---
stepsCompleted:
- 1
- 2
- 3
- 4
- 5
- 6
- 7
- 8
inputDocuments:
- /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md
- /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd-validation-report.md
- /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md
- /home/shipyard/src/Auto-Stat-Description/docs/ANDROID_WIDGET_COMPANION.md
- /home/shipyard/src/Auto-Stat-Description/docs/API_DOCUMENTATION.md
- /home/shipyard/src/Auto-Stat-Description/docs/MISERY_INDEX_REPORT.md
- /home/shipyard/src/Auto-Stat-Description/docs/api-contracts-backend.md
- /home/shipyard/src/Auto-Stat-Description/docs/architecture-android.md
- /home/shipyard/src/Auto-Stat-Description/docs/architecture-backend.md
- /home/shipyard/src/Auto-Stat-Description/docs/architecture-patterns.md
- /home/shipyard/src/Auto-Stat-Description/docs/asset-inventory-android.md
- /home/shipyard/src/Auto-Stat-Description/docs/comprehensive-analysis-android.md
- /home/shipyard/src/Auto-Stat-Description/docs/comprehensive-analysis-backend.md
- /home/shipyard/src/Auto-Stat-Description/docs/contribution-guidelines.md
- /home/shipyard/src/Auto-Stat-Description/docs/critical-folders-summary.md
- /home/shipyard/src/Auto-Stat-Description/docs/data-models-android.md
- /home/shipyard/src/Auto-Stat-Description/docs/data-models-backend.md
- /home/shipyard/src/Auto-Stat-Description/docs/deployment-configuration.md
- /home/shipyard/src/Auto-Stat-Description/docs/deployment-guide.md
- /home/shipyard/src/Auto-Stat-Description/docs/development-guide-android.md
- /home/shipyard/src/Auto-Stat-Description/docs/development-guide-backend.md
- /home/shipyard/src/Auto-Stat-Description/docs/development-instructions.md
- /home/shipyard/src/Auto-Stat-Description/docs/existing-documentation-inventory.md
- /home/shipyard/src/Auto-Stat-Description/docs/index.md
- /home/shipyard/src/Auto-Stat-Description/docs/integration-architecture.md
- /home/shipyard/src/Auto-Stat-Description/docs/project-overview.md
- /home/shipyard/src/Auto-Stat-Description/docs/project-parts-metadata.md
- /home/shipyard/src/Auto-Stat-Description/docs/project-parts.json
- /home/shipyard/src/Auto-Stat-Description/docs/project-scan-report.json
- /home/shipyard/src/Auto-Stat-Description/docs/project-structure.md
- /home/shipyard/src/Auto-Stat-Description/docs/source-tree-analysis.md
- /home/shipyard/src/Auto-Stat-Description/docs/state-management-patterns-android.md
- /home/shipyard/src/Auto-Stat-Description/docs/supporting-documentation.md
- /home/shipyard/src/Auto-Stat-Description/docs/technology-stack.md
- /home/shipyard/src/Auto-Stat-Description/docs/ui-component-inventory-android.md
- /home/shipyard/src/Auto-Stat-Description/docs/user-provided-context.md
workflowType: architecture
project_name: Auto-Stat-Description
user_name: boss
date: '2026-02-25'
lastStep: 8
status: complete
completedAt: '2026-02-25'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**  
The architecture must support multi-source setup/OAuth, template editing + preview + validation + rollback, profile management (YAML/UI), plan + workout management (YAML workshop), Garmin workout sync, dashboard/trends/heatmaps, automated reruns, and import/export. These imply a modular pipeline with stable APIs, validation surfaces, and reliable background processing.

**Non-Functional Requirements:**  
- p95 UI interactions < 1s (planning + dashboard).  
- Description render correctness ≥ 95%.  
- Automated description failure < 1/month.  
- System runs ≥ 8 weeks without manual intervention.  
- Garmin sync p95 15–30s with retries + backoff.  
- Tokens/keys stored locally; no plaintext logs; local/Tailscale-only access.

