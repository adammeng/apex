"""泳道路由。"""

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..core.redis_client import cache_get, cache_set, make_cache_key
from ..schemas.response import ApiResponse
from ..services.analysis import compute_pipeline, fetch_filtered_records

router = APIRouter(prefix="/pipeline", tags=["泳道图"])


class PipelineQueryParams(BaseModel):
    disease: str
    targets: Optional[List[str]] = None
    include_combo: bool = True


@router.post("/query", summary="泳道图查询")
async def pipeline_query(params: PipelineQueryParams):
    cache_key = make_cache_key("pipeline", params.model_dump(exclude_none=True))
    cached = await cache_get(cache_key)
    if cached:
        return ApiResponse.ok(data=cached)

    records = fetch_filtered_records(diseases=[params.disease], require_targets=True)
    result = compute_pipeline(
        records,
        disease=params.disease,
        selected_targets=params.targets,
        include_combo=params.include_combo,
    )

    await cache_set(cache_key, result)
    return ApiResponse.ok(data=result)


@router.get("/export", summary="泳道图导出（Excel）")
async def pipeline_export():
    return ApiResponse.ok(data={"msg": "TODO: 泳道图导出待实现"})
