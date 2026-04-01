"""drop data_versions, remove unique constraint on sync_jobs.version

Revision ID: 002_simplify_sync
Revises: 001_sync_tables
Create Date: 2026-04-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_simplify_sync"
down_revision: Union[str, None] = "001_sync_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 删除 data_versions 表（不再做版本存档）
    op.drop_index("ix_data_versions_version", table_name="data_versions")
    op.drop_table("data_versions")

    # sync_jobs.version 去掉唯一约束（同一天允许多次同步记录）
    op.drop_constraint("uq_sync_jobs_version", "sync_jobs", type_="unique")


def downgrade() -> None:
    # 恢复唯一约束
    op.create_unique_constraint("uq_sync_jobs_version", "sync_jobs", ["version"])

    # 恢复 data_versions 表
    op.create_table(
        "data_versions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("version", sa.String(length=20), nullable=False, unique=True),
        sa.Column("parquet_dir", sa.String(length=512), nullable=False),
        sa.Column("md5_map", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_data_versions_version", "data_versions", ["version"])
