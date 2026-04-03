"""
OSS 数据同步任务
- 从阿里云 OSS 下载最新 parquet 文件，覆盖写入 backend/parquet/
- 下载完成后热更新 DuckDB 连接 + 清除 Redis 缓存
- 写入同步记录到 MySQL sync_jobs 表
"""

import asyncio
import hashlib
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

from ..core.config import get_settings
from ..core.logging import get_logger

logger = get_logger(__name__)
_SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")

_PARQUET_ATTRS = [
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


def _parquet_ready(settings) -> bool:
    """检查 parquet 目录下三个文件是否都存在。"""
    return all(
        (settings.parquet_path / getattr(settings, attr)).exists()
        for attr in _PARQUET_ATTRS
    )


def _download_from_oss(tmp_dir: Path) -> dict[str, str]:
    """
    同步下载 OSS 上的三个 parquet 文件到临时目录。
    返回 {文件名: md5} 字典。
    """
    import oss2  # type: ignore

    settings = get_settings()
    if not settings.oss_access_key_id or not settings.oss_access_key_secret:
        raise RuntimeError(
            "OSS 凭据未配置（OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET）"
        )

    auth = oss2.Auth(settings.oss_access_key_id, settings.oss_access_key_secret)
    bucket = oss2.Bucket(auth, settings.oss_endpoint, settings.oss_bucket_name)

    tmp_dir.mkdir(parents=True, exist_ok=True)
    md5_map: dict[str, str] = {}

    for attr in _PARQUET_ATTRS:
        filename: str = getattr(settings, attr)
        oss_key = f"{settings.oss_prefix}/{filename}".lstrip("/")
        local_path = tmp_dir / filename

        logger.info(f"OSS 下载: {oss_key} → {local_path}")
        bucket.get_object_to_file(oss_key, str(local_path))

        md5_map[filename] = _md5_file(local_path)
        logger.info(f"  {filename} md5={md5_map[filename]}")

    return md5_map


def _atomic_replace_parquet(tmp_dir: Path, target_dir: Path) -> None:
    """
    将临时目录中的文件逐一原子替换到目标目录。
    策略：先写 .tmp 再 os.replace，单文件级别原子性。
    """
    target_dir.mkdir(parents=True, exist_ok=True)
    for tmp_file in tmp_dir.iterdir():
        dst = target_dir / tmp_file.name
        tmp_dst = target_dir / (tmp_file.name + ".tmp")
        shutil.copy2(str(tmp_file), str(tmp_dst))
        os.replace(str(tmp_dst), str(dst))
        logger.info(f"  写入 {dst.name}")


async def _create_sync_record(
    version: str,
    status: str = "running",
) -> Optional[int]:
    """创建一条同步记录并返回主键 id。失败仅记录日志，不抛出异常。"""
    try:
        import sqlalchemy as sa
        from sqlalchemy.ext.asyncio import create_async_engine

        settings = get_settings()
        engine = create_async_engine(settings.mysql_dsn, pool_pre_ping=True)
        now = datetime.now(timezone.utc)

        async with engine.begin() as conn:
            result = await conn.execute(
                sa.text("""
                    INSERT INTO sync_jobs
                        (version, status, md5_map, error_msg, created_at, updated_at)
                    VALUES
                        (:version, :status, :md5_map, :error_msg, :now, :now)
                """),
                {
                    "version": version,
                    "status": status,
                    "md5_map": "{}",
                    "error_msg": None,
                    "now": now,
                },
            )
        await engine.dispose()
        record_id = result.lastrowid
        logger.info(
            f"同步记录已创建 id={record_id} version={version} status={status}"
        )
        return int(record_id) if record_id is not None else None
    except Exception as e:
        logger.warning(f"创建同步记录失败（不影响主流程）: {e}")
        return None


async def _finish_sync_record(
    record_id: Optional[int],
    status: str,
    md5_map: Optional[dict[str, str]] = None,
    error_msg: Optional[str] = None,
) -> None:
    """更新同步记录状态。失败仅记录日志，不抛出异常。"""
    if record_id is None:
        return

    try:
        import json

        import sqlalchemy as sa
        from sqlalchemy.ext.asyncio import create_async_engine

        settings = get_settings()
        engine = create_async_engine(settings.mysql_dsn, pool_pre_ping=True)
        now = datetime.now(timezone.utc)

        async with engine.begin() as conn:
            await conn.execute(
                sa.text("""
                    UPDATE sync_jobs
                    SET status = :status,
                        md5_map = :md5_map,
                        error_msg = :error_msg,
                        updated_at = :now
                    WHERE id = :record_id
                """),
                {
                    "record_id": record_id,
                    "status": status,
                    "md5_map": json.dumps(md5_map or {}, ensure_ascii=False),
                    "error_msg": error_msg,
                    "now": now,
                },
            )
        await engine.dispose()
        logger.info(f"同步记录已更新 id={record_id} status={status}")
    except Exception as e:
        logger.warning(f"更新同步记录失败（不影响主流程）: {e}")


async def run_sync(force: bool = False) -> dict:
    """
    执行完整的 OSS → backend/parquet/ 覆盖 → DuckDB 热更新流程。

    Args:
        force: 即使文件已存在也强制重新下载

    Returns:
        {"status": "success"|"failed"|"skipped", "msg": ...}
    """
    settings = get_settings()
    version = datetime.now(_SHANGHAI_TZ).strftime("%Y%m%d")

    # 有文件且不强制 → 跳过（本地开发常态）
    if not force and _parquet_ready(settings):
        logger.info("parquet 文件已就绪，跳过 OSS 下载")
        return {"status": "skipped", "msg": "文件已存在，跳过下载"}

    logger.info(f"开始 OSS 数据同步 version={version}")
    record_id = await _create_sync_record(version, "running")

    tmp_dir = settings.parquet_path.parent / ".parquet_tmp"
    try:
        # 在线程池中执行同步 IO（oss2 是同步库）
        loop = asyncio.get_event_loop()
        md5_map = await loop.run_in_executor(None, _download_from_oss, tmp_dir)

        # 原子替换到 backend/parquet/
        _atomic_replace_parquet(tmp_dir, settings.parquet_path)

        # 热更新 DuckDB
        from ..core.duckdb_conn import reload_conn

        reload_conn()

        # 清理 Redis 缓存
        try:
            from ..core.redis_client import cache_flush_pattern

            deleted = await cache_flush_pattern("apex:*")
            logger.info(f"Redis 缓存已清理，删除 {deleted} 个 key")
        except Exception as e:
            logger.warning(f"Redis 缓存清理失败: {e}")

        await _finish_sync_record(record_id, "success", md5_map)
        logger.info("OSS 数据同步完成")
        return {"status": "success", "msg": "同步完成"}

    except Exception as e:
        error_msg = str(e)
        logger.error(f"OSS 数据同步失败: {error_msg}", exc_info=True)
        await _finish_sync_record(record_id, "failed", error_msg=error_msg)
        return {"status": "failed", "msg": error_msg}

    finally:
        # 清理临时目录
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)
