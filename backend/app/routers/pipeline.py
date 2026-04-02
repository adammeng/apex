"""泳道路由。"""

from typing import List, Optional

from fastapi import APIRouter, Query
from fastapi.responses import Response
from pydantic import BaseModel

from ..core.redis_client import cache_get, cache_set, make_cache_key
from ..schemas.response import ApiResponse
from ..services.analysis import compute_pipeline, fetch_filtered_records
from ..services.excel_export import (
    build_excel_bytes,
    build_export_filename,
    build_pipeline_export_rows,
)

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
async def pipeline_export(
    disease: str,
    targets: Optional[List[str]] = Query(default=None),
    include_combo: bool = True,
):
    records = fetch_filtered_records(diseases=[disease], require_targets=True)
    rows = build_pipeline_export_rows(
        records,
        selected_targets=targets,
        include_combo=include_combo,
    )
    content = build_excel_bytes(rows)
    filename = build_export_filename("swimlane")
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(
        content=content,
        headers=headers,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
