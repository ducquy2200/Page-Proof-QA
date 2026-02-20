from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass
from difflib import SequenceMatcher

from openai import BadRequestError, OpenAI
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.chunk import Chunk
from app.models.document import Document
from app.models.page import Page
from app.models.span import Span
from app.schemas.qa import AskQuestionResponse, BBox, EvidenceItem

logger = logging.getLogger(__name__)


class QAError(RuntimeError):
    """Base QA error."""


class InvalidQuestionError(QAError):
    """Raised when question is empty after trimming."""


class DocumentNotReadyError(QAError):
    """Raised when document is not ready for answering."""


class OpenAIConfigurationError(QAError):
    """Raised when OpenAI key/config is missing."""


INSUFFICIENT_EVIDENCE_ANSWER = "I don't have enough grounded evidence in this document to answer that confidently."
QUESTION_STOPWORDS = {
    "the",
    "a",
    "an",
    "of",
    "to",
    "in",
    "on",
    "for",
    "and",
    "or",
    "is",
    "was",
    "were",
    "are",
    "be",
    "who",
    "what",
    "when",
    "where",
    "which",
    "how",
    "did",
    "does",
    "do",
    "from",
    "with",
    "by",
    "at",
    "as",
    "about",
}
CONTEXT_WINDOW_RADIUS = 1
SIGNATURE_SIGNAL_THRESHOLD = 0.9
EMBEDDING_VECTOR_DIM = 1536


@dataclass
class RetrievedChunk:
    id: uuid.UUID
    chunk_index: int
    text: str
    page_start: int | None
    page_end: int | None
    span_start_id: int | None
    span_end_id: int | None
    distance: float | None = None


@dataclass
class EvidenceLineCandidate:
    text: str
    spans: list[Span]
    y1: float
    y2: float
    weighted_score: float
    answer_overlap: int
    question_overlap: int
    signature_signal: float = 0.0


@dataclass
class ScoredEvidenceItem:
    item: EvidenceItem
    score: float


def ask_question(
    *,
    db: Session,
    settings: Settings,
    document_id: uuid.UUID,
    question: str,
) -> AskQuestionResponse:
    clean_question = question.strip()
    if not clean_question:
        raise InvalidQuestionError("Question cannot be empty.")

    document = db.get(Document, document_id)
    if document is None:
        raise ValueError("Document not found.")
    if document.status != "ready":
        raise DocumentNotReadyError("Document is not ready for question answering.")

    if not settings.openai_api_key:
        raise OpenAIConfigurationError("OPENAI_API_KEY is not configured.")
    if settings.openai_embedding_dimensions != EMBEDDING_VECTOR_DIM:
        raise OpenAIConfigurationError(
            f"OPENAI_EMBEDDING_DIMENSIONS must be {EMBEDDING_VECTOR_DIM} for current schema."
        )

    client = OpenAI(api_key=settings.openai_api_key)

    try:
        _ensure_chunk_embeddings(
            db=db,
            client=client,
            settings=settings,
            document_id=document_id,
        )
    except Exception as exc:
        raise QAError(f"Failed to prepare chunk embeddings: {exc}") from exc

    try:
        retrieved = _retrieve_chunks(
            db=db,
            client=client,
            settings=settings,
            document_id=document_id,
            question=clean_question,
        )
    except Exception as exc:
        logger.warning("Vector retrieval failed for %s: %s", document_id, exc)
        return _insufficient_response("Vector retrieval failed.")
    if not retrieved:
        return _insufficient_response("No retrievable chunks were found.")
    if not _has_sufficient_retrieval_confidence(settings=settings, chunks=retrieved):
        return _insufficient_response("Retrieval confidence is below threshold.")

    context_chunks = retrieved[: settings.retrieval_max_context_chunks]
    try:
        answer, cited_chunk_ids = _generate_answer(
            client=client,
            settings=settings,
            question=clean_question,
            chunks=context_chunks,
        )
    except Exception as exc:
        raise QAError(f"Failed to generate answer: {exc}") from exc

    cited_lookup = {chunk.id: chunk for chunk in context_chunks}
    valid_citations = [chunk_id for chunk_id in cited_chunk_ids if chunk_id in cited_lookup]

    if settings.require_llm_citations and not valid_citations:
        return _insufficient_response("No valid citations were returned by the model.")

    if not valid_citations:
        valid_citations = [context_chunks[0].id]

    if not answer:
        return _insufficient_response("Model answer text was empty.")

    if _answer_is_uncertain(answer):
        return _insufficient_response("Model flagged uncertainty.")

    selected_chunks: list[RetrievedChunk] = []
    for chunk_id in valid_citations:
        chunk = cited_lookup.get(chunk_id)
        if chunk and chunk not in selected_chunks:
            selected_chunks.append(chunk)

    if not selected_chunks:
        return _insufficient_response("No cited chunks were resolved to retrieval context.")

    evidence = _build_evidence(
        db=db,
        settings=settings,
        question=clean_question,
        answer=answer,
        document_id=document_id,
        chunks=selected_chunks,
    )

    if len(evidence) < settings.minimum_evidence_items:
        return _insufficient_response("Evidence count is below minimum threshold.")

    if not _validate_evidence_mapping(db=db, document_id=document_id, evidence=evidence):
        return _insufficient_response("Evidence mapping validation failed.")

    return AskQuestionResponse(answer=answer, evidence=evidence)


