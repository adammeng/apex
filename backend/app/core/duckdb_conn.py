"""
DuckDB 连接管理
- 单例模式，全局共享一个 in-memory 连接，直接读 parquet 外部表
- parquet 路径固定为 backend/parquet/（由 settings.parquet_path 提供）
- 支持热更新（OSS 同步覆盖文件后调用 reload_conn）
- 并发安全：业务代码应使用 get_cursor() 获取线程独立游标，而非直接使用裸连接
"""

import threading
from typing import Optional

import duckdb

from .config import get_settings
from .logging import get_logger

logger = get_logger(__name__)

_conn: Optional[duckdb.DuckDBPyConnection] = None
_lock = threading.Lock()


def _create_connection() -> duckdb.DuckDBPyConnection:
    """创建并初始化 DuckDB 连接，注册 parquet 视图。"""
    settings = get_settings()
    parquet_dir = settings.parquet_path

    ci_path = str(parquet_dir / settings.parquet_ci_tracking)
    detail_path = str(parquet_dir / settings.parquet_clinical_detail)
    pipeline_path = str(parquet_dir / settings.parquet_drug_pipeline)

    logger.info(f"DuckDB 使用 parquet 目录: {parquet_dir}")

    conn = duckdb.connect(database=":memory:", read_only=False)

    # 原始表视图
    conn.execute(
        f"CREATE OR REPLACE VIEW ci_tracking_raw AS SELECT * FROM read_parquet('{ci_path}')"
    )
    conn.execute(
        f"CREATE OR REPLACE VIEW clinical_detail_raw AS SELECT * FROM read_parquet('{detail_path}')"
    )
    conn.execute(
        f"CREATE OR REPLACE VIEW drug_pipeline_raw AS SELECT * FROM read_parquet('{pipeline_path}')"
    )

    # 视图一：latest_records — 按 PRD 规则取最新记录
    conn.execute("""
        CREATE OR REPLACE VIEW latest_records AS
        SELECT * FROM ci_tracking_raw
        WHERE (
            nct_id IS NOT NULL
            AND highest_trial_id IS NOT NULL
            AND nct_id = highest_trial_id
        )
        OR nct_id IS NULL
    """)

    # 视图二：stage_mapped_records — 阶段标准化 + score
    conn.execute("""
        CREATE OR REPLACE VIEW stage_mapped_records AS
        SELECT
            *,
            CASE indication_top_cn_latest_stage
                WHEN '临床前'        THEN 0.1
                WHEN '申报临床'      THEN 0.5
                WHEN 'I期临床'       THEN 1.0
                WHEN 'I/II期临床'    THEN 1.5
                WHEN 'II期临床'      THEN 2.0
                WHEN 'II/III期临床'  THEN 2.5
                WHEN 'III期临床'     THEN 3.0
                WHEN '申请上市'      THEN 3.5
                WHEN '批准上市'      THEN 4.0
                ELSE NULL
            END AS stage_score,
            CASE indication_top_cn_latest_stage
                WHEN '临床前'        THEN 'PreClinical'
                WHEN '申报临床'      THEN 'IND'
                WHEN 'I期临床'       THEN 'Phase I'
                WHEN 'I/II期临床'    THEN 'Phase I/II'
                WHEN 'II期临床'      THEN 'Phase II'
                WHEN 'II/III期临床'  THEN 'Phase II/III'
                WHEN 'III期临床'     THEN 'Phase III'
                WHEN '申请上市'      THEN 'BLA'
                WHEN '批准上市'      THEN 'Approved'
                ELSE indication_top_cn_latest_stage
            END AS stage_display
        FROM latest_records
    """)

    # 视图三：normalized_target_records — 靶点归一化
    conn.execute("""
        CREATE OR REPLACE VIEW normalized_target_records AS
        SELECT
            *,
            COALESCE(targets, '') AS targets_safe,
            UPPER(TRIM(COALESCE(targets, ''))) AS norm_targets,
            CASE
                WHEN TRIM(COALESCE(targets, '')) = '' THEN 0
                ELSE ARRAY_LENGTH(STRING_SPLIT(TRIM(targets), ','))
            END AS target_count
        FROM stage_mapped_records
    """)

    logger.info("DuckDB 视图初始化完成")
    return conn


def get_conn() -> duckdb.DuckDBPyConnection:
    """获取全局 DuckDB 连接（懒初始化）。仅供预热/内部使用，业务代码请用 get_cursor()。"""
    global _conn
    if _conn is None:
        with _lock:
            if _conn is None:
                _conn = _create_connection()
    return _conn


def get_cursor() -> duckdb.DuckDBPyConnection:
    """
    获取线程独立的 DuckDB cursor。
    每次调用返回新 cursor，与全局连接共享 in-memory 数据库，但执行上下文隔离，线程安全。
    业务路由中应始终使用此函数，不要直接使用 get_conn()。
    """
    return get_conn().cursor()


def reload_conn() -> None:
    """热更新：重建 DuckDB 连接（OSS 覆盖文件后调用）。"""
    global _conn
    with _lock:
        logger.info("重建 DuckDB 连接...")
        old = _conn
        _conn = _create_connection()
        if old is not None:
            try:
                old.close()
            except Exception:
                pass
    logger.info("DuckDB 连接热更新完成")
