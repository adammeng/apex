"""
APScheduler 定时任务管理
- 每日指定时间触发 OSS 数据同步
- 使用 AsyncIOScheduler，与 FastAPI 生命周期绑定
"""

from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore
from apscheduler.triggers.cron import CronTrigger  # type: ignore

from ..core.config import get_settings
from ..core.logging import get_logger

logger = get_logger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
    return _scheduler


async def _sync_job() -> None:
    """定时任务回调：执行 OSS 同步。"""
    from .oss_sync import run_sync

    logger.info("定时同步任务触发")
    result = await run_sync()
    logger.info(f"定时同步任务完成: {result}")


def start_scheduler() -> None:
    """注册定时任务并启动 scheduler。"""
    settings = get_settings()
    scheduler = get_scheduler()

    scheduler.add_job(
        _sync_job,
        trigger=CronTrigger(
            hour=settings.sync_hour,
            minute=settings.sync_minute,
            timezone="Asia/Shanghai",
        ),
        id="oss_daily_sync",
        name="每日 OSS 数据同步",
        replace_existing=True,
        misfire_grace_time=600,  # 允许 10 分钟内的补偿触发
    )

    scheduler.start()
    logger.info(
        f"定时任务已启动，每日 {settings.sync_hour:02d}:{settings.sync_minute:02d} (Asia/Shanghai) 同步"
    )


def stop_scheduler() -> None:
    """关闭 scheduler（应用退出时调用）。"""
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("定时任务 scheduler 已关闭")