def _ensure_chunk_embeddings(
    *,
    db: Session,
    client: OpenAI,
    settings: Settings,
    document_id: uuid.UUID,
) -> None:
    missing_chunks = list(
        db.scalars(
            select(Chunk)
            .where(Chunk.document_id == document_id, Chunk.embedding.is_(None))
            .order_by(Chunk.chunk_index)
        )
    )
    if not missing_chunks:
        return

    batch_size = 64
    for start in range(0, len(missing_chunks), batch_size):
        batch = missing_chunks[start : start + batch_size]
        texts = [chunk.text for chunk in batch]
        response = client.embeddings.create(
            input=texts,
            **_embedding_request_kwargs(settings),
        )
        for chunk, embedded in zip(batch, response.data, strict=True):
            chunk.embedding = embedded.embedding

    db.commit()


def _retrieve_chunks(
    *,
    db: Session,
    client: OpenAI,
    settings: Settings,
    document_id: uuid.UUID,
    question: str,
) -> list[RetrievedChunk]:
    embed_response = client.embeddings.create(
        input=question,
        **_embedding_request_kwargs(settings),
    )
    query_embedding = embed_response.data[0].embedding
    vector_literal = "[" + ",".join(f"{v:.8f}" for v in query_embedding) + "]"

    sql = text(
        """
        SELECT
            id,
            chunk_index,
            text,
            page_start,
            page_end,
            span_start_id,
            span_end_id,
            (embedding <=> CAST(:query_embedding AS vector)) AS distance
        FROM chunks
        WHERE document_id = CAST(:document_id AS uuid)
          AND embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:query_embedding AS vector), chunk_index
        LIMIT :limit
        """
    )
    rows = db.execute(
        sql,
        {
            "document_id": str(document_id),
            "query_embedding": vector_literal,
            "limit": settings.retrieval_top_k,
        },
    ).mappings()

    return [
        RetrievedChunk(
            id=uuid.UUID(str(row["id"])),
            chunk_index=row["chunk_index"],
            text=row["text"],
            page_start=row["page_start"],
            page_end=row["page_end"],
            span_start_id=row["span_start_id"],
            span_end_id=row["span_end_id"],
            distance=float(row["distance"]) if row["distance"] is not None else None,
        )
        for row in rows
    ]


def _embedding_request_kwargs(settings: Settings) -> dict[str, object]:
    selected_model = settings.openai_embedding_model.strip()
    kwargs: dict[str, object] = {"model": selected_model}
    if selected_model.startswith("text-embedding-3"):
        kwargs["dimensions"] = settings.openai_embedding_dimensions
    return kwargs


