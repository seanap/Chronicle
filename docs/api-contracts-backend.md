# API Contracts (Backend)

**Part:** backend
**Service:** Flask API + server-rendered UI
**Base URL (local):** `http://localhost:1609`

## Authentication
- No explicit auth middleware detected in `chronicle/api_server.py`.
- OAuth flow exists for Strava, but the API itself is unauthenticated on localhost.

## HTML Pages (server-rendered)
- `GET /` → redirect to `/dashboard`
- `GET /dashboard` → dashboard page
- `GET /plan` → plan page
- `GET /editor` → template editor UI
- `GET /setup` → source setup UI
- `GET /control` → API control UI

## Health & Runtime
- `GET /health` → liveness info, worker heartbeat
- `GET /ready` → readiness checks for state path + worker
- `GET /latest` → latest activity payload JSON
- `GET /service-metrics` → most recent service-call metrics

## Dashboard
- `GET /dashboard/data.json`
  - Query: `force=true|false`, `mode=full|summary|year`, `year=YYYY`
  - Returns activity aggregates, intervals metrics, and optional activity list

## Plan
- `GET /plan/data.json`
  - Query: `center_date=YYYY-MM-DD`, `window_days=7..56`, `start_date`, `end_date`, `include_meta=0|1`
  - Returns plan rows, summary, and run-type options
- `GET /plan/today.json`
  - Returns today’s planned run summary for widgets
- `GET /plan/pace-workshop.json`
  - Returns marathon goal and pace recommendations
- `PUT /plan/pace-workshop/goal`
  - Body: `{ "marathon_goal": "HH:MM:SS" }`
- `POST /plan/pace-workshop/calculate`
  - Body: `{ "distance": <miles>, "time": "HH:MM:SS" }`
- `PUT /plan/day/<date_local>`
  - Body supports `distance`, `planned_total_miles`, `sessions`, `run_type`, `notes`, `is_complete`
- `POST /plan/days/bulk`
  - Body: `{ "days": [ {"date_local":"YYYY-MM-DD", ...} ] }`
- `GET /plan/day/<date_local>/metrics`
  - Returns metrics for a single day
- `POST /plan/seed/from-actuals`
  - Seeds plan based on actual activities

## Setup (Sources / OAuth)
- `GET /setup/api/config` → effective setup config (masked)
- `PUT /setup/api/config` → update `.env` and runtime overrides
- `GET /setup/api/env` → rendered `.env` snippet
- `GET /setup/api/strava/status` → Strava connection status
- `POST /setup/api/strava/oauth/start` → returns Strava authorize URL
- `GET /setup/strava/callback` → Strava OAuth callback
- `POST /setup/api/strava/disconnect` → clear Strava tokens

## Editor / Templates
- `GET /editor/profiles` → available profiles + working profile
- `PUT /editor/profiles/<profile_id>` → enable/disable/priority
- `POST /editor/profiles/working` → set working profile
- `GET /editor/template` → active template for profile
- `PUT /editor/template` → save template (validates against context)
- `GET /editor/template/default` → default template
- `GET /editor/template/versions` → version history
- `GET /editor/template/version/<version_id>` → fetch a version
- `GET /editor/template/export` → export template or bundle
- `POST /editor/template/import` → import template
- `POST /editor/template/rollback` → rollback to version
- `POST /editor/validate` → validate template against context
- `POST /editor/preview` → render preview
- `GET /editor/schema` → context schema
- `GET /editor/catalog` → context catalog
- `GET /editor/snippets` → editor snippets
- `GET /editor/starter-templates` → starter template list
- `GET /editor/context/sample` → sample context payload

## Template Repository
- `GET /editor/repository/templates`
- `GET /editor/repository/template/<template_id>`
- `POST /editor/repository/template/<template_id>/load`
- `POST /editor/repository/save_as`
- `PUT /editor/repository/template/<template_id>`
- `POST /editor/repository/template/<template_id>/duplicate`
- `GET /editor/repository/template/<template_id>/export`
- `POST /editor/repository/import`

## Rerun / Processing
- `POST /rerun/latest` → re-run latest activity
- `POST /rerun/activity/<activity_id>` → re-run a specific activity
- `POST /rerun` → re-run by request body (`activity_id` optional)

---
_Source: `chronicle/api_server.py`_ 
