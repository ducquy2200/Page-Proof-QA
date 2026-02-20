from __future__ import annotations

from pydantic import BaseModel, Field


class BBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class EvidenceItem(BaseModel):
    page: int = Field(ge=1)
    text: str = Field(min_length=1)
    bbox: BBox
    page_width: float | None = None
    page_height: float | None = None


class AskQuestionRequest(BaseModel):
    question: str = Field(min_length=1)


class AskQuestionResponse(BaseModel):
    answer: str
    evidence: list[EvidenceItem]