def _generate_answer(
    *,
    client: OpenAI,
    settings: Settings,
    question: str,
    chunks: list[RetrievedChunk],
) -> tuple[str, list[uuid.UUID]]:
    context_lines = []
    for chunk in chunks:
        if chunk.page_start is None:
            page_info = "pages unknown"
        elif chunk.page_start == chunk.page_end:
            page_info = f"pages {chunk.page_start}"
        else:
            page_info = f"pages {chunk.page_start}-{chunk.page_end}"
        context_lines.append(
            f"CHUNK_ID={chunk.id} | {page_info}\n{chunk.text}"
        )

    user_prompt = (
        "Answer the question using only the provided document chunks.\n"
        "If the answer is not clearly supported, say so.\n\n"
        "If the question asks who performed/signed something, list all supported names.\n"
        "Do not collapse multiple people into a single name.\n\n"
        f"Question:\n{question}\n\n"
        "Document chunks:\n"
        + "\n\n".join(context_lines)
        + "\n\n"
        "Return strictly valid JSON with this shape:\n"
        '{"answer":"...", "citations":[{"chunk_id":"<uuid>"}]}'
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a careful document QA assistant. "
                "Only use supplied chunks and cite chunk IDs."
            ),
        },
        {"role": "user", "content": user_prompt},
    ]

    request_kwargs: dict[str, object] = {
        "response_format": {"type": "json_object"},
        "messages": messages,
    }

    content = _create_llm_json_response(
        client=client,
        settings=settings,
        messages=messages,
        base_request_kwargs=request_kwargs,
    )
    payload = _parse_json_payload(content)
    answer = str(payload.get("answer", "")).strip()

    citations = payload.get("citations", [])
    chunk_ids: list[uuid.UUID] = []
    if isinstance(citations, list):
        for citation in citations:
            if not isinstance(citation, dict):
                continue
            raw_id = citation.get("chunk_id")
            if not raw_id:
                continue
            try:
                parsed_id = uuid.UUID(str(raw_id))
            except ValueError:
                continue
            if parsed_id not in chunk_ids:
                chunk_ids.append(parsed_id)

    return answer, chunk_ids


def _create_llm_json_response(
    *,
    client: OpenAI,
    settings: Settings,
    messages: list[dict[str, str]],
    base_request_kwargs: dict[str, object],
) -> str:
    model_name = settings.openai_chat_model.strip()
    request_kwargs = dict(base_request_kwargs)
    request_kwargs["model"] = model_name
    if not _is_gpt5_family_model(model_name):
        request_kwargs["temperature"] = 0.1

    return _create_llm_json_response_for_model(
        client=client,
        messages=messages,
        model_name=model_name,
        request_kwargs=request_kwargs,
    )


def _create_llm_json_response_for_model(
    *,
    client: OpenAI,
    messages: list[dict[str, str]],
    model_name: str,
    request_kwargs: dict[str, object],
) -> str:
    try:
        response = client.chat.completions.create(**request_kwargs)
        return response.choices[0].message.content or "{}"
    except BadRequestError as exc:
        lowered = str(exc).lower()
        retry_kwargs = dict(request_kwargs)

        if "response_format" in lowered:
            retry_kwargs.pop("response_format", None)
        if "temperature" in lowered:
            retry_kwargs.pop("temperature", None)

        if retry_kwargs != request_kwargs:
            try:
                response = client.chat.completions.create(**retry_kwargs)
                return response.choices[0].message.content or "{}"
            except BadRequestError as retry_exc:
                lowered_retry = str(retry_exc).lower()
                if "chat.completions" in lowered_retry or "responses api" in lowered_retry:
                    return _create_response_via_responses_api(
                        client=client,
                        messages=messages,
                        model_name=model_name,
                    )
                raise

        # Some model configurations may only support the Responses API.
        if "chat.completions" in lowered or "responses api" in lowered:
            return _create_response_via_responses_api(
                client=client,
                messages=messages,
                model_name=model_name,
            )
        raise


def _create_response_via_responses_api(
    *,
    client: OpenAI,
    messages: list[dict[str, str]],
    model_name: str,
) -> str:
    request_kwargs: dict[str, object] = {
        "model": model_name,
        "input": messages,
    }
    if not _is_gpt5_family_model(model_name):
        request_kwargs["temperature"] = 0.1

    response = client.responses.create(**request_kwargs)
    output_text = (getattr(response, "output_text", "") or "").strip()
    if output_text:
        return output_text

    # Fallback extraction when output_text is empty.
    parts: list[str] = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text_value = getattr(content, "text", None)
            if isinstance(text_value, str):
                if text_value.strip():
                    parts.append(text_value.strip())
                continue
            if text_value is not None:
                value = getattr(text_value, "value", "")
                if value:
                    parts.append(str(value).strip())

    return "\n".join(part for part in parts if part) or "{}"


