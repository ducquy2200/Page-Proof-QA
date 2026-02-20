# Page-Proof-QA Backend

FastAPI backend for document-grounded Q&A with page-level evidence bounding boxes.

This service handles:
- PDF upload and persistence
- PDF page rendering and text extraction (with OCR fallback)
- Retrieval chunking + embedding storage in pgvector
- LLM answer generation with chunk citations
- Evidence line selection and bbox mapping for frontend highlights

## Backend Architecture
![Backend Architecture](./docs/architecture_diagram.png)

## Tech Stack
- Python 3.13
- FastAPI + Uvicorn
- SQLAlchemy 2 + Alembic
- PostgreSQL + pgvector
- PyMuPDF for parsing/rendering/OCR bridge
- OpenAI API for embeddings + chat completion
- Docker Compose for local orchestration

## Prerequisites
- Python 3.11+ (project currently uses 3.13)
- PostgreSQL (or Docker)
- Tesseract OCR installed locally if running without Docker
- OpenAI API key

## Quick Start (Local)
From `backend/`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create and configure `.env` (see Configuration section), then:

```bash
alembic upgrade head
python run.py
```

Health check:
- `http://localhost:8080/health`

Note:
- `0.0.0.0` is a bind address, not a browser URL. Use `localhost` or `127.0.0.1` in browser.

## Quick Start (Docker)
From `backend/`:

```bash
docker compose up --build
```

This starts:
- `pageproofqa-db` (Postgres + pgvector)
- `pageproofqa-api` (FastAPI)

API health:
- `http://localhost:8080/health`

Stop:

```bash
docker compose down
```

## API Endpoints
- `GET /health`
- `POST /documents`
- `GET /documents/{document_id}/status`
- `GET /documents/{document_id}/pages/{page}`
- `POST /documents/{document_id}/ask`

Detailed request/response contract:
- `docs/api-contract.md`

## End-to-End Flow
1. `POST /documents` saves `source.pdf`, creates `documents` row with `status=processing`.
2. Background task runs `process_document_metadata(...)`.
3. Service renders per-page PNGs, extracts words/spans, chunks text, stores metadata.
4. On success: `documents.status=ready`; on failure: `status=error` with `error_message`.
5. `POST /documents/{id}/ask` executes retrieval + grounded answer + evidence mapping.

## Ingestion Pipeline Details
Implemented in `app/services/document_processing.py`:
- Render each PDF page to `uploads/{document_id}/pages/page-XXXX.png`
- Extract word-level spans (`text`, `x1,y1,x2,y2`, `span_index`)
- OCR fallback when native extraction quality is low
- Build chunk windows with overlap for retrieval context
- Persist:
  - `pages` (dimensions + image path)
  - `spans` (word-level geometry)
  - `chunks` (retrieval text windows + span id range)

## QA Pipeline Details
Implemented in `app/services/qa.py`:
1. Validate document readiness and OpenAI config.
2. Ensure chunk embeddings exist (`chunks.embedding`).
3. Embed question and retrieve top-K chunks via pgvector similarity.
4. Ask chat model to return JSON:
   - `answer`
   - `citations: [{ chunk_id }]`
5. Build evidence from cited chunks (+ near-neighbor chunks).
6. Rank line candidates, map to bbox, validate overlap against stored spans.
7. Return:
   - `answer`
   - `evidence[]` with `{ page, text, bbox, page_width?, page_height? }`

## Evidence Selection Logic (Current)
Evidence is no longer fixed top-N by default.

Selection now:
1. Score candidate lines.
2. Keep strongest evidence.
3. Continue while score stays within confidence thresholds.
4. Stop when score suddenly drops.
5. Return final evidence sorted for display by page then top-to-bottom position.

Primary controls:
- `EVIDENCE_RELATIVE_SCORE_THRESHOLD`
- `EVIDENCE_DROP_RATIO_STOP`
- `EVIDENCE_MIN_ABSOLUTE_SCORE`
- `ANSWER_MAX_EVIDENCE_ITEMS` (`0` means no hard cap)

