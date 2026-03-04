# Story 5.1: Send Workout to Garmin from a Plan Day

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to send a workout to Garmin from a plan day,  
so that my watch has the correct workout scheduled.

## Acceptance Criteria

1. **Given** a plan day has a workout attached  
   **When** I choose "Send to Garmin"  
   **Then** the system initiates a Garmin sync for that workout  
   **And** I see a pending or in-progress status.

## Tasks / Subtasks

- [x] Add backend Garmin sync-initiation endpoint for a plan day (AC: 1)
  - [x] Add a plan-scoped endpoint under `/plan/*` that initiates Garmin sync for a specific day workout.
  - [x] Resolve workout from attached day sessions and reject requests when no workout is attached.
  - [x] Return structured sync-initiation payload with status (`pending` or `in-progress`), status code, and timestamp.

- [x] Add persistence/helper for Garmin sync request tracking (AC: 1)
  - [x] Persist sync-initiation records using existing runtime storage (`plan_settings`) with stable `snake_case` fields.
  - [x] Keep initiation behavior idempotent for already pending/in-progress day+workout requests.

- [x] Add SPA API client support for Garmin sync initiation (AC: 1)
  - [x] Extend `chronicle-ui/src/api/plan-api.ts` with typed request/response for send-to-Garmin action.
  - [x] Add API wrapper tests in `chronicle-ui/src/api/plan-api.test.ts`.

- [x] Add Plan page Send-to-Garmin action and visible status (AC: 1)
  - [x] Add per-day "Send to Garmin" control in the Plan grid for days with attached workouts.
  - [x] Show pending/in-progress status in UI after initiation.
  - [x] Preserve existing plan save/reload behavior and workout attachment flows.

- [x] Add automated coverage for Garmin sync initiation flow (AC: 1)
  - [x] Extend `chronicle-ui/src/features/plan/plan-page.test.tsx` for send action + status display.
  - [x] Add backend endpoint tests in `tests/test_api_server.py` for success + validation paths.

## Dev Notes

- Scope boundary for Story 5.1:
  - Includes initiating Garmin sync from a plan day with attached workout and showing pending/in-progress status.
  - Includes request tracking state for initiation visibility.
  - Does not include workout creation in Garmin (Story 5.2).
  - Does not include Garmin calendar scheduling (Story 5.3).
  - Does not include full completion/retry guidance payload requirements from Story 5.4.

### Technical Requirements

- Primary requirement sources:
  - Epic 5 Story 5.1 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR19 in `_bmad-output/planning-artifacts/prd.md`.
- Continuity constraints:
  - Story 4.3/4.4/4.5 established day workout attachment, workout workshop, and searchable workout selection.
  - Story 5.1 must reuse attached day workout data, not introduce parallel workout state.

### Architecture Compliance

- Keep architecture boundaries:
  - Backend initiation + tracking logic in `chronicle/*` (thin endpoint orchestration in `api_server.py`).
  - Plan UI action/status in `chronicle-ui/src/features/plan/`.
  - Typed API contracts in `chronicle-ui/src/api/`.
- Keep endpoint namespace under existing `/plan/*`.
- Keep payload/response keys in `snake_case`.

### Library / Framework Requirements

- Use current stack without upgrades:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4

### File Structure Requirements

- Likely files to modify:
  - `chronicle/api_server.py`
  - `chronicle/` helper module for Garmin sync request tracking
  - `chronicle-ui/src/api/plan-api.ts`
  - `chronicle-ui/src/api/plan-api.test.ts`
  - `chronicle-ui/src/features/plan/plan-page.tsx`
  - `chronicle-ui/src/features/plan/plan-page.test.tsx`
  - `tests/test_api_server.py`
  - `_bmad-output/implementation-artifacts/5-1-send-workout-to-garmin-from-a-plan-day.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Send-to-Garmin action is available for day rows with attached workout.
  - Initiation request returns pending/in-progress and UI displays that status.
  - Missing workout attachment returns actionable validation guidance.
- Regression coverage:
  - Existing plan-day edit/save and workout workshop/search flows remain intact.
- Suggested verification commands:
  - `npm run test -- src/api/plan-api.test.ts src/features/plan/plan-page.test.tsx`
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 4.5 introduced workout search/filter and improved selection labels in plan grid.
- Story 5.1 should layer action/status on top of existing day-row workout selection rather than replacing that interaction.

### Git Intelligence Summary

- Recent plan work favors:
  - Validation-first behavior with actionable error text.
  - Deterministic UI tests scoped to specific controls.
  - Backend endpoints with thin orchestration + explicit 400/500 envelopes.

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- No dependency upgrade required for Story 5.1.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Preserve backend as source of truth for persisted action state.
  - Keep endpoint paths and `snake_case` contracts stable.
  - Keep tests deterministic with no live external API calls.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: Plan-day Garmin sync initiation shipped with idempotent request tracking, UI pending state visibility, and regression-safe automated coverage.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/4-5-search-and-select-workouts.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `5.1`.
- Parsed Epic 5 Story 5.1 acceptance criteria from planning artifacts.
- Pulled continuity constraints and implementation patterns from completed Story 4.5.
- Implemented `POST /plan/day/<date_local>/garmin-sync` with attached-workout validation and request payload contract.
- Added `chronicle/garmin_sync_queue.py` helper to persist idempotent sync-initiation records via `plan_settings`.
- Added Plan page "Send to Garmin" action and pending/in-progress status display for workout-attached day rows.
- Applied code-review hardening fixes:
  - prevent send action while a day has unsaved edits to avoid stale workout mismatch calls
  - clean per-day in-flight sending state on completion
  - add explicit send error-path coverage and unsaved-edit guard coverage in Plan page tests
- Validation commands executed:
  - `npm run test -- src/features/plan/plan-page.test.tsx src/api/plan-api.test.ts`
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Added backend Garmin sync-initiation endpoint for plan days with actionable validation errors.
- Added persisted, idempotent Garmin sync request tracking with stable `snake_case` fields.
- Added typed SPA API contract + tests for plan-day Garmin sync initiation.
- Added Plan grid send control and visible pending sync state for days with attached workouts.
- Added backend and frontend automated tests for success, idempotency, validation failures, and UI guardrails.
- Completed review/fix/QA verification pass and closed story as `done`.

### File List

- _bmad-output/implementation-artifacts/5-1-send-workout-to-garmin-from-a-plan-day.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle/garmin_sync_queue.py
- chronicle/api_server.py
- tests/test_api_server.py
- chronicle-ui/src/api/plan-api.ts
- chronicle-ui/src/api/plan-api.test.ts
- chronicle-ui/src/features/plan/plan-page.tsx
- chronicle-ui/src/features/plan/plan-page.test.tsx

### Change Log

- 2026-03-04: Created Story 5.1 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented Garmin sync-initiation endpoint + persistence helper + Plan page send action/status; set status to review.
- 2026-03-04: Applied code review hardening fixes, reran frontend/backend regressions + build, and set status to done.
