"""
OSS 数据同步任务
- 从阿里云 OSS 下载最新 parquet 文件，写入 backend/parquet/
- 同时归档到 backend/parquet/YYYYMMDD/ 保留历史快照（对应 data_versions 表）
- 下载完成后热更新 DuckDB 连接 + 清除 Redis 缓存
- 写入同步记录到 MySQL sync_jobs 表，写入版本记录到 MySQL data_versions 表
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


def _archive_and_replace_parquet(
    tmp_dir: Path, target_dir: Path, version: str
) -> Optional[Path]:
    """
    将临时目录中的文件：
    1. 若当天归档目录不存在，复制到 target_dir/YYYYMMDD/（历史快照）
       若已存在（同天重复同步），跳过归档步骤
    2. 原子替换到 target_dir/ 根目录（DuckDB 实际读取路径）

    Returns:
        archive_dir: 归档目录绝对路径；同天跳过归档时返回 None
    """
    archive_dir = target_dir / version
    already_archived = archive_dir.exists()
    if already_archived:
        logger.info(
            f"归档目录 {archive_dir.name}/ 已存在，跳过归档步骤（同天重复同步）"
        )
    else:
        archive_dir.mkdir(parents=True, exist_ok=True)

    target_dir.mkdir(parents=True, exist_ok=True)

    for tmp_file in tmp_dir.iterdir():
        # 1. 写入归档目录（仅首次）
        if not already_archived:
            shutil.copy2(str(tmp_file), str(archive_dir / tmp_file.name))

        # 2. 原子替换到根目录（先写 .tmp 再 os.replace，单文件级别原子）
        tmp_dst = target_dir / (tmp_file.name + ".tmp")
        shutil.copy2(str(tmp_file), str(tmp_dst))
        os.replace(str(tmp_dst), str(target_dir / tmp_file.name))

        suffix = f"（已归档至 {archive_dir.name}/）" if not already_archived else ""
        logger.info(f"  写入 {tmp_file.name}{suffix}")

    return None if already_archived else archive_dir


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
        logger.info(f"同步记录已创建 id={record_id} version={version} status={status}")
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


def _cleanup_old_archives(parquet_dir: Path, keep_days: int) -> None:
    """
    删除 parquet_dir 下超过 keep_days 天的归档子目录（名称格式 YYYYMMDD）。
    只处理纯数字8位目录名，避免误删其他目录。
    失败仅记录日志，不抛出异常。
    """
    try:
        cutoff = datetime.now(_SHANGHAI_TZ).strftime("%Y%m%d")
        # 收集所有合法归档目录并按版本号排序
        archives = sorted(
            [
                d
                for d in parquet_dir.iterdir()
                if d.is_dir() and d.name.isdigit() and len(d.name) == 8
            ],
            key=lambda d: d.name,
        )
        # 保留最新 keep_days 个，删除更早的
        to_delete = archives[: max(0, len(archives) - keep_days)]
        for old_dir in to_delete:
            shutil.rmtree(str(old_dir), ignore_errors=True)
            logger.info(f"已删除过期归档目录: {old_dir.name}/")
        if not to_delete:
            logger.info(f"归档目录数 {len(archives)} ≤ {keep_days}，无需清理")
    except Exception as e:
        logger.warning(f"清理旧归档失败（不影响主流程）: {e}")


async def _write_data_version(
    version: str,
    parquet_dir: Path,
    md5_map: Optional[dict],
) -> None:
    """
    写入或更新 data_versions 表中的版本记录。
    - 新 version：INSERT
    - 同天重复同步（version 已存在）：UPDATE md5_map（归档目录不变）
    失败仅记录日志，不抛出异常。
    """
    try:
        import json

        import sqlalchemy as sa
        from sqlalchemy.ext.asyncio import create_async_engine

        settings = get_settings()
        engine = create_async_engine(settings.mysql_dsn, pool_pre_ping=True)
        now_utc = datetime.now(timezone.utc)
        md5_json = json.dumps(md5_map or {}, ensure_ascii=False)

        async with engine.begin() as conn:
            await conn.execute(
                sa.text("""
                    INSERT INTO data_versions
                        (version, parquet_dir, md5_map, created_at)
                    VALUES
                        (:version, :parquet_dir, :md5_map, :created_at)
                    ON DUPLICATE KEY UPDATE
                        md5_map = VALUES(md5_map)
                """),
                {
                    "version": version,
                    "parquet_dir": str(parquet_dir.resolve()),
                    "md5_map": md5_json,
                    "created_at": now_utc,
                },
            )
        await engine.dispose()
        logger.info(f"data_versions 已写入/更新 version={version}")
    except Exception as e:
        logger.warning(f"写入 data_versions 失败（不影响主流程）: {e}")


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

        # 归档到 parquet/YYYYMMDD/ 并原子替换 backend/parquet/ 根目录
        archive_dir = _archive_and_replace_parquet(
            tmp_dir, settings.parquet_path, version
        )

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

        # 写入/更新 data_versions 记录
        # archive_dir 为 None 表示同天重复同步跳过了归档，此时用已有归档目录路径
        effective_archive_dir = (
            archive_dir if archive_dir is not None else settings.parquet_path / version
        )
        await _write_data_version(version, effective_archive_dir, md5_map)

        # 清理超过 keep_days 天的旧归档目录
        _cleanup_old_archives(settings.parquet_path, settings.parquet_archive_keep_days)

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
