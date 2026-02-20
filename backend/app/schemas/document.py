from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


DocumentStatus = Literal["processing", "ready", "error"]


class DocumentUploadResponse(BaseModel):
    document_id: str


class DocumentStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: DocumentStatus
    total_pages: int | None
    page_width: float | None
    page_height: float | None
    error_message: str | None = None

