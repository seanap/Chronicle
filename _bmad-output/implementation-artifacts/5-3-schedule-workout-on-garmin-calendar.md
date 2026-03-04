# Story 5.3: Schedule Workout on Garmin Calendar

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want the system to schedule the workout on my Garmin calendar,  
so that my watch prompts the workout on the correct day.

## Acceptance Criteria

1. **Given** a workout exists in Garmin  
   **When** I sync a plan day  
   **Then** the workout is scheduled on the Garmin calendar for that date  
   **And** the calendar entry matches the plan day.

## Tasks / Subtasks

- [x] Add backend Garmin calendar scheduling phase (AC: 1)
  - [x] Add a plan-scoped scheduling endpoint under `/plan/*` for day-level sync requests.
  - [x] Require prior sync run/workout creation phase before calendar scheduling.
  - [x] Return structured payload with sync status, Garmin workout, and Garmin calendar entry.

- [x] Add Garmin calendar-entry persistence helper (AC: 1)
  - [x] Persist Garmin calendar scheduling records via existing runtime storage (`plan_settings`) with `snake_case` fields.
  - [x] Keep scheduling behavior idempotent for repeated requests of the same day + workout.
  - [x] Keep scheduled date aligned to requested `date_local` day.

- [x] Extend SPA API contracts for scheduling phase (AC: 1)
  - [x] Extend `chronicle-ui/src/api/plan-api.ts` with typed schedule request/response.
  - [x] Add API wrapper tests in `chronicle-ui/src/api/plan-api.test.ts`.

- [x] Add automated coverage for scheduling behavior (AC: 1)
  - [x] Extend `tests/test_api_server.py` for schedule success + idempotency + precondition failures.
  - [x] Verify returned calendar entry date matches the requested plan day.

## Dev Notes

- Scope boundary for Story 5.3:
  - Includes scheduling Garmin calendar entries for plan-day sync requests.
  - Includes persistence/idempotency for scheduling records.
  - Includes sync lifecycle transition toward final result reporting.
  - Does not include final user-facing 30-second result/retry guidance (Story 5.4).

### Technical Requirements

- Primary requirement sources:
  - Epic 5 Story 5.3 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR21 in `_bmad-output/planning-artifacts/prd.md`.
- Continuity constraints:
  - Story 5.1 initiation endpoint creates day-level sync request records.
  - Story 5.2 run phase ensures Garmin workout exists and sets `next_step: schedule_workout_on_calendar`.
  - Story 5.3 must schedule against those existing records; no parallel sync state path.

### Architecture Compliance

- Keep architecture boundaries:
  - API orchestration remains thin in `chronicle/api_server.py`.
  - Domain persistence logic stays in backend helper modules under `chronicle/`.
  - Typed API contracts live in `chronicle-ui/src/api/`.
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
  - `chronicle/garmin_sync_queue.py`
  - `chronicle/api_server.py`
  - `tests/test_api_server.py`
  - `chronicle-ui/src/api/plan-api.ts`
  - `chronicle-ui/src/api/plan-api.test.ts`
  - `_bmad-output/implementation-artifacts/5-3-schedule-workout-on-garmin-calendar.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Workout schedules to Garmin calendar for requested plan date.
  - Scheduling payload reflects matching `date_local`.
  - Scheduling remains idempotent for repeated calls.
- Regression coverage:
  - Existing 5.1 initiation and 5.2 run/create-if-missing behaviors remain intact.
- Suggested verification commands:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test -- src/api/plan-api.test.ts`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 5.2 introduced Garmin workout persistence and run-phase lifecycle transitions.
- Story 5.3 should append scheduling records and lifecycle transitions rather than rewriting prior phases.

### Git Intelligence Summary

- Recent Epic 5 implementation style favors:
  - deterministic local persistence for sync simulation
  - explicit 400/500 envelopes for actionable validation
  - idempotent request handling for repeated user actions

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- No dependency upgrade required for Story 5.3.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Keep backend as source of truth for sync/workout/calendar state.
  - Keep endpoint paths and `snake_case` contracts stable.
  - Keep tests deterministic with no live external API calls.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: Garmin calendar scheduling now supports plan-day schedule phase, idempotent entry reuse, and sync lifecycle completion metadata.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/5-2-create-garmin-workout-if-missing.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `5.3`.
- Parsed Epic 5 Story 5.3 acceptance criteria from planning artifacts.
- Pulled continuity constraints and implementation patterns from completed Story 5.2.
- Implemented `POST /plan/day/<date_local>/garmin-sync/schedule` in backend API.
- Added Garmin calendar-entry persistence and scheduling helpers to sync queue domain logic.
- Added/updated backend and frontend automated tests for schedule success, idempotency, precondition failures, and requested workout selection.
- Code review findings addressed:
  - Added missing `calendar_entry_id` typing to `PlanGarminSyncRecord`.
  - Added backend coverage for schedule requests that select a specific workout on multi-workout days.
  - Reconciled story task/status/file tracking with actual implementation and QA outputs.
- Validation commands executed:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test -- src/api/plan-api.test.ts`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Added schedule-phase backend endpoint and lifecycle orchestration to complete Garmin sync after run phase.
- Added calendar-entry persistence/idempotency behavior keyed by `date_local` + `garmin_workout_id`.
- Extended API client contracts for schedule responses, including `calendar_entry_id` sync metadata typing.
- Added backend/frontend regression coverage and reran full test/build validation.
- Completed review/fix/qa checks and closed story as `done`.

### File List

- _bmad-output/implementation-artifacts/5-3-schedule-workout-on-garmin-calendar.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle/garmin_sync_queue.py
- chronicle/api_server.py
- tests/test_api_server.py
- chronicle-ui/src/api/plan-api.ts
- chronicle-ui/src/api/plan-api.test.ts

### Change Log

- 2026-03-04: Created Story 5.3 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented Garmin calendar scheduling phase, persistence/idempotency helpers, and endpoint/API test coverage.
- 2026-03-04: Applied code-review hardening updates, reran test/build validation, and set status to done.
