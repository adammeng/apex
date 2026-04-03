# Apex

药物研发智能分析平台，面向 Harbour 内部使用。项目基于 Pharmcube 导出的 parquet 数据，提供研发全景总览、竞争矩阵、研发泳道和竞争格局分析能力。

## 当前状态

### 后端（`backend/`）

| 模块 | 状态 |
| --- | --- |
| FastAPI 服务框架、配置体系、日志 | 已完成 |
| DuckDB 单例连接 + 6 张 parquet 视图 | 已完成 |
| Redis 异步缓存工具 | 已完成 |
| MySQL 建库建表（Alembic 001_sync_tables） | 已完成 |
| 健康检查 `/api/system/health` | 已完成 |
| 元数据接口（疾病树 / 靶点 / 阶段枚举） | 已完成 |
| APScheduler 每日定时同步骨架 | 已完成 |
| 飞书 OAuth 完整登录流程 | 已完成 |
| 竞争矩阵查询（`/matrix/query`、`/matrix/tooltip`、`/matrix/export`） | 已完成 |
| 研发泳道查询（`/pipeline/query`、`/pipeline/export`） | 已完成 |
| Excel 导出服务（`services/excel_export.py`） | 已完成 |
| 导出任务管理（`/export/jobs`、`/export/jobs/{id}/download`） | 待实现（接口占位） |

### 前端（`frontend/`）

| 模块 | 状态 |
| --- | --- |
| 基础布局（左侧导航 + 顶部栏） | 已完成 |
| 统一请求实例（Axios + JWT + 401 跳转） | 已完成 |
| Zustand 鉴权 & 筛选状态 | 已完成 |
| 竞争矩阵页面（真实数据渲染，含筛选、tooltip、导出） | 已完成 |
| 研发泳道页面（真实数据渲染，含筛选、导出） | 已完成 |
| 分析组件库（MatrixBoard、PipelineBoard、filters） | 已完成 |
| 数据总览页面 | 待实现 |
| 竞争格局页面 | 待实现 |

### 本地开发环境

| 服务 | 版本 | 启动方式 |
| --- | --- | --- |
| MySQL | 9.6（Homebrew） | `brew services start mysql` |
| Redis | 8.6（Homebrew） | `brew services start redis` |
| FastAPI | 后台运行，`--reload` | `uvicorn app.main:app --reload`（在 `backend/` 下） |

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、Ant Design、React Router、React Query、Zustand |
| 后端 | FastAPI、Pydantic Settings、DuckDB、Redis、SQLAlchemy、MySQL |
| 数据 | Parquet、Pandas、PyArrow |
| 鉴权/集成 | 飞书 OAuth、JWT、阿里云 OSS |

## 目录结构

```text
Apex/
├── README.md
├── frontend/            # React 前端
├── backend/             # FastAPI 后端
├── parquet/             # Pharmcube 导出的 parquet 数据
├── data/                # 运行期数据目录
├── deploy/              # 部署相关文件
├── 架构/                # 技术架构与设计文档
└── 需求/                # 产品需求资料
```

## 核心模块

- 数据总览：关键指标、分布概览、最近更新
- 竞争矩阵：靶点维度交叉分析与 tooltip 明细
- 研发泳道：适应症下的靶点 / 药物阶段分布
- 竞争格局：公司、靶点、治疗领域多维对比

## 数据源

| 文件 | 内容 | 规模 |
| --- | --- | --- |
| `pharmcube2harbour_ci_tracking_info_0.parquet` | 临床试验跟踪信息 | 43,943 行 × 63 列 |
| `pharmcube2harbour_clinical_trial_detail_info_0.parquet` | 临床试验详情 | 16,282 行 × 55 列 |
| `pharmcube2harbour_drug_pipeline_info_0.parquet` | 药物管线信息 | 3,457 行 × 53 列 |

## 开发说明

### 前端

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

默认开发地址：`http://localhost:5173`

### 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.local.example .env.local
uvicorn app.main:app --reload
```

默认开发地址：`http://localhost:8000`

接口文档：

- Swagger: `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`

## 文档索引

- 根目录说明：`README.md`
- 前端说明：`frontend/README.md`
- 后端说明：`backend/README.md`
- 整体架构：`架构/Apex整体技术架构实现方案.md`
- 飞书登录流程：`架构/飞书登录流程.md`
- 前端 Table 性能优化：`frontend/docs/table-performance.md`

## 说明

- UI 语言默认使用中文
- parquet 原始数据不入库，通常不提交到 Git
- 当前仓库仍处于快速迭代阶段，导出任务管理模块与总览、竞争格局页面尚未实现
