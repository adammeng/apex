"""
泳道图路由 — 药物研发进展泳道图查询与导出
"""

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..core.duckdb_conn import get_conn
from ..core.redis_client import cache_get, cache_set, make_cache_key
from ..schemas.response import ApiResponse

router = APIRouter(prefix="/pipeline", tags=["泳道图"])


class PipelineQueryParams(BaseModel):
    disease: str  # 必须指定单个适应症
    targets: Optional[List[str]] = None  # 靶点过滤
    include_combo: bool = True  # 是否包含组合靶点


@router.post("/query", summary="泳道图查询")
async def pipeline_query(params: PipelineQueryParams):
    """
    返回指定适应症下的药物研发进展泳道图数据。
    泳道列固定为 7 个阶段：PreC / IND / Phase 1 / Phase 2 / Phase 3 / BLA / Market
    """
    cache_key = make_cache_key("pipeline", params.model_dump())
    cached = await cache_get(cache_key)
    if cached:
        return ApiResponse.ok(data=cached)

    # TODO: 实现泳道图查询逻辑（参考架构文档 9.4）
    lanes = ["PreC", "IND", "Phase 1", "Phase 2", "Phase 3", "BLA", "Market"]
    result = {
        "disease": params.disease,
        "lanes": lanes,
        "rows": [],  # 每行一个靶点，每格是药物列表
        "data_version": None,
        "msg": "TODO: 泳道图查询逻辑待实现",
    }

    await cache_set(cache_key, result)
    return ApiResponse.ok(data=result)


@router.get("/export", summary="泳道图导出（Excel）")
async def pipeline_export():
    """
    导出当前泳道图筛选结果为 Excel。
    """
    # TODO: 实现导出逻辑
    return ApiResponse.ok(data={"msg": "TODO: 泳道图导出待实现"})
