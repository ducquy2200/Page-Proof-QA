from __future__ import annotations

from dataclasses import dataclass
import logging
import shutil
import uuid
from pathlib import Path

import fitz
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.chunk import Chunk
from app.models.document import Document
from app.models.page import Page
from app.models.span import Span

logger = logging.getLogger(__name__)

RENDER_SCALE = 2.0
CHUNK_MAX_CHARS = 900
CHUNK_OVERLAP_SPANS = 20
OCR_SCORE_MARGIN = 0.04


@dataclass
class ExtractedPageWords:
    words: list[tuple[float, float, float, float, str]]
    source: str
    attempted_ocr: bool
    native_word_count: int
    ocr_word_count: int


class FileTooLargeError(ValueError):
    """Raised when uploaded file exceeds configured size limit."""


def ensure_document_dir(upload_root: str, document_id: uuid.UUID) -> Path:
    document_dir = Path(upload_root) / str(document_id)
    document_dir.mkdir(parents=True, exist_ok=True)
    return document_dir


def persist_upload(upload_file, destination: Path, max_upload_bytes: int) -> int:
    total_bytes = 0
    chunk_size = 1024 * 1024

    with destination.open("wb") as target:
        while True:
            chunk = upload_file.file.read(chunk_size)
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > max_upload_bytes:
                raise FileTooLargeError(f"File exceeds upload size limit of {max_upload_bytes} bytes.")
            target.write(chunk)

    upload_file.file.seek(0)
    return total_bytes


def remove_document_dir(document_dir: Path) -> None:
    shutil.rmtree(document_dir, ignore_errors=True)


def _extract_words(
    page: fitz.Page,
    *,
    textpage: fitz.TextPage | None = None,
) -> list[tuple[float, float, float, float, str]]:
    if textpage is None:
        words = page.get_text("words", sort=True)
    else:
        words = page.get_text("words", textpage=textpage, sort=True)

    extracted: list[tuple[float, float, float, float, str]] = []

    for item in words:
        x0, y0, x1, y1, text = item[:5]
        clean = str(text).strip()
        if not clean:
            continue
        extracted.append((float(x0), float(y0), float(x1), float(y1), clean))

    return extracted


def _word_quality_metrics(words: list[tuple[float, float, float, float, str]]) -> tuple[int, float]:
    if not words:
        return 0, 0.0

    compact = "".join(text for _, _, _, _, text in words)
    if not compact:
        return 0, 0.0

    alnum_chars = sum(1 for ch in compact if ch.isalnum())
    alnum_ratio = alnum_chars / len(compact)
    return len(words), alnum_ratio


def _should_attempt_ocr(
    *,
    word_metrics: tuple[int, float],
    settings: Settings,
) -> bool:
    if not settings.ocr_fallback_enabled:
        return False

    word_count, alnum_ratio = word_metrics
    return (
        word_count < settings.ocr_trigger_min_words
        or alnum_ratio < settings.ocr_trigger_min_alnum_ratio
    )


def _word_quality_score(
    *,
    word_metrics: tuple[int, float],
    settings: Settings,
) -> float:
    word_count, alnum_ratio = word_metrics
    word_target = max(1, settings.ocr_trigger_min_words)
    word_score = min(1.0, word_count / word_target)
    return (word_score * 0.55) + (alnum_ratio * 0.45)


