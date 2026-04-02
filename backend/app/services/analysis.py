from __future__ import annotations

from collections import defaultdict
from itertools import combinations
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from ..core.duckdb_conn import get_cursor

STAGE_ITEMS = [
    {"value": "临床前", "score": 0.1, "matrix": "PreClinical", "pipeline": "PreC"},
    {"value": "申报临床", "score": 0.5, "matrix": "IND", "pipeline": "IND"},
    {"value": "I期临床", "score": 1.0, "matrix": "Phase I", "pipeline": "Phase 1"},
    {"value": "I/II期临床", "score": 1.5, "matrix": "Phase I/II", "pipeline": "Phase 1"},
    {"value": "II期临床", "score": 2.0, "matrix": "Phase II", "pipeline": "Phase 2"},
    {"value": "II/III期临床", "score": 2.5, "matrix": "Phase II/III", "pipeline": "Phase 2"},
    {"value": "III期临床", "score": 3.0, "matrix": "Phase III", "pipeline": "Phase 3"},
    {"value": "申请上市", "score": 3.5, "matrix": "BLA", "pipeline": "BLA"},
    {"value": "批准上市", "score": 4.0, "matrix": "Approved", "pipeline": "Market"},
]

STAGE_SCORE_MAP = {item["value"]: item["score"] for item in STAGE_ITEMS}
MATRIX_STAGE_MAP = {item["value"]: item["matrix"] for item in STAGE_ITEMS}
PIPELINE_STAGE_MAP = {item["value"]: item["pipeline"] for item in STAGE_ITEMS}
PIPELINE_LANES = ["PreC", "IND", "Phase 1", "Phase 2", "Phase 3", "BLA", "Market"]
INVALID_TARGETS = {"", "NOT AVAILABLE", "N/A", "NA", "UNKNOWN"}


def get_stage_items() -> List[dict]:
    return STAGE_ITEMS


def normalize_targets(raw_targets: Optional[str]) -> List[str]:
    if not raw_targets:
        return []

    seen = set()
    normalized: List[str] = []
    for part in raw_targets.split(","):
        target = part.strip()
        if not target:
            continue
        if target.upper() in INVALID_TARGETS:
            continue
        if target in seen:
            continue
        seen.add(target)
        normalized.append(target)
    return normalized


def build_target_groups(targets: Iterable[str]) -> List[dict]:
    groups: Dict[str, List[str]] = defaultdict(list)
    for target in sorted(set(targets), key=lambda item: item.upper()):
        first_char = target[:1].upper()
        group_key = first_char if first_char.isalpha() else "#"
        groups[group_key].append(target)

    def sort_key(key: str) -> Tuple[int, str]:
        return (0, key) if key == "#" else (1, key)

    return [{"key": key, "targets": groups[key]} for key in sorted(groups.keys(), key=sort_key)]


def get_disease_tree_data() -> List[dict]:
    conn = get_cursor()
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

    tree: Dict[str, dict] = {}
    for ta, disease, count in rows:
        if ta not in tree:
            tree[ta] = {"ta": ta, "children": []}
        tree[ta]["children"].append({"name": disease, "drug_count": count})

    return list(tree.values())


def get_targets_data(disease: Optional[str] = None) -> dict:
    records = fetch_filtered_records(diseases=[disease] if disease else None, require_targets=True)
    target_set = set()
    for record in records:
        target_set.update(record["target_list"])

    targets = sorted(target_set, key=lambda item: item.upper())
    return {
        "targets": targets,
        "groups": build_target_groups(targets),
        "total": len(targets),
    }


def get_filter_dictionaries() -> dict:
    disease_tree = get_disease_tree_data()
    diseases = [
        {"ta": area["ta"], "name": child["name"], "drug_count": child["drug_count"]}
        for area in disease_tree
        for child in area["children"]
    ]
    return {
        "disease_tree": disease_tree,
        "diseases": diseases,
        "stages": get_stage_items(),
    }


