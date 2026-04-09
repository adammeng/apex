# Apex 后端

基于 FastAPI 的后端服务，负责飞书鉴权、数据查询、缓存、导出与数据同步。

## 当前实现进度

| 模块 | 文件 | 状态 |
|------|------|------|
| 应用入口 + 生命周期 | `app/main.py` | 已完成 |
| 配置加载（pydantic-settings） | `app/core/config.py` | 已完成 |
| DuckDB 连接 + 6 张视图 | `app/core/duckdb_conn.py` | 已完成 |
| Redis 异步缓存工具 | `app/core/redis_client.py` | 已完成 |
| JWT 工具 | `app/core/jwt.py` | 已完成 |
| 健康检查 `/api/system/health` | `app/routers/system.py` | 已完成 |
| 元数据接口（疾病树 / 靶点 / 阶段） | `app/routers/meta.py` | 已完成 |
| APScheduler 定时任务骨架 | `app/tasks/scheduler.py` | 已完成 |
| OSS 同步流程 | `app/tasks/oss_sync.py` | 已完成（骨架）|
| 飞书 OAuth 完整登录 | `app/routers/auth.py` | 已完成 |
| 竞争矩阵查询（`/matrix/query`、`/matrix/tooltip`、`/matrix/export`） | `app/routers/matrix.py` | 已完成 |
| 研发泳道查询（`/pipeline/query`、`/pipeline/export`） | `app/routers/pipeline.py` | 已完成 |
| 业务查询核心逻辑 | `app/services/analysis.py` | 已完成 |
| Excel 导出服务 | `app/services/excel_export.py` | 已完成 |
| 导出任务（`/export/jobs`、`/export/jobs/{id}/download`） | `app/routers/export.py` | 待实现（接口占位） |
| 数据库迁移（建表） | `alembic/versions/001_sync_tables` | 已完成 |

## 技术栈

| 组件 | 用途 |
|------|------|
| FastAPI + Uvicorn | Web 框架与 ASGI 服务器 |
| DuckDB | 直接读 parquet，承载全部分析查询 |
| Redis | 查询结果缓存，降低 DuckDB 并发压力 |
| MySQL + SQLAlchemy | 用户、数据版本、同步任务等元数据 |
| Alembic | 数据库迁移 |
| APScheduler | 每日定时从 OSS 同步 parquet 并热更新 |
| python-jose | JWT 签发与验证 |
| httpx | 调用飞书开放平台 API |
| openpyxl | Excel 导出 |

## 目录结构

```
backend/
├── app/
│   ├── main.py              # FastAPI 入口，lifespan、CORS、路由注册
│   ├── core/
│   │   ├── config.py        # pydantic-settings 配置，单例
│   │   ├── jwt.py           # JWT 签发与验证工具
│   │   ├── duckdb_conn.py   # DuckDB 连接单例，启动时建视图
│   │   ├── redis_client.py  # Redis 异步客户端单例
│   │   └── logging.py       # 日志初始化
│   ├── routers/
│   │   ├── auth.py          # 鉴权（飞书静默登录、/me、mock-login）
│   │   ├── system.py        # 健康检查、同步状态
│   │   ├── meta.py          # 疾病树、靶点、阶段枚举
│   │   ├── matrix.py        # 竞争矩阵查询与 tooltip
│   │   ├── pipeline.py      # 研发泳道查询
│   │   └── export.py        # 导出任务
│   ├── services/
│   │   └── feishu_auth.py   # 飞书 OAuth：code → user_info
│   ├── models/
│   │   └── sync.py          # SQLAlchemy ORM：sync_jobs
│   ├── schemas/
│   │   └── response.py      # 统一响应体 ApiResponse[T]
│   ├── tasks/
│   │   ├── scheduler.py     # APScheduler 定时任务管理
│   │   └── oss_sync.py      # OSS 同步全流程
│   ├── repositories/        # 数据库访问层（待扩展）
│   └── utils/               # 通用工具（待扩展）
├── alembic/                 # 数据库迁移脚本
├── tests/
├── .env.example
├── Dockerfile
└── requirements.txt
```

## 本地启动与停止

### 前置条件