def _is_gpt5_family_model(model_name: str) -> bool:
    normalized = model_name.strip().lower()
    return normalized.startswith("gpt-5")


def _parse_json_payload(content: str) -> dict:
    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}

    try:
        parsed = json.loads(content[start : end + 1])
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _build_evidence(
    *,
    db: Session,
    settings: Settings,
    question: str,
    answer: str,
    document_id: uuid.UUID,
    chunks: list[RetrievedChunk],
) -> list[EvidenceItem]:
    scored_by_key: dict[str, ScoredEvidenceItem] = {}
    prefer_signature_lines = _question_targets_signer_evidence(question)
    question_terms = _tokenize_question_terms(question)
    answer_terms = _tokenize_question_terms(answer)
    question_weight, answer_weight = _normalize_evidence_weights(
        question_weight=settings.evidence_question_weight,
        answer_weight=settings.evidence_answer_weight,
    )

    evidence_chunks = _expand_chunks_for_evidence(
        db=db,
        document_id=document_id,
        chunks=chunks,
    )

    for chunk in evidence_chunks:
        chunk_items = _chunk_evidence_items(
            db=db,
            question_terms=question_terms,
            answer_terms=answer_terms,
            min_keyword_overlap=settings.retrieval_min_keyword_overlap,
            question_weight=question_weight,
            answer_weight=answer_weight,
            prefer_signature_lines=prefer_signature_lines,
            document_id=document_id,
            chunk=chunk,
        )
        for scored in chunk_items:
            item = scored.item
            key = f"{item.page}:{item.bbox.x1:.1f}:{item.bbox.y1:.1f}:{item.bbox.x2:.1f}:{item.bbox.y2:.1f}"
            existing = scored_by_key.get(key)
            if existing is None or scored.score > existing.score:
                scored_by_key[key] = scored

    if not scored_by_key:
        return []

    filtered = _filter_scored_evidence(
        scored_items=list(scored_by_key.values()),
        settings=settings,
    )
    ordered_for_display = sorted(
        filtered,
        key=lambda entry: (
            entry.item.page,
            entry.item.bbox.y1,
            entry.item.bbox.x1,
            -entry.score,
        ),
    )
    return [entry.item for entry in ordered_for_display]


def _expand_chunks_for_evidence(
    *,
    db: Session,
    document_id: uuid.UUID,
    chunks: list[RetrievedChunk],
) -> list[RetrievedChunk]:
    if not chunks:
        return []

    expanded: list[RetrievedChunk] = []
    seen_ids: set[uuid.UUID] = set()
    present_indices = {chunk.chunk_index for chunk in chunks}
    neighbor_indices: set[int] = set()

    for chunk in chunks:
        if chunk.id not in seen_ids:
            expanded.append(chunk)
            seen_ids.add(chunk.id)
        if (chunk.chunk_index + 1) not in present_indices:
            neighbor_indices.add(chunk.chunk_index + 1)
        if chunk.chunk_index > 0 and (chunk.chunk_index - 1) not in present_indices:
            neighbor_indices.add(chunk.chunk_index - 1)

    if not neighbor_indices:
        return expanded

    neighbor_rows = list(
        db.scalars(
            select(Chunk)
            .where(
                Chunk.document_id == document_id,
                Chunk.chunk_index.in_(neighbor_indices),
            )
            .order_by(Chunk.chunk_index)
        )
    )
    row_by_index = {row.chunk_index: row for row in neighbor_rows}

    # Prefer the immediate next chunk first, then previous, for better local continuity.
    for chunk in chunks:
        for neighbor_index in (chunk.chunk_index + 1, chunk.chunk_index - 1):
            neighbor_row = row_by_index.get(neighbor_index)
            if neighbor_row is None:
                continue
            if neighbor_row.id in seen_ids:
                continue
            expanded.append(
                RetrievedChunk(
                    id=neighbor_row.id,
                    chunk_index=neighbor_row.chunk_index,
                    text=neighbor_row.text,
                    page_start=neighbor_row.page_start,
                    page_end=neighbor_row.page_end,
                    span_start_id=neighbor_row.span_start_id,
                    span_end_id=neighbor_row.span_end_id,
                    distance=None,
                )
            )
            seen_ids.add(neighbor_row.id)

    return expanded


