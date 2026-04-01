# Apex Backend

`backend/` 是 Apex 的后端服务，基于 FastAPI，负责数据读取、接口聚合、鉴权、缓存、导出和后续的数据同步任务。

## 技术栈

- FastAPI
- Uvicorn
- Pydantic / pydantic-settings
- DuckDB
- Pandas / PyArrow
- Redis
- SQLAlchemy + MySQL
- APScheduler
- openpyxl

## 当前实现

- 已完成应用入口、生命周期管理和日志初始化
- 已完成环境变量配置加载
- 已接入全局异常处理与 CORS
- 已注册以下路由模块：
  - `auth` 鉴权
  - `system` 系统状态
  - `meta` 元数据
  - `matrix` 竞争矩阵
  - `pipeline` 研发泳道
  - `export` 导出
- 已实现健康检查与部分元数据接口
- 矩阵查询、泳道查询、飞书完整登录、导出下载等仍为占位实现

## 环境变量

复制模板：

```bash
cp .env.example .env
```

主要变量：

| 分类 | 变量 |
| --- | --- |
| 应用 | `DEBUG` `ENVIRONMENT` |
| JWT | `JWT_SECRET` `JWT_EXPIRE_MINUTES` |
| 飞书 | `FEISHU_APP_ID` `FEISHU_APP_SECRET` `FEISHU_REDIRECT_URI` |
| Redis | `REDIS_URL` `CACHE_TTL_SECONDS` |
| MySQL | `MYSQL_HOST` `MYSQL_PORT` `MYSQL_USER` `MYSQL_PASSWORD` `MYSQL_DATABASE` |
| 数据路径 | `DATA_DIR` `PARQUET_DIR` |
| 定时任务 | `SYNC_HOUR` `SYNC_MINUTE` |
| OSS | `OSS_ENDPOINT` `OSS_ACCESS_KEY_ID` `OSS_ACCESS_KEY_SECRET` `OSS_BUCKET_NAME` `OSS_PREFIX` |

说明：

- 配置默认从 `backend/.env` 读取
- `PARQUET_DIR` 需要指向实际 parquet 数据目录
- 服务启动时会尝试预热 DuckDB 连接

## 本地启动

建议在 `backend/` 目录下执行：

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

默认地址：

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`

## Docker 启动

仓库内已提供 `Dockerfile`，容器默认暴露 `8000` 端口，并以：

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

启动服务。

## 目录结构

```text
backend/
├── app/
│   ├── core/            # 配置、日志、DuckDB、Redis
│   ├── routers/         # 路由定义
│   ├── schemas/         # 响应模型
│   ├── services/        # 业务服务层
│   ├── repositories/    # 数据访问层
│   ├── tasks/           # 定时任务
│   └── main.py          # FastAPI 入口
├── tests/
├── .env.example
├── Dockerfile
└── requirements.txt
```

## 当前接口概览

| 模块 | 路径前缀 | 说明 |
| --- | --- | --- |
| 系统 | `/api/system` | 健康检查、同步状态 |
| 鉴权 | `/api/auth` | 飞书登录、回调、当前用户 |
| 元数据 | `/api/meta` | 疾病树、靶点列表、阶段枚举 |
| 矩阵 | `/api/matrix` | 竞争矩阵查询、tooltip、导出 |
| 泳道 | `/api/pipeline` | 研发泳道查询、导出 |
| 导出 | `/api/export` | 导出任务列表与下载 |

## 开发约定

- API 返回结构统一为 `code / msg / data`
- 中文业务语义优先，字段命名沿用现有英文代码命名
- 与 parquet 相关的数据查询优先通过 DuckDB 完成
- 需要落库的元数据与任务状态后续通过 MySQL 承载
