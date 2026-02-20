"""Initial persistence schema with pgvector support.

Revision ID: 20260219_0001
Revises:
Create Date: 2026-02-19 14:30:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.db.types import Vector

# revision identifiers, used by Alembic.
revision: str = "20260219_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("total_pages", sa.Integer(), nullable=True),
        sa.Column("page_width", sa.Float(), nullable=True),
        sa.Column("page_height", sa.Float(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_documents")),
    )
    op.create_index(op.f("ix_documents_status"), "documents", ["status"], unique=False)

    op.create_table(
        "pages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("width_pts", sa.Float(), nullable=True),
        sa.Column("height_pts", sa.Float(), nullable=True),
        sa.Column("image_path", sa.String(length=1024), nullable=True),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_pages_document_id_documents"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pages")),
        sa.UniqueConstraint("document_id", "page_number", name=op.f("uq_pages_document_id")),
    )
    op.create_index(op.f("ix_pages_document_id"), "pages", ["document_id"], unique=False)

    op.create_table(
        "spans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("page_id", sa.Integer(), nullable=False),
        sa.Column("span_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("x1", sa.Float(), nullable=False),
        sa.Column("y1", sa.Float(), nullable=False),
        sa.Column("x2", sa.Float(), nullable=False),
        sa.Column("y2", sa.Float(), nullable=False),
        sa.Column("char_start", sa.Integer(), nullable=True),
        sa.Column("char_end", sa.Integer(), nullable=True),
        sa.CheckConstraint("x2 > x1", name=op.f("ck_spans_x2_gt_x1")),
        sa.CheckConstraint("y2 > y1", name=op.f("ck_spans_y2_gt_y1")),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_spans_document_id_documents"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["page_id"],
            ["pages.id"],
            name=op.f("fk_spans_page_id_pages"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_spans")),
        sa.UniqueConstraint("page_id", "span_index", name=op.f("uq_spans_page_id")),
    )
    op.create_index(op.f("ix_spans_document_id"), "spans", ["document_id"], unique=False)
    op.create_index(op.f("ix_spans_page_id"), "spans", ["page_id"], unique=False)

    op.create_table(
        "chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("page_start", sa.Integer(), nullable=True),
        sa.Column("page_end", sa.Integer(), nullable=True),
        sa.Column("span_start_id", sa.Integer(), nullable=True),
        sa.Column("span_end_id", sa.Integer(), nullable=True),
        sa.Column("embedding", Vector(dim=1536), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_chunks_document_id_documents"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["span_start_id"],
            ["spans.id"],
            name=op.f("fk_chunks_span_start_id_spans"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["span_end_id"],
            ["spans.id"],
            name=op.f("fk_chunks_span_end_id_spans"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chunks")),
        sa.UniqueConstraint("document_id", "chunk_index", name=op.f("uq_chunks_document_id")),
    )
    op.create_index(op.f("ix_chunks_document_id"), "chunks", ["document_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_chunks_document_id"), table_name="chunks")
    op.drop_table("chunks")

    op.drop_index(op.f("ix_spans_page_id"), table_name="spans")
    op.drop_index(op.f("ix_spans_document_id"), table_name="spans")
    op.drop_table("spans")

    op.drop_index(op.f("ix_pages_document_id"), table_name="pages")
    op.drop_table("pages")

    op.drop_index(op.f("ix_documents_status"), table_name="documents")
    op.drop_table("documents")