Signer-specific behavior:
- If question intent is signature-focused ("who signed", "signature"), selection prioritizes signature-like lines and penalizes noisy operational lines.

## Data Model
Core tables:
- `documents`: status, page metadata, errors
- `pages`: per-page dimensions + image path
- `spans`: word-level text + bounding boxes
- `chunks`: retrieval text windows + vector embeddings

Embedding schema:
- `chunks.embedding` is `vector(1536)`.
- Use `OPENAI_EMBEDDING_DIMENSIONS=1536` with current schema.

## Configuration
All settings are loaded from `.env` via `app/core/config.py`.

### `.env` Template (Current Runtime Profile)
`OPENAI_API_KEY` is intentionally left blank.

```dotenv
APP_NAME=Page-Proof-QA API
APP_ENV=dev
DEBUG=false
API_HOST=0.0.0.0
API_PORT=8080
LOG_LEVEL=INFO
SQL_ECHO=false
CORS_ORIGINS=["http://localhost:5173"]
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/pageproofqa
UPLOAD_DIR=uploads
MAX_UPLOAD_BYTES=52428800
OCR_FALLBACK_ENABLED=true
OCR_TRIGGER_MIN_WORDS=18
OCR_TRIGGER_MIN_ALNUM_RATIO=0.60
OCR_LANGUAGE=eng
OCR_DPI=300
OCR_FULL_PAGE=true
# Optional. Docker image default path shown; leave empty for local default lookup.
OCR_TESSDATA=/usr/share/tesseract-ocr/5/tessdata
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-5.2
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_EMBEDDING_DIMENSIONS=1536
RETRIEVAL_TOP_K=8
RETRIEVAL_MAX_CONTEXT_CHUNKS=6
ANSWER_MAX_EVIDENCE_ITEMS=0
RETRIEVAL_MIN_KEYWORD_OVERLAP=1
EVIDENCE_QUESTION_WEIGHT=0.2
EVIDENCE_ANSWER_WEIGHT=0.8
EVIDENCE_RELATIVE_SCORE_THRESHOLD=0.60
EVIDENCE_DROP_RATIO_STOP=0.72
EVIDENCE_MIN_ABSOLUTE_SCORE=0.20
RETRIEVAL_MAX_VECTOR_DISTANCE=1.2
MINIMUM_EVIDENCE_ITEMS=1
REQUIRE_LLM_CITATIONS=true
```

If you want local-only binding, set `API_HOST=127.0.0.1`.

### App/Server
- `APP_NAME`
- `APP_ENV`
- `DEBUG`
- `API_HOST`
- `API_PORT`
- `LOG_LEVEL`
- `SQL_ECHO`
- `CORS_ORIGINS`

### Storage/Upload
- `UPLOAD_DIR`
- `MAX_UPLOAD_BYTES`

### Database
- `DATABASE_URL`

### OCR
- `OCR_FALLBACK_ENABLED`
- `OCR_TRIGGER_MIN_WORDS`
- `OCR_TRIGGER_MIN_ALNUM_RATIO`
- `OCR_LANGUAGE`
- `OCR_DPI`
- `OCR_FULL_PAGE`
- `OCR_TESSDATA` (optional custom tessdata path; default is `None`)

