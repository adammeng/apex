"""矩阵路由。"""

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..core.redis_client import cache_get, cache_set, make_cache_key
from ..schemas.response import ApiResponse
from ..services.analysis import (
    STAGE_ITEMS,
    compute_matrix,
    compute_tooltip,
    fetch_filtered_records,
)

router = APIRouter(prefix="/matrix", tags=["竞争矩阵"])


class MatrixQueryParams(BaseModel):
    diseases: Optional[List[str]] = None
    ta: Optional[str] = None
    stages: Optional[List[str]] = None
    min_stage_score: Optional[float] = None
    targets: Optional[List[str]] = None
    top_n: Optional[int] = None
    hide_no_combo: bool = False


class TooltipParams(BaseModel):
    row_target: str
    col_target: str
    diseases: Optional[List[str]] = None
    ta: Optional[str] = None
    stages: Optional[List[str]] = None
    min_stage_score: Optional[float] = None


def normalize_stage_filter(
    stages: Optional[List[str]], min_stage_score: Optional[float]
) -> Optional[List[str]]:
    if stages:
        return stages
    if min_stage_score is None:
        return None
    return [item["value"] for item in STAGE_ITEMS if item["score"] >= min_stage_score]


@router.post("/query", summary="矩阵查询")
async def matrix_query(params: MatrixQueryParams):
    stage_filter = normalize_stage_filter(params.stages, params.min_stage_score)
    cache_payload = params.model_dump(exclude_none=True)
    cache_payload["stages"] = stage_filter
    cache_key = make_cache_key("matrix", cache_payload)
    cached = await cache_get(cache_key)
    if cached:
        return ApiResponse.ok(data=cached)

    records = fetch_filtered_records(
        diseases=params.diseases,
        ta=params.ta,
        stages=stage_filter,
        require_targets=True,
    )
    result = compute_matrix(
        records,
        selected_targets=params.targets,
        top_n=params.top_n,
        hide_no_combo=params.hide_no_combo,
    )

    await cache_set(cache_key, result)
    return ApiResponse.ok(data=result)


@router.post("/tooltip", summary="矩阵 Tooltip 详情")
async def matrix_tooltip(params: TooltipParams):
    stage_filter = normalize_stage_filter(params.stages, params.min_stage_score)
    cache_payload = params.model_dump(exclude_none=True)
    cache_payload["stages"] = stage_filter
    cache_key = make_cache_key("matrix_tooltip", cache_payload)
    cached = await cache_get(cache_key)
    if cached:
        return ApiResponse.ok(data=cached)

    records = fetch_filtered_records(
        diseases=params.diseases,
        ta=params.ta,
        stages=stage_filter,
        require_targets=True,
    )
    result = compute_tooltip(records, params.row_target, params.col_target)

    await cache_set(cache_key, result)
    return ApiResponse.ok(data=result)


@router.get("/export", summary="矩阵结果导出（Excel）")
async def matrix_export():
    return ApiResponse.ok(data={"msg": "TODO: 矩阵导出待实现"})
