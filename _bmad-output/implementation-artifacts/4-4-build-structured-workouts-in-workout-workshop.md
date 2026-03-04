# Story 4.4: Build Structured Workouts in Workout Workshop

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to create and edit structured workouts in the Workout Workshop UI,  
so that I can define structured workouts without leaving the app.

## Acceptance Criteria

1. **Given** I open the Workout Workshop  
   **When** I create or edit a structured workout in the UI  
   **Then** the workout is saved and available for selection  
   **And** validation errors are shown if required workout fields are invalid.

## Tasks / Subtasks

- [x] Add backend workout-workshop storage and API contracts (AC: 1)
  - [x] Add plan-scoped workout definition persistence using existing runtime storage (`plan_settings`) with stable `snake_case` fields.
  - [x] Add API endpoints for listing and upserting workout definitions under existing `/plan/*` namespace (no `/api/v1` changes).
  - [x] Validate required fields (`workout_code`, `structure`) and return actionable HTTP 400 errors.

- [x] Add typed SPA API client support for workout workshop endpoints (AC: 1)
  - [x] Extend `chronicle-ui/src/api/plan-api.ts` with typed contracts for list/upsert workout definitions.
  - [x] Add API wrapper tests for request/response contract behavior in `chronicle-ui/src/api/plan-api.test.ts`.

- [x] Implement Workout Workshop UI on Plan page for create/edit (AC: 1)
  - [x] Add a Workout Workshop panel (open/close) in `chronicle-ui/src/features/plan/plan-page.tsx`.
  - [x] Support selecting an existing workout for edit or entering a new one for create.
  - [x] Show inline validation guidance when required fields are missing/invalid.
  - [x] Save workout definitions through workshop API and refresh definitions after save.

- [x] Make saved workouts available in plan-day workout selection (AC: 1)
  - [x] Merge workshop-saved workouts into Plan day workout select options.
  - [x] Preserve existing day-save behavior and authoritative refresh flow from Stories 4.1–4.3.

- [x] Add automated coverage for Workout Workshop behavior (AC: 1)
  - [x] Extend `chronicle-ui/src/features/plan/plan-page.test.tsx` for workshop create/edit and validation flows.
  - [x] Add backend endpoint tests in `tests/test_api_server.py` for list/upsert + validation.
  - [x] Keep plan day workout-attachment regression tests passing.

## Dev Notes

- Scope boundary for Story 4.4:
  - Includes creating and editing structured workout definitions in UI.
  - Includes persistence and availability for plan-day selection.
  - Does not include workout search/filter UX enhancements (Story 4.5).
  - Does not include Garmin send/sync flow (Epic 5).

### Technical Requirements

- Primary requirement sources:
  - Epic 4 Story 4.4 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR17 in `_bmad-output/planning-artifacts/prd.md`.
- Continuity constraints from previous stories:
  - Story 4.3 introduced day-level workout attachment using plan sessions.
  - Story 4.1–4.3 established authoritative reload and resilient save patterns for Plan SPA.

### Architecture Compliance

- Keep architecture boundaries:
  - Backend source-of-truth remains in `chronicle/*` with plan state persisted via storage layer.
  - Plan SPA logic remains in `chronicle-ui/src/features/plan/`.
  - API contracts remain in `chronicle-ui/src/api/`.
- Keep endpoint style and JSON shape rules:
  - Preserve existing endpoint namespace conventions.
  - Keep payload keys `snake_case`.
  - No `/api/v1` path changes.

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
  - `chronicle/storage.py` (or plan-support module for helper persistence functions)
  - `chronicle-ui/src/api/plan-api.ts`
  - `chronicle-ui/src/api/plan-api.test.ts`
  - `chronicle-ui/src/features/plan/plan-page.tsx`
  - `chronicle-ui/src/features/plan/plan-page.test.tsx`
  - `tests/test_api_server.py`
  - `_bmad-output/implementation-artifacts/4-4-build-structured-workouts-in-workout-workshop.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Workout Workshop UI opens and supports create/edit flows.
  - Required-field validation errors are surfaced clearly.
  - Saved workouts appear in plan-day workout selection list.
- Regression coverage:
  - Existing plan day edit/save flow and workout attachment behavior remain intact.
- Suggested verification commands:
  - `npm run test -- src/features/plan/plan-page.test.tsx src/api/plan-api.test.ts`
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 4.3 established:
  - Workout attachment flow and persistence through plan sessions.
  - Payload minimization fix: run-type-only updates should not rewrite sessions.
- Story 4.4 must preserve this behavior while introducing workshop-managed workout definitions.

### Git Intelligence Summary

- Recent work patterns in this branch favor:
  - Thin typed API wrappers in SPA.
  - Resilient save/reload flows.
  - Explicit backend validation and deterministic tests.

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- No dependency upgrade required for Story 4.4.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Keep endpoint paths stable and JSON keys `snake_case`.
  - Keep backend as source of truth.
  - Keep tests deterministic (no live network).
  - Keep `api_server.py` orchestration-focused.

### Story Completion Status

- Story context created.
- Story status set to `ready-for-dev`.
- Completion note: Workout Workshop implementation context prepared for create/edit + persistence + plan selection integration.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/4-3-attach-a-workout-to-a-day.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `4.4`.
- Parsed Epic 4 Story 4.4 acceptance criteria from planning artifacts.
- Pulled continuity constraints and implementation patterns from completed Story 4.3.
- Extracted architecture + project-context constraints for API naming and plan feature boundaries.
- Implemented workout workshop persistence module and `/plan/workouts` list/upsert endpoints.
- Extended SPA API contracts + tests for workout workshop list/upsert behavior.
- Added Plan page Workout Workshop panel with create/edit + validation + save/reload feedback.
- Code review findings fixed:
  - removed workshop reload loop tied to `workshopSelectedCode` dependency in `loadWorkouts`
  - hardened stale-workshop-selection reset logic after refresh
  - made day-row option assertion deterministic in workshop selection test
- Validation commands executed:
  - `npm run test -- src/api/plan-api.test.ts src/features/plan/plan-page.test.tsx`
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Implemented Workout Workshop list/create/edit persistence flow across backend + SPA contracts.
- Added plan-day integration so saved workshop workouts are selectable in day row workout fields.
- Added/updated automated coverage for workshop API contracts, Plan page workshop UX, and backend validation paths.
- Completed adversarial review and fixed all identified high/medium issues.
- Verified with targeted + full frontend test suites, backend API test suite, and production build.

### File List

- _bmad-output/implementation-artifacts/4-4-build-structured-workouts-in-workout-workshop.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle/workout_workshop.py
- chronicle/api_server.py
- chronicle-ui/src/api/plan-api.ts
- chronicle-ui/src/api/plan-api.test.ts
- chronicle-ui/src/features/plan/plan-page.tsx
- chronicle-ui/src/features/plan/plan-page.test.tsx
- tests/test_api_server.py

### Change Log

- 2026-03-04: Created Story 4.4 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented Story 4.4 Workout Workshop backend + SPA flows and automated coverage; set status to review.
- 2026-03-04: Applied code review fixes (workshop reload loop + deterministic option assertions), reran regressions, and set status to done.
