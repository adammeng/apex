"""
MySQL 元数据表模型
- sync_jobs: 每次同步任务的执行记录
- data_versions: 已成功同步的可用版本
"""

import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from datetime import datetime
from typing import Optional


class Base(DeclarativeBase):
    pass


class SyncJob(Base):
    """每次 OSS 同步任务的执行记录。"""

    __tablename__ = "sync_jobs"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(sa.String(20), nullable=False, index=True)
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

    __table_args__ = (sa.UniqueConstraint("version", name="uq_sync_jobs_version"),)


class DataVersion(Base):
    """已成功同步、可供查询的 parquet 数据版本。"""

    __tablename__ = "data_versions"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(
        sa.String(20), nullable=False, unique=True, index=True, comment="YYYYMMDD"
    )
    parquet_dir: Mapped[str] = mapped_column(
        sa.String(512), nullable=False, comment="本地目录绝对路径"
    )
    md5_map: Mapped[Optional[str]] = mapped_column(
        sa.Text, nullable=True, comment="各文件 md5 JSON"
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
