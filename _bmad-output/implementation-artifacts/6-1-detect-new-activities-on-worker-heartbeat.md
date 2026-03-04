# Story 6.1: Detect New Activities on Worker Heartbeat

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want the system to detect new activities via a worker heartbeat,  
so that I know new activities are picked up for processing.

## Acceptance Criteria

1. **Given** the worker heartbeat runs  
   **When** a new activity is detected  
   **Then** the system records the detection state  
   **And** the UI can surface that a new activity is available.

## Tasks / Subtasks

- [x] Add worker-cycle detection state recording (AC: 1)
  - [x] Record heartbeat-cycle activity-detection state in runtime storage when cycle status is evaluated.
  - [x] Persist a clear `new_activity_available` flag and detection metadata (status, timestamps, latest activity id when available).
  - [x] Keep detection recording deterministic across `updated`, `already_processed`, and `no_activities` cycle outcomes.

- [x] Add backend endpoint to expose detection state for UI (AC: 1)
  - [x] Add plan/control-scoped API endpoint returning worker heartbeat + activity detection payload.
  - [x] Return stable `snake_case` fields for detection status and availability.
  - [x] Handle missing runtime values gracefully with explicit defaults.

- [x] Surface activity detection state in Control SPA UI (AC: 1)
  - [x] Add typed API client contracts for control activity detection.
  - [x] Update Control page to load and display heartbeat health + detection state.
  - [x] Show an explicit "new activity available" signal when detection flag is true.

- [x] Add automated coverage for detection state behavior (AC: 1)
  - [x] Extend worker tests to validate detection-state mapping from cycle outcomes.
  - [x] Extend backend API tests for activity-detection endpoint success/default states.
  - [x] Add frontend API + Control page tests for new activity and fallback/error rendering.

## Dev Notes

- Scope boundary for Story 6.1:
  - Includes heartbeat-cycle detection-state recording.
  - Includes UI surfacing of new-activity availability.
  - Does not include rerun actions themselves (Stories 6.2 and 6.3).

### Technical Requirements

- Primary requirement sources:
  - Epic 6 Story 6.1 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR26 in `_bmad-output/planning-artifacts/prd.md`.
- Continuity constraints:
  - `worker.main()` already updates heartbeat and executes `run_once(force_update=False)` cycles.
  - `run_once` status outcomes (`updated`, `already_processed`, `no_activities`) should drive detection-state transitions.

### Architecture Compliance

- Keep architecture boundaries:
  - Worker cycle state mapping in `chronicle/worker.py`.
  - Runtime read API in `chronicle/api_server.py`.
  - SPA integration in `chronicle-ui/src/features/control/` and `chronicle-ui/src/api/`.
- Keep endpoint paths stable and JSON keys `snake_case`.

### Library / Framework Requirements

- Use current stack without upgrades:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4

### File Structure Requirements

- Likely files to modify:
  - `chronicle/worker.py`
  - `chronicle/api_server.py`
  - `tests/test_worker.py`
  - `tests/test_api_server.py`
  - `chronicle-ui/src/api/control-api.ts`
  - `chronicle-ui/src/api/control-api.test.ts`
  - `chronicle-ui/src/features/control/control-page.tsx`
  - `chronicle-ui/src/features/control/control-page.test.tsx`
  - `_bmad-output/implementation-artifacts/6-1-detect-new-activities-on-worker-heartbeat.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Worker-cycle result mapping records detection state and new-activity availability.
  - API endpoint returns heartbeat and detection payload with safe defaults.
  - Control page visibly signals when new activity is available.
- Regression coverage:
  - Existing readiness and rerun endpoints remain intact.
  - Existing SPA route and shell behavior for Control remains intact.
- Suggested verification commands:
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`
  - `npm run test -- src/api/control-api.test.ts src/features/control/control-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Epic 5 introduced full Garmin sync lifecycle and result surfacing patterns in SPA.
- Story 6.1 should reuse the same status/timestamp communication style for consistency.

### Git Intelligence Summary

- Existing project patterns favor:
  - backend source-of-truth runtime state
  - explicit status envelopes and actionable UI messaging
  - deterministic tests with local runtime simulation only

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- No dependency upgrade required for Story 6.1.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Keep backend/runtime state authoritative.
  - Preserve endpoint contracts and `snake_case`.
  - Keep tests deterministic and local (no network calls).

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: Worker heartbeat now records new-activity detection state and Control UI surfaces availability.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/5-4-show-sync-result-within-30-seconds-with-retry-guidance.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `6.1`.
- Parsed Epic 6 Story 6.1 acceptance criteria from planning artifacts.
- Identified worker/runtime/control integration points for heartbeat detection state.
- Added worker detection-state mapping helper and persisted runtime updates per cycle outcome.
- Added `GET /control/activity-detection` endpoint with heartbeat + detection payload and safe defaults.
- Added Control SPA status view with explicit new-activity availability signal and refresh behavior.
- Added backend and frontend automated tests covering detection state mapping, endpoint payloads, and UI rendering paths.
- Code review findings addressed:
  - Prevented non-detection cycle statuses (for example `locked`) from clearing existing positive detection flags.
  - Avoided stale Control payload display after refresh failures to keep operator signals accurate.
  - Added explicit endpoint default-state and retry-path assertions to guard regressions in detection surfacing.
- Validation commands executed:
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`
  - `npm run test -- src/api/control-api.test.ts src/features/control/control-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Added deterministic worker-cycle detection-state runtime recording keyed to cycle outcomes.
- Added Control detection API with heartbeat health and activity-detection metadata for SPA consumption.
- Implemented Control page status UI that surfaces new-activity availability and fallback/error states.
- Added worker/backend/frontend automated test coverage and reran full regression/build verification.
- Applied code-review hardening fixes and closed story as `done`.

### File List

- _bmad-output/implementation-artifacts/6-1-detect-new-activities-on-worker-heartbeat.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle/worker.py
- chronicle/api_server.py
- tests/test_worker.py
- tests/test_api_server.py
- chronicle-ui/src/api/control-api.ts
- chronicle-ui/src/api/control-api.test.ts
- chronicle-ui/src/features/control/control-page.tsx
- chronicle-ui/src/features/control/control-page.test.tsx

### Change Log

- 2026-03-04: Created Story 6.1 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented worker heartbeat detection-state recording, control API endpoint, and Control SPA surfacing with automated coverage.
- 2026-03-04: Applied code-review hardening updates, reran full validations, and set status to done.