**Scale & Complexity:**  
- Primary domain: full‑stack web app with background worker + local integrations.  
- Complexity level: **High** (multi-source APIs, automation pipeline, rich UI, Garmin sync).  
- Estimated architectural components: 8–10 (API + UI + worker + data stores + integrations + templating + plan engine + metrics).

### Technical Constraints & Dependencies

- Local-first, self-hosted deployment (Docker), no cloud dependency assumed.
- MPA architecture preferred unless SPA adds clear benefit.
- External dependencies: Strava OAuth + multiple source APIs, Garmin sync.
- Android widget consumes `/plan/today.json` (no auth, LAN/Tailscale).

### Cross-Cutting Concerns Identified

- **Reliability:** health checks, retries, idempotent reruns, error visibility.  
- **Performance:** fast UI + fast template rendering.  
- **Security:** secrets management, no plaintext logs, local network exposure.  
- **Observability:** status/heartbeat for worker and integrations.  
- **Data integrity:** versioned templates, plan session edits, workout YAML validation.

## Starter Template Evaluation

### Primary Technology Domain

Frontend SPA (React) with existing Flask backend and SQLite retained.

### Starter Options Considered

**Option A: Vite + React (SPA)**  
- Best match for SPA requirement, light framework opinion.  
- Fast dev server + HMR.  
- Works cleanly with Material UI.  

**Option B: Next.js**  
- Strong framework, but leans SSR/SSG.  
- Good if future hybrid rendering or API routes are desired.  
- Likely heavier than needed for a local-first SPA.

### Selected Starter: Vite + React (TypeScript)

**Rationale for Selection:**  
Directly supports the SPA requirement, keeps the backend unchanged, and aligns with the Material-based UI system.

**Initialization Command:**

```bash
# Scaffold SPA (React + TS)
npm create vite@latest chronicle-ui -- --template react-ts

# Install dependencies
cd chronicle-ui
npm install

# Add Material UI
npm install @mui/material @emotion/react @emotion/styled
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:** React + TypeScript  
**Styling Solution:** Material UI (Emotion)  
**Build Tooling:** Vite (fast dev server + optimized build)  
**Testing Framework:** Not included by default; add per team preference  
**Code Organization:** `src/`-based SPA, component-driven  
**Development Experience:** Instant HMR, minimal scaffolding opinion

**Note:** Project initialization using this command should be the first implementation story if we proceed with the SPA path.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- SPA frontend + existing Flask backend (no rewrite of backend).
- SQLite retained; SQLAlchemy Core + Alembic for schema control.
- Local-only deployment (Docker Compose), no auth in-app.
- REST JSON API, consistent error envelope.
- React SPA stack (Vite + React Router + MUI).

**Important Decisions (Shape Architecture):**
- Pydantic for validation.
- Light in-memory caching for dashboard aggregates with explicit invalidation.
- No API version prefix; CORS only for SPA dev if needed.

**Deferred Decisions (Post‑MVP):**
- Alternative state management (Zustand) or data fetching (TanStack Query) if complexity grows.

### Data Architecture

- **Database:** SQLite (retained).  
- **Modeling:** SQLAlchemy Core **2.0.46** (explicit queries, low overhead).  
- **Migrations:** Alembic **1.18.4**.  
- **Validation:** Pydantic **2.12.5**.  
- **Caching:** Light in-memory TTL cache for expensive aggregates only; invalidate after plan edits or reruns.

### Authentication & Security

- **Auth:** None in-app (local/Tailscale only).
- **CSRF:** Not enabled (local-only assumption).
- **Secrets:** `.env` + local state only; never log plaintext.

### API & Communication Patterns

- **API Style:** REST JSON.  
- **Errors:** Consistent JSON error envelope (`error: {code, message, details}`).
- **Versioning:** No `/api/v1` prefix.  
- **CORS:** Off by default. If SPA dev server needs it, enable Flask‑CORS **6.0.2** in dev only.

### Frontend Architecture

- **Framework:** React **19.2** (latest 19.2 release).  
- **Router:** React Router **v7.13.0**.  
- **UI Library:** MUI **v7.3.7** (Material-based).  
- **Build Tool:** Vite **v7.2.6**.  
- **State:** React Context + hooks first; add Zustand later if needed.  
- **Data Fetching:** native `fetch` first; add TanStack Query if caching/retry complexity grows.  
- **Structure:** feature-based folders (`features/plan`, `features/build`, etc.), shared UI in `components/`.

### Infrastructure & Deployment

- **Hosting:** Local Docker Compose only.  
- **CI/CD:** GitHub Actions for tests/lint on PRs.  
- **Monitoring:** Basic structured logs + existing `/health` + `/ready`.  
- **Scaling:** Single-instance only (no scaling plan).

### Decision Impact Analysis

**Implementation Sequence:**
1. SPA scaffold (Vite + React + Router + MUI).
2. API stabilization + error envelope.
3. Data layer (SQLAlchemy Core + Alembic + Pydantic).
4. Caching + invalidation.
5. CI checks + health logging.

**Cross‑Component Dependencies:**
- SPA migration depends on stable REST endpoints and CORS policy.
- Data model changes require Alembic migrations and updated API validation.
- Cache invalidation ties to plan edits and rerun flows.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 7 areas where AI agents could make different choices

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case` plural (e.g., `plan_days`, `template_versions`)
- Columns: `snake_case` (e.g., `plan_date`, `run_type`)
- Foreign keys: `{table}_id` (e.g., `profile_id`)
- Indexes: `idx_{table}_{column}` (e.g., `idx_plan_days_date`)

