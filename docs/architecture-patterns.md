# Architecture Patterns

## Part: backend
- **Primary Pattern:** Service/API-centric backend (Flask)
- **Traits:** Request/response web service, server-rendered UI (`templates/` + `static/`), background/worker-style processing for activity polling.

## Part: android
- **Primary Pattern:** Native Android app (single app module)
- **Traits:** Client UI consuming backend API (`/plan/today.json`), background fetch via WorkManager (per existing docs).
