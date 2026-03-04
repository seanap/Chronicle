# Story 7.2: Scope Dashboard by Year or Summary Mode

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to scope the dashboard by year or summary mode,  
so that I can focus on a specific time range or view.

## Acceptance Criteria

1. **Given** I am viewing the dashboard  
   **When** I select a year or summary mode  
   **Then** the charts and heatmaps update to that scope  
   **And** the selected scope is clearly shown  
   **And** the dashboard scope-change interaction responds in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30).

## Tasks / Subtasks

- [x] Add dashboard scope controls for mode/year selection (AC: 1)
  - [x] Add a response-mode selector (full, summary, year) to the View page.
  - [x] Add a year selector and only require it when year mode is selected.
  - [x] Ensure selected mode/year values are clearly visible in UI scope summary.

- [x] Apply selected scope to dashboard data requests and rendering (AC: 1)
  - [x] Call `/dashboard/data.json` using `mode` and `year` query parameters based on selected scope.
  - [x] Re-render trend/heatmap cards from the currently scoped payload.
  - [x] Preserve existing loading/error/refresh behavior with scoped requests.

- [x] Add scope-change telemetry for responsiveness (AC: 1)
  - [x] Emit timing telemetry for mode/year scope-change requests.
  - [x] Keep scope-change timing p95 < 1000ms in UI test telemetry runs.

- [x] Add automated coverage for scope behavior and telemetry (AC: 1)
  - [x] Extend frontend API request tests for mode/year query combinations.
  - [x] Add View page tests for mode/year scope selection behavior.
  - [x] Add View page tests that assert selected scope visibility and telemetry p95 bounds.

## Dev Notes

- Scope boundary for Story 7.2:
  - Adds dashboard response scoping controls for year/summary mode in SPA View page.
  - Builds directly on Story 7.1 dashboard rendering and timing instrumentation.
  - Does not add new custom metric panels or classification overlays (Story 7.3).

### Technical Requirements

- Primary requirement sources:
  - Epic 7 Story 7.2 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR24 and FR30 in `_bmad-output/planning-artifacts/prd.md`.
- Backend behavior dependencies:
  - `/dashboard/data.json?mode=summary` returns projected summary payload.
  - `/dashboard/data.json?mode=year&year=YYYY` returns year-scoped payload.

### Architecture Compliance

- Keep architecture boundaries:
  - Dashboard data access in `chronicle-ui/src/api/`.
  - View feature logic in `chronicle-ui/src/features/view/`.
- Preserve backend endpoint path and `snake_case` JSON contract keys.

### Library / Framework Requirements

- Use current stack without upgrades:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4

### File Structure Requirements

- Likely files to modify:
  - `chronicle-ui/src/api/view-api.ts`
  - `chronicle-ui/src/api/view-api.test.ts`
  - `chronicle-ui/src/features/view/view-page.tsx`
  - `chronicle-ui/src/features/view/view-page.test.tsx`
  - `chronicle-ui/src/features/view/view-timing.ts` (reuse existing timing helpers)
  - `_bmad-output/implementation-artifacts/7-2-scope-dashboard-by-year-or-summary-mode.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - View page exposes mode/year scope controls and selected scope indicator.
  - Mode/year changes call dashboard API with correct query parameters.
  - Scope-change timing telemetry p95 remains <1000ms in tests.
- Regression coverage:
  - Existing 7.1 trend/heatmap + refresh + type-filter behavior remains intact.
- Suggested verification commands:
  - `npm run test -- src/api/view-api.test.ts src/features/view/view-page.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`

### Previous Story Intelligence

- Story 7.1 established:
  - Typed `getDashboardData` API wrapper with optional `mode` and `year`.
  - View dashboard trend + heatmap rendering from activities payload.
  - `chronicle:ui-timing` instrumentation via `view-timing.ts`.
- Story 7.2 should extend these patterns rather than introducing a parallel fetch/render path.

### Git Intelligence Summary

- Existing frontend patterns favor:
  - deterministic tests with mocked API clients
  - feature-local utilities
  - explicit loading/error state assertions

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- No dependency upgrades required for Story 7.2.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Backend is source-of-truth for metrics and aggregates.
  - Keep endpoint paths unchanged (no `/api/v1` migration).
  - Keep tests deterministic and avoid live-network dependencies.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: View dashboard now supports explicit full/summary/year scoping with clear scope indicator, scoped API query behavior, and sub-second telemetry assertions for scope-change interactions.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/dashboard_response_modes.py]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story file created from Epic 7 Story 7.2 and PRD FR24/FR30 requirements.
- Implemented dashboard scope state (`scopeMode`, `scopeYear`) with unioned year options preserved across scoped payload reloads.
- Added scoped request building in View page using existing `getDashboardData` mode/year query support.
- Added explicit selected-scope indicator and summary-mode behavior for cards/filter state.
- Extended `view-api` payload typings with optional `activity_count` and `response_year`.
- Expanded API tests with summary-mode query coverage.
- Expanded View page tests for:
  - year mode scoping + selected-scope visibility
  - summary mode scoping behavior
  - scope-change telemetry (`dashboard.scope_change_mode`, `dashboard.scope_change_year`) with p95 < 1000ms.
- Code review pass: no blocking correctness or regression issues remained after implementation.
- Validation commands executed:
  - `npm run test -- src/api/view-api.test.ts src/features/view/view-page.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`

### Completion Notes List

- Added dashboard scope mode and year controls on View page with clear selected scope display.
- Wired mode/year scope selections to `/dashboard/data.json` query parameters and scoped rerendering.
- Preserved existing refresh/load/error behaviors while applying scoped API requests.
- Added and validated scope-change timing telemetry with sub-second p95 checks in automated tests.
- Completed dev/review/fix/QA flow for Story 7.2 and finalized status as `done`.

### File List

- _bmad-output/implementation-artifacts/7-2-scope-dashboard-by-year-or-summary-mode.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle-ui/src/api/view-api.ts
- chronicle-ui/src/api/view-api.test.ts
- chronicle-ui/src/features/view/view-page.tsx
- chronicle-ui/src/features/view/view-page.test.tsx

### Change Log

- 2026-03-04: Created Story 7.2 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented dashboard year/summary scope UX, scoped query behavior, telemetry coverage, and completed review/QA with status set to done.
