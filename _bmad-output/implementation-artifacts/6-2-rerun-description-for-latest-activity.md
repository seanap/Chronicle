# Story 6.2: Rerun Description for Latest Activity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to rerun description generation for the latest activity,  
so that I can refresh output after template changes.

## Acceptance Criteria

1. **Given** there is a latest activity  
   **When** I click "Rerun latest"  
   **Then** a new description is generated  
   **And** I see a status code and timestamped success/failure result without duplicate reruns.  
   **And** the rerun initiation flow completes in <= 3 steps and <= 60 seconds under normal load (FR29).

## Tasks / Subtasks

- [x] Add timestamped rerun-result envelope for latest rerun endpoint (AC: 1)
  - [x] Extend latest-rerun backend response with explicit status code and timestamp fields.
  - [x] Include actionable retry guidance for lock/duplicate-rerun scenarios.
  - [x] Keep existing rerun result payload compatibility for current consumers.

- [x] Add frontend control API contracts for latest rerun action (AC: 1)
  - [x] Extend control API client with typed `rerun latest` request/response support.
  - [x] Keep contract shape aligned with backend `snake_case` response fields.

- [x] Implement Control UI rerun-latest action and result surfacing (AC: 1)
  - [x] Add a "Rerun latest activity" action to the Control page.
  - [x] Show status code + timestamped outcome for success/failure states.
  - [x] Prevent duplicate reruns while a request is in-flight and display lock guidance when returned by backend.

- [x] Add automated coverage for rerun-latest UX and API behavior (AC: 1)
  - [x] Extend backend API tests for timestamped rerun envelope and lock guidance.
  - [x] Extend control API tests for rerun-latest contract.
  - [x] Extend Control page tests for success state, lock guidance, and duplicate-click prevention.

## Dev Notes

- Scope boundary for Story 6.2:
  - Includes rerun-latest action initiation and immediate result surfacing.
  - Includes duplicate-rerun prevention/guidance in the control flow.
  - Does not include rerun-for-specific-activity behavior (Story 6.3).

### Technical Requirements

- Primary requirement sources:
  - Epic 6 Story 6.2 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR27 and FR29 in `_bmad-output/planning-artifacts/prd.md`.
- Continuity constraints:
  - Existing `/rerun/latest` endpoint executes `run_once(force_update=True)`.
  - Story 6.2 should build on existing rerun backend path; no parallel rerun endpoint family.

### Architecture Compliance

- Keep architecture boundaries:
  - Rerun envelope updates in `chronicle/api_server.py`.
  - SPA control action and view logic in `chronicle-ui/src/features/control/`.
  - API client contracts in `chronicle-ui/src/api/`.
- Preserve endpoint paths and `snake_case` fields.

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
  - `tests/test_api_server.py`
  - `chronicle-ui/src/api/control-api.ts`
  - `chronicle-ui/src/api/control-api.test.ts`
  - `chronicle-ui/src/features/control/control-page.tsx`
  - `chronicle-ui/src/features/control/control-page.test.tsx`
  - `_bmad-output/implementation-artifacts/6-2-rerun-description-for-latest-activity.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Rerun latest returns status code + timestamp envelope.
  - UI surfaces success/failure result and lock guidance.
  - Duplicate rerun clicks are prevented while in-flight.
- Regression coverage:
  - Existing rerun endpoints remain compatible.
  - Existing Control status/detection rendering remains intact.
- Suggested verification commands:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test -- src/api/control-api.test.ts src/features/control/control-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 6.1 established Control page runtime status surfacing and refresh mechanics.
- Story 6.2 should extend that same surface with rerun action/result feedback.

### Git Intelligence Summary

- Existing project patterns favor:
  - actionable response envelopes with timestamp metadata
  - explicit user guidance for transient/lock conditions
  - deterministic tests and minimal scope expansion

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- No dependency upgrade required for Story 6.2.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Keep backend source-of-truth for rerun processing state.
  - Preserve API contracts and `snake_case`.
  - Keep UI tests deterministic with mocked API calls.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: Control rerun-latest flow now returns and surfaces status code + timestamped outcomes with duplicate-rerun prevention.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/6-1-detect-new-activities-on-worker-heartbeat.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `6.2`.
- Parsed Epic 6 Story 6.2 acceptance criteria from planning artifacts.
- Pulled continuity constraints and implementation patterns from completed Story 6.1.
- Implemented rerun-latest backend envelope in `chronicle/api_server.py` with `status_code`, `timestamp_utc`, and lock retry guidance while preserving existing `result` and `dashboard_refresh` compatibility.
- Added backend tests in `tests/test_api_server.py` for success envelope fields, lock-guidance payload, and 500 error envelope metadata.
- Added frontend control API contract + call for `POST /rerun/latest` in `chronicle-ui/src/api/control-api.ts` and test coverage in `chronicle-ui/src/api/control-api.test.ts`.
- Extended Control page UI with "Rerun latest activity" action, in-flight duplicate-click protection, and status/timestamped success/failure messaging in `chronicle-ui/src/features/control/control-page.tsx`.
- Added UI tests for rerun success, lock guidance, API-error status/timestamp surfacing, and duplicate-click prevention in `chronicle-ui/src/features/control/control-page.test.tsx`.
- Validation commands executed:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`
  - `npm run test -- src/api/control-api.test.ts src/features/control/control-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Added rerun-latest API response envelope fields (`status_code`, `timestamp_utc`) for consistent, timestamped action feedback.
- Added backend duplicate-rerun (`locked`) retry guidance payload and frontend lock-guidance rendering.
- Added Control page rerun action with in-flight button disable to prevent duplicate submissions.
- Added frontend error rendering that preserves backend status/timestamp metadata for failed rerun responses.
- Expanded backend/frontend test coverage and passed full regression + build validation.
- Completed review/fix/QA flow and finalized Story 6.2 as `done`.

### File List

- _bmad-output/implementation-artifacts/6-2-rerun-description-for-latest-activity.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle/api_server.py
- tests/test_api_server.py
- chronicle-ui/src/api/control-api.ts
- chronicle-ui/src/api/control-api.test.ts
- chronicle-ui/src/features/control/control-page.tsx
- chronicle-ui/src/features/control/control-page.test.tsx

### Change Log

- 2026-03-04: Created Story 6.2 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented rerun-latest backend envelope, Control API/UI action, and automated coverage.
- 2026-03-04: Applied review hardening for failed-rerun status/timestamp surfacing, reran full validations, and set status to done.
