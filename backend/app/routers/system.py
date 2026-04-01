"""
系统路由 — 健康检查、数据同步状态、手动触发同步
"""

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException

from ..core.config import get_settings
from ..schemas.response import ApiResponse

router = APIRouter(prefix="/system", tags=["系统"])


@router.get("/health", summary="健康检查")
async def health():
    """返回服务健康状态，用于 Docker 健康探针。"""
    settings = get_settings()
    return ApiResponse.ok(
        data={
            "status": "ok",
            "app_name": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )


@router.get("/sync-status", summary="数据同步状态")
async def sync_status():
    """返回最近一次数据同步的状态与版本信息。"""
    settings = get_settings()

    # 优先从 MySQL 查询最新同步记录
    latest_job = None
    latest_version = None
    try:
        import sqlalchemy as sa
        from sqlalchemy.ext.asyncio import create_async_engine

        engine = create_async_engine(settings.mysql_dsn, pool_pre_ping=True)
        async with engine.connect() as conn:
            row = await conn.execute(
                sa.text("""
                    SELECT version, status, error_msg, created_at, updated_at
                    FROM sync_jobs
                    ORDER BY created_at DESC
                    LIMIT 1
                """)
            )
            job = row.fetchone()
            if job:
                latest_job = {
                    "version": job.version,
                    "status": job.status,
                    "error_msg": job.error_msg,
                    "started_at": job.created_at.isoformat()
                    if job.created_at
                    else None,
                    "updated_at": job.updated_at.isoformat()
                    if job.updated_at
                    else None,
                }

            row2 = await conn.execute(
                sa.text("""
                    SELECT version, parquet_dir, created_at
                    FROM data_versions
                    ORDER BY version DESC
                    LIMIT 1
                """)
            )
            ver = row2.fetchone()
            if ver:
                latest_version = {
                    "version": ver.version,
                    "parquet_dir": ver.parquet_dir,
                    "synced_at": ver.created_at.isoformat() if ver.created_at else None,
                }
        await engine.dispose()
    except Exception as e:
        # 数据库不可用时降级：从本地文件系统读取
        latest_job = {"status": "db_unavailable", "msg": str(e)}
        latest_version = _get_version_from_fs(settings)

    # 当前 DuckDB 实际使用的 parquet 路径
    current_parquet_dir = str(settings.parquet_path)

    return ApiResponse.ok(
        data={
            "current_parquet_dir": current_parquet_dir,
            "latest_version": latest_version,
            "latest_sync_job": latest_job,
            "next_sync": _get_next_sync_time(settings),
        }
    )


@router.post("/sync", summary="手动触发 OSS 数据同步")
async def trigger_sync(background_tasks: BackgroundTasks, force: bool = False):
    """
    手动触发一次 OSS 数据同步，在后台异步执行。
    force=true 时即使今日版本已存在也强制重新下载。
    """
    from ..tasks.oss_sync import run_sync

    background_tasks.add_task(run_sync, force=force)
    return ApiResponse.ok(
        data={"msg": "同步任务已提交，请稍后通过 /sync-status 查询结果"}
    )


def _get_version_from_fs(settings) -> Optional[dict]:
    """从本地文件系统推断最新可用版本（数据库不可用时降级使用）。"""
    try:
        raw_dir = settings.raw_data_dir
        if not raw_dir.exists():
            return None
        dirs = sorted(
            [d.name for d in raw_dir.iterdir() if d.is_dir() and d.name.isdigit()],
            reverse=True,
        )
        if dirs:
            return {"version": dirs[0], "source": "filesystem"}
        return None
    except Exception:
        return None


def _get_next_sync_time(settings) -> str:
    """计算下次定时同步的时间字符串。"""
    try:
        from ..tasks.scheduler import get_scheduler

        scheduler = get_scheduler()
        job = scheduler.get_job("oss_daily_sync")
        if job and job.next_run_time:
            return job.next_run_time.isoformat()
    except Exception:
        pass
    return f"每日 {settings.sync_hour:02d}:{settings.sync_minute:02d} (Asia/Shanghai)"
