# Story 5.4: Show Sync Result Within 30 Seconds with Retry Guidance

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to see a Garmin sync result quickly with actionable guidance,  
so that I know whether it succeeded and how to retry if it failed.

## Acceptance Criteria

1. **Given** I initiate a Garmin sync  
   **When** the sync completes or fails  
   **Then** I see a status code and timestamp within 30 seconds  
   **And** I see either confirmation that scheduling succeeded or actionable retry guidance with next steps.

## Tasks / Subtasks

- [x] Add backend Garmin sync result orchestration endpoint (AC: 1)
  - [x] Add a plan-scoped endpoint under `/plan/*` that resolves run + schedule phases for a sync request.
  - [x] Keep retry behavior bounded and deterministic (retry + short backoff) for transient sync failures.
  - [x] Return a structured result envelope with outcome, status code, timestamp, and retry guidance fields.

- [x] Persist sync failure metadata for user guidance (AC: 1)
  - [x] Extend Garmin sync request persistence to track failure message and retry guidance in `snake_case`.
  - [x] Preserve lifecycle continuity (`next_step`) for retryable failures without creating duplicate requests.
  - [x] Keep success/failure timestamps aligned to persisted `updated_at_utc`.

- [x] Update SPA Plan UX to show final Garmin sync result (AC: 1)
  - [x] Extend plan API contracts with a typed sync-result endpoint wrapper.
  - [x] Update Plan page send-to-Garmin flow to fetch final result after initiation and display outcome state.
  - [x] Surface status code + timestamp and either success confirmation or actionable retry guidance in the UI.

- [x] Add automated coverage for sync-result UX + API behavior (AC: 1)
  - [x] Extend backend API tests for success result envelope and retry-guidance failure envelope.
  - [x] Extend frontend API tests for result endpoint contracts.
  - [x] Extend Plan page tests for user-visible success and retry-guidance states.

## Dev Notes

- Scope boundary for Story 5.4:
  - Includes final user-facing Garmin sync result for initiated plan-day sync operations.
  - Includes retry guidance surfacing and timestamped status reporting.
  - Includes bounded retry + backoff behavior for result resolution.
  - Does not include broader health-page troubleshooting (Epic 8 stories).

### Technical Requirements

- Primary requirement sources:
  - Epic 5 Story 5.4 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR22 in `_bmad-output/planning-artifacts/prd.md`.
- Continuity constraints:
  - Story 5.1 handles initiation (`/garmin-sync`).
  - Story 5.2 handles run/workout-create (`/garmin-sync/run`).
  - Story 5.3 handles calendar scheduling (`/garmin-sync/schedule`).
  - Story 5.4 must build result reporting on top of that lifecycle (no parallel sync state path).

### Architecture Compliance

- Keep architecture boundaries:
  - API orchestration in `chronicle/api_server.py` remains thin and delegates to domain helpers.
  - Domain state transitions/persistence in `chronicle/garmin_sync_queue.py`.
  - Typed API contracts and UI flow updates in `chronicle-ui/src/api/` and `chronicle-ui/src/features/plan/`.
- Keep endpoint namespace under existing `/plan/*`.
- Keep JSON keys `snake_case`.

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
  - `chronicle-ui/src/features/plan/plan-page.tsx`
  - `chronicle-ui/src/features/plan/plan-page.test.tsx`
  - `_bmad-output/implementation-artifacts/5-4-show-sync-result-within-30-seconds-with-retry-guidance.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - User-visible sync result includes status code + timestamp within the same initiated flow.
  - Success path confirms scheduling completion.
  - Failure path returns actionable retry guidance.
- Regression coverage:
  - Existing initiation/run/schedule endpoints remain compatible.
  - Existing plan-day save/workout-selection flows remain intact.
- Suggested verification commands:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test -- src/api/plan-api.test.ts`
  - `npm run test -- src/features/plan/plan-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 5.3 established schedule-phase completion and `next_step: report_sync_result`.
- Story 5.4 should consume that transition and expose stable, user-readable result outcomes.

### Git Intelligence Summary

- Recent Epic 5 patterns favor:
  - deterministic local simulation of Garmin sync lifecycle
  - explicit actionable error responses
  - idempotent behavior for repeated user-triggered sync actions

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- No dependency upgrade required for Story 5.4.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Keep backend as source of truth for sync/workout/calendar/result state.
  - Keep endpoint paths and `snake_case` contracts stable.
  - Keep tests deterministic with no live external API calls.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: Garmin sync initiation now surfaces final timestamped success/failure results with actionable retry guidance.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/5-3-schedule-workout-on-garmin-calendar.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `5.4`.
- Parsed Epic 5 Story 5.4 acceptance criteria from planning artifacts.
- Pulled continuity constraints and implementation patterns from completed Story 5.3.
- Added `POST /plan/day/<date_local>/garmin-sync/result` orchestration endpoint with bounded retry/backoff.
- Added Garmin sync failure metadata persistence (`error_message`, `retry_guidance`) and failure-state lifecycle updates.
- Extended frontend API contracts and Plan page Garmin sync UX to display status code + timestamp + success/retry guidance.
- Added backend/frontend automated coverage for result success/failure envelopes and UI guidance rendering.
- Code review findings addressed:
  - Added guaranteed timestamp fallbacks in result responses to avoid blank status metadata.
  - Added explicit precondition test for `/garmin-sync/result` when no sync initiation exists.
  - Added explicit frontend assertion that result resolution is not attempted when initiation fails.
- Validation commands executed:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test -- src/api/plan-api.test.ts src/features/plan/plan-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Added backend result endpoint that resolves run+scheduling and returns final sync outcome within one initiated flow.
- Added persisted failure metadata and retry guidance on sync request records for recoverable errors.
- Added typed frontend sync-result API wrapper and updated Plan page Garmin action to show timestamped success/failure messaging.
- Added automated backend and frontend test coverage for sync-result outcomes and actionable retry guidance.
- Applied code-review fixes and reran regressions/build; story closed as `done`.

### File List

- _bmad-output/implementation-artifacts/5-4-show-sync-result-within-30-seconds-with-retry-guidance.md
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

- 2026-03-04: Created Story 5.4 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented Garmin sync result orchestration endpoint, persistence updates, and SPA sync-result UX/test coverage.
- 2026-03-04: Applied code-review hardening fixes, reran full validations, and set status to done.