def fetch_filtered_records(
    diseases: Optional[Sequence[str]] = None,
    ta: Optional[str] = None,
    stages: Optional[Sequence[str]] = None,
    require_targets: bool = False,
) -> List[dict]:
    conn = get_cursor()
    sql_parts = [
        """
        SELECT
            ta,
            harbour_indication_name,
            drug_id,
            drug_name_en,
            drug_name_cn,
            targets,
            originator,
            research_institute,
            indication_top_global_latest_stage AS stage_value,
            highest_trial_date,
            nct_id,
            update_time,
            is_combo
        FROM latest_records
        WHERE harbour_indication_name IS NOT NULL
        """
    ]
    params: List[Any] = []

    if ta:
        params.append(ta)
        sql_parts.append(f"AND ta = ${len(params)}")

    if diseases:
        disease_values = [item for item in diseases if item]
        if disease_values:
            placeholders = ", ".join(
                f"${len(params) + index + 1}" for index in range(len(disease_values))
            )
            sql_parts.append(f"AND harbour_indication_name IN ({placeholders})")
            params.extend(disease_values)

    if stages:
        stage_values = [item for item in stages if item]
        if stage_values:
            placeholders = ", ".join(
                f"${len(params) + index + 1}" for index in range(len(stage_values))
            )
            sql_parts.append(f"AND indication_top_global_latest_stage IN ({placeholders})")
            params.extend(stage_values)

    if require_targets:
        sql_parts.append("AND targets IS NOT NULL AND TRIM(targets) != ''")

    sql_parts.append("ORDER BY harbour_indication_name, drug_name_en, drug_id")

    rows = conn.execute("\n".join(sql_parts), params).fetchall()

    records: List[dict] = []
    for row in rows:
        stage_value = row[8]
        score = STAGE_SCORE_MAP.get(stage_value)
        if score is None:
            continue

        target_list = normalize_targets(row[5])
        if require_targets and not target_list:
            continue

        records.append(
            {
                "ta": row[0],
                "disease": row[1],
                "drug_id": row[2] or "",
                "drug_name_en": row[3] or "",
                "drug_name_cn": row[4] or "",
                "targets": row[5] or "",
                "target_list": target_list,
                "originator": row[6] or "",
                "research_institute": row[7] or "",
                "stage_value": stage_value,
                "score": score,
                "highest_trial_date": row[9] or "",
                "nct_id": row[10] or "",
                "update_time": row[11] or "",
                "is_combo": (row[12] or "").lower() == "yes",
            }
        )

    return records


def extract_data_version(records: Sequence[dict]) -> Optional[str]:
    updates = [record["update_time"] for record in records if record.get("update_time")]
    return max(updates) if updates else None


def serialize_drug(record: dict) -> dict:
    return {
        "drug_id": record["drug_id"],
        "drug_name_en": record["drug_name_en"],
        "drug_name_cn": record["drug_name_cn"],
        "originator": record["originator"],
        "research_institute": record["research_institute"],
        "highest_trial_date": record["highest_trial_date"],
        "nct_id": record["nct_id"],
        "disease": record["disease"],
        "ta": record["ta"],
        "stage_value": record["stage_value"],
        "score": record["score"],
        "targets": record["target_list"],
        "is_combo": record["is_combo"],
    }


def sort_drugs(records: Sequence[dict]) -> List[dict]:
    serialized = [serialize_drug(record) for record in records]
    return sorted(
        serialized,
        key=lambda item: (
            -item["score"],
            -(int((item["highest_trial_date"] or "0000-00-00").replace("-", ""))),
            item["drug_name_en"] or item["drug_name_cn"] or "",
            item["nct_id"] or "",
        ),
    )


