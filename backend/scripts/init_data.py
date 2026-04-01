"""
Apex 数据初始化脚本
执行顺序：
  1. alembic upgrade head   — 建表/迁移
  2. 检查 parquet 是否已存在，若缺失则从 OSS 拉取

本地开发和 Docker init 容器共用此脚本。
用法：
  python -m scripts.init_data [--skip-alembic] [--skip-parquet] [--force]
"""

import argparse
import asyncio
import subprocess
import sys
from pathlib import Path

# 将 backend/ 加入 path，使 app 包可被直接导入
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.core.config import get_settings  # noqa: E402
from app.core.logging import get_logger, setup_logging  # noqa: E402

setup_logging()
logger = get_logger("init_data")

_PARQUET_ATTRS = [
    "parquet_ci_tracking",
    "parquet_clinical_detail",
    "parquet_drug_pipeline",
]


def run_alembic() -> None:
    """运行 alembic upgrade head，建表或迁移。"""
    logger.info("运行 alembic upgrade head ...")
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=str(ROOT),
        capture_output=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"alembic upgrade 失败，退出码 {result.returncode}")
    logger.info("alembic upgrade head 完成")


def _parquet_dir_ready(parquet_dir: Path, settings) -> bool:
    """检查 parquet_dir 下三个文件是否都存在。"""
    return all(
        (parquet_dir / getattr(settings, attr)).exists() for attr in _PARQUET_ATTRS
    )


def _copy_local_parquet(src: Path, dst: Path, settings) -> bool:
    """
    如果 PARQUET_DIR 下已有文件（本地开发场景），
    直接复制到 DATA_DIR/raw/<today>/ 并建软链。
    返回 True 表示已处理，无需走 OSS。
    """
    import shutil
    from datetime import datetime, timezone

    if not _parquet_dir_ready(src, settings):
        return False

    version = datetime.now(timezone.utc).strftime("%Y%m%d")
    dst_version = dst / version
    dst_version.mkdir(parents=True, exist_ok=True)

    for attr in _PARQUET_ATTRS:
        filename = getattr(settings, attr)
        src_file = src / filename
        dst_file = dst_version / filename
        if not dst_file.exists():
            shutil.copy2(str(src_file), str(dst_file))
            logger.info(f"  复制 {filename} → {dst_version}")
        else:
            logger.info(f"  已存在 {filename}，跳过复制")

    # 建软链 parquet_current → 新版本目录
    _make_symlink(settings.data_path / "parquet_current", dst_version)
    return True


def _make_symlink(link: Path, target: Path) -> None:
    import os

    tmp = link.parent / (link.name + ".tmp")
    if tmp.exists() or tmp.is_symlink():
        tmp.unlink()
    os.symlink(str(target.resolve()), str(tmp))
    os.replace(str(tmp), str(link))
    logger.info(f"软链 parquet_current → {target}")


async def pull_parquet(force: bool = False) -> None:
    """
    拉取 parquet 数据：
    - 优先检查 PARQUET_DIR 本地文件（本地开发）
    - 否则从 OSS 下载（Docker / 生产）
    """
    settings = get_settings()
    raw_dir = settings.raw_data_dir
    parquet_src = settings.parquet_path

    # 检查软链是否已就绪
    symlink = settings.data_path / "parquet_current"
    if not force and symlink.exists() and symlink.is_symlink():
        resolved = symlink.resolve()
        if _parquet_dir_ready(resolved, settings):
            logger.info(f"parquet_current 软链已就绪（{resolved}），跳过拉取")
            return

    # 尝试从本地 PARQUET_DIR 复制（本地开发场景）
    if parquet_src.exists() and _parquet_dir_ready(parquet_src, settings):
        logger.info(f"检测到本地 parquet 目录 {parquet_src}，直接使用")
        _copy_local_parquet(parquet_src, raw_dir, settings)
        return

    # 从 OSS 拉取
    logger.info("本地 parquet 不存在，从 OSS 拉取...")
    from app.tasks.oss_sync import run_sync

    result = await run_sync(force=force)
    if result["status"] == "failed":
        raise RuntimeError(f"OSS 拉取失败: {result['msg']}")
    logger.info(f"OSS 拉取完成: {result['msg']}")


async def main(skip_alembic: bool, skip_parquet: bool, force: bool) -> None:
    if not skip_alembic:
        run_alembic()
    else:
        logger.info("跳过 alembic（--skip-alembic）")

    if not skip_parquet:
        await pull_parquet(force=force)
    else:
        logger.info("跳过 parquet 拉取（--skip-parquet）")

    logger.info("初始化完成")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Apex 数据初始化")
    parser.add_argument("--skip-alembic", action="store_true", help="跳过数据库迁移")
    parser.add_argument("--skip-parquet", action="store_true", help="跳过 parquet 拉取")
    parser.add_argument("--force", action="store_true", help="强制重新下载 parquet")
    args = parser.parse_args()

    asyncio.run(main(args.skip_alembic, args.skip_parquet, args.force))