def _filter_scored_evidence(
    *,
    scored_items: list[ScoredEvidenceItem],
    settings: Settings,
) -> list[ScoredEvidenceItem]:
    if not scored_items:
        return []

    ordered = sorted(
        scored_items,
        key=lambda entry: (
            -entry.score,
            entry.item.page,
            entry.item.bbox.y1,
            entry.item.bbox.x1,
        ),
    )

    best_score = ordered[0].score
    if best_score <= 0:
        return ordered[:1]

    relative_threshold = min(1.0, max(0.0, settings.evidence_relative_score_threshold))
    drop_ratio_stop = min(1.0, max(0.0, settings.evidence_drop_ratio_stop))
    absolute_threshold = max(0.0, settings.evidence_min_absolute_score)
    score_floor = max(absolute_threshold, best_score * relative_threshold)

    selected: list[ScoredEvidenceItem] = [ordered[0]]
    previous_score = best_score

    for entry in ordered[1:]:
        score = entry.score
        if score < score_floor:
            break

        if previous_score > 0:
            ratio = score / previous_score
            if ratio < drop_ratio_stop:
                break

        selected.append(entry)
        previous_score = score

    if settings.answer_max_evidence_items > 0:
        return selected[: settings.answer_max_evidence_items]

    return selected


def _has_sufficient_retrieval_confidence(*, settings: Settings, chunks: list[RetrievedChunk]) -> bool:
    if not chunks:
        return False

    vector_distances = [chunk.distance for chunk in chunks if chunk.distance is not None]
    if vector_distances:
        best_distance = min(vector_distances)
        return best_distance <= settings.retrieval_max_vector_distance

    return False


def _answer_is_uncertain(answer: str) -> bool:
    lowered = answer.lower()
    markers = [
        "not enough evidence",
        "cannot determine",
        "can't determine",
        "insufficient",
        "uncertain",
        "not clearly supported",
    ]
    return any(marker in lowered for marker in markers)


def _validate_evidence_mapping(
    *,
    db: Session,
    document_id: uuid.UUID,
    evidence: list[EvidenceItem],
) -> bool:
    for item in evidence:
        if item.bbox.x2 <= item.bbox.x1 or item.bbox.y2 <= item.bbox.y1:
            return False

        match = db.execute(
            select(Span.id)
            .join(Page, Span.page_id == Page.id)
            .where(
                Span.document_id == document_id,
                Page.page_number == item.page,
                Span.x2 > item.bbox.x1,
                Span.x1 < item.bbox.x2,
                Span.y2 > item.bbox.y1,
                Span.y1 < item.bbox.y2,
            )
            .limit(1)
        ).first()

        if match is None:
            return False

    return True


def _insufficient_response(reason: str) -> AskQuestionResponse:
    logger.info("Returning insufficient evidence response: %s", reason)
    return AskQuestionResponse(answer=INSUFFICIENT_EVIDENCE_ANSWER, evidence=[])