**API Naming Conventions:**
- Existing endpoints remain unchanged (e.g., `/plan/data.json`, `/dashboard/data.json`)
- New endpoints: plural nouns + `snake_case` (e.g., `/profiles`, `/workout_sessions`)
- Query params: `snake_case`
- Error codes: `SCREAMING_SNAKE_CASE` (e.g., `TEMPLATE_INVALID`)

**Code Naming Conventions:**
- Backend Python: `snake_case` (functions, variables)
- Frontend JS/TS: `camelCase` variables, `PascalCase` React components
- Files: `kebab-case.tsx` (SPA), `snake_case.py` (backend)

### Structure Patterns

**Project Organization:**
- SPA uses feature-first structure: `features/plan`, `features/build`, `features/view`, `features/control`, `features/sources`
- Shared UI in `components/`, shared hooks in `hooks/`, API clients in `api/`
- Frontend tests co-located (`*.test.tsx`); backend tests remain in `tests/`

**File Structure Patterns:**
- Config in `chronicle/config/` (backend) and `src/config/` (frontend)
- Static assets in `static/` (backend) and `src/assets/` (frontend)
- Docs remain in `docs/`, planning artifacts in `_bmad-output/`

### Format Patterns

**API Response Formats:**
- Success: direct payload (no wrapper)
- Error: `{error: {code, message, details}}`
- Dates: ISO‑8601 strings with timezone (`YYYY-MM-DD` for dates, `YYYY-MM-DDTHH:mm:ssZ` for timestamps)

**Data Exchange Formats:**
- JSON fields in `snake_case`
- Booleans as `true/false`
- Optional fields omitted or `null` only when necessary

### Communication Patterns

**Event System Patterns:**
- No event bus; background worker uses internal task/heartbeat naming in `snake_case`

**State Management Patterns:**
- React Context + hooks for global state
- Local component state for UI-only concerns
- Shared `useRequest/useAsync` hook for loading + error consistency

### Process Patterns

**Error Handling Patterns:**
- Inline banners for recoverable errors (forms, validation, API)
- Toasts for transient errors (retryable operations)
- Error boundaries for page-level failures (SPA only)

**Loading State Patterns:**
- Local loading indicators per component + page-level skeletons for heavy views
- Background refresh uses subtle status indicators, not blocking spinners

**Logging Patterns:**
- Standard log levels: `INFO`, `WARN`, `ERROR`
- Health events always logged with explicit level

### Enforcement Guidelines

**All AI Agents MUST:**
- Follow naming conventions exactly for endpoints, JSON, and files
- Preserve existing API routes unless explicitly approved
- Use the standard error envelope format
- Add an example response in docs or fixtures for every new endpoint

