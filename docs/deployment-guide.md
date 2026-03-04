# Deployment Guide

## Docker (recommended)
- Build/run: `docker compose up -d`
- Exposes service on `http://localhost:1609`

## Environment Configuration
- `.env` is the primary config file.
- `/setup` UI can update `.env` values and runtime overrides.

## CI/CD
- `.github/workflows/ci-cd.yml` runs the Python CI checks.
- `.github/workflows/android-widget-release.yml` produces Android widget releases.

## UI Rollout and Rollback Guardrails (MPA/SPA Coexistence)
- Default rollout mode is controlled by `UI_ROLLOUT_DEFAULT_MODE` (`mpa` or `spa`, default `mpa`).
- SPA entry base path is controlled by `UI_SPA_BASE_PATH` (default `/app`).
- Canonical core journey routes:
  - `/sources`
  - `/build`
  - `/plan`
  - `/view`
  - `/control`
- Legacy fallback routes:
  - `/legacy/sources`
  - `/legacy/build`
  - `/legacy/plan`
  - `/legacy/view`
  - `/legacy/control`

### Release Simulation
```bash
curl -X POST http://localhost:1609/ops/ui-rollout/mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"spa","source":"release-drill"}'
```

### Rollback Trigger
```bash
curl -X POST http://localhost:1609/ops/ui-rollout/rollback \
  -H "Content-Type: application/json" \
  -d '{"source":"oncall","reason":"regression"}'
```

### Executable Verification Checklist
- Run smoke verification script:
```bash
./.venv/bin/python scripts/verify_ui_rollout_smoke.py
```
- The script validates:
  - MPA mode core journey behavior
  - SPA mode canonical route targeting
  - Legacy fallback availability
  - Rollback completion metadata and route recovery

For the full operator playbook, see `docs/ui-rollout-rollback.md`.

---
_Source: Dockerfile, docker-compose.yml, GitHub workflows_ 
