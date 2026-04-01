"""
元数据路由 — 疾病树、靶点列表、阶段枚举
"""

from fastapi import APIRouter, Query

from ..core.duckdb_conn import get_conn
from ..schemas.response import ApiResponse

router = APIRouter(prefix="/meta", tags=["元数据"])


@router.get("/disease-tree", summary="疾病树（TA -> 适应症）")
async def disease_tree():
    """
    返回两级树结构：治疗领域(ta) -> 疾病(harbour_indication_name)。
    """
    conn = get_conn()
    rows = conn.execute("""
        SELECT
            COALESCE(ta, '未分类') AS ta,
            COALESCE(harbour_indication_name, '未知') AS disease,
            COUNT(DISTINCT drug_id) AS drug_count
        FROM latest_records
        WHERE ta IS NOT NULL AND harbour_indication_name IS NOT NULL
        GROUP BY ta, harbour_indication_name
        ORDER BY ta, disease
    """).fetchall()

    # 组装树
    tree: dict = {}
    for ta, disease, count in rows:
        if ta not in tree:
            tree[ta] = {"ta": ta, "children": []}
        tree[ta]["children"].append({"name": disease, "drug_count": count})

    return ApiResponse.ok(data=list(tree.values()))


@router.get("/targets", summary="靶点列表")
async def targets(disease: str = Query(None, description="按适应症过滤")):
    """
    返回靶点列表，按首字母分组。
    可选 disease 参数过滤特定适应症下的靶点。
    """
    conn = get_conn()
    where_clause = "WHERE targets IS NOT NULL AND TRIM(targets) != ''"
    if disease:
        where_clause += (
            f" AND harbour_indication_name = '{disease.replace(chr(39), '')}'"
        )

    rows = conn.execute(f"""
        SELECT DISTINCT
            TRIM(t.target) AS target
        FROM latest_records,
        UNNEST(STRING_SPLIT(targets, ',')) AS t(target)
        {where_clause.replace("WHERE targets", "WHERE t.target")}
        ORDER BY target
    """).fetchall()

    targets_list = [r[0] for r in rows if r[0]]
    return ApiResponse.ok(data={"targets": targets_list, "total": len(targets_list)})


@router.get("/stages", summary="阶段枚举")
async def stages():
    """返回阶段映射表：原值、score、矩阵显示名、泳道图显示名。"""
    stage_map = [
        {"value": "临床前", "score": 0.1, "matrix": "PreClinical", "pipeline": "PreC"},
        {"value": "申报临床", "score": 0.5, "matrix": "IND", "pipeline": "IND"},
        {"value": "I期临床", "score": 1.0, "matrix": "Phase I", "pipeline": "Phase 1"},
        {
            "value": "I/II期临床",
            "score": 1.5,
            "matrix": "Phase I/II",
            "pipeline": "Phase 1",
        },
        {
            "value": "II期临床",
            "score": 2.0,
            "matrix": "Phase II",
            "pipeline": "Phase 2",
        },
        {
            "value": "II/III期临床",
            "score": 2.5,
            "matrix": "Phase II/III",
            "pipeline": "Phase 2",
        },
        {
            "value": "III期临床",
            "score": 3.0,
            "matrix": "Phase III",
            "pipeline": "Phase 3",
        },
        {"value": "申请上市", "score": 3.5, "matrix": "BLA", "pipeline": "BLA"},
        {"value": "批准上市", "score": 4.0, "matrix": "Approved", "pipeline": "Market"},
    ]
    return ApiResponse.ok(data=stage_map)
