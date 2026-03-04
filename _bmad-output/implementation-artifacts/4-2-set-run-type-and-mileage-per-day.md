# Story 4.2: Set Run Type and Mileage Per Day

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to set the run type and mileage for a day,  
so that each day reflects my intended training.

## Acceptance Criteria

1. **Given** I am editing a plan day  
   **When** I set run type and mileage  
   **Then** the day reflects the new values  
   **And** changes persist after refresh.  
   **And** this day-edit flow completes in <= 3 steps and <= 60 seconds under normal load (FR29)  
   **And** day-edit interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30)
2. **Given** I submit invalid mileage or an unsupported run type  
   **When** I save day values  
   **Then** the save is rejected with clear corrective guidance  
   **And** no partial or incorrect day data is persisted.

## Tasks / Subtasks

- [x] Extend Plan grid UI for run type + mileage day editing (AC: 1)
  - [x] In `chronicle-ui/src/features/plan/plan-page.tsx`, add a run type control per day row (sourced from `run_type_options`) alongside mileage input.
  - [x] Keep editing flow <= 3 steps for a typical day update (set fields -> save).
  - [x] Preserve keyboard accessibility and labeled controls for both mileage and run type.
  - [x] Ensure refreshed data reflects saved run type + mileage values.

- [x] Extend Plan save payload handling for combined day edits (AC: 1, 2)
  - [x] Save changed day values via existing `POST /plan/days/bulk` endpoint, including both `distance` and `run_type`.
  - [x] Keep existing path and `snake_case` payload conventions unchanged.
  - [x] Preserve current optimistic-safe behavior: refresh from server after save and after failures.

- [x] Enforce backend validation for unsupported run type values (AC: 2)
  - [x] In `chronicle/api_server.py`, validate incoming `run_type` values against canonical plan run type options.
  - [x] Reject unsupported values with HTTP 400 and actionable message.
  - [x] Ensure invalid bulk payload rows fail atomically (no partial day writes).

- [x] Keep telemetry coverage for day-edit interaction performance (AC: 1)
  - [x] Reuse existing plan timing instrumentation (`plan-grid-load`, `plan-grid-save`) for run type + mileage updates.
  - [x] Assert p95 < 1000ms in tests for day-edit interaction under test load.

- [x] Add/extend automated tests for Story 4.2 behavior (AC: 1, 2)
  - [x] Update `chronicle-ui/src/features/plan/plan-page.test.tsx` with run type + mileage edit/save persistence scenarios.
  - [x] Update `chronicle-ui/src/api/plan-api.test.ts` with run type + distance bulk payload contract checks.
  - [x] Add backend API tests in `tests/test_api_server.py` for unsupported run type rejection in single and bulk plan day endpoints.

## Dev Notes

- Scope boundary for Story 4.2:
  - Includes day-level run type + mileage editing and persistence in Plan SPA.
  - Does not include workout attachment (Story 4.3).
  - Does not include workout workshop creation/search flows (Stories 4.4, 4.5).

### Technical Requirements

- Primary requirement sources:
  - Epic 4 Story 4.2 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR15 (run type + mileage per day), FR29, FR30 in `_bmad-output/planning-artifacts/prd.md`.
- Existing implementation baseline from Story 4.1:
  - Plan grid load/save scaffolding in `chronicle-ui/src/features/plan/plan-page.tsx`.
  - Plan API wrappers in `chronicle-ui/src/api/plan-api.ts`.
  - Plan timing telemetry in `chronicle-ui/src/features/plan/plan-timing.ts`.
- Backend behavior to tighten:
  - `plan day` endpoints currently accept arbitrary `run_type` text; this story requires explicit unsupported-run-type rejection.

### Architecture Compliance

- Keep architecture boundaries:
  - Backend remains source of truth for plan-day data and validation (`chronicle/api_server.py`, `chronicle/plan_data.py`).
  - Plan SPA logic stays in `chronicle-ui/src/features/plan/`.
  - API wrapper contracts stay in `chronicle-ui/src/api/`.
