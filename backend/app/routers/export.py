"""
导出路由 — Excel 导出任务管理
"""

from fastapi import APIRouter

from ..schemas.response import ApiResponse

router = APIRouter(prefix="/export", tags=["导出"])


@router.get("/jobs", summary="导出任务列表")
async def list_export_jobs():
    """返回当前用户的历史导出记录。"""
    # TODO: 查询 export_jobs 表
    return ApiResponse.ok(data={"jobs": [], "msg": "TODO: 导出任务列表待实现"})


@router.get("/jobs/{job_id}/download", summary="下载导出文件")
async def download_export(job_id: int):
    """根据 job_id 下载已生成的 Excel 文件。"""
    # TODO: 校验用户权限，返回文件
    return ApiResponse.ok(data={"job_id": job_id, "msg": "TODO: 文件下载待实现"})
