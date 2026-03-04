# Deployment Configuration

## Docker
- `Dockerfile` defines container image for the backend.
- `docker-compose.yml` provides local orchestration.

## CI/CD
- `.github/workflows/ci-cd.yml` runs backend CI tasks.
- `.github/workflows/android-widget-release.yml` builds/releases Android widget APKs.

## Environment
- `.env` is the primary configuration file (can be edited via `/setup`).
- Runtime overrides stored under `state/`.
