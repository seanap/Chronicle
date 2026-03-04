# Story 4.1: View and Edit Multi-Week Plan Grid

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to view and edit a multi-week plan grid,  
so that I can adjust my training plan quickly.

## Acceptance Criteria

1. **Given** I open the Plan page  
   **When** the plan grid loads  
   **Then** I can view multiple weeks of planned days  
   **And** I can edit plan entries within the grid  
   **And** a simple plan edit completes in <= 3 steps and <= 60 seconds (FR29)  
   **And** plan interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30).
2. **Given** a plan edit contains invalid values or conflicts  
   **When** I save the plan change  
   **Then** the save is rejected with clear corrective guidance  
   **And** no partial or incorrect plan update is persisted.

## Tasks / Subtasks

- [x] Add typed SPA Plan API wrappers for plan grid load and day-save flows (AC: 1, 2)
  - [x] Create `chronicle-ui/src/api/plan-api.ts` with typed request/response contracts for `GET /plan/data.json`, `PUT /plan/day/<date_local>`, and `POST /plan/days/bulk`.
  - [x] Keep endpoint paths unchanged and JSON keys in `snake_case`.
  - [x] Add API wrapper tests in `chronicle-ui/src/api/plan-api.test.ts`.

- [x] Implement Plan page multi-week grid UI with inline editable entries (AC: 1)
  - [x] Replace placeholder `PlanPage` with a data-backed grid using existing plan payload rows from `/plan/data.json`.
  - [x] Render at least multi-week span centered on today (using backend payload window controls).
  - [x] Keep table semantics and keyboard-accessible editing controls (labels, focus, save action).
  - [x] Preserve and show loading/error states with actionable copy.

- [x] Implement plan-entry edit + save workflow with clear validation handling (AC: 1, 2)
  - [x] Support in-grid editing for plan entry mileage input (`planned_input` / distance value) without introducing run-type/workout editing yet.
  - [x] Save edits via existing plan endpoints and refresh data after successful save.
  - [x] Surface backend validation errors directly to user with corrective guidance.
  - [x] Ensure invalid edit attempts do not apply partial persisted updates in UI flow (reload from server state after rejection).

- [x] Add plan timing telemetry guardrails for performance ACs (AC: 1)
  - [x] Add plan timing helper (parallel to build timing pattern) with event source `plan-grid`.
  - [x] Emit load/save timing metrics and assert p95 < 1000ms in automated tests.
  - [x] Keep telemetry test-only assertions deterministic (no live network timing dependencies).

- [x] Add/extend automated tests for Story 4.1 behavior and regressions (AC: 1, 2)
  - [x] Add Plan page tests in `chronicle-ui/src/features/plan/plan-page.test.tsx` for load, multi-week render, inline edit save success, and invalid-save rejection messaging.
  - [x] Keep existing route smoke coverage passing in `chronicle-ui/src/app-smoke.test.tsx`.
  - [x] Run full frontend tests and build to verify no regressions in prior stories.

## Dev Notes

- Scope boundary for Story 4.1:
  - Include view/edit of multi-week plan grid entries in SPA.
  - Focus on mileage/plan-entry editing only for this story.
  - Do not implement workout attach flow yet (Story 4.3).
  - Do not expand run-type workflow beyond what is needed for preserving existing values (Story 4.2 covers explicit run type/day editing).

### Technical Requirements

- Primary requirement sources:
  - Epic 4 Story 4.1 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR14 (multi-week grid), FR29 (<=3 steps and <=60s), FR30 (<1s p95 interactions) in `_bmad-output/planning-artifacts/prd.md`.
- Existing backend capabilities to leverage:
  - `GET /plan/data.json` in `chronicle/api_server.py` backed by `chronicle/plan_data.py` for multi-week rows + summary + run type options.
  - `PUT /plan/day/<date_local>` and `POST /plan/days/bulk` for persistence with validation and atomic bulk handling.
  - Existing backend tests already cover atomic invalid-row behavior (`test_plan_days_bulk_endpoint_is_atomic_on_invalid_row`).
- UX requirements:
  - Implement as a dense plan ledger table with clear focus states and table semantics.
  - Keep edit flow low-friction and fast; avoid modal-heavy interactions for basic edits.

### Architecture Compliance

- Keep architecture boundaries:
  - Backend remains source of truth for plan data (`chronicle/plan_data.py`, `chronicle/api_server.py`).
  - SPA feature implementation belongs in `chronicle-ui/src/features/plan/`.
  - API contract wrappers belong in `chronicle-ui/src/api/`.
