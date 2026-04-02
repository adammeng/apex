# 后端开发规范 — Apex

本文件是 `backend/` 目录下的工作约束，AI 和开发者在此目录操作前必须阅读。

## 技术栈

Python 3.9 · FastAPI · Pydantic v2 · DuckDB（in-memory）· Redis（异步缓存）· MySQL + SQLAlchemy 2（元数据）· APScheduler · Alembic

---

## 目录结构

```
app/
├── main.py           # FastAPI 应用工厂 + 生命周期
├── core/
│   ├── config.py     # Settings（pydantic-settings，@lru_cache）
│   ├── duckdb_conn.py # DuckDB 单例连接 + 视图注册
│   ├── redis_client.py # 异步 Redis 工具函数
│   ├── jwt.py        # JWT 签发与校验
│   └── logging.py    # 统一日志
├── routers/          # FastAPI 路由，按业务域拆分
├── schemas/          # Pydantic 请求/响应模型
│   └── response.py   # ApiResponse 通用响应结构
├── services/         # 业务逻辑（DuckDB 查询 + 数据组装）
├── repositories/     # MySQL CRUD（SQLAlchemy ORM）
├── models/           # SQLAlchemy ORM 模型
├── tasks/            # APScheduler 定时任务（OSS 同步）
└── utils/            # 纯工具函数
```

---

## 响应格式

**所有接口**统一返回 `ApiResponse`，不允许裸返回 dict 或直接 raise HTTP 异常暴露细节：

```python
# schemas/response.py 已定义，直接使用
return ApiResponse.ok(data=result)
return ApiResponse.error(code=400, msg="参数错误")
```

响应结构固定为：
```json
{"code": 0, "msg": "ok", "data": ...}
```

---

## DuckDB 使用规范

DuckDB 使用 in-memory 单例连接，已在启动时注册好以下视图：

| 视图名 | 说明 |
|---|---|
| `ci_tracking_raw` | 临床试验跟踪原始数据 |
| `clinical_detail_raw` | 临床试验详情原始数据 |
| `drug_pipeline_raw` | 药物管线原始数据 |
| `latest_records` | 按 PRD 规则去重后的主视图（**业务查询默认从这里开始**）|
| `stage_mapped_records` | 含 `stage_score` / `stage_display` 的阶段标准化视图 |
| `normalized_target_records` | 含靶点归一化字段的视图 |

**规则：**

```python
# 业务代码：始终用 get_cursor()，每次返回独立 cursor，线程安全
from app.core.duckdb_conn import get_cursor

cursor = get_cursor()
rows = cursor.execute("SELECT ... FROM latest_records WHERE ...").fetchall()

# 禁止在业务代码中调用 get_conn()，仅启动预热使用
# 禁止在业务代码中创建新的 DuckDB 连接
```

**参数化查询**，防止 SQL 注入，DuckDB 使用位置参数 `$1, $2, ...`：

```python
rows = cursor.execute(
    "SELECT * FROM latest_records WHERE harbour_indication_name = $1 AND ta = $2",
    [indication, ta]
).fetchall()
```

---

## Redis 缓存规范

所有缓存操作通过 `app/core/redis_client.py` 的工具函数，不直接操作 Redis 客户端：

```python
from app.core.redis_client import cache_get, cache_set, make_cache_key

# key 格式：apex:<prefix>:<md5(params)>
key = make_cache_key("matrix", {"ta": ta, "targets": targets})

cached = await cache_get(key)
if cached:
    return ApiResponse.ok(data=cached)

result = ... # 查询逻辑
await cache_set(key, result)  # TTL 默认读配置，也可显式传入
return ApiResponse.ok(data=result)
```

**命名空间统一为 `apex:`**，数据同步后执行 `cache_flush_pattern("apex:*")` 清除全部缓存。

---

## 新增路由的标准写法

```python
# routers/xxx.py
from fastapi import APIRouter, Query
from ..core.duckdb_conn import get_cursor
from ..core.redis_client import cache_get, cache_set, make_cache_key
from ..schemas.response import ApiResponse

router = APIRouter(prefix="/xxx", tags=["模块名"])

@router.get("/list", summary="接口说明")
async def list_xxx(
    ta: str = Query(None, description="治疗领域"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    params = {"ta": ta, "page": page, "page_size": page_size}
    key = make_cache_key("xxx_list", params)

    cached = await cache_get(key)
    if cached:
        return ApiResponse.ok(data=cached)

    cursor = get_cursor()
    # ... 查询逻辑 ...

    await cache_set(key, result)
    return ApiResponse.ok(data=result)
```

