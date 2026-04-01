"""create sync_jobs and data_versions tables

Revision ID: 001_sync_tables
Revises:
Create Date: 2026-04-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_sync_tables"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # sync_jobs 表：记录每次 OSS 同步任务
    op.create_table(
        "sync_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("version", sa.String(length=20), nullable=False, comment="YYYYMMDD"),
        sa.Column(
            "status",
            sa.Enum("running", "success", "failed", "skipped", name="sync_status"),
            nullable=False,
            server_default="running",
        ),
        sa.Column("md5_map", sa.Text(), nullable=True, comment="各文件 md5 JSON"),
        sa.Column("error_msg", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version", name="uq_sync_jobs_version"),
    )
    op.create_index("ix_sync_jobs_version", "sync_jobs", ["version"])

    # data_versions 表：记录可供查询的版本
    op.create_table(
        "data_versions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "version",
            sa.String(length=20),
            nullable=False,
            unique=True,
            comment="YYYYMMDD",
        ),
        sa.Column(
            "parquet_dir",
            sa.String(length=512),
            nullable=False,
            comment="本地目录绝对路径",
        ),
        sa.Column("md5_map", sa.Text(), nullable=True, comment="各文件 md5 JSON"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_data_versions_version", "data_versions", ["version"])


def downgrade() -> None:
    op.drop_index("ix_data_versions_version", table_name="data_versions")
    op.drop_table("data_versions")
    op.drop_index("ix_sync_jobs_version", table_name="sync_jobs")
    op.drop_table("sync_jobs")
    op.execute("DROP TYPE IF EXISTS sync_status")
