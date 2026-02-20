from __future__ import annotations

import uuid

from sqlalchemy import Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Page(Base):
    __tablename__ = "pages"
    __table_args__ = (UniqueConstraint("document_id", "page_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    width_pts: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_pts: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    document: Mapped["Document"] = relationship("Document", back_populates="pages")
    spans: Mapped[list["Span"]] = relationship(
        "Span",
        back_populates="page",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