**Pattern Enforcement:**
- Review diffs for naming/format violations before merge
- Document deviations in PR description
- Update this section if patterns evolve

### Pattern Examples

**Good Examples:**
- `GET /plan/data.json` → `{ rows: [...] }`
- `POST /editor/template` error → `{ error: { code: "TEMPLATE_INVALID", message: "...", details: {...} } }`
- `features/plan/plan-table.tsx` with `planRows` data

**Anti-Patterns:**
- Mixing `camelCase` and `snake_case` in the same API response
- Creating `/api/v1/...` endpoints without approval
- Component files named `PlanTable.jsx` while backend uses `snake_case`

## Project Structure & Boundaries

### Complete Project Directory Structure
```
Auto-Stat-Description/
├── chronicle/
│   ├── api_server.py
│   ├── worker.py
│   ├── activity_pipeline.py
│   ├── dashboard_data.py
│   ├── plan_data.py
│   ├── template_*
│   ├── stat_modules/
│   ├── config/
│   ├── integrations/
│   ├── services/                 # Domain logic (plan, templates, rerun)
│   └── api_schemas/              # Pydantic DTOs for API requests/responses
├── templates/
├── static/
├── chronicle-ui/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── public/
│   └── src/
│       ├── app/
│       ├── api/
│       │   ├── client.ts         # fetch wrapper + error handling
│       │   └── types.ts          # API response typings
│       ├── components/
│       ├── features/
│       │   ├── view/
│       │   ├── plan/
│       │   ├── build/
│       │   ├── control/
│       │   └── sources/
│       ├── hooks/
│       ├── config/
│       ├── assets/
│       └── styles/
├── tests/
│   ├── fixtures/                 # Example API responses
│   └── integration/              # API-level tests
├── docs/
├── local/
├── state/
├── data/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── .github/
    └── workflows/
        └── ci.yml
```

### Architectural Boundaries

**API Boundaries:**
- Backend remains the single API authority (`/plan/*`, `/dashboard/*`, `/editor/*`, `/setup/*`, `/control/*`, `/rerun/*`).
- SPA consumes JSON endpoints; legacy MPA can coexist during migration.
- `chronicle/api_schemas/` defines canonical request/response models.

**Component Boundaries:**
- SPA UI: React components under `chronicle-ui/src/`.
- Backend HTML stays in `templates/` until fully migrated.
- Data logic stays in backend; frontend never computes authoritative metrics.

**Service Boundaries:**
- `services/` owns domain logic; `api_server.py` stays thin.
- `worker.py` handles background automation and heartbeat checks.
- `integrations/` encapsulates external API calls.

**Data Boundaries:**
- SQLite + `state/` is authoritative data store.
- Migrations managed via Alembic (future).
- Caches are in-memory only and invalidated on plan changes + reruns.

### Requirements to Structure Mapping

**FR1–4 Sources/OAuth:**  
- Backend: `chronicle/api_server.py`, `chronicle/integrations/`, `chronicle/config/`  
- SPA: `chronicle-ui/src/features/sources/`

**FR5–9 Templates:**  
- Backend: `chronicle/template_*`, `chronicle/api_server.py`  
- SPA: `chronicle-ui/src/features/build/`

**FR10–13 Profiles:**  
- Backend: `chronicle/template_*`  
- SPA: `chronicle-ui/src/features/build/`

**FR14–18 Planning/Workouts:**  
- Backend: `chronicle/plan_data.py`  
- SPA: `chronicle-ui/src/features/plan/`

**FR19–22 Garmin Sync:**  
- Backend: `chronicle/integrations/`, `chronicle/activity_pipeline.py`  
- SPA: `chronicle-ui/src/features/plan/` + `chronicle-ui/src/features/control/`

**FR23–25 Dashboard/Trends:**  
- Backend: `chronicle/dashboard_data.py`  
- SPA: `chronicle-ui/src/features/view/`

