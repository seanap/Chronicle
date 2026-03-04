# Story 6.3: Rerun Description for a Specific Activity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to rerun description generation for a specific activity,  
so that I can refresh output for a chosen run.

## Acceptance Criteria

1. **Given** I select a specific activity  
   **When** I click "Rerun"  
   **Then** a new description is generated for that activity  
   **And** I see a status code and timestamped success/failure result without duplicate reruns.  
   **And** the rerun initiation flow completes in <= 3 steps and <= 60 seconds under normal load (FR29).

## Tasks / Subtasks

- [x] Add Control API contract for specific-activity rerun (AC: 1)
  - [x] Add typed request/response support for `POST /rerun/activity/<id>`.
  - [x] Keep response contract aligned with backend `snake_case` envelope (`status_code`, `timestamp_utc`, optional `retry_guidance`).

- [x] Implement Control UI activity selection and rerun action (AC: 1)
  - [x] Add a specific-activity selector/input to Control.
  - [x] Add "Rerun selected activity" action wired to the selected activity id.
  - [x] Prevent duplicate reruns while a request is in-flight.

- [x] Surface specific-rerun results with status metadata and guidance (AC: 1)
  - [x] Show status code + timestamped result for selected rerun action.
  - [x] Show lock/failure retry guidance from backend when returned.
  - [x] Keep latest-rerun behavior intact.

- [x] Add automated coverage for specific-rerun UX and API behavior (AC: 1)
  - [x] Add frontend API tests for specific-rerun endpoint usage.
  - [x] Extend Control page tests for selection validation, success/failure messaging, and duplicate-click prevention.
  - [x] Add backend API test assertions for specific-activity rerun envelope compatibility as needed.

## Dev Notes

- Scope boundary for Story 6.3:
  - Includes selecting a specific activity and rerunning description generation for that selection.
  - Includes status/timestamped result surfacing and duplicate-rerun prevention.
  - Does not modify worker heartbeat detection behavior (Story 6.1).

### Technical Requirements

- Primary requirement sources:
  - Epic 6 Story 6.3 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR28 and FR29 in `_bmad-output/planning-artifacts/prd.md`.
- Continuity constraints:
  - Existing `/rerun/activity/<int:activity_id>` endpoint must remain authoritative for specific reruns.
  - Reuse 6.2 rerun response envelope conventions (`status_code`, `timestamp_utc`, `retry_guidance`).

### Architecture Compliance

- Keep architecture boundaries:
  - Backend rerun execution in `chronicle/api_server.py`.
  - SPA control action/view logic in `chronicle-ui/src/features/control/`.
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
  - `_bmad-output/implementation-artifacts/6-3-rerun-description-for-a-specific-activity.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Selected activity rerun request executes against specific endpoint.
  - UI surfaces success/failure result with status code + timestamp.
  - Duplicate rerun clicks are prevented while request is in-flight.
- Regression coverage:
  - Existing latest-rerun behavior remains intact.
  - Existing Control status/detection rendering remains intact.
- Suggested verification commands:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test -- src/api/control-api.test.ts src/features/control/control-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 6.2 introduced reusable rerun envelope handling and Control action feedback.
- Story 6.3 should follow the same status/timestamp and retry-guidance presentation patterns.

### Git Intelligence Summary

- Existing project patterns favor:
  - action-specific API clients with typed envelopes
  - in-flight guardrails to prevent duplicate operation triggers
  - deterministic UI tests with mocked API responses

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- No dependency upgrade required for Story 6.3.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Keep backend source-of-truth for rerun processing state.
  - Preserve API contracts and `snake_case`.
  - Keep UI tests deterministic with mocked API calls.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: Control supports selecting a specific activity and rerunning with status/timestamped result feedback and duplicate-rerun prevention.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/6-2-rerun-description-for-latest-activity.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `6.3`.
- Parsed Epic 6 Story 6.3 acceptance criteria from planning artifacts.
- Pulled continuity constraints and implementation patterns from completed Stories 6.1 and 6.2.
- Added `rerunSpecificActivityDescription(activityId)` API client in `chronicle-ui/src/api/control-api.ts` targeting `POST /rerun/activity/<id>` with input validation.
- Added control API tests for specific rerun endpoint call and invalid ID rejection in `chronicle-ui/src/api/control-api.test.ts`.
- Extended Control UI with a specific activity selector, dedicated "Rerun selected activity" action, and status/timestamped success/lock/failure messaging.
- Added duplicate-click prevention for selected reruns using shared in-flight guardrails and rerun mode tracking.
- Added backend API test coverage for `/rerun/activity/<id>` lock guidance/status envelope compatibility in `tests/test_api_server.py`.
- Code review pass identified a test coverage gap for selected-rerun lock/failure surfaces; added targeted tests and revalidated.
- Validation commands executed:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`
  - `npm run test -- src/api/control-api.test.ts src/features/control/control-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Added specific-activity rerun API helper and contract validation for `POST /rerun/activity/<id>`.
- Added Control UI input + action flow for selected activity reruns while preserving existing latest-rerun behavior.
- Added selected-rerun user guidance for invalid input, lock state, failure metadata, and success outcomes.
- Added duplicate-click protection for selected reruns and tested in-flight behavior.
- Completed review/fix/QA flow and finalized Story 6.3 as `done`.

### File List

- _bmad-output/implementation-artifacts/6-3-rerun-description-for-a-specific-activity.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle-ui/src/api/control-api.ts
- chronicle-ui/src/api/control-api.test.ts
- chronicle-ui/src/features/control/control-page.tsx
- chronicle-ui/src/features/control/control-page.test.tsx
- tests/test_api_server.py

### Change Log

- 2026-03-04: Created Story 6.3 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented specific-activity rerun control flow, extended API/UI tests, applied review hardening, and set status to done.
