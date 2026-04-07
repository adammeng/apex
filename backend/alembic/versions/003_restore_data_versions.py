"""restore data_versions table for parquet snapshot archiving

Revision ID: 003_restore_data_versions
Revises: 002_simplify_sync
Create Date: 2026-04-07
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_restore_data_versions"
down_revision: Union[str, None] = "002_simplify_sync"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "data_versions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "version",
            sa.String(length=20),
            nullable=False,
            unique=True,
            comment="YYYYMMDD，与 sync_jobs.version 对应",
        ),
        sa.Column(
            "parquet_dir",
            sa.String(length=512),
            nullable=False,
            comment="归档目录绝对路径，如 .../parquet/20260407",
        ),
        sa.Column(
            "md5_map",
            sa.Text(),
            nullable=True,
            comment="各文件 md5 JSON",
        ),
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
