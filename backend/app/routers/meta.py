"""元数据路由。"""

from typing import Optional

from fastapi import APIRouter, Query

from ..schemas.response import ApiResponse
from ..services.analysis import (
    get_disease_tree_data,
    get_filter_dictionaries,
    get_stage_items,
    get_targets_data,
)

router = APIRouter(prefix="/meta", tags=["元数据"])


@router.get("/disease-tree", summary="疾病树（TA -> 适应症）")
async def disease_tree():
    return ApiResponse.ok(data=get_disease_tree_data())


@router.get("/targets", summary="靶点列表")
async def targets(disease: Optional[str] = Query(None, description="按适应症过滤")):
    return ApiResponse.ok(data=get_targets_data(disease))


@router.get("/stages", summary="阶段枚举")
async def stages():
    return ApiResponse.ok(data=get_stage_items())


@router.get("/dictionaries", summary="分析模块筛选字典")
async def dictionaries():
    return ApiResponse.ok(data=get_filter_dictionaries())
