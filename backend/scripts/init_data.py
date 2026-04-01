"""
Apex 数据初始化脚本
执行顺序：
  1. alembic upgrade head   — 建表/迁移
  2. 检查 backend/parquet/ 下三个文件是否已存在
     - 已存在 → 跳过（本地开发常态，避免每次启动都下载）
     - 不存在 → 从 OSS 拉取

用法：
  python -m scripts.init_data [--skip-alembic] [--skip-parquet] [--force]
"""

import argparse
import asyncio
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.core.config import get_settings  # noqa: E402
from app.core.logging import get_logger, setup_logging  # noqa: E402

setup_logging()
logger = get_logger("init_data")


def run_alembic() -> None:
    """运行 alembic upgrade head。"""
    logger.info("运行 alembic upgrade head ...")
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=str(ROOT),
        capture_output=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"alembic upgrade 失败，退出码 {result.returncode}")
    logger.info("alembic upgrade head 完成")


async def ensure_parquet(force: bool = False) -> None:
    """
    确保 backend/parquet/ 下三个文件就绪。
    - 文件已存在且不强制 → 直接跳过
    - 否则从 OSS 下载
    """
    from app.tasks.oss_sync import _parquet_ready, run_sync

    settings = get_settings()

    if not force and _parquet_ready(settings):
        logger.info(f"parquet 文件已就绪（{settings.parquet_path}），跳过下载")
        return

    logger.info("parquet 文件不存在或强制刷新，从 OSS 拉取...")
    result = await run_sync(force=force)
    if result["status"] == "failed":
        raise RuntimeError(f"OSS 拉取失败: {result['msg']}")
    logger.info(f"parquet 就绪: {result['msg']}")


async def main(skip_alembic: bool, skip_parquet: bool, force: bool) -> None:
    if not skip_alembic:
        run_alembic()
    else:
        logger.info("跳过 alembic（--skip-alembic）")

    if not skip_parquet:
        await ensure_parquet(force=force)
    else:
        logger.info("跳过 parquet 检查（--skip-parquet）")

    logger.info("初始化完成")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Apex 数据初始化")
    parser.add_argument("--skip-alembic", action="store_true", help="跳过数据库迁移")
    parser.add_argument("--skip-parquet", action="store_true", help="跳过 parquet 检查")
    parser.add_argument("--force", action="store_true", help="强制重新从 OSS 下载")
    args = parser.parse_args()

    asyncio.run(main(args.skip_alembic, args.skip_parquet, args.force))