- Do not create `/api/v1` routes or alter existing endpoint paths.
- Keep API payload keys and contracts `snake_case`.
- Keep `api_server.py` thin; if backend changes are needed, route domain logic through existing plan modules.

### Library / Framework Requirements

- Use current project stack:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- No new dependencies are required for Story 4.1.

### File Structure Requirements

- Likely files to modify:
  - `chronicle-ui/src/features/plan/plan-page.tsx`
  - `chronicle-ui/src/features/plan/plan-page.test.tsx` (new)
  - `chronicle-ui/src/api/plan-api.ts` (new)
  - `chronicle-ui/src/api/plan-api.test.ts` (new)
  - `chronicle-ui/src/features/plan/plan-timing.ts` (new)
  - `chronicle-ui/src/app-smoke.test.tsx` (only if heading semantics change)

### Testing Requirements

- Acceptance coverage:
  - Multi-week plan data renders from `/plan/data.json`.
  - Inline plan edit can be saved and reflected after refresh.
  - Invalid edit response is shown with corrective guidance.
  - Invalid edit does not produce partial persisted updates in UI flow.
  - Load/save telemetry events support p95 < 1s assertions in tests.
- Regression coverage:
  - Existing Build, Sources, Control, View route behavior remains unchanged.
- Suggested verification commands:
  - `npm run test -- src/api/plan-api.test.ts src/features/plan/plan-page.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`

### Git Intelligence Summary

- Latest commits are docs/repo housekeeping and do not introduce plan feature architecture changes.
- Story 4.1 should follow established SPA patterns used in `features/build`:
  - thin API wrapper modules under `src/api/`
  - user-facing feedback for validation failures
  - deterministic timing telemetry assertions in tests.

### Latest Tech Information

- Snapshot check (2026-03-03 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- Story 4.1 should not upgrade framework versions; implement within currently pinned project versions.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Preserve endpoint paths and response shapes.
  - Keep backend as source of truth for authoritative metrics and plan state.
  - Keep tests deterministic and avoid live network behavior.
  - Keep API errors actionable and consistent with existing error envelopes.

### Story Completion Status

- Story implementation complete.
- Story status set to `done`.
- Completion note: Implemented Plan grid API wrappers, multi-week editable Plan SPA table, save/reload validation guidance flow, timing telemetry with automated p95 checks, and code-review hardening fixes.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/plan_data.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/tests/test_api_server.py]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `4.1`.
- Parsed Epic 4 Story 4.1 acceptance criteria from planning artifacts.
- Cross-checked PRD FR14, FR29, FR30 plus architecture/UX constraints for Plan Ledger implementation.
- Verified existing backend plan endpoints and payload shape for reuse.
- Added failing-first tests for `plan-api` and `PlanPage`.
- Implemented `plan-api`, `PlanPage`, and `plan-timing` modules.
- Resolved TypeScript build issue by using `sx` for Stack alignment.
- Ran adversarial code review and resolved 3 medium issues in `PlanPage`:
  - Preserve stale grid data when reload fails.
  - Prevent false success messaging when post-save reload fails.
  - Add malformed-distance client validation before save.
- Added QA hardening coverage for reload-failure and post-save refresh-failure flows.
- Validation commands executed:
  - `npm run test -- src/api/plan-api.test.ts src/features/plan/plan-page.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_api_server`

### Completion Notes List

- Implemented typed Plan API wrappers with query/path handling and tests.
- Replaced Plan page placeholder with multi-week plan grid, center/reload controls, and inline mileage editing.
- Added bulk-save workflow with authoritative reload on failure to prevent partial UI persistence.
- Added plan timing instrumentation (`plan-grid-load`, `plan-grid-save`) and p95 telemetry assertions.
- Hardened save/reload UX behavior after code review to improve reliability and guidance quality.
- Added QA automation tests to cover resilience edge cases and updated QA summary artifact.
- Full frontend tests, frontend build, and backend API regression suite passed.

### File List

- chronicle-ui/src/api/plan-api.ts
- chronicle-ui/src/api/plan-api.test.ts
- chronicle-ui/src/features/plan/plan-page.tsx
- chronicle-ui/src/features/plan/plan-page.test.tsx
- chronicle-ui/src/features/plan/plan-timing.ts
- _bmad-output/implementation-artifacts/4-1-view-and-edit-multi-week-plan-grid.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md

### Change Log

- 2026-03-03: Created Story 4.1 with comprehensive context and set status to ready-for-dev.
- 2026-03-03: Implemented Story 4.1 plan grid view/edit workflow with telemetry and tests; set status to review.
- 2026-03-03: Completed code review hardening for Story 4.1 and set status to done.
- 2026-03-03: Ran QA automation hardening for Story 4.1 and updated test summary.