def _chunk_evidence_items(
    *,
    db: Session,
    question_terms: set[str],
    answer_terms: set[str],
    min_keyword_overlap: int,
    question_weight: float,
    answer_weight: float,
    prefer_signature_lines: bool,
    document_id: uuid.UUID,
    chunk: RetrievedChunk,
) -> list[ScoredEvidenceItem]:
    if chunk.span_start_id is None or chunk.span_end_id is None:
        return []

    low_id = min(chunk.span_start_id, chunk.span_end_id)
    high_id = max(chunk.span_start_id, chunk.span_end_id)

    rows = db.execute(
        select(Span, Page.page_number, Page.width_pts, Page.height_pts)
        .join(Page, Span.page_id == Page.id)
        .where(
            Span.document_id == document_id,
            Span.id >= low_id,
            Span.id <= high_id,
        )
        .order_by(Page.page_number, Span.span_index)
    ).all()

    if not rows:
        return []

    grouped: dict[int, dict[str, object]] = {}
    for span, page_number, width_pts, height_pts in rows:
        group = grouped.setdefault(
            page_number,
            {"spans": [], "page_width": None, "page_height": None},
        )
        group["spans"].append(span)
        if group["page_width"] is None and width_pts is not None:
            group["page_width"] = float(width_pts)
        if group["page_height"] is None and height_pts is not None:
            group["page_height"] = float(height_pts)

    items: list[ScoredEvidenceItem] = []

    for page_number in sorted(grouped):
        group = grouped[page_number]
        spans = group["spans"]
        page_width = group["page_width"]
        page_height = group["page_height"]
        if not spans:
            continue

        line_candidates: list[EvidenceLineCandidate] = []
        line_groups = _group_spans_into_lines(spans)
        for line_spans in line_groups:
            ordered_line = sorted(line_spans, key=lambda span: span.x1)
            excerpt = " ".join(span.text for span in ordered_line).strip()
            if not excerpt:
                continue

            x1 = min(span.x1 for span in ordered_line)
            y1 = min(span.y1 for span in ordered_line)
            x2 = max(span.x2 for span in ordered_line)
            y2 = max(span.y2 for span in ordered_line)
            if x2 <= x1 or y2 <= y1:
                continue

            question_overlap = _keyword_overlap_count(excerpt, question_terms)
            answer_overlap = _keyword_overlap_count(excerpt, answer_terms)
            question_score = _keyword_overlap_weighted_score(excerpt, question_terms)
            answer_score = _keyword_overlap_weighted_score(excerpt, answer_terms)
            weighted_score = (question_score * question_weight) + (answer_score * answer_weight)
            signature_signal = 0.0
            if prefer_signature_lines:
                signature_signal = _signature_line_signal(excerpt)
                weighted_score += (signature_signal * 1.35) - _operational_line_penalty(excerpt)
            line_candidates.append(
                EvidenceLineCandidate(
                    text=excerpt,
                    spans=ordered_line,
                    y1=y1,
                    y2=y2,
                    weighted_score=weighted_score,
                    answer_overlap=answer_overlap,
                    question_overlap=question_overlap,
                    signature_signal=signature_signal,
                )
            )

        if not line_candidates:
            continue

        ranked_lines = _rank_line_candidates_with_context(
            candidates=line_candidates,
            question_terms=question_terms,
            answer_terms=answer_terms,
            question_weight=question_weight,
            answer_weight=answer_weight,
        )
        score_by_index = {idx: score for score, idx, _ in ranked_lines}

        if prefer_signature_lines:
            signature_selected = [
                entry
                for entry in ranked_lines
                if entry[2].signature_signal >= SIGNATURE_SIGNAL_THRESHOLD
            ]
            if not signature_selected:
                continue
            selected_indices = sorted(
                {entry[1] for entry in signature_selected},
                key=lambda idx: line_candidates[idx].y1,
            )
        else:
            if question_terms or answer_terms:
                selected = [
                    entry
                    for entry in ranked_lines
                    if (entry[2].answer_overlap + entry[2].question_overlap) >= min_keyword_overlap
                ]
                if not selected:
                    selected = ranked_lines[:1]
            else:
                selected = ranked_lines[:1]

            seed_indices = [entry[1] for entry in selected[:2]]
            selected_indices = _expand_line_indices_from_seeds(
                ranked_lines=ranked_lines,
                candidates=line_candidates,
                seed_indices=seed_indices,
                max_lines=len(line_candidates),
            )

        for idx in selected_indices:
            candidate = line_candidates[idx]
            item = _build_line_evidence_item(
                page_number=page_number,
                page_width=page_width,
                page_height=page_height,
                candidate=candidate,
            )
            if item is not None:
                items.append(
                    ScoredEvidenceItem(
                        item=item,
                        score=score_by_index.get(idx, candidate.weighted_score),
                    )
                )

    return items


