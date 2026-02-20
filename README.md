# Page-Proof-QA
Page-Proof-QA is a full-stack application for grounded question answering on PDF documents.

Users can upload a document, ask a question, and receive:
- a natural-language answer
- supporting evidence snippets
- visual highlights on the exact PDF regions used as evidence

## What Problem It Solves
Most document Q&A tools return answers without clear traceability.
Page-Proof-QA is designed to keep answers auditable by grounding every response in extracted spans and page-level bounding boxes.

## Core Capabilities
- PDF upload and processing pipeline
- Text extraction with OCR fallback for hard-to-parse pages
- Embedding-based retrieval with pgvector
- LLM answering with citation-aware grounding
- Evidence-to-bounding-box mapping for deterministic visual highlights
- Frontend hover-sync between chat evidence cards and PDF overlays
- True upload progress feedback in the frontend upload flow
- Responsive frontend layout (mobile pane switch + desktop resizable divider with persisted split ratio)
- PDF zoom controls (50%-300%) with highlight alignment preserved
- Local self-hosting with Docker and optional Cloudflare Tunnel

## End-to-End Flow
1. User uploads a PDF.
2. Backend stores the file and processes pages in the background.
3. Backend renders page images, extracts spans/chunks, and stores vectors.
4. User submits a question.
5. Backend retrieves relevant chunks, generates an answer, and selects evidence lines.
6. Backend returns answer + evidence + bbox metadata.
7. Frontend renders evidence cards and highlights corresponding PDF regions.

## Repository Layout
```text
Page-Proof-QA/
  frontend/    # React + Vite client
  backend/     # FastAPI + PostgreSQL/pgvector API
  infra/       # Docker self-host deployment and tunnel helpers
  LICENSE
  README.md
```

## Architecture Documents
- Frontend architecture: `frontend/docs/architecture_diagram.png`
- Backend architecture: `backend/docs/architecture_diagram.png`
- Backend API contract: `backend/docs/api-contract.md`

## Tech Stack
- Frontend: React 19, Vite, TanStack Query, Zustand, Tailwind CSS v4, Axios
- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL, pgvector, PyMuPDF, OpenAI API
- Infra: Docker Compose, Nginx, Cloudflare Tunnel (optional)

## Quick Start
### Option A: Local Dev (Frontend + Backend separately)
1. Configure backend env:
   - create `backend/.env`
   - set at least `OPENAI_API_KEY`
2. Start backend:
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python run.py
```
3. Configure frontend env:
   - create `frontend/.env` with `VITE_API_URL=http://localhost:8080`
4. Start frontend:
```powershell
cd frontend
npm install
npm run dev
```
5. Open `http://localhost:5173`

### Option B: Self-Hosted Full Stack via Docker (Recommended for deployment-like setup)
1. Configure `infra/.env` (OpenAI + DB + tunnel vars as needed).
2. Start stack:
```powershell
cd infra
.\scripts\up.ps1
```
3. Start with Dockerized Cloudflare tunnel:
```powershell
.\scripts\up.ps1 -Tunnel
```
4. Stop:
```powershell
.\scripts\down.ps1
```

## Environment Files
- `backend/.env`: API, DB, OCR, retrieval, model settings
- `frontend/.env`: frontend runtime API target (`VITE_API_URL`)
- `infra/.env`: Docker runtime values + optional Cloudflare tunnel settings

See detailed variable documentation in:
- `backend/README.md`
- `frontend/README.md`
- `infra/README.md`

## Model Defaults and Recommendations
Backend code defaults:
- `OPENAI_CHAT_MODEL=gpt-5-mini`
- `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`

Recommended quality profile:
- `OPENAI_CHAT_MODEL=gpt-5.2`
- `OPENAI_EMBEDDING_MODEL=text-embedding-3-large`
- `OPENAI_EMBEDDING_DIMENSIONS=1536`

Deterministic behavior:
- Backend uses exactly the models configured in `backend/.env`.
- No runtime model fallback is applied.
- Embeddings use `OPENAI_EMBEDDING_DIMENSIONS`; keep it at `1536` for current DB schema compatibility.

## API Surface (Backend)
- `GET /health`
- `POST /documents`
- `GET /documents/{document_id}/status`
- `GET /documents/{document_id}/pages/{page}`
- `POST /documents/{document_id}/ask`

Detailed examples: `backend/docs/api-contract.md`

## Cloudflare Tunnel Notes
If you host multiple projects on the same machine:
- use one tunnel per project
- keep hostnames isolated per tunnel
- avoid mixing `localhost` origins with Docker service-name origins in the same tunnel config

For this project's Dockerized tunnel mode, origins should target Docker services:
- app host -> `http://web:80`
- api host -> `http://api:8080`

## Security
- Do not commit real API keys or secrets.
- Keep `.env` files private.
- Uploaded files may contain sensitive records; production deployment should add strict access control and data-retention policy.

## Detailed Subsystem Documentation
- Frontend deep dive: `frontend/README.md`
- Backend deep dive: `backend/README.md`
- Infra/deployment guide: `infra/README.md`

## License
MIT License. See `LICENSE`.

