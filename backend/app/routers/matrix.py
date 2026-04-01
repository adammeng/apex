"""
矩阵路由 — 靶点竞争矩阵查询、tooltip、导出
"""

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..core.duckdb_conn import get_conn
from ..core.redis_client import cache_get, cache_set, make_cache_key
from ..schemas.response import ApiResponse

router = APIRouter(prefix="/matrix", tags=["竞争矩阵"])


class MatrixQueryParams(BaseModel):
    diseases: Optional[List[str]] = None  # 适应症过滤
    ta: Optional[str] = None  # 治疗领域过滤
    min_stage_score: Optional[float] = None  # 最低阶段分值
    targets: Optional[List[str]] = None  # 指定靶点（为空则取 top N）
    top_n: int = 20  # 返回靶点数


class TooltipParams(BaseModel):
    row_target: str
    col_target: str
    diseases: Optional[List[str]] = None
    ta: Optional[str] = None


@router.post("/query", summary="矩阵查询")
async def matrix_query(params: MatrixQueryParams):
    """
    返回靶点竞争矩阵数据。
    缓存 key 基于请求参数的 MD5。
    """
    cache_key = make_cache_key("matrix", params.model_dump())
    cached = await cache_get(cache_key)
    if cached:
        return ApiResponse.ok(data=cached)

    # TODO: 实现完整矩阵查询逻辑（参考架构文档 9.2）
    result = {
        "targets": [],
        "single_max": {},
        "cells": [],
        "legend": [],
        "data_version": None,
        "msg": "TODO: 矩阵查询逻辑待实现",
    }

    await cache_set(cache_key, result)
    return ApiResponse.ok(data=result)


@router.post("/tooltip", summary="矩阵 Tooltip 详情")
async def matrix_tooltip(params: TooltipParams):
    """
    返回矩阵特定单元格的药物明细。
    """
    cache_key = make_cache_key("matrix_tooltip", params.model_dump())
    cached = await cache_get(cache_key)
    if cached:
        return ApiResponse.ok(data=cached)

    # TODO: 实现 tooltip 查询逻辑（参考架构文档 9.3）
    result = {
        "row_target": params.row_target,
        "col_target": params.col_target,
        "drugs": [],
        "msg": "TODO: Tooltip 查询逻辑待实现",
    }

    await cache_set(cache_key, result)
    return ApiResponse.ok(data=result)


@router.get("/export", summary="矩阵结果导出（Excel）")
async def matrix_export():
    """
    导出当前矩阵筛选结果为 Excel。
    """
    # TODO: 实现导出逻辑（参考架构文档 9.5）
    return ApiResponse.ok(data={"msg": "TODO: 矩阵导出待实现"})
