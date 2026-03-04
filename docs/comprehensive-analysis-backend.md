# Comprehensive Analysis (Backend)

**Part:** backend

## Configuration Management
- `.env` and runtime overrides managed via `chronicle/setup_config.py`.
- `chronicle/config.py` loads env vars and merges overrides stored in `state/`.
- `Settings` class centralizes config (API port, polling intervals, provider keys, state paths).

## Authentication / Security
- Strava OAuth flow implemented in `chronicle/api_server.py` (`/setup/api/strava/oauth/start`, `/setup/strava/callback`).
- No general API authentication middleware observed; endpoints are intended for local use.

## Entry Points
- Flask app entry: `chronicle/api_server.py` (`if __name__ == "__main__": app.run(...)`).
- Worker processing: `chronicle/worker.py` (heartbeat-driven background job loop).

## Shared Code / Utilities
- `chronicle/template_*` for templates, profiles, and repository.
- `chronicle/stat_modules/*` for stats calculations (misery index, intervals, etc.).
- `chronicle/storage.py` provides runtime DB + persistence APIs.

## Async / Event Patterns
- Worker heartbeat and job queue stored in runtime DB.
- Rerun endpoints trigger pipeline execution (`activity_pipeline.run_once`).

## CI/CD
- `.github/workflows/ci-cd.yml` — CI pipeline.
- Docker deployment via `Dockerfile` + `docker-compose.yml`.

## Deployment
- Containerized with Docker; compose file present for local deployment.
- Gunicorn in requirements suggests production WSGI server.

## Localization
- No localization directory detected.

---
_Source: `chronicle/api_server.py`, `chronicle/config.py`, `chronicle/worker.py`, `.github/workflows/*`, `Dockerfile`, `docker-compose.yml`_ 
