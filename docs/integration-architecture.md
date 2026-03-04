# Integration Architecture

**Repository Type:** Monorepo
**Parts:** backend, android

## Integration Points
1. **Android → Backend**
   - **Type:** REST (HTTP)
   - **Endpoint:** `GET /plan/today.json`
   - **Purpose:** Fetch today’s plan summary for widgets
   - **Auth:** None (local network usage)
   - **Data Format:** JSON

2. **Android → Backend (Web UI deep link)**
   - **Type:** HTTP URL navigation
   - **Endpoint:** `/plan`
   - **Purpose:** Open the plan page from widget tap

## Data Flow
- Backend persists plan data in SQLite (`plan_days` + `plan_sessions`).
- `/plan/today.json` aggregates today’s plan and emits a lightweight payload.
- Android widget fetches, caches, and renders the payload into `RemoteViews`.

## Shared Dependencies
- None. Android app is a standalone client.

---
_Source: `chronicle/api_server.py`, `android/app/src/main/java/com/chronicle/widget/*`_ 
