# Infra (Self-Host + Cloudflare)

This folder contains a production-style local deployment for Page-Proof-QA using Docker Compose.

Services in `docker-compose.selfhost.yml`:
- `web`: frontend static build served by Nginx
- `api`: FastAPI backend
- `db`: PostgreSQL + pgvector
- `cloudflared` (optional profile): Cloudflare Tunnel connector

## 1) Prepare Environment
Edit `infra/.env`:
- set `OPENAI_API_KEY`
- set `VITE_API_URL`
- set `CORS_ORIGINS_JSON`
- set `CF_APP_DOMAIN` and `CF_API_DOMAIN` for DNS routing in `cloudflared-tunnel.ps1`
- set `CF_TUNNEL_ID` (UUID) for Dockerized tunnel runs
- optional: set `CF_TUNNEL_NAME` if you prefer tunnel name for host-side script
- set `CF_CLOUDFLARED_CERT_FILE` to the host path of `cert.pem`
- set `CF_TUNNEL_CREDENTIALS_PATH` to the host path of tunnel credentials JSON (`<tunnel-uuid>.json`)

Common additional knobs (all used by `docker-compose.selfhost.yml`):
- Ports: `EXPOSE_WEB_PORT`, `EXPOSE_API_PORT`, `EXPOSE_DB_PORT`
- Postgres: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Models: `OPENAI_CHAT_MODEL`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_EMBEDDING_DIMENSIONS`
- OCR: `OCR_FALLBACK_ENABLED`, `OCR_TRIGGER_MIN_WORDS`, `OCR_TRIGGER_MIN_ALNUM_RATIO`, `OCR_LANGUAGE`, `OCR_DPI`, `OCR_FULL_PAGE`, `OCR_TESSDATA`
- Retrieval/evidence: `RETRIEVAL_TOP_K`, `RETRIEVAL_MAX_CONTEXT_CHUNKS`, `RETRIEVAL_MIN_KEYWORD_OVERLAP`, `EVIDENCE_QUESTION_WEIGHT`, `EVIDENCE_ANSWER_WEIGHT`, `EVIDENCE_RELATIVE_SCORE_THRESHOLD`, `EVIDENCE_DROP_RATIO_STOP`, `EVIDENCE_MIN_ABSOLUTE_SCORE`, `RETRIEVAL_MAX_VECTOR_DISTANCE`, `ANSWER_MAX_EVIDENCE_ITEMS`, `MINIMUM_EVIDENCE_ITEMS`, `REQUIRE_LLM_CITATIONS`

Security note:
- Keep `infra/.env` private. Do not commit real API keys, tunnel UUIDs, or local file paths.

Compatibility note:
- Keep `OPENAI_EMBEDDING_DIMENSIONS=1536` for the current backend schema (`vector(1536)`).

## 2) Start Stack
```powershell
.\scripts\up.ps1
```

With Dockerized Cloudflare tunnel:

```powershell
.\scripts\up.ps1 -Tunnel
```

AI-Commerce style host tunnel (run `cloudflared` on host):

```powershell
.\cloudflared-tunnel.ps1 -StartStack
```

Useful commands:

```powershell
.\scripts\logs.ps1
.\scripts\logs.ps1 api
.\scripts\down.ps1
.\scripts\down.ps1 -RemoveVolumes
```

`.\scripts\down.ps1` tears down all services, including the `tunnel` profile.

## 3) Local Access
- Frontend: `http://localhost:<EXPOSE_WEB_PORT>` (default `5173`)
- API: `http://localhost:<EXPOSE_API_PORT>` (default `8080`)
- DB: `localhost:<EXPOSE_DB_PORT>` (default `5432`)

## 4) Cloudflare Subdomain Setup (Your Current 2-Subdomain Pattern)
You currently have:
- app host: `page-proof-qa.<your-domain>`
- api host: `api-page-proof-qa.<your-domain>`

If you run Cloudflare Tunnel on the host machine, set Cloudflare published app URLs to local ports:
- app hostname -> `http://localhost:<EXPOSE_WEB_PORT>` (default `5173`)
- api hostname -> `http://localhost:<EXPOSE_API_PORT>` (default `8080`)

Use `http://` origin URLs in tunnel config unless you configured local TLS termination.

If you run Dockerized `cloudflared` (`.\scripts\up.ps1 -Tunnel`), set origins to Docker service names:
- app hostname -> `http://web:80`
- api hostname -> `http://api:8080`

For Dockerized tunnel:
- set `CF_TUNNEL_ID`
- set `CF_CLOUDFLARED_CERT_FILE` (example: `C:/Users/<you>/.cloudflared/cert.pem`)
- set `CF_TUNNEL_CREDENTIALS_PATH` (example: `C:/Users/<you>/.cloudflared/<tunnel-uuid>.json`)
- this mode does not mount host `config.yml`, avoiding cross-project conflicts

If you run host-side script (`.\cloudflared-tunnel.ps1`), it:
- reads tunnel reference from `-TunnelRef`, then `CF_TUNNEL_NAME`, then `CF_TUNNEL_ID`
- routes `CF_APP_DOMAIN` / `CF_API_DOMAIN` with `--overwrite-dns` (unless `-SkipDnsRoute`)
- starts tunnel mode (`cloudflared tunnel run <TunnelRef>`)

Then set:
- `VITE_API_URL=https://api-page-proof-qa.<your-domain>`
- `CORS_ORIGINS_JSON=["https://page-proof-qa.<your-domain>","http://localhost:5173"]`

## 5) Single-Host Alternative (Optional)
If you prefer one hostname (recommended for simpler CORS):
- set `VITE_API_URL=/api`
- publish only app host -> `http://web:80`
- Nginx already proxies `/api/*` to backend `api:8080`

## Notes
- Frontend image is built with `infra/frontend.Dockerfile`.
- Backend runs migrations on startup.
- Uploaded PDFs/pages are persisted in `uploads_data` volume.
- Database is persisted in `postgres_data` volume.
