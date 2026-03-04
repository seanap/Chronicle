# Architecture - Backend

## Executive Summary
The backend is a Flask-based service that provides a local web UI, JSON APIs, and a background worker to process Strava activities and generate rich descriptions. Runtime state is stored in SQLite and JSON files under `state/`.

## Technology Stack
- Python 3.x
- Flask (API + server-rendered UI)
- Gunicorn (WSGI server)
- SQLite runtime DB
- Docker + Docker Compose

## Architecture Pattern
- Service/API-centric monolith with server-rendered HTML pages and JSON endpoints.
- Background worker loop for polling and processing activities.

## Data Architecture
- SQLite runtime DB (`state/runtime_state.db`) holds activity state, jobs, runs, plan days/sessions.
- JSON files for latest payload, tokens, and template artifacts in `state/`.

## API Design
- REST-style JSON endpoints in `chronicle/api_server.py`.
- HTML pages served for `/dashboard`, `/plan`, `/editor`, `/setup`, `/control`.
- Strava OAuth handled via `/setup/api/strava/*` and `/setup/strava/callback`.

## Component Overview
- `chronicle/api_server.py` — HTTP layer (UI + JSON endpoints)
- `chronicle/worker.py` — background loop and lifecycle
- `chronicle/activity_pipeline.py` — activity processing and description generation
- `chronicle/template_*` — template profiles, repository, validation, rendering
- `chronicle/stat_modules/*` — stats computations

## Source Tree
See `docs/source-tree-analysis.md`.

## Development Workflow
- Local run via `python -m chronicle.api_server`.
- Worker runs via `python -m chronicle.worker`.
- Tests via `pytest`.

## Deployment Architecture
- Docker container built from `Dockerfile`.
- Local orchestration with `docker-compose.yml`.
- CI via `.github/workflows/ci-cd.yml`.

## Testing Strategy
- Pytest-based suite in `tests/` covering pipeline, API, and stats modules.

---
_Source: chronicle/*.py, Dockerfile, docker-compose.yml, tests/_
