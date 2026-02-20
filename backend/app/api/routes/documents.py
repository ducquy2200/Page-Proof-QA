from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Path as FastAPIPath, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import SessionLocal, get_db
from app.models.document import Document
from app.models.page import Page as PageModel
from app.schemas.document import DocumentStatusResponse, DocumentUploadResponse
from app.schemas.qa import AskQuestionRequest, AskQuestionResponse
from app.services.document_processing import (
    FileTooLargeError,
    ensure_document_dir,
    persist_upload,
    process_document_metadata,
    remove_document_dir,
)
from app.services.qa import (
    DocumentNotReadyError,
    InvalidQuestionError,
    OpenAIConfigurationError,
    QAError,
    ask_question,
)

router = APIRouter(tags=["documents"])


def _process_document_in_background(document_id: str, pdf_path: str) -> None:
    db = SessionLocal()
    try:
        process_document_metadata(db=db, document_id=uuid.UUID(document_id), pdf_path=Path(pdf_path))
    finally:
        db.close()


@router.post(
    "/documents",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DocumentUploadResponse:
    filename = file.filename or ""
    is_pdf_name = filename.lower().endswith(".pdf")
    content_type = (file.content_type or "").lower()
    is_pdf_content = "pdf" in content_type

    if not is_pdf_name and not is_pdf_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported.",
        )

    document_id = uuid.uuid4()
    document_dir = ensure_document_dir(settings.upload_dir, document_id)
    source_pdf_path = document_dir / "source.pdf"

    try:
        persist_upload(file, source_pdf_path, settings.max_upload_bytes)
    except FileTooLargeError:
        remove_document_dir(document_dir)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File is too large.",
        ) from None
    except Exception:
        remove_document_dir(document_dir)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read uploaded file.",
        ) from None

    document = Document(
        id=document_id,
        filename=filename or "uploaded.pdf",
        content_type=file.content_type,
        status="processing",
    )
    db.add(document)
    db.commit()

    background_tasks.add_task(
        _process_document_in_background,
        document_id=str(document_id),
        pdf_path=str(source_pdf_path),
    )

    return DocumentUploadResponse(document_id=str(document_id))


@router.get(
    "/documents/{document_id}/status",
    response_model=DocumentStatusResponse,
)
def get_document_status(document_id: str, db: Session = Depends(get_db)) -> DocumentStatusResponse:
    try:
        document_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}",
        ) from exc

    document = db.get(Document, document_uuid)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}",
        )

    return DocumentStatusResponse(
        status=document.status,
        total_pages=document.total_pages,
        page_width=document.page_width,
        page_height=document.page_height,
        error_message=document.error_message,
    )


@router.get("/documents/{document_id}/pages/{page}")
def get_document_page_image(
    document_id: str,
    page: int = FastAPIPath(..., ge=1),
    db: Session = Depends(get_db),
) -> FileResponse:
    try:
        document_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}",
        ) from exc

    document = db.get(Document, document_uuid)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}",
        )

    page_row = db.execute(
        select(PageModel).where(
            PageModel.document_id == document_uuid,
            PageModel.page_number == page,
        )
    ).scalar_one_or_none()
    if page_row is None or not page_row.image_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Page not found: {page}",
        )

    image_path = Path(page_row.image_path)
    if not image_path.is_absolute():
        image_path = Path.cwd() / image_path

    if not image_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Page image not found: {page}",
        )

    return FileResponse(path=image_path, media_type="image/png", filename=image_path.name)


@router.post(
    "/documents/{document_id}/ask",
    response_model=AskQuestionResponse,
)
def ask_document_question(
    document_id: str,
    payload: AskQuestionRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AskQuestionResponse:
    try:
        document_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}",
        ) from exc

    document = db.get(Document, document_uuid)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}",
        )

    try:
        return ask_question(
            db=db,
            settings=settings,
            document_id=document_uuid,
            question=payload.question,
        )
    except InvalidQuestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except DocumentNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except OpenAIConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except QAError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Question answering failed: {exc}",
        ) from exc
