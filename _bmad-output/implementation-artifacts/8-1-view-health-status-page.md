# Story 8.1: View Health/Status Page

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to view a health/status page,  
so that I can see if the system is healthy and what to do next.

## Acceptance Criteria

1. **Given** I open the Health/Status page  
   **When** the page loads  
   **Then** I see clear healthy/warn/error states  
   **And** each state includes a recommended next action.

## Tasks / Subtasks

- [x] Add SPA Health/Status route and page shell (AC: 1)
  - [x] Add a new route entry and navigation link for Health/Status.
  - [x] Render page heading/description and refresh control.
  - [x] Keep existing app routes and navigation behavior intact.

- [x] Implement health data loading from existing backend endpoints (AC: 1)
  - [x] Add frontend API client for `/health`, `/ready`, `/service-metrics`, and `/setup/api/strava/status`.
  - [x] Reuse existing control activity-detection endpoint for worker detection context.
  - [x] Handle partial endpoint failures without crashing the page.

- [x] Render clear healthy/warn/error states with actions (AC: 1)
  - [x] Derive state severity from readiness checks and endpoint payloads.
  - [x] Render explicit status labels and concise next-action guidance per health panel.
  - [x] Surface fallback guidance when health data is unavailable.

- [x] Add automated coverage for page and route behavior (AC: 1)
  - [x] Add API tests validating health endpoint request paths.
  - [x] Add Health page tests for healthy/warn/error and recommended actions.
  - [x] Update route/smoke tests to include new Health route.

## Dev Notes

- Scope boundary for Story 8.1:
  - Introduces an SPA Health page for operational status visibility.
  - Uses existing backend health/readiness endpoints; no backend contract changes expected.
  - Troubleshooting guide content itself is Story 8.2.

### Technical Requirements

- Primary requirement sources:
  - Epic 8 Story 8.1 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR33 in `_bmad-output/planning-artifacts/prd.md`.
- Endpoint sources to use:
  - `/health`
  - `/ready`
  - `/service-metrics`
  - `/setup/api/strava/status`
  - `/control/activity-detection`

### Architecture Compliance

- Keep architecture boundaries:
  - API wrappers in `chronicle-ui/src/api/`.
  - Page rendering in `chronicle-ui/src/features/health/`.
  - Route wiring in `chronicle-ui/src/config/routes.tsx`.
- Keep backend endpoint paths unchanged.

### Library / Framework Requirements

- Use current stack without upgrades:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4

### File Structure Requirements

- Likely files to modify:
  - `chronicle-ui/src/api/health-status-api.ts` (new)
  - `chronicle-ui/src/api/health-status-api.test.ts` (new)
  - `chronicle-ui/src/features/health/health-page.tsx` (new)
  - `chronicle-ui/src/features/health/health-page.test.tsx` (new)
  - `chronicle-ui/src/config/routes.tsx`
  - `chronicle-ui/src/components/app-shell.tsx`
  - `chronicle-ui/src/app-smoke.test.tsx`
  - `_bmad-output/implementation-artifacts/8-1-view-health-status-page.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Page shows explicit healthy/warn/error statuses.
  - Each status panel includes actionable next-step guidance.
  - Refresh action re-runs health endpoint loading.
- Regression coverage:
  - Existing route navigation and feature pages remain intact.
- Suggested verification commands:
  - `npm run test -- src/api/health-status-api.test.ts src/features/health/health-page.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`

### Previous Story Intelligence

- Story 7.3 completed dashboard enhancements and did not alter global routing structure.
- Story 8.1 should add Health route with minimal coupling to other features.

### Git Intelligence Summary

- Existing frontend patterns favor:
  - typed API wrappers with deterministic tests
  - robust error/loading state presentation
  - explicit UI guidance for recoverable issues

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Keep backend as source-of-truth.
  - Do not alter endpoint paths.
  - Keep tests deterministic and avoid live network calls.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: SPA now includes a Health/Status page with explicit healthy/warn/error panels and actionable recommended next steps sourced from existing backend health/readiness endpoints.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story file created from Epic 8 Story 8.1 and PRD FR33 requirements.
- Added `health-status-api` wrapper and snapshot aggregator for `/health`, `/ready`, `/service-metrics`, `/setup/api/strava/status`, and `/control/activity-detection`.
- Added Health page feature with:
  - refresh action
  - panelized status derivation logic
  - explicit status chips (Healthy/Warning/Error)
  - recommended next-action guidance per panel
  - partial-load warnings and fallback handling.
- Wired Health page into SPA route config and app navigation (`/status`, label `Health`).
- Expanded smoke/feature coverage with new API + page + route tests.
- Code review pass: no blocking correctness or regression issues remained after implementation.
- Validation commands executed:
  - `npm run test -- src/api/health-status-api.test.ts src/features/health/health-page.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`

### Completion Notes List

- Delivered Health page with clear healthy/warn/error states and direct recommended next actions.
- Implemented resilient multi-endpoint loading with partial-failure warnings instead of total page failure.
- Added SPA route/nav support for Health status view.
- Added deterministic test coverage for API contracts, page behavior, and route smoke expectations.
- Completed dev/review/fix/QA flow for Story 8.1 and finalized status as `done`.

### File List

- _bmad-output/implementation-artifacts/8-1-view-health-status-page.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle-ui/src/api/health-status-api.ts
- chronicle-ui/src/api/health-status-api.test.ts
- chronicle-ui/src/features/health/health-page.tsx
- chronicle-ui/src/features/health/health-page.test.tsx
- chronicle-ui/src/config/routes.tsx
- chronicle-ui/src/components/app-shell.tsx
- chronicle-ui/src/app-smoke.test.tsx

### Change Log

- 2026-03-04: Created Story 8.1 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented Health/Status page with endpoint aggregation, route wiring, tests, and completed review/QA with status set to done.
