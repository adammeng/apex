"""
Apex 数据分析脚本
分析三个 parquet 文件的多维度数据内容
"""

import pandas as pd
import numpy as np
from pathlib import Path

BASE_DIR = Path("/Users/adam/repo/Apex/parquet")

FILES = {
    "drug_pipeline_info": BASE_DIR / "pharmcube2harbour_drug_pipeline_info_0.parquet",
    "ci_tracking_info": BASE_DIR / "pharmcube2harbour_ci_tracking_info_0.parquet",
    "clinical_trial_detail_info": BASE_DIR
    / "pharmcube2harbour_clinical_trial_detail_info_0.parquet",
}

SEP = "=" * 80
SEP2 = "-" * 60


def pprint(text: str = ""):
    print(text)


def analyze_table(name: str, df: pd.DataFrame):
    pprint(SEP)
    pprint(f"  表名: {name}")
    pprint(SEP)

    # ── 1. 基本信息 ──────────────────────────────────────────────────────────
    pprint("\n【1. 基本信息】")
    pprint(f"  行数: {len(df):,}")
    pprint(f"  列数: {len(df.columns)}")

    # 重复记录
    dup_count = df.duplicated().sum()
    pprint(f"  完全重复行数: {dup_count:,}")

    # ── 2. 列名 / 类型 / 空值率 ──────────────────────────────────────────────
    pprint("\n【2. 列名 · 数据类型 · 空值率】")
    pprint(f"  {'列名':<45} {'类型':<20} {'空值率':>8}  {'非空数量':>10}")
    pprint("  " + "-" * 90)
    for col in df.columns:
        null_rate = df[col].isna().mean()
        non_null = df[col].notna().sum()
        pprint(
            f"  {col:<45} {str(df[col].dtype):<20} {null_rate:>7.1%}  {non_null:>10,}"
        )

    # ── 3. 分类字段分析 ──────────────────────────────────────────────────────
    pprint("\n【3. 分类字段 Top-10 频率分析】")
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    # 剔除明显是自由文本的大字段（平均长度 > 100 字符）
    skip_long = set()
    for col in cat_cols:
        sample = df[col].dropna()
        if len(sample) > 0 and sample.astype(str).str.len().mean() > 120:
            skip_long.add(col)

    for col in cat_cols:
        pprint(f"\n  ▶ {col}")
        non_null_series = df[col].dropna()
        unique_cnt = non_null_series.nunique()
        pprint(f"    唯一值数量: {unique_cnt:,}")
        if col in skip_long:
            pprint(f"    (字段平均长度较长，跳过详细枚举)")
            continue
        if unique_cnt == 0:
            pprint("    (无非空数据)")
            continue
        top10 = non_null_series.value_counts().head(10)
        for val, cnt in top10.items():
            pct = cnt / len(df) * 100
            val_str = str(val)[:80]
            pprint(f"    {val_str:<82} {cnt:>7,}  ({pct:.1f}%)")

    # ── 4. 数值字段分析 ──────────────────────────────────────────────────────
    pprint("\n【4. 数值字段统计】")
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if num_cols:
        pprint(
            f"  {'列名':<45} {'非空数':>8} {'最小值':>14} {'最大值':>14} {'均值':>14} {'中位数':>14}"
        )
        pprint("  " + "-" * 115)
        for col in num_cols:
            s = df[col].dropna()
            if len(s) == 0:
                pprint(f"  {col:<45} {'0':>8} {'—':>14} {'—':>14} {'—':>14} {'—':>14}")
                continue
            pprint(
                f"  {col:<45} {len(s):>8,} {s.min():>14.2f} {s.max():>14.2f} {s.mean():>14.2f} {s.median():>14.2f}"
            )
    else:
        pprint("  (无数值类型列)")

    # ── 5. 时间字段分析 ──────────────────────────────────────────────────────
    pprint("\n【5. 时间字段分析】")

    # 先找 dtype 为 datetime 的列
    dt_cols = df.select_dtypes(include=["datetime", "datetimetz"]).columns.tolist()

    # 再从 object 列中识别日期样式的列（列名含 date/time/_dt）
    date_keywords = [
        "date",
        "time",
        "_dt",
        "start",
        "end",
        "posted",
        "completion",
        "update",
    ]
    for col in df.select_dtypes(include="object").columns:
        if any(kw in col.lower() for kw in date_keywords) and col not in dt_cols:
            sample = df[col].dropna().head(200)
            if len(sample) == 0:
                continue
            try:
                parsed = pd.to_datetime(sample, errors="coerce")
                if parsed.notna().mean() > 0.6:
                    dt_cols.append(col)
            except Exception:
                pass

    if dt_cols:
        for col in dt_cols:
            pprint(f"\n  ▶ {col}")
            try:
                series = pd.to_datetime(df[col], errors="coerce")
            except Exception:
                pprint("    (解析失败)")
                continue
            valid = series.dropna()
            if len(valid) == 0:
                pprint("    (无有效日期数据)")
                continue
            pprint(f"    非空记录: {len(valid):,} / {len(df):,}")
            pprint(f"    最早: {valid.min()}")
            pprint(f"    最晚: {valid.max()}")
            # 按年分布（取前 15）
            year_dist = valid.dt.year.value_counts().sort_index()
            pprint(f"    按年分布 (共 {len(year_dist)} 个年份):")
            for yr, cnt in year_dist.items():
                bar = "█" * min(int(cnt / year_dist.max() * 30), 30)
                pprint(f"      {int(yr)}  {bar:<30}  {cnt:,}")
    else:
        pprint("  (未发现时间字段)")

    pprint()


def main():
    for name, path in FILES.items():
        pprint(f"\n正在读取: {path.name} ...")
        df = pd.read_parquet(path)
        analyze_table(name, df)

    pprint(SEP)
    pprint("  分析完成")
    pprint(SEP)


if __name__ == "__main__":
    main()
