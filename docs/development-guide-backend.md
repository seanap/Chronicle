# Development Guide (Backend)

**Part:** backend

## Prerequisites
- Python 3.x
- Docker + Docker Compose (for containerized runs)

## Environment Setup
- Copy `.env.example` to `.env` and fill in provider credentials.
- Configure source credentials on the `/setup` page after boot.

## Local Development
### Option A: Docker
- `docker compose up -d`
- App listens on `http://localhost:1609`

### Option B: Run Flask directly
- `pip install -r requirements.txt`
- `python -m chronicle.api_server`

## Worker
- The worker loop runs separately via `python -m chronicle.worker`.
- Poll interval and quiet hours are configured via env vars.

## Testing
- Python tests are located in `tests/`.
- Run with `pytest`.

---
_Source: README, Dockerfile, docker-compose.yml_ 
