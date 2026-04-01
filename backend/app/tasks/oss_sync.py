"""
OSS 数据同步任务
- 从阿里云 OSS 下载最新 parquet 文件到 data/raw/<yyyymmdd>/
- 下载完成后原子切换 parquet_dir 软链 + 热更新 DuckDB 连接
- 写入同步记录到 MySQL sync_jobs / data_versions 表
"""

import asyncio
import hashlib
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ..core.config import get_settings
from ..core.logging import get_logger

logger = get_logger(__name__)

# parquet 文件名列表（顺序固定，与 config 保持一致）
_PARQUET_FILES = [
    "parquet_ci_tracking",
    "parquet_clinical_detail",
    "parquet_drug_pipeline",
]


def _md5_file(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _download_from_oss(version_dir: Path) -> dict[str, str]:
    """
    同步下载 OSS 上的三个 parquet 文件到 version_dir。
    返回 {文件名: md5} 字典。
    若 oss2 未安装或凭据为空则抛出 RuntimeError。
    """
    import oss2  # type: ignore

    settings = get_settings()
    if not settings.oss_access_key_id or not settings.oss_access_key_secret:
        raise RuntimeError(
            "OSS 凭据未配置（OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET）"
        )

    auth = oss2.Auth(settings.oss_access_key_id, settings.oss_access_key_secret)
    bucket = oss2.Bucket(auth, settings.oss_endpoint, settings.oss_bucket_name)

    version_dir.mkdir(parents=True, exist_ok=True)
    md5_map: dict[str, str] = {}

    for attr in _PARQUET_FILES:
        filename: str = getattr(settings, attr)
        oss_key = f"{settings.oss_prefix}/{filename}".lstrip("/")
        local_path = version_dir / filename

        logger.info(f"OSS 下载: {oss_key} → {local_path}")
        bucket.get_object_to_file(oss_key, str(local_path))

        md5_map[filename] = _md5_file(local_path)
        logger.info(f"  md5={md5_map[filename]}")

    return md5_map


def _atomic_switch_parquet_dir(new_dir: Path) -> None:
    """
    将 data/parquet_current 软链原子切换到 new_dir。
    并更新 settings.parquet_dir（运行时生效，不修改 .env）。
    """
    settings = get_settings()
    link_path = settings.data_path / "parquet_current"
    tmp_link = settings.data_path / "parquet_current.tmp"

    # 使用临时链接 + rename 保证原子性
    if tmp_link.exists() or tmp_link.is_symlink():
        tmp_link.unlink()
    os.symlink(str(new_dir.resolve()), str(tmp_link))
    os.replace(str(tmp_link), str(link_path))

    logger.info(f"parquet_current 软链已切换 → {new_dir}")


async def _write_sync_record(
    version: str,
    status: str,
    md5_map: Optional[dict[str, str]] = None,
    error_msg: Optional[str] = None,
) -> None:
    """
    将同步结果写入 MySQL sync_jobs 和 data_versions 表。
    若数据库不可用则仅记录日志，不抛出异常。
    """
    try:
        import json

        import sqlalchemy as sa
        from sqlalchemy.ext.asyncio import create_async_engine

        settings = get_settings()
        engine = create_async_engine(settings.mysql_dsn, pool_pre_ping=True)

        now = datetime.now(timezone.utc)
        async with engine.begin() as conn:
            # sync_jobs 表
            await conn.execute(
                sa.text("""
                    INSERT INTO sync_jobs
                        (version, status, md5_map, error_msg, created_at, updated_at)
                    VALUES
                        (:version, :status, :md5_map, :error_msg, :now, :now)
                    ON DUPLICATE KEY UPDATE
                        status=VALUES(status),
                        md5_map=VALUES(md5_map),
                        error_msg=VALUES(error_msg),
                        updated_at=VALUES(updated_at)
                """),
                {
                    "version": version,
                    "status": status,
                    "md5_map": json.dumps(md5_map or {}, ensure_ascii=False),
                    "error_msg": error_msg,
                    "now": now,
                },
            )

            if status == "success":
                # data_versions 表：记录可用版本
                await conn.execute(
                    sa.text("""
                        INSERT IGNORE INTO data_versions
                            (version, parquet_dir, md5_map, created_at)
                        VALUES
                            (:version, :parquet_dir, :md5_map, :now)
                    """),
                    {
                        "version": version,
                        "parquet_dir": str(settings.data_path / "raw" / version),
                        "md5_map": json.dumps(md5_map or {}, ensure_ascii=False),
                        "now": now,
                    },
                )

        await engine.dispose()
        logger.info(f"同步记录已写入 MySQL version={version} status={status}")

    except Exception as e:
        logger.warning(f"写入同步记录失败（不影响主流程）: {e}")


async def run_sync(force: bool = False) -> dict:
    """
    执行完整的 OSS → 本地 → DuckDB 热更新同步流程。

    Args:
        force: 即使今日版本已存在也强制重新下载

    Returns:
        {"version": ..., "status": "success"|"failed", "msg": ...}
    """
    settings = get_settings()
    version = datetime.now(timezone.utc).strftime("%Y%m%d")
    version_dir = settings.raw_data_dir / version

    # 检查今日版本是否已存在
    if version_dir.exists() and not force:
        # 验证文件完整性
        all_exist = all(
            (version_dir / getattr(settings, attr)).exists() for attr in _PARQUET_FILES
        )
        if all_exist:
            logger.info(f"今日版本 {version} 已存在，跳过下载")
            return {"version": version, "status": "skipped", "msg": "今日版本已存在"}

    logger.info(f"开始 OSS 数据同步，version={version}")
    await _write_sync_record(version, "running")

    try:
        # 在线程池中执行同步 IO（oss2 是同步库）
        loop = asyncio.get_event_loop()
        md5_map = await loop.run_in_executor(None, _download_from_oss, version_dir)

        # 原子切换软链
        _atomic_switch_parquet_dir(version_dir)

        # 热更新 DuckDB（先更新 settings 的 parquet_dir 指向新版本）
        # settings 是 lru_cache 单例，通过直接修改属性来更新运行时路径
        # 注意：这不会持久化到 .env，仅影响当前进程
        object.__setattr__(settings, "parquet_dir", str(version_dir))

        from ..core.duckdb_conn import reload_conn

        reload_conn()

        # 清理 Redis 缓存（数据已更新）
        try:
            from ..core.redis_client import cache_flush_pattern

            deleted = await cache_flush_pattern("apex:*")
            logger.info(f"Redis 缓存已清理，删除 {deleted} 个 key")
        except Exception as e:
            logger.warning(f"Redis 缓存清理失败: {e}")

        await _write_sync_record(version, "success", md5_map)

        # 清理超过 7 天的旧版本目录
        _cleanup_old_versions(settings.raw_data_dir, keep=7)

        logger.info(f"OSS 数据同步完成，version={version}")
        return {"version": version, "status": "success", "msg": "同步完成"}

    except Exception as e:
        error_msg = str(e)
        logger.error(f"OSS 数据同步失败: {error_msg}", exc_info=True)
        # 清理失败的不完整目录
        if version_dir.exists():
            shutil.rmtree(version_dir, ignore_errors=True)
        await _write_sync_record(version, "failed", error_msg=error_msg)
        return {"version": version, "status": "failed", "msg": error_msg}


def _cleanup_old_versions(raw_dir: Path, keep: int = 7) -> None:
    """保留最近 keep 个版本目录，删除更旧的。"""
    try:
        dirs = sorted(
            [d for d in raw_dir.iterdir() if d.is_dir() and d.name.isdigit()],
            key=lambda d: d.name,
            reverse=True,
        )
        for old_dir in dirs[keep:]:
            shutil.rmtree(old_dir, ignore_errors=True)
            logger.info(f"清理旧版本: {old_dir.name}")
    except Exception as e:
        logger.warning(f"旧版本清理失败: {e}")
