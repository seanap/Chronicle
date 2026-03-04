# Project Structure

**Repository Type:** Monorepo
**Parts Count:** 2
**Detected Parts:**
- `backend` — `/home/shipyard/src/Auto-Stat-Description`
- `android` — `/home/shipyard/src/Auto-Stat-Description/android`

## Summary
This repository contains a Python backend/web application at the repo root and an Android companion app under `android/`.

## Part Classification Rationale
- **backend:** Detected `requirements.txt`, `Dockerfile`, `docker-compose.yml` → classified as `backend`
- **android:** Detected `build.gradle.kts`, `settings.gradle.kts`, `AndroidManifest.xml` → classified as `mobile`
