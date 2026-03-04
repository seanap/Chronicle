# Story 4.5: Search and Select Workouts

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to search and select workouts from a list,  
so that I can quickly attach the right workout.

## Acceptance Criteria

1. **Given** I am choosing a workout  
   **When** I search by name or type  
   **Then** matching workouts are shown  
   **And** I can select one to attach to a plan day.

## Tasks / Subtasks

- [x] Add searchable workout-selection UX to Plan page (AC: 1)
  - [x] Add a workout search input to the Plan experience where users select workouts.
  - [x] Provide clear search guidance that supports searching by workout name/type keywords.
  - [x] Keep the interaction responsive and aligned with existing Plan page editing patterns.

- [x] Filter workout options by search criteria (AC: 1)
  - [x] Apply case-insensitive filtering to workout options shown in day-row workout selectors.
  - [x] Ensure options can be matched by name/type text from presets and workshop-defined workouts.
  - [x] Preserve current selected workout visibility so active selections are never silently dropped by filtering.

- [x] Preserve existing attach/save behavior while search is active (AC: 1)
  - [x] Ensure selecting a filtered workout still writes through existing `/plan/days/bulk` workflow.
  - [x] Preserve authoritative refresh and error-handling behavior from Stories 4.1–4.4.

- [x] Add automated coverage for workout search/select behavior (AC: 1)
  - [x] Extend `chronicle-ui/src/features/plan/plan-page.test.tsx` with search filter + selection assertions.
  - [x] Keep existing plan save and workout workshop regressions passing.

## Dev Notes

- Scope boundary for Story 4.5:
  - Includes searching/filtering workout choices at selection time.
  - Includes attaching a filtered result to a day via existing save path.
  - Does not include Garmin sync behavior (Epic 5).
  - Does not include backend search endpoints (client-side filtering is sufficient for current dataset size).

### Technical Requirements

- Primary requirement sources:
  - Epic 4 Story 4.5 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR18 in `_bmad-output/planning-artifacts/prd.md`.
- Continuity constraints:
  - Story 4.3 established workout attachment behavior.
  - Story 4.4 established workout workshop persistence and day-row option integration.

### Architecture Compliance

- Keep architecture boundaries:
  - Plan search/select UX logic stays in `chronicle-ui/src/features/plan/`.
  - Reuse existing API contract in `chronicle-ui/src/api/plan-api.ts`.
  - No new backend endpoints required for this story.
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
  - `chronicle-ui/src/features/plan/plan-page.tsx`
  - `chronicle-ui/src/features/plan/plan-page.test.tsx`
  - `_bmad-output/implementation-artifacts/4-5-search-and-select-workouts.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Search input narrows workout options by name/type keywords.
  - Filtered workout remains selectable and can be attached to a day.
  - Save behavior remains correct under filtered selection.
- Regression coverage:
  - Existing workout workshop create/edit + reload warning flows remain passing.
  - Existing plan day save/error/resync behavior remains intact.
- Suggested verification commands:
  - `npm run test -- src/features/plan/plan-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 4.4 introduced workshop definitions and fixed reload robustness issues in workout data refresh.
- Story 4.5 should build on that data source rather than introducing parallel workout catalogs.

### Git Intelligence Summary

- Recent plan-page changes favor:
  - Clear validation-first user feedback.
  - Authoritative reload behavior after save.
  - Deterministic test assertions over global/unscoped selectors.

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- No dependency upgrade required for Story 4.5.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Keep backend authoritative for persisted plan state.
  - Keep tests deterministic with no live network dependencies.
  - Preserve existing endpoint contracts and `snake_case` payload/response shapes.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: Searchable workout selection shipped with regression-safe attach/save behavior and validated test coverage.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/4-4-build-structured-workouts-in-workout-workshop.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `4.5`.
- Parsed Epic 4 Story 4.5 acceptance criteria from planning artifacts.
- Pulled continuity constraints and implementation patterns from completed Story 4.4.
- Implemented searchable workout filtering in Plan page day-level selection flow.
- Added deterministic search/filter + attach test coverage for plan page.
- Code review findings fixed:
  - deduplicated workout option lists case-insensitively to avoid duplicated entries
  - keyed search index lookups case-insensitively for robust matching across persisted casing variants
  - improved workout option labels for workshop-defined workouts to show human title + code context
- Validation commands executed:
  - `npm run test -- src/features/plan/plan-page.test.tsx`
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Added `Workout search` input with case-insensitive filtering across preset and workshop-defined workouts.
- Preserved selected workout visibility when active filter would otherwise hide the current selection.
- Confirmed filtered selection still attaches via existing `/plan/days/bulk` workflow without regressions.
- Added automated search+attach coverage and reran full frontend/backend/build validation.
- Applied and verified code review hardening fixes; story closed as done.

### File List

- _bmad-output/implementation-artifacts/4-5-search-and-select-workouts.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle-ui/src/features/plan/plan-page.tsx
- chronicle-ui/src/features/plan/plan-page.test.tsx

### Change Log

- 2026-03-04: Created Story 4.5 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented workout search/filter + attach flow in Plan page and added automated coverage; set status to review.
- 2026-03-04: Applied code review hardening fixes, reran regressions/build, and set status to done.