def _rank_line_candidates_with_context(
    *,
    candidates: list[EvidenceLineCandidate],
    question_terms: set[str],
    answer_terms: set[str],
    question_weight: float,
    answer_weight: float,
) -> list[tuple[float, int, EvidenceLineCandidate]]:
    if not candidates:
        return []

    ranked: list[tuple[float, int, EvidenceLineCandidate]] = []
    for idx, candidate in enumerate(candidates):
        start = max(0, idx - CONTEXT_WINDOW_RADIUS)
        end = min(len(candidates), idx + CONTEXT_WINDOW_RADIUS + 1)
        context_text = " ".join(candidates[j].text for j in range(start, end))

        context_question = _keyword_overlap_weighted_score(context_text, question_terms)
        context_answer = _keyword_overlap_weighted_score(context_text, answer_terms)
        context_score = (context_question * question_weight) + (context_answer * answer_weight)

        neighbor_overlap = 0.0
        for j in range(start, end):
            if j == idx:
                continue
            neighbor = candidates[j]
            neighbor_overlap += min(2.0, float(neighbor.answer_overlap + neighbor.question_overlap))

        final_score = (
            (candidate.weighted_score * 0.72)
            + (context_score * 0.28)
            + (neighbor_overlap * 0.08)
            + (candidate.signature_signal * 0.12)
        )
        ranked.append((final_score, idx, candidate))

    ranked.sort(
        key=lambda item: (
            -item[0],
            -item[2].signature_signal,
            -item[2].weighted_score,
            -(item[2].answer_overlap + item[2].question_overlap),
            item[2].y1,
        )
    )
    return ranked


def _build_line_evidence_item(
    *,
    page_number: int,
    page_width: float | None,
    page_height: float | None,
    candidate: EvidenceLineCandidate,
) -> EvidenceItem | None:
    if not candidate.spans:
        return None

    x1 = min(span.x1 for span in candidate.spans)
    y1 = min(span.y1 for span in candidate.spans)
    x2 = max(span.x2 for span in candidate.spans)
    y2 = max(span.y2 for span in candidate.spans)
    if x2 <= x1 or y2 <= y1:
        return None

    text = candidate.text.strip()
    if not text:
        return None

    return EvidenceItem(
        page=page_number,
        text=text,
        bbox=BBox(x1=x1, y1=y1, x2=x2, y2=y2),
        page_width=page_width,
        page_height=page_height,
    )


def _expand_line_indices_from_seeds(
    *,
    ranked_lines: list[tuple[float, int, EvidenceLineCandidate]],
    candidates: list[EvidenceLineCandidate],
    seed_indices: list[int],
    max_lines: int,
) -> list[int]:
    if not candidates or max_lines <= 0:
        return []

    n = len(candidates)
    selected_order: list[int] = []

    def add_idx(idx: int) -> None:
        if 0 <= idx < n and idx not in selected_order and len(selected_order) < max_lines:
            selected_order.append(idx)

    def is_relevant(idx: int) -> bool:
        candidate = candidates[idx]
        overlap = candidate.answer_overlap + candidate.question_overlap
        if overlap > 0:
            return True
        if candidate.weighted_score >= 0.75:
            return True
        if candidate.signature_signal >= SIGNATURE_SIGNAL_THRESHOLD:
            return True
        return False

    for seed in seed_indices:
        add_idx(seed)
        if 0 <= (seed - 1) < n and is_relevant(seed - 1):
            add_idx(seed - 1)
        if 0 <= (seed + 1) < n and is_relevant(seed + 1):
            add_idx(seed + 1)
        if len(selected_order) >= max_lines:
            break

    if len(selected_order) < max_lines:
        for _, idx, _ in ranked_lines:
            if is_relevant(idx):
                add_idx(idx)
            if len(selected_order) >= max_lines:
                break

    if not selected_order and ranked_lines:
        add_idx(ranked_lines[0][1])

    if len(selected_order) < max_lines:
        for _, idx, _ in ranked_lines:
            add_idx(idx)
            if len(selected_order) >= max_lines:
                break

    return sorted(selected_order, key=lambda idx: candidates[idx].y1)


def _tokenize_question_terms(question: str) -> set[str]:
    tokens = [_normalize_token(t) for t in re.findall(r"[a-zA-Z0-9]+", question.lower())]
    return {
        token
        for token in tokens
        if token and len(token) >= 3 and token not in QUESTION_STOPWORDS
    }


