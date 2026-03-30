# Apex

药物研发智能分析平台 — Harbour BioMed 内部工具

## 简介

Apex 基于 Pharmcube 导出的临床试验与药物管线数据，提供多维度的研发数据分析与可视化，帮助团队快速掌握竞争格局、跟踪临床进展、洞察管线趋势。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React |
| 后端 | Python FastAPI |
| 数据 | Parquet / Pandas / PyArrow |

## 功能模块

- **数据总览** — 关键指标卡片、研发阶段 / 治疗领域 / 分子类型分布图
- **临床试验分析** — 试验列表、多维筛选、详情查看、进度时间线
- **药物管线分析** — 管线可视化、组合筛选、趋势追踪
- **竞争格局分析** — 公司对比、靶点热度、治疗领域竞争地图

## 数据源

| 文件 | 内容 | 规模 |
|---|---|---|
| `ci_tracking_info` | 临床试验跟踪 | 43,943 行 × 63 列 |
| `clinical_trial_detail_info` | 临床试验详情 | 16,282 行 × 55 列 |
| `drug_pipeline_info` | 药物管线信息 | 3,457 行 × 53 列 |

> 数据文件位于 `parquet/` 目录，已被 `.gitignore` 排除。

## 快速开始

```bash
# 激活虚拟环境
source .venv/bin/activate

# 安装依赖（后续补充）
pip install -r requirements.txt
```

## 项目结构

```
Apex/
├── CLAUDE.md           # 项目规范与详细需求
├── README.md           # 本文件
├── parquet/            # 数据源（不入库）
├── 需求/               # 需求文档
├── .opencode/          # OpenCode 配置与 skills
└── .venv/              # Python 虚拟环境（不入库）
```

## License

Private — Harbour BioMed 内部使用