def compute_matrix(
    records: Sequence[dict],
    selected_targets: Optional[Sequence[str]] = None,
    top_n: Optional[int] = None,
    hide_no_combo: bool = False,
) -> dict:
    target_max: Dict[str, float] = defaultdict(float)
    target_stage: Dict[str, str] = {}
    pair_scores: Dict[Tuple[str, str], float] = defaultdict(float)
    pair_stage: Dict[Tuple[str, str], str] = {}
    pair_drugs: Dict[Tuple[str, str], set] = defaultdict(set)

    for record in records:
        targets = record["target_list"]
        if not targets:
            continue

        score = record["score"]
        for target in targets:
            if score > target_max[target]:
                target_max[target] = score
                target_stage[target] = record["stage_value"]

        if len(targets) < 2:
            continue

        for left, right in combinations(sorted(targets), 2):
            pair_key = (left, right)
            if score > pair_scores[pair_key]:
                pair_scores[pair_key] = score
                pair_stage[pair_key] = record["stage_value"]
            pair_drugs[pair_key].add(record["drug_id"] or f"{record['drug_name_en']}|{record['nct_id']}")

    sorted_targets = sorted(target_max.keys(), key=lambda item: (-target_max[item], item.upper()))
    if selected_targets:
        target_set = set(selected_targets)
        display_targets = [target for target in sorted_targets if target in target_set]
    else:
        display_targets = sorted_targets[:top_n] if top_n else sorted_targets

    if hide_no_combo:
        filtered_targets = []
        for target in display_targets:
            has_combo = any(
                pair_scores.get(tuple(sorted((target, other))), 0) > 0
                for other in display_targets
                if other != target
            )
            if has_combo:
                filtered_targets.append(target)
        display_targets = filtered_targets

    cells = []
    for left, right in combinations(display_targets, 2):
        pair_key = tuple(sorted((left, right)))
        score = pair_scores.get(pair_key)
        if not score:
            continue
        cells.append(
            {
                "row_target": pair_key[0],
                "col_target": pair_key[1],
                "score": score,
                "stage_value": pair_stage.get(pair_key),
                "drug_count": len(pair_drugs.get(pair_key, set())),
            }
        )

    single_max = {
        target: {"score": target_max[target], "stage_value": target_stage.get(target)}
        for target in display_targets
    }

    return {
        "targets": display_targets,
        "single_max": single_max,
        "cells": cells,
        "legend": get_stage_items(),
        "data_version": extract_data_version(records),
        "available_target_total": len(sorted_targets),
    }


def compute_tooltip(
    records: Sequence[dict],
    row_target: str,
    col_target: str,
) -> dict:
    matched_records = []
    for record in records:
        targets = set(record["target_list"])
        if row_target == col_target:
            if row_target in targets:
                matched_records.append(record)
            continue

        if row_target in targets and col_target in targets:
            matched_records.append(record)

    return {
        "row_target": row_target,
        "col_target": col_target,
        "is_single": row_target == col_target,
        "drugs": sort_drugs(matched_records),
        "data_version": extract_data_version(records),
    }


def compute_pipeline(
    records: Sequence[dict],
    disease: str,
    selected_targets: Optional[Sequence[str]] = None,
    include_combo: bool = True,
) -> dict:
    target_filter = None if selected_targets is None else set(selected_targets)
    rows: Dict[str, dict] = {}

    for record in records:
        if record["disease"] != disease:
            continue
        if not include_combo and len(record["target_list"]) > 1:
            continue

        lane = PIPELINE_STAGE_MAP.get(record["stage_value"])
        if lane is None:
            continue

        for target in record["target_list"]:
            if target_filter is not None and target not in target_filter:
                continue

            if target not in rows:
                rows[target] = {
                    "target": target,
                    "max_score": 0.0,
                    "total_drug_count": 0,
                    "cells": {lane_name: [] for lane_name in PIPELINE_LANES},
                }

            rows[target]["cells"][lane].append(serialize_drug(record))
            rows[target]["max_score"] = max(rows[target]["max_score"], record["score"])
            rows[target]["total_drug_count"] += 1

    row_items = []
    for row in rows.values():
        for lane in PIPELINE_LANES:
            row["cells"][lane] = sorted(
                row["cells"][lane],
                key=lambda item: (
                    -item["score"],
                    item["highest_trial_date"] or "",
                    item["drug_name_en"] or item["drug_name_cn"] or "",
                ),
            )
        row_items.append(row)

    row_items.sort(
        key=lambda item: (-item["max_score"], -item["total_drug_count"], item["target"].upper())
    )

    return {
        "disease": disease,
        "lanes": PIPELINE_LANES,
        "rows": row_items,
        "data_version": extract_data_version(records),
    }