**FR26–28 Automation/Rerun:**  
- Backend: `chronicle/worker.py`, `chronicle/activity_pipeline.py`  
- SPA: `chronicle-ui/src/features/control/`

**FR29–30 UI/UX Polish:**  
- SPA: `chronicle-ui/src/components/`, `chronicle-ui/src/styles/`

**FR31–34 Guidance/Troubleshooting:**  
- SPA: `chronicle-ui/src/features/sources/`, `chronicle-ui/src/features/control/`  
- Docs: `docs/`

**FR35–37 Import/Export:**  
- Backend: `chronicle/template_*`  
- SPA: `chronicle-ui/src/features/build/`

### Integration Points

**Internal Communication:**
- SPA → Backend via REST JSON.
- Worker triggers data refresh and pipeline writes; API surfaces results.

**External Integrations:**
- Strava OAuth + API, Garmin API, other sources.

**Data Flow:**
- Sources → pipeline → templates → publish → dashboard/plan APIs → SPA.

### File Organization Patterns

**Configuration Files:**
- Backend: `.env`, `chronicle/config/`
- SPA: `chronicle-ui/src/config/`

**Source Organization:**
- Feature-first in SPA.
- Backend modules by concern (plan, dashboard, templates, integrations, worker).

**Test Organization:**
- Backend tests: `tests/`
- SPA tests: co-located in `chronicle-ui/src/**`

**Asset Organization:**
- Backend static assets in `static/`
- SPA assets in `chronicle-ui/src/assets/`

### Development Workflow Integration

**Development Server Structure:**
- Backend runs on Flask (existing).
- SPA dev server (Vite) proxies API to backend in dev.

**Build Process Structure:**
- SPA builds to static output (future integration into backend static serving or separate path).

**Deployment Structure:**
- Docker Compose runs backend; SPA can be built and served by backend or via separate container.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices are compatible (Flask + SQLite + SQLAlchemy Core + Alembic + Pydantic with React SPA). SPA separation keeps backend stable.

**Pattern Consistency:**
Naming, error formats, and DTO boundaries align with chosen stack and prevent drift.

**Structure Alignment:**
Project structure supports SPA migration, domain services, and DTO enforcement.

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**
No epics provided; FR mapping covers all functional categories.

**Functional Requirements Coverage:**
All FR categories map to concrete backend modules and SPA feature folders.

**Non-Functional Requirements Coverage:**
Performance, reliability, and security constraints are addressed (local-only, fast UI, retries, health checks).

### Implementation Readiness Validation ✅

**Decision Completeness:**
Critical decisions documented with versions and rationale.

**Structure Completeness:**
Project tree is complete and boundaries are defined.

**Pattern Completeness:**
Naming, formatting, error handling, loading, and testing patterns are specified.

### Gap Analysis Results

**Critical Gaps:** None.

**Important Gaps:** None.

**Nice‑to‑Have Gaps:**
- Decide SPA deployment approach (serve via Flask static vs. separate container).
- Choose SPA testing framework (e.g., Vitest) when implementation starts.
- Document dev-only CORS policy details (host/port) for Vite proxy.

### Validation Issues Addressed

No blocking issues found.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION  
**Confidence Level:** High

**Key Strengths:**
- Clear SPA migration path without destabilizing backend
- Strong consistency rules for multi-agent implementation
- Requirements mapped to concrete locations

**Areas for Future Enhancement:**
- SPA build/deploy strategy
- Frontend test tooling
- Dev CORS/proxy defaults

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented.
- Use implementation patterns consistently across components.
- Respect project structure and boundaries.
- Refer to this document for architectural questions.

**GitHub-as-Memory Protocol (Mandatory):**
- Use GitHub Issues + PRs as durable project memory.
- Always follow the repo’s labeling/branch/PR conventions.
- Store bulk artifacts in GitHub, not in chat context.
- Use the Recall Protocol before resuming any work after compaction.

**Permission Rule (Mandatory):**
- Any `gh`, `git`, or Docker Hub commands MUST request user approval before running.
- If approval is required and missing, do not run the command.

**First Implementation Priority:**
- SPA scaffold (Vite + React + Router + MUI)