- Python 3.9（`backend/.venv/` 已就绪）
- 本地 MySQL（3306）和 Redis（6379）通过 Homebrew 安装
- `backend/parquet/` 目录下已有三个 parquet 数据文件

### 一键启动 / 停止

```bash
cd backend

# 启动（venv → 依赖 → alembic 建表 → uvicorn，parquet 检查由 lifespan 自动处理）
bash dev-bootstrap.sh

# 停止（uvicorn + MySQL + Redis 全部停止）
bash dev-stop.sh
```

### 手动启动

```bash
# 1. 进入目录
cd backend

# 2. 创建并激活虚拟环境（首次）
python3 -m venv .venv
source .venv/bin/activate

# 3. 安装依赖（首次或依赖变更时）
pip install -r requirements.txt

# 4. 准备配置文件（首次）
cp .env.example .env            # 按实际填写 MySQL、Redis、飞书等配置

# 5. 启动基础服务
brew services start mysql
brew services start redis

# 6. 数据库迁移（首次或有新迁移时）
alembic upgrade head

# 7. 启动开发服务器
uvicorn app.main:app --reload --reload-dir app
```

- API 根路径：`http://localhost:8000/api`
- Swagger：`http://localhost:8000/api/docs`
- ReDoc：`http://localhost:8000/api/redoc`

> **注意**：日常重启只需步骤 5 + 7，其余步骤首次或有变更时才需要执行。

### 手动停止

```bash
# 停止 uvicorn
kill $(lsof -ti :8000)

# 停止 MySQL / Redis（Homebrew 管理）
brew services stop mysql
brew services stop redis
```

## 环境变量

推荐分环境管理：

- 本地开发：复制 `.env.local.example` 为 `.env.local`
- 线上部署：复制 `.env.production.example` 为 `.env.production`
- 如果不额外区分环境，也可以直接使用 `.env`

配置读取优先级：

- 默认：`.env` -> `.env.local`（后者覆盖前者同名项）
- 指定文件：设置 `APEX_ENV_FILE=/absolute/path/to/.env.production`

按下表填写：

| 分类 | 变量 | 说明 |
|------|------|------|
| 应用 | `DEBUG` `ENVIRONMENT` | debug=true 时开启 mock-login |
| JWT | `JWT_SECRET` `JWT_EXPIRE_MINUTES` | 生产环境必须用强随机密钥 |
| 飞书 | `FEISHU_APP_ID` `FEISHU_APP_SECRET` `FEISHU_REDIRECT_URI` | 企业自建应用凭证；`FEISHU_REDIRECT_URI` 用于浏览器 OAuth 回调 |
| 前端 | `FRONTEND_URL` | 浏览器 OAuth 成功后 302 回跳的前端地址 |
| Redis | `REDIS_URL` `CACHE_TTL_SECONDS` | 默认 TTL 1 小时 |
| MySQL | `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE` | 元数据库 |
| 数据路径 | `DATA_DIR` `PARQUET_DIR` | DATA_DIR 运行期数据根目录；PARQUET_DIR 本地 parquet 路径 |
| 定时同步 | `SYNC_HOUR` `SYNC_MINUTE` | 默认每日 05:10 |
| OSS | `OSS_ENDPOINT/ACCESS_KEY_ID/ACCESS_KEY_SECRET/BUCKET_NAME` | 阿里云 OSS |

线上部署注意：

- `docker compose` 会先加载 `.env.production`，再加载 `.env.production.local`
- 若 `.env.production.local` 中仍保留旧的 `FEISHU_REDIRECT_URI=/api/auth/feishu/launch`，会覆盖 `.env.production` 中正确的 `/api/auth/feishu/callback`
- 这会导致浏览器 OAuth 授权完成后无法在后端完成 `code -> JWT` 交换

## 接口概览

完整接口说明见：`../架构/API接口文档.md`

### 鉴权 `/api/auth`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/feishu/code2token` | 飞书 JSSDK 静默获取 code 后换取 JWT | 无 |
| GET  | `/auth/feishu/launch` | 飞书工作台 / H5 网页应用入口，302 到前端页面 | 无 |
| GET  | `/auth/feishu/redirect` | 外部浏览器发起 OAuth，302 到飞书授权页 | 无 |
| GET  | `/auth/feishu/callback` | 飞书 OAuth 回调，换 JWT 后 302 回前端 | 无 |
| GET  | `/auth/me` | 返回当前登录用户信息 | JWT |
| POST | `/auth/mock-login` | Mock 登录，返回真实 JWT（仅本地开发兜底） | 无 |

