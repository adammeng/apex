"""
Apex FastAPI 应用入口
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.config import get_settings
from .core.logging import get_logger, setup_logging
from .routers import auth, export, matrix, meta, pipeline, system
from .tasks.scheduler import start_scheduler, stop_scheduler

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动/关闭生命周期。"""
    settings = get_settings()
    logger.info(
        f"启动 {settings.app_name} v{settings.app_version} [{settings.environment}]"
    )

    # 启动时确保 parquet 就绪（有文件自动跳过，无文件从 OSS 拉取）
    try:
        from .tasks.oss_sync import run_sync

        result = await run_sync()
        logger.info(f"启动 parquet 检查: {result['msg']}")
    except Exception as e:
        logger.warning(f"启动 parquet 检查失败: {e}")

    # 预热 DuckDB 连接
    try:
        from .core.duckdb_conn import get_conn

        get_conn()
        logger.info("DuckDB 预热完成")
    except Exception as e:
        logger.warning(f"DuckDB 预热失败（parquet 文件可能不存在）: {e}")

    # 启动定时同步任务（每日 05:10 从 OSS 覆盖拉取）
    try:
        start_scheduler()
    except Exception as e:
        logger.warning(f"定时任务启动失败: {e}")

    yield

    # 关闭定时任务
    try:
        stop_scheduler()
    except Exception:
        pass

    logger.info("应用关闭")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 全局异常处理
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"未处理异常: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"code": 500, "msg": "服务器内部错误", "data": None},
        )

    # 注册路由
    prefix = settings.api_prefix
    app.include_router(auth.router, prefix=prefix)
    app.include_router(system.router, prefix=prefix)
    app.include_router(meta.router, prefix=prefix)
    app.include_router(matrix.router, prefix=prefix)
    app.include_router(pipeline.router, prefix=prefix)
    app.include_router(export.router, prefix=prefix)

    return app


app = create_app()