- Preserve existing endpoint paths (`/plan/data.json`, `/plan/day/<date_local>`, `/plan/days/bulk`); no `/api/v1` additions.
- Keep JSON keys in `snake_case`.

### Library / Framework Requirements

- Use current project stack:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- No new dependencies are required.

### File Structure Requirements

- Likely files to modify:
  - `chronicle-ui/src/features/plan/plan-page.tsx`
  - `chronicle-ui/src/features/plan/plan-page.test.tsx`
  - `chronicle-ui/src/api/plan-api.test.ts`
  - `chronicle/api_server.py`
  - `tests/test_api_server.py`
  - `_bmad-output/implementation-artifacts/4-2-set-run-type-and-mileage-per-day.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Day row can set both mileage and run type and values persist after refresh.
  - Invalid mileage and unsupported run type return corrective guidance.
  - Invalid save attempts do not persist partial/incorrect day data.
  - Save/load telemetry remains under p95 < 1s in tests.
- Suggested verification commands:
  - `npm run test -- src/api/plan-api.test.ts src/features/plan/plan-page.test.tsx`
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 4.1 established:
  - Multi-week plan grid rendering and mileage editing.
  - Authoritative reload-on-failure behavior to avoid stale partial UI state.
  - Timing telemetry and p95 assertions for plan grid load/save.
- Story 4.2 should extend, not replace, these patterns.

### Git Intelligence Summary

- Recent changes in this branch are focused on Plan grid SPA implementation and hardening.
- Follow existing patterns introduced in Story 4.1 to minimize regression risk.

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- Story 4.2 should not upgrade framework versions.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Backend remains source of truth.
  - Keep response shapes stable.
  - Keep tests deterministic and free of live network calls.
  - Keep `api_server.py` focused on request validation/orchestration.

### Story Completion Status

- Story implementation complete.
- Story status set to `done`.
- Completion note: Added run type + mileage day editing in Plan SPA, combined save payload handling, backend run type validation, review hardening fixes, and QA automation coverage.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/4-1-view-and-edit-multi-week-plan-grid.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/plan_data.py]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `4.2`.
- Parsed Epic 4 Story 4.2 acceptance criteria from planning artifacts.
- Pulled continuity constraints and implementation patterns from completed Story 4.1.
- Confirmed existing backend plan endpoint capabilities and identified required run type validation hardening.
- Implemented run type dropdown editing in Plan grid with labeled keyboard-accessible controls.
- Added combined day-save payload generation for `{distance, run_type}` via bulk endpoint.
- Added backend run type canonicalization/validation and unsupported-run-type rejection.
- Code review hardening fixes:
  - Avoid sending unchanged `run_type` values in distance-only updates.
  - Preserve distance-only update behavior when legacy stored run types exist.
- Validation commands executed:
  - `npm run test -- src/api/plan-api.test.ts src/features/plan/plan-page.test.tsx`
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Implemented run type + mileage editing in the Plan table with persistence across reload.
- Added run type validation guardrails on both client and server paths.
- Expanded frontend and backend tests for invalid run type handling, canonicalization, persistence behavior, and legacy compatibility.
- Added QA hardening summary in `_bmad-output/implementation-artifacts/tests/test-summary.md`.
- Full frontend test suite, backend API suite, and build completed successfully.

### File List

- chronicle-ui/src/features/plan/plan-page.tsx
- chronicle-ui/src/features/plan/plan-page.test.tsx
- chronicle-ui/src/api/plan-api.test.ts
- chronicle/api_server.py
- tests/test_api_server.py
- _bmad-output/implementation-artifacts/4-2-set-run-type-and-mileage-per-day.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md

### Change Log

- 2026-03-04: Created Story 4.2 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented Story 4.2 run type + mileage editing, validation hardening, and test coverage; set status to review.
- 2026-03-04: Completed code review fixes and QA automation hardening for Story 4.2; set status to done.
