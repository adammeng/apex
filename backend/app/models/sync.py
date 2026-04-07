"""
MySQL 元数据表模型
- sync_jobs: 每次 OSS 同步任务的执行记录
- data_versions: 每次成功同步后保留的 parquet 历史快照记录
"""

from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class DataVersion(Base):
    """每次成功同步后归档的 parquet 快照记录。version 唯一，对应 parquet/YYYYMMDD/ 目录。"""

    __tablename__ = "data_versions"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(
        sa.String(20),
        nullable=False,
        unique=True,
        index=True,
        comment="YYYYMMDD 归档日期",
    )
    parquet_dir: Mapped[str] = mapped_column(
        sa.String(512),
        nullable=False,
        comment="归档目录绝对路径，如 .../parquet/20260407",
    )
    md5_map: Mapped[Optional[str]] = mapped_column(
        sa.Text, nullable=True, comment="各文件 md5 JSON"
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )


class SyncJob(Base):
    """每次 OSS 同步任务的执行记录。version 为触发日期（YYYYMMDD），同一天可多条。"""

    __tablename__ = "sync_jobs"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(
        sa.String(20), nullable=False, index=True, comment="YYYYMMDD 触发日期"
    )
    status: Mapped[str] = mapped_column(
        sa.Enum("running", "success", "failed", "skipped", name="sync_status"),
        nullable=False,
        default="running",
    )
    md5_map: Mapped[Optional[str]] = mapped_column(
        sa.Text, nullable=True, comment="各文件 md5 JSON"
    )
    error_msg: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
    )
