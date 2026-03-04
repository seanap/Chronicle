# Story 5.2: Create Garmin Workout if Missing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want the system to create a Garmin workout if it doesn't exist,  
so that my planned workout can still be synced.

## Acceptance Criteria

1. **Given** I send a workout that does not exist in Garmin  
   **When** the sync runs  
   **Then** the system creates the workout in Garmin  
   **And** it continues the sync flow with the new workout.

## Tasks / Subtasks

- [x] Add backend Garmin-sync run phase for workout creation (AC: 1)
  - [x] Add a plan-scoped sync-run endpoint under `/plan/*` for a day-level Garmin sync request.
  - [x] Move sync record into `in-progress` while run phase executes.
  - [x] Return structured run payload with sync status and workout-creation result.

- [x] Add Garmin workout existence/create persistence helper (AC: 1)
  - [x] Persist Garmin-side workout catalog records via existing runtime storage (`plan_settings`) with `snake_case` fields.
  - [x] Reuse existing workout when already present (no duplicate Garmin workout creation).
  - [x] Create Garmin workout record when missing and attach Garmin identifiers to sync state.

- [x] Extend API contracts for sync-run responses (AC: 1)
  - [x] Add typed request/response support for sync-run endpoint in `chronicle-ui/src/api/plan-api.ts`.
  - [x] Add API client tests covering create-if-missing and reuse-existing paths.

- [x] Add automated backend and integration coverage for create-if-missing behavior (AC: 1)
  - [x] Extend `tests/test_api_server.py` for sync-run success (missing workout created).
  - [x] Extend `tests/test_api_server.py` for sync-run idempotency/reuse when workout already exists.
  - [x] Verify sync state continues in-progress with next-step metadata for downstream scheduling flow.

## Dev Notes

- Scope boundary for Story 5.2:
  - Includes workout creation behavior inside Garmin sync run phase.
  - Includes persistence of Garmin workout existence/create results.
  - Includes sync state continuity toward scheduling flow.
  - Does not include Garmin calendar scheduling itself (Story 5.3).
  - Does not include final success/failure retry guidance surface (Story 5.4).

### Technical Requirements

- Primary requirement sources:
  - Epic 5 Story 5.2 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR20 in `_bmad-output/planning-artifacts/prd.md`.
- Continuity constraints:
  - Story 5.1 already initiates Garmin sync requests from plan days with attached workouts.
  - Story 5.2 must build on Story 5.1 request records (no parallel sync tracking path).

### Architecture Compliance

- Keep architecture boundaries:
  - Backend sync orchestration remains thin in `chronicle/api_server.py`.
  - Domain persistence/helper logic in dedicated backend modules under `chronicle/`.
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
  - `chronicle/garmin_sync_queue.py`
  - `chronicle-ui/src/api/plan-api.ts`
  - `chronicle-ui/src/api/plan-api.test.ts`
  - `tests/test_api_server.py`
  - `_bmad-output/implementation-artifacts/5-2-create-garmin-workout-if-missing.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Missing Garmin workout is created when sync run executes.
  - Existing Garmin workout is reused without duplicate creation.
  - Sync payload remains in-progress and carries workout creation result metadata for next step.
- Regression coverage:
  - Existing Story 5.1 initiation endpoint behavior remains intact.
  - Existing plan-day save/workout attach workflows remain intact.
- Suggested verification commands:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test -- src/api/plan-api.test.ts`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 5.1 introduced plan-day Garmin sync initiation and idempotent request tracking.
- Story 5.2 should extend that request lifecycle rather than creating new request tables/keys.

### Git Intelligence Summary

- Recent Epic 5 behavior favors:
  - actionable validation errors with explicit 400 envelopes
  - deterministic local persistence for sync/request simulation
  - conservative UI changes unless required by story AC

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- No dependency upgrade required for Story 5.2.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Preserve backend as source of truth for sync/workout state.
  - Keep endpoint paths and `snake_case` contracts stable.
  - Keep tests deterministic with no live external API calls.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: Garmin sync-run now creates missing workouts, reuses existing workouts, and preserves in-progress handoff metadata for scheduling.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/5-1-send-workout-to-garmin-from-a-plan-day.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `5.2`.
- Parsed Epic 5 Story 5.2 acceptance criteria from planning artifacts.
- Pulled continuity constraints and implementation patterns from completed Story 5.1.
- Implemented `POST /plan/day/<date_local>/garmin-sync/run` to execute create-if-missing sync phase.
- Extended `chronicle/garmin_sync_queue.py` with Garmin workout catalog persistence + reuse/create behavior.
- Added typed API client contract and tests for sync-run endpoint payloads.
- Added backend coverage for create-if-missing, reuse-existing, idempotent reruns, and precondition failures.
- Validation commands executed:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test -- src/api/plan-api.test.ts`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Added sync-run endpoint that transitions sync requests to `in-progress` and returns create/reuse result metadata.
- Added Garmin workout persistence records with stable `snake_case` fields and deterministic identifiers.
- Implemented create-if-missing behavior and duplicate prevention by reusing existing Garmin workout records.
- Added and validated API/backend tests to enforce 5.2 acceptance and regressions.
- Completed review/fix/qa verification and closed story as `done`.

### File List

- _bmad-output/implementation-artifacts/5-2-create-garmin-workout-if-missing.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle/garmin_sync_queue.py
- chronicle/api_server.py
- tests/test_api_server.py
- chronicle-ui/src/api/plan-api.ts
- chronicle-ui/src/api/plan-api.test.ts

### Change Log

- 2026-03-04: Created Story 5.2 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented Garmin sync-run create-if-missing behavior and API/test coverage; set status to review.
- 2026-03-04: Applied review/fix validation pass, reran full tests/build, and set status to done.