### 系统 `/api/system`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/system/health` | 健康检查 |
| GET | `/system/sync-status` | 当前数据同步状态 |
| POST | `/system/sync` | 手动触发同步（调试用） |

### 元数据 `/api/meta`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/meta/disease-tree` | 两级疾病树（ta → 适应症） |
| GET | `/meta/targets` | 靶点列表（可按疾病筛选） |
| GET | `/meta/stages` | 研发阶段枚举与 score 映射 |

### 业务查询

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| POST | `/matrix/query` | 竞争矩阵主查询 | 已完成 |
| POST | `/matrix/tooltip` | 矩阵单格详情 | 已完成 |
| GET  | `/matrix/export` | 矩阵 Excel 导出 | 已完成 |
| POST | `/pipeline/query` | 研发泳道查询 | 已完成 |
| GET  | `/pipeline/export` | 泳道 Excel 导出 | 已完成 |
| GET  | `/export/jobs` | 导出任务列表 | 待实现（占位） |
| GET  | `/export/jobs/{id}/download` | 下载导出文件 | 待实现（占位） |

## 统一响应格式

所有接口返回：

```json
{ "code": 0, "msg": "ok", "data": { ... } }
```

业务异常时 `code` 非 0，HTTP 状态码与 `code` 保持一致。

## DuckDB 视图层

启动时在内存中建立三个逻辑视图，供所有查询接口复用：

| 视图 | 说明 |
|------|------|
| `latest_records` | 按 PRD 规则过滤最新试验记录（nct_id = highest_trial_id） |
| `stage_mapped_records` | 在 `latest_records` 基础上附加阶段 score 映射 |
| `normalized_target_records` | 靶点归一化（拆分、排序、拼接）+ target_count |

parquet 文件热更新后（OSS 同步完成），视图自动重建，Redis 缓存同步清除，业务无中断。

## 数据同步流程

```
APScheduler 05:10 触发
  → 从 OSS 下载最新 parquet（3 个文件）
  → 校验 MD5
  → 原子切换软链到新版本目录
  → reload_conn() 重建 DuckDB 视图
  → 清除 Redis 全部查询缓存
  → 写入 sync_jobs / data_versions 记录
  → 清理 7 天前的旧版本目录
```

失败时保留上一个版本继续服务，错误写入 `sync_jobs.error_msg`。

## 数据库迁移

```bash
cd backend
alembic upgrade head   # 建表
alembic revision --autogenerate -m "描述"  # 生成新迁移
```

当前迁移：`001_sync_tables` — 创建 `sync_jobs` 和 `data_versions` 表。

## Docker 部署

完整服务栈（init + backend + mysql + redis + nginx）：

```bash
cd deploy
docker compose up -d
```

启动顺序由依赖关系自动保障：

```
mysql (healthy)
  └── init (alembic 建表 + parquet 就绪，healthy)
        └── backend (API 服务，healthy)
              └── nginx (反向代理 + 前端静态资源)
```

`init` 容器职责：
- 运行 `alembic upgrade head`
- 检查本地挂载的 `../backend/parquet/` 是否有数据文件 → 有则复制并建软链
- 若本地无文件，从 OSS 下载（需配置 OSS 环境变量）
- 建立 `/data/parquet_current` 软链，healthcheck 以此判断就绪

`backend` 容器仅在 `init` healthy 后才启动，确保 parquet 和数据库表都已就绪。

### 仅重建后端镜像

```bash
cd deploy
docker compose up -d --build backend
```

### 查看初始化日志

```bash
docker compose logs -f init
```

## init_data.py 用法

```
python -m scripts.init_data [--skip-alembic] [--skip-parquet] [--force]

  --skip-alembic   跳过数据库迁移（已建表时可用）
  --skip-parquet   跳过 parquet 拉取
  --force          强制重新拉取 parquet（即使软链已就绪）
```
