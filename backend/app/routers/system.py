"""
系统路由 — 健康检查、数据同步状态
"""

from datetime import datetime

from fastapi import APIRouter

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
    # TODO: 查询 data_versions / sync_jobs 表
    return ApiResponse.ok(
        data={
            "latest_version": None,
            "last_sync_at": None,
            "status": "pending",
            "msg": "TODO: 数据同步状态查询待实现",
        }
    )