### OpenAI
- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL` (default `gpt-5-mini`)
- `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`)
- `OPENAI_EMBEDDING_DIMENSIONS` (must be `1536` currently)

Recommended (better answer quality, usually higher cost/latency):
- `OPENAI_CHAT_MODEL=gpt-5.2`
- `OPENAI_EMBEDDING_MODEL=text-embedding-3-large`
- `OPENAI_EMBEDDING_DIMENSIONS=1536`

Deterministic runtime behavior:
- Chat generation uses only `OPENAI_CHAT_MODEL`.
- Embedding generation uses only `OPENAI_EMBEDDING_MODEL`.
- Embedding requests use `OPENAI_EMBEDDING_DIMENSIONS`; keep `1536` for the current `vector(1536)` schema.

### Retrieval/Answering
- `RETRIEVAL_TOP_K`
- `RETRIEVAL_MAX_CONTEXT_CHUNKS`
- `RETRIEVAL_MAX_VECTOR_DISTANCE`
- `RETRIEVAL_MIN_KEYWORD_OVERLAP`
- `EVIDENCE_QUESTION_WEIGHT`
- `EVIDENCE_ANSWER_WEIGHT`
- `EVIDENCE_RELATIVE_SCORE_THRESHOLD`
- `EVIDENCE_DROP_RATIO_STOP`
- `EVIDENCE_MIN_ABSOLUTE_SCORE`
- `ANSWER_MAX_EVIDENCE_ITEMS`
- `MINIMUM_EVIDENCE_ITEMS`
- `REQUIRE_LLM_CITATIONS`

## Backend File Tree

```text
backend/
  app/
    api/
      router.py                     # Root API router registration
      routes/
        health.py                   # /health endpoint
        documents.py                # upload/status/page/ask endpoints
    core/
      config.py                     # Environment-backed settings
      errors.py                     # Exception handlers
      logging.py                    # Logging setup
    db/
      base.py                       # SQLAlchemy Base
      session.py                    # Engine/session factory
      types.py                      # Vector type fallback
    models/
      document.py                   # documents table
      page.py                       # pages table
      span.py                       # spans table
      chunk.py                      # chunks table + embedding vector
    schemas/
      health.py                     # health response schema
      document.py                   # document endpoint schemas
      qa.py                         # ask/evidence schemas
    services/
      document_processing.py        # ingestion pipeline
      qa.py                         # retrieval + answer + evidence logic
    main.py                         # FastAPI app factory
  alembic/
    env.py                          # migration environment
    versions/                       # migration history
  docs/
    api-contract.md                 # API request/response examples
    architecture_diagram.png        # backend architecture image
  docker-compose.yml                # local db + api orchestration
  Dockerfile                        # api image build
  run.py                            # uvicorn launcher
  requirements.txt                  # python dependencies
  .env                              # local config (not for commit)
```

## Migrations and Persistence
- Generate migration:
  - `alembic revision -m "message"`
- Apply latest:
  - `alembic upgrade head`

Do not run API without applying migrations first.

## Troubleshooting
- `connection timeout localhost:5432`:
  - Postgres is not running or `DATABASE_URL` is wrong.
- `OPENAI_EMBEDDING_DIMENSIONS must be 1536`:
  - Set `OPENAI_EMBEDDING_DIMENSIONS=1536`.
- GPT-5 model issues:
  - Ensure your API key/project has access to selected model.
- OCR quality poor:
  - Verify Tesseract installation and OCR env settings.

## Security Notes
- Never commit real `OPENAI_API_KEY` values.
- Keep `.env` local/private.
- Uploaded documents may contain sensitive data; secure storage and access controls are required in production.

## Key Backend Decisions
1. Store rendered page images server-side.
Reason: frontend highlights align directly with server-extracted span coordinates.

2. Word-level spans as ground-truth geometry.
Reason: evidence highlighting needs deterministic bbox mapping, not fuzzy post-hoc approximations.

3. pgvector-based retrieval in Postgres.
Reason: keeps retrieval close to app data model with low operational complexity for this project scale.

4. OCR fallback rather than OCR-only.
Reason: native extraction is faster/cleaner for machine PDFs; OCR is used only when extraction quality is low.

5. Grounded answering with citation validation.
Reason: enforce answer traceability to retrieved chunks and reduce hallucination risk.

6. Threshold-driven evidence filtering.
Reason: avoid fixed arbitrary evidence counts and stop at confidence drop points.

## Development Notes
- Run API:
  - `python run.py`
- Lint/format commands are not configured yet in this backend.
- Basic compile sanity check:
  - `python -m compileall app`