def _should_use_ocr(
    *,
    native_metrics: tuple[int, float],
    ocr_metrics: tuple[int, float],
    settings: Settings,
) -> bool:
    native_count, native_ratio = native_metrics
    ocr_count, ocr_ratio = ocr_metrics

    if ocr_count == 0:
        return False
    if native_count == 0:
        return True

    native_score = _word_quality_score(word_metrics=native_metrics, settings=settings)
    ocr_score = _word_quality_score(word_metrics=ocr_metrics, settings=settings)

    if ocr_score >= native_score + OCR_SCORE_MARGIN:
        return True
    if native_count < settings.ocr_trigger_min_words and ocr_count > native_count:
        return True
    if ocr_ratio >= native_ratio + 0.12 and ocr_count >= max(3, native_count // 2):
        return True

    return False


def _extract_words_with_fallback(
    *,
    page: fitz.Page,
    page_number: int,
    settings: Settings,
) -> ExtractedPageWords:
    native_words = _extract_words(page)
    native_metrics = _word_quality_metrics(native_words)

    if not _should_attempt_ocr(word_metrics=native_metrics, settings=settings):
        return ExtractedPageWords(
            words=native_words,
            source="native",
            attempted_ocr=False,
            native_word_count=len(native_words),
            ocr_word_count=0,
        )

    try:
        textpage = page.get_textpage_ocr(
            language=settings.ocr_language,
            dpi=settings.ocr_dpi,
            full=settings.ocr_full_page,
            tessdata=settings.ocr_tessdata or None,
        )
        ocr_words = _extract_words(page, textpage=textpage)
    except Exception as exc:
        logger.warning("OCR fallback failed on page %s: %s", page_number, exc)
        return ExtractedPageWords(
            words=native_words,
            source="native",
            attempted_ocr=True,
            native_word_count=len(native_words),
            ocr_word_count=0,
        )

    ocr_metrics = _word_quality_metrics(ocr_words)
    use_ocr = _should_use_ocr(
        native_metrics=native_metrics,
        ocr_metrics=ocr_metrics,
        settings=settings,
    )

    if use_ocr:
        return ExtractedPageWords(
            words=ocr_words,
            source="ocr",
            attempted_ocr=True,
            native_word_count=len(native_words),
            ocr_word_count=len(ocr_words),
        )

    return ExtractedPageWords(
        words=native_words,
        source="native",
        attempted_ocr=True,
        native_word_count=len(native_words),
        ocr_word_count=len(ocr_words),
    )


def _chunk_span_window(span_refs: list[tuple[Span, int]]) -> list[tuple[int, int]]:
    if not span_refs:
        return []

    windows: list[tuple[int, int]] = []
    start = 0

    while start < len(span_refs):
        end = start
        total_chars = 0

        while end < len(span_refs):
            text_len = len(span_refs[end][0].text) + (1 if total_chars else 0)
            if total_chars + text_len > CHUNK_MAX_CHARS and end > start:
                break
            total_chars += text_len
            end += 1

        windows.append((start, end))
        if end >= len(span_refs):
            break

        start = max(end - CHUNK_OVERLAP_SPANS, start + 1)

    return windows


def _reset_document_rows(db: Session, document_id: uuid.UUID) -> None:
    db.query(Chunk).filter(Chunk.document_id == document_id).delete(synchronize_session=False)
    db.query(Span).filter(Span.document_id == document_id).delete(synchronize_session=False)
    db.query(Page).filter(Page.document_id == document_id).delete(synchronize_session=False)
    db.flush()


def process_document_metadata(
    db: Session,
    document_id: uuid.UUID,
    pdf_path: Path,
    settings: Settings | None = None,
) -> None:
    if settings is None:
        settings = get_settings()

    document = db.get(Document, document_id)
    if document is None:
        return

    pdf = None
    try:
        pdf = fitz.open(pdf_path)
        total_pages = pdf.page_count
        if total_pages == 0:
            raise ValueError("PDF has no pages.")

        _reset_document_rows(db, document_id)

        pages_dir = pdf_path.parent / "pages"
        shutil.rmtree(pages_dir, ignore_errors=True)
        pages_dir.mkdir(parents=True, exist_ok=True)

        first_page_rect = pdf[0].rect
        page_width = float(first_page_rect.width)
        page_height = float(first_page_rect.height)

        span_refs: list[tuple[Span, int]] = []
        ocr_attempted_pages = 0
        ocr_used_pages = 0

        for page_idx in range(total_pages):
            page = pdf[page_idx]
            page_number = page_idx + 1
            rect = page.rect

            image_name = f"page-{page_number:04d}.png"
            image_path = pages_dir / image_name
            pix = page.get_pixmap(matrix=fitz.Matrix(RENDER_SCALE, RENDER_SCALE), alpha=False)
            pix.save(str(image_path))

            try:
                stored_image_path = image_path.relative_to(Path.cwd()).as_posix()
            except ValueError:
                stored_image_path = image_path.as_posix()

            page_row = Page(
                document_id=document_id,
                page_number=page_number,
                width_pts=float(rect.width),
                height_pts=float(rect.height),
                image_path=stored_image_path,
            )
            db.add(page_row)
            db.flush()

            extracted_words = _extract_words_with_fallback(
                page=page,
                page_number=page_number,
                settings=settings,
            )
            words = extracted_words.words
            if extracted_words.attempted_ocr:
                ocr_attempted_pages += 1
            if extracted_words.source == "ocr":
                ocr_used_pages += 1

            char_cursor = 0
            page_spans: list[Span] = []

            for span_index, (x0, y0, x1, y1, text) in enumerate(words):
                char_start = char_cursor
                char_end = char_start + len(text)
                char_cursor = char_end + 1

                span = Span(
                    document_id=document_id,
                    page_id=page_row.id,
                    span_index=span_index,
                    text=text,
                    x1=x0,
                    y1=y0,
                    x2=x1,
                    y2=y1,
                    char_start=char_start,
                    char_end=char_end,
                )
                db.add(span)
                page_spans.append(span)

            db.flush()
            span_refs.extend((span, page_number) for span in page_spans)

        windows = _chunk_span_window(span_refs)
        for chunk_index, (start, end) in enumerate(windows):
            window = span_refs[start:end]
            if not window:
                continue

            text = " ".join(span.text for span, _ in window).strip()
            if not text:
                continue

            first_span, first_page = window[0]
            last_span, last_page = window[-1]

            chunk = Chunk(
                document_id=document_id,
                chunk_index=chunk_index,
                text=text,
                page_start=first_page,
                page_end=last_page,
                span_start_id=first_span.id,
                span_end_id=last_span.id,
                embedding=None,
            )
            db.add(chunk)

        document.status = "ready"
        document.total_pages = total_pages
        document.page_width = page_width
        document.page_height = page_height
        document.error_message = None
        logger.info(
            "Document %s processed: pages=%s, ocr_attempted_pages=%s, ocr_used_pages=%s",
            document_id,
            total_pages,
            ocr_attempted_pages,
            ocr_used_pages,
        )
        db.commit()
    except Exception as exc:
        logger.exception("Failed to process document %s", document_id, exc_info=exc)
        db.rollback()
        document = db.get(Document, document_id)
        if document is None:
            return
        document.status = "error"
        document.total_pages = None
        document.page_width = None
        document.page_height = None
        document.error_message = f"Document processing failed: {exc}"
        db.commit()
    finally:
        try:
            pdf.close()
        except Exception:
            pass
