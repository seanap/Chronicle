# Story 4.3: Attach a Workout to a Day

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to attach a workout to a plan day,  
so that I can track a specific workout for that day.

## Acceptance Criteria

1. **Given** I am editing a plan day  
   **When** I select a workout to attach  
   **Then** the workout is associated with that day  
   **And** the association is visible in the plan grid.

## Tasks / Subtasks

- [x] Add workout attachment UI controls to Plan day rows (AC: 1)
  - [x] In `chronicle-ui/src/features/plan/plan-page.tsx`, add a per-day workout selector with an explicit accessible label.
  - [x] Surface the current workout association from plan row data (`planned_sessions_detail`) so attached workout state is visible in-grid.
  - [x] Keep edit flow low-friction and consistent with existing Plan row editing patterns (inline edit + save).

- [x] Persist workout attachment through existing plan save contracts (AC: 1)
  - [x] Reuse `POST /plan/days/bulk` in `chronicle-ui/src/api/plan-api.ts`; do not add new endpoints.
  - [x] Send workout associations via `sessions[*].workout_code` with `snake_case` payload keys.
  - [x] Preserve existing authoritative-refresh behavior after save so persisted workout state is reloaded from backend.

- [x] Ensure backend accepts and returns workout association fields consistently (AC: 1)
  - [x] In `chronicle/api_server.py`, ensure plan day coercion accepts `workout_code` / `planned_workout` aliasing in session payloads.
  - [x] Ensure normalized plan responses include workout association fields for UI rehydration.
  - [x] Preserve atomic behavior in `POST /plan/days/bulk` (no partial writes on invalid payloads).

- [x] Add automated coverage for workout attachment behavior (AC: 1)
  - [x] Extend `chronicle-ui/src/features/plan/plan-page.test.tsx` for workout attach + persistence-after-refresh.
  - [x] Extend API contract tests (`chronicle-ui/src/api/plan-api.test.ts`) for workout session payload shape where applicable.
  - [x] Add backend tests in `tests/test_api_server.py` for bulk workout association persistence and metrics visibility.

## Dev Notes

- Scope boundary for Story 4.3:
  - Includes attaching an existing workout to a plan day and showing it in the Plan grid.
  - Does not include workout builder authoring workflows (Story 4.4).
  - Does not include workout search UX beyond a practical selectable list in the day editor (Story 4.5 expands this).

### Technical Requirements

- Primary requirement sources:
  - Epic 4 Story 4.3 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR16 (`Users can attach workouts to a day`) in `_bmad-output/planning-artifacts/prd.md`.
- Existing implementation baseline to extend:
  - Story 4.1 delivered the Plan grid view/edit scaffolding.
  - Story 4.2 delivered run type + mileage day-edit persistence and backend run type validation.
- Contract constraints:
  - Keep existing endpoint paths (`/plan/data.json`, `/plan/day/<date_local>`, `/plan/days/bulk`).
  - Keep request/response keys in `snake_case`.

### Architecture Compliance

- Keep architecture boundaries:
  - Backend remains source of truth for plan-day state and sessions (`chronicle/api_server.py`, `chronicle/plan_data.py`).
  - Plan SPA interactions stay in `chronicle-ui/src/features/plan/`.
  - API wrappers remain in `chronicle-ui/src/api/`.
- Do not introduce `/api/v1` or alternate path variants.
- Keep `api_server.py` focused on request validation and orchestration.

### Library / Framework Requirements

- Use current project stack:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- No new dependencies are required for Story 4.3.

### File Structure Requirements

- Likely files to modify:
  - `chronicle-ui/src/features/plan/plan-page.tsx`
  - `chronicle-ui/src/features/plan/plan-page.test.tsx`
  - `chronicle-ui/src/api/plan-api.ts`
  - `chronicle-ui/src/api/plan-api.test.ts`
  - `chronicle/api_server.py`
  - `tests/test_api_server.py`
  - `_bmad-output/implementation-artifacts/4-3-attach-a-workout-to-a-day.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Workout can be selected and saved on a plan day.
  - Saved workout association is visible in the grid after reload.
  - Save failures provide corrective feedback and avoid partial persisted UI state.
- Regression coverage:
  - Existing plan day edit/save flows (distance + run type from Story 4.2) remain intact.
  - Existing bulk endpoint behavior remains atomic.
- Suggested verification commands:
  - `npm run test -- src/features/plan/plan-page.test.tsx src/api/plan-api.test.ts`
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 4.2 established:
  - Plan-day run type + mileage edit flows with authoritative refresh behavior.
  - Backend run type canonicalization/validation with bulk atomic rejection.
  - Deterministic telemetry checks for plan load/save interactions.
- Story 4.3 should build directly on these patterns and avoid introducing alternate save paths.

### Git Intelligence Summary

- Recent commits are mostly repo/docs housekeeping and do not redefine Plan feature architecture.
- Use existing Plan SPA patterns already established in Story 4.1 and Story 4.2 to minimize regression risk.

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- Story 4.3 should not include framework upgrades.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Preserve endpoint paths and response shapes used by web + Android surfaces.
  - Keep backend authoritative for persisted workout association state.
  - Keep tests deterministic and free of live network calls.
  - Keep API payload fields and response keys in `snake_case`.

### Story Completion Status

- Story context created.
- Story status set to `ready-for-dev`.
- Completion note: Comprehensive implementation context prepared for workout attachment in Plan day flow.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/4-2-set-run-type-and-mileage-per-day.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `4.3`.
- Parsed Epic 4 Story 4.3 acceptance criteria from planning artifacts.
- Pulled continuity constraints and implementation patterns from completed Story 4.2.
- Extracted architecture + project-context constraints for endpoint stability and `snake_case` contracts.
- Included current-stack version snapshot for implementation guardrails.
- Verified existing 4.3 implementation in `plan-page`, `api_server`, and backend tests against ACs/tasks.
- Added contract coverage for workout session payload passthrough in `chronicle-ui/src/api/plan-api.test.ts`.
- Code review findings fixed:
  - run-type-only saves no longer rewrite distance/session payloads unnecessarily
  - added frontend regression coverage for run-type updates on days with attached workouts
  - added backend regression coverage for preserving workout sessions on run-type-only updates
- Validation commands executed:
  - `npm run test -- src/features/plan/plan-page.test.tsx src/api/plan-api.test.ts`
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Confirmed workout attachment UI is available per day and visible after reload in the Plan grid.
- Confirmed save payload path uses existing `/plan/days/bulk` endpoint with `sessions[*].workout_code`.
- Confirmed backend accepts workout aliasing and returns normalized workout fields for UI hydration.
- Added/verified frontend and backend tests for workout attach + persistence flows.
- Full targeted and full frontend regression plus backend API suite passed.
- Closed code review with all identified high/medium issues fixed.

### File List

- _bmad-output/implementation-artifacts/4-3-attach-a-workout-to-a-day.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- chronicle-ui/src/features/plan/plan-page.tsx
- chronicle-ui/src/features/plan/plan-page.test.tsx
- chronicle-ui/src/api/plan-api.ts
- chronicle-ui/src/api/plan-api.test.ts
- chronicle/api_server.py
- tests/test_api_server.py

### Change Log

- 2026-03-04: Created Story 4.3 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented Story 4.3 workout-attachment flow and validation coverage; set status to review.
- 2026-03-04: Completed code review fixes for payload minimization + session preservation guardrails; set status to done.
