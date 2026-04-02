from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Iterable, List, Optional, Sequence

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from .analysis import MATRIX_STAGE_MAP, compute_matrix

EXPORT_HEADERS = [
    "药品英文名",
    "药品中文名",
    "靶点组合",
    "研发阶段",
    "阶段分值",
    "原研机构",
    "所有研究机构",
    "最高阶段日期",
    "nctId",
    "疾病",
    "疾病领域",
    "是否联用",
]

EXPORT_SHEET_NAME = "研发管线数据"
EXPORT_HEADER_FILL = PatternFill("solid", fgColor="DCE7FF")
EXPORT_HEADER_FONT = Font(bold=True, color="1F3763")
EXPORT_HEADER_ALIGNMENT = Alignment(horizontal="center", vertical="center")
EXPORT_BODY_ALIGNMENT = Alignment(vertical="center")
EXPORT_COLUMN_WIDTHS = [20, 18, 22, 14, 10, 18, 26, 14, 18, 28, 16, 10]


def _format_targets(targets: Sequence[str]) -> str:
    return " + ".join(targets)


def _format_stage(stage_value: str) -> str:
    return MATRIX_STAGE_MAP.get(stage_value, stage_value)


def _build_export_row(record: dict, targets: Sequence[str]) -> List[object]:
    return [
        record["drug_name_en"],
        record["drug_name_cn"],
        _format_targets(targets),
        _format_stage(record["stage_value"]),
        record["score"],
        record["originator"],
        record["research_institute"],
        record["highest_trial_date"],
        record["nct_id"],
        record["disease"],
        record["ta"],
        "是" if record["is_combo"] else "否",
    ]


def _sort_records(records: Iterable[dict]) -> List[dict]:
    return sorted(
        records,
        key=lambda item: (
            -item["score"],
            -(int((item["highest_trial_date"] or "0000-00-00").replace("-", ""))),
            item["drug_name_en"] or item["drug_name_cn"] or "",
            item["nct_id"] or "",
            item["disease"] or "",
        ),
    )


def build_matrix_export_rows(
    records: Sequence[dict],
    selected_targets: Optional[Sequence[str]] = None,
    top_n: Optional[int] = None,
    hide_no_combo: bool = False,
) -> List[List[object]]:
    matrix_data = compute_matrix(
        records,
        selected_targets=selected_targets,
        top_n=top_n,
        hide_no_combo=hide_no_combo,
    )
    display_targets = set(matrix_data["targets"])
    if not display_targets:
        return []

    rows: List[List[object]] = []
    for record in _sort_records(records):
        matched_targets = [target for target in record["target_list"] if target in display_targets]
        if not matched_targets:
            continue
        rows.append(_build_export_row(record, matched_targets))
    return rows


def build_pipeline_export_rows(
    records: Sequence[dict],
    selected_targets: Optional[Sequence[str]] = None,
    include_combo: bool = True,
) -> List[List[object]]:
    target_filter = None if not selected_targets else set(selected_targets)
    rows: List[List[object]] = []

    for record in _sort_records(records):
        if not include_combo and len(record["target_list"]) > 1:
            continue

        matched_targets = record["target_list"]
        if target_filter is not None:
            matched_targets = [target for target in matched_targets if target in target_filter]
            if not matched_targets:
                continue

        rows.append(_build_export_row(record, matched_targets))

    return rows


def build_excel_bytes(rows: Sequence[Sequence[object]]) -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = EXPORT_SHEET_NAME
    worksheet.freeze_panes = "A2"
    worksheet.append(EXPORT_HEADERS)

    for row in rows:
        worksheet.append(list(row))

    for cell in worksheet[1]:
        cell.fill = EXPORT_HEADER_FILL
        cell.font = EXPORT_HEADER_FONT
        cell.alignment = EXPORT_HEADER_ALIGNMENT

    for row in worksheet.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = EXPORT_BODY_ALIGNMENT

    for index, width in enumerate(EXPORT_COLUMN_WIDTHS, start=1):
        worksheet.column_dimensions[get_column_letter(index)].width = width

    worksheet.auto_filter.ref = worksheet.dimensions

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def build_export_filename(export_type: str) -> str:
    today = datetime.now().strftime("%Y-%m-%d")
    return f"Apex_Target_Intelligence_{export_type}_{today}.xlsx"