def _normalize_token(token: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", token.lower())


def _question_targets_signer_evidence(question: str) -> bool:
    lowered = question.lower()
    return (
        "signed" in lowered
        or "signature" in lowered
        or "who signed" in lowered
    )


def _signature_line_signal(text: str) -> float:
    lowered = f" {text.lower()} "
    tokens = [
        _normalize_token(token)
        for token in re.findall(r"[a-zA-Z0-9]+", text.lower())
    ]
    tokens = [token for token in tokens if len(token) >= 4]

    score = 0.0
    if " signed by " in lowered or " signature " in lowered:
        score = max(score, 2.0)

    for token in tokens:
        if token.startswith("sig"):
            score = max(score, 1.6)
            continue

        if token.startswith("s") and SequenceMatcher(None, token, "signed").ratio() >= 0.60:
            score = max(score, 1.35)

        if SequenceMatcher(None, token, "electronic").ratio() >= 0.68:
            score = max(score, 1.15)

    if score > 0 and " by " in lowered:
        score += 0.25

    return score


def _operational_line_penalty(text: str) -> float:
    lowered = text.lower()
    penalty = 0.0
    if "ordering doctor" in lowered:
        penalty += 1.35

    noisy_markers = {
        "order source": 1.00,
        "order receive": 1.00,
        "order continued": 0.95,
        "order acknowledged": 0.95,
        "order enter": 0.90,
        "order from set": 0.85,
        "in pom": 0.85,
        "order's status changed": 0.75,
    }
    for marker, marker_penalty in noisy_markers.items():
        if marker in lowered:
            penalty += marker_penalty

    return penalty


def _keyword_overlap_count(text: str, question_terms: set[str]) -> int:
    if not question_terms:
        return 0

    tokens = {
        _normalize_token(token)
        for token in re.findall(r"[a-zA-Z0-9]+", text.lower())
    }
    normalized_tokens = {
        token
        for token in tokens
        if token and len(token) >= 3 and token not in QUESTION_STOPWORDS
    }
    if not normalized_tokens:
        return 0

    overlap = 0
    for term in question_terms:
        if any(term == token or term in token or token in term for token in normalized_tokens):
            overlap += 1
    return overlap


def _keyword_overlap_weighted_score(text: str, terms: set[str]) -> float:
    if not terms:
        return 0.0

    tokens = {
        _normalize_token(token)
        for token in re.findall(r"[a-zA-Z0-9]+", text.lower())
    }
    normalized_tokens = {
        token
        for token in tokens
        if token and len(token) >= 3 and token not in QUESTION_STOPWORDS
    }
    if not normalized_tokens:
        return 0.0

    score = 0.0
    for term in terms:
        if not term:
            continue
        if any(term == token or term in token or token in term for token in normalized_tokens):
            # Favor specific terms slightly more than generic short terms.
            term_weight = 1.0 + min(0.6, max(0.0, (len(term) - 4) * 0.08))
            score += term_weight
    return score


def _normalize_evidence_weights(*, question_weight: float, answer_weight: float) -> tuple[float, float]:
    q = max(0.0, question_weight)
    a = max(0.0, answer_weight)
    total = q + a
    if total <= 0:
        return 0.2, 0.8
    return q / total, a / total


def _group_spans_into_lines(spans: list[Span]) -> list[list[Span]]:
    if not spans:
        return []

    ordered = sorted(spans, key=lambda span: ((span.y1 + span.y2) / 2, span.x1))
    tolerance = _line_merge_tolerance(ordered)

    groups: list[dict[str, object]] = []
    for span in ordered:
        center_y = (span.y1 + span.y2) / 2

        if not groups:
            groups.append({"center": center_y, "spans": [span]})
            continue

        current = groups[-1]
        current_center = float(current["center"])
        if abs(center_y - current_center) <= tolerance:
            current_spans = current["spans"]
            current_spans.append(span)
            current["center"] = sum((s.y1 + s.y2) / 2 for s in current_spans) / len(current_spans)
        else:
            groups.append({"center": center_y, "spans": [span]})

    return [group["spans"] for group in groups]


def _line_merge_tolerance(spans: list[Span]) -> float:
    if not spans:
        return 3.0

    heights = sorted(max(0.5, span.y2 - span.y1) for span in spans)
    mid = len(heights) // 2
    if len(heights) % 2 == 0:
        median_height = (heights[mid - 1] + heights[mid]) / 2
    else:
        median_height = heights[mid]

    return min(10.0, max(2.5, median_height * 0.65))
