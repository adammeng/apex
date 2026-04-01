# Apex

药物研发智能分析平台，面向 Harbour 内部使用。项目基于 Pharmcube 导出的 parquet 数据，提供研发全景总览、竞争矩阵、研发泳道和竞争格局分析能力。

## 当前状态

- 前端已完成基础框架、路由和主界面骨架
- 后端已完成 FastAPI 服务骨架、配置体系和部分元数据接口
- 数据源以 `parquet/` 目录内文件为主，查询层基于 DuckDB / Pandas / PyArrow
- 飞书登录、导出、矩阵查询、泳道查询等能力已预留接口，仍在持续完善

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
cp .env.example .env
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

## 说明

- UI 语言默认使用中文
- parquet 原始数据不入库，通常不提交到 Git
- 当前仓库仍处于快速迭代阶段，部分接口和页面为占位实现