路由注册在 `main.py` 的 `create_app()` 中：

```python
from .routers import xxx
app.include_router(xxx.router, prefix=settings.api_prefix)
```

---

## Pydantic Schema 规范

- 请求参数和响应数据都用 Pydantic 模型，不用裸 dict
- 字段命名与数据库/parquet 原始字段保持一致（snake_case）
- 可空字段显式标注 `Optional[str] = None`（Python 3.9 不支持 `str | None` 语法）
- 不要用 `Any` 替代明确类型

```python
# schemas/trial.py 示例
from typing import Optional
from pydantic import BaseModel

class TrialItem(BaseModel):
    nct_id: str
    drug_name_cn: Optional[str] = None
    overall_status_cn: Optional[str] = None
    phase_revised: Optional[str] = None

class TrialListData(BaseModel):
    list: list[TrialItem]
    total: int
```

---

## MySQL / SQLAlchemy 规范

- ORM 模型放 `models/`，CRUD 操作放 `repositories/`，路由不直接写 ORM 查询
- Session 通过依赖注入获取，不手动管理事务（除非有明确需要）
- 迁移通过 Alembic 管理，不手动 ALTER TABLE

```python
# repositories/xxx.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.xxx import XxxModel

async def get_by_id(session: AsyncSession, record_id: int) -> XxxModel | None:
    result = await session.execute(select(XxxModel).where(XxxModel.id == record_id))
    return result.scalar_one_or_none()
```

---

## 配置与环境变量

- 配置通过 `get_settings()` 读取，`@lru_cache` 已保证单例
- 不在业务代码里用 `os.environ` 直接读配置
- 新增配置项在 `Settings` 类中声明，提供默认值，同步更新 `.env.example`

```python
from app.core.config import get_settings
settings = get_settings()
```

---

## 日志规范

- 使用 `get_logger(__name__)` 获取 logger，不用 `print`
- 业务异常记录 `logger.error`，预期内的降级记录 `logger.warning`
- 不在正常流程中频繁打 `logger.debug` 污染日志

```python
from app.core.logging import get_logger
logger = get_logger(__name__)

logger.info(f"查询完成: {total} 条结果")
logger.warning(f"Redis 缓存未命中，降级查询 DuckDB: key={key}")
logger.error(f"DuckDB 查询失败: {e}", exc_info=True)
```

---

## 错误处理

- 路由层捕获预期异常，返回 `ApiResponse.error()`，不抛出 500
- 非预期异常由 `main.py` 的全局异常处理器兜底
- Redis / OSS 等外部依赖的异常**不应让接口失败**，降级处理后继续

```python
try:
    result = await some_external_call()
except Exception as e:
    logger.warning(f"外部调用失败，降级处理: {e}")
    result = default_value
```

---

## 数据同步与热更新

- parquet 文件存放在 `backend/parquet/`，由 OSS 同步覆盖
- 同步后调用 `reload_conn()` 重建 DuckDB 连接，再调用 `cache_flush_pattern("apex:*")` 清缓存
- 定时任务在 `tasks/scheduler.py`，时间由 `settings.sync_hour / sync_minute` 控制

---

## Python 3.9 兼容性

以下写法在 3.9 下不可用，必须用替代形式：

| 不可用 | 替代 |
|---|---|
| `str \| None` | `Optional[str]` |
| `list[str]`（类型注解）| `List[str]` 或运行时无泛型 |
| `dict[str, int]`（类型注解）| `Dict[str, int]` |
| `X \| Y`（联合类型注解）| `Union[X, Y]` |

类型导入：`from typing import Optional, List, Dict, Union`

---

## 禁止事项

- 业务代码中直接调用 `get_conn()`（仅启动预热使用）
- SQL 拼接用户输入（必须用参数化查询）
- 路由函数里写大段业务逻辑（抽到 `services/`）
- 直接用 `os.environ` 读配置
- 用 `print` 替代日志
- 新增 MySQL 表不走 Alembic 迁移
- `Optional[str]` 写成 `str | None`（Python 3.9 不支持）
