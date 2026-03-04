# Chronicle - Project Overview

**Date:** 2026-02-25
**Type:** Monorepo (backend + android)
**Architecture:** Service-centric backend + Android companion widgets

## Executive Summary
Chronicle is a local-first system that builds rich Strava activity descriptions by combining data from Strava and connected sources. It includes a Flask-based web UI for dashboards, planning, template editing, and setup, plus an Android widget companion that surfaces daily plan details.

## Project Classification
- **Repository Type:** Monorepo
- **Project Type(s):** Backend (Python/Flask), Mobile (Android/Kotlin)
- **Primary Language(s):** Python, Kotlin
- **Architecture Pattern:** Server-rendered web app + background worker + Android widgets

## Multi-Part Structure
This project consists of 2 distinct parts:

### Backend
- **Type:** Backend (Python/Flask)
- **Location:** `/home/shipyard/src/Auto-Stat-Description`
- **Purpose:** API + web UI + activity processing pipeline
- **Tech Stack:** Python, Flask, SQLite runtime DB, Docker

### Android
- **Type:** Mobile (Android/Kotlin)
- **Location:** `/home/shipyard/src/Auto-Stat-Description/android`
- **Purpose:** Widget companion app for daily plan
- **Tech Stack:** Kotlin, Android SDK, WorkManager

### How Parts Integrate
- Android widgets call `GET /plan/today.json` from the backend.
- Base URL is configured in the Android app and stored in SharedPreferences.

## Technology Stack Summary

### Backend Stack
| Category | Technology | Version | Justification |
| --- | --- | --- | --- |
| Language | Python | 3.x (inferred) | `requirements.txt` present |
| Web Framework | Flask | 3.1.0 | `requirements.txt` |
| WSGI Server | Gunicorn | 22.0.0 | `requirements.txt` |
| HTTP Client | requests | 2.32.3 | `requirements.txt` |
| Config | python-dotenv | 1.0.1 | `requirements.txt` |
| External API Client | garminconnect | 0.2.28 | `requirements.txt` |
| Containerization | Docker | N/A | `Dockerfile` |
| Orchestration | Docker Compose | N/A | `docker-compose.yml` |

### Android Stack
| Category | Technology | Version | Justification |
| --- | --- | --- | --- |
| Language | Kotlin | N/A | Gradle Kotlin DSL |
| Build System | Gradle | N/A | `build.gradle.kts` |
| Platform | Android SDK | N/A | `AndroidManifest.xml` |

## Key Features
- Automated Strava description generation using activity profiles and templates
- Web UI: dashboard, plan sheet, template editor, setup, and control panel
- Template repository with versioning and export/import
- Plan sheet management with workouts and pace workshop
- Android widgets for daily plan summary

## Architecture Highlights
- Flask app serves both HTML pages and JSON API endpoints.
- Background worker executes activity pipeline and refreshes dashboard cache.
- Runtime state stored in SQLite + JSON files under `state/`.

## Development Overview

### Prerequisites
- Python 3.x
- Docker + Docker Compose
- Android Studio (for widget app)

### Getting Started
- Copy `.env.example` to `.env`
- `docker compose up -d`
- Open `http://localhost:1609`

### Key Commands

#### Backend
- **Install:** `pip install -r requirements.txt`
- **Dev:** `python -m chronicle.api_server`
- **Worker:** `python -m chronicle.worker`
- **Test:** `pytest`

#### Android
- **Build:** Open `android/` in Android Studio
- **Run:** Install app module on device/emulator

## Repository Structure
- `chronicle/` backend logic
- `templates/` + `static/` frontend
- `android/` widget companion
- `tests/` backend tests
- `docs/` documentation

## Documentation Map
For detailed information, see:

- [index.md](./index.md) - Master documentation index
- [architecture-backend.md](./architecture-backend.md) - Backend architecture
- [architecture-android.md](./architecture-android.md) - Android architecture
- [source-tree-analysis.md](./source-tree-analysis.md) - Directory structure
- [development-guide-backend.md](./development-guide-backend.md) - Backend dev
- [development-guide-android.md](./development-guide-android.md) - Android dev

---
_Generated using BMAD Method `document-project` workflow_
