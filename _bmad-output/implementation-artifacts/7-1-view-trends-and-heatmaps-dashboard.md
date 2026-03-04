# Story 7.1: View Trends and Heatmaps Dashboard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to view training trends and heatmaps,  
so that I can understand my training patterns at a glance.

## Acceptance Criteria

1. **Given** I open the Dashboard  
   **When** the page loads  
   **Then** I see trend charts and heatmaps  
   **And** they reflect my current training data  
   **And** dashboard interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30).

## Tasks / Subtasks

- [x] Add SPA dashboard API contracts for View page data loading (AC: 1)
  - [x] Add typed contract for `/dashboard/data.json` payload in frontend API layer.
  - [x] Add load + force-refresh request support from View page.

- [x] Implement View dashboard trends and heatmap rendering (AC: 1)
  - [x] Load dashboard payload on page mount and surface loading/error states.
  - [x] Render trend visualization from current activity data.
  - [x] Render heatmap visualization from current activity data.

- [x] Add user interactions and telemetry for dashboard responsiveness (AC: 1)
  - [x] Add at least one dashboard interaction (for example, type filter and/or refresh) tied to current dataset.
  - [x] Emit client timing telemetry events for dashboard load/interaction durations.
  - [x] Keep interaction and rendering paths within <1s p95 in test telemetry runs.

- [x] Add automated coverage for View dashboard behavior (AC: 1)
  - [x] Add frontend API tests for dashboard data request paths.
  - [x] Add View page tests for trend + heatmap rendering and data reflection.
  - [x] Add View page tests for interaction timing telemetry and error handling.

## Dev Notes

- Scope boundary for Story 7.1:
  - Includes View page dashboard visualizations (trends + heatmaps) in SPA.
  - Includes dashboard response timing telemetry assertions in UI tests.
  - Does not include year/summary response-mode scoping behavior (Story 7.2).

### Technical Requirements

- Primary requirement sources:
  - Epic 7 Story 7.1 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR23 and FR30 in `_bmad-output/planning-artifacts/prd.md`.
- Continuity constraints:
  - Backend endpoint `/dashboard/data.json` is the source-of-truth payload.
  - Existing SPA route `/view` should remain the user entry point for this story.

### Architecture Compliance

- Keep architecture boundaries:
  - Dashboard data access in `chronicle-ui/src/api/`.
  - View rendering logic in `chronicle-ui/src/features/view/`.
- Preserve backend response contracts and `snake_case` payload keys.

### Library / Framework Requirements

- Use current stack without upgrades:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4

### File Structure Requirements

- Likely files to modify:
  - `chronicle-ui/src/api/view-api.ts` (new)
  - `chronicle-ui/src/api/view-api.test.ts` (new)
  - `chronicle-ui/src/features/view/view-page.tsx`
  - `chronicle-ui/src/features/view/view-page.test.tsx` (new)
  - `chronicle-ui/src/features/view/view-timing.ts` (new)
  - `_bmad-output/implementation-artifacts/7-1-view-trends-and-heatmaps-dashboard.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - View page renders trend and heatmap sections from dashboard payload.
  - Displayed values reflect loaded activity data.
  - Dashboard interaction/load telemetry p95 is <1000ms in test runs.
- Regression coverage:
  - Existing SPA routes and navigation remain intact.
  - Existing backend dashboard endpoint contract remains unchanged.
- Suggested verification commands:
  - `npm run test -- src/api/view-api.test.ts src/features/view/view-page.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_api_server`

### Previous Story Intelligence

- Story 6.3 completed Control rerun UX with status/timestamp envelopes and timing-safe interactions.
- Story 7.1 should keep the same deterministic UI testing patterns and telemetry event conventions.

### Git Intelligence Summary

- Existing project patterns favor:
  - typed API wrappers in `chronicle-ui/src/api/`
  - feature-local telemetry utilities
  - robust UI error states and deterministic tests with mocked APIs

### Latest Tech Information

- Snapshot check (2026-03-04 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- No dependency upgrade required for Story 7.1.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Backend is source-of-truth for metrics and aggregates.
  - Do not change endpoint paths or add `/api/v1`.
  - Keep tests deterministic and local.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: View page now renders trend and heatmap visualizations from live dashboard payload with tested load/refresh timing telemetry.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/dashboard_data.py]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `7.1`.
- Parsed Epic 7 Story 7.1 acceptance criteria from planning artifacts.
- Identified existing `/view` route and `/dashboard/data.json` backend payload contract for SPA integration.
- Added `chronicle-ui/src/api/view-api.ts` and typed `/dashboard/data.json` contract with force/mode/year query support.
- Added API tests in `chronicle-ui/src/api/view-api.test.ts` for default and query-param request paths.
- Implemented View page dashboard experience in `chronicle-ui/src/features/view/view-page.tsx`:
  - loading/error states
  - current training snapshot totals
  - distance trend chart (last 8 weeks)
  - activity heatmap (last 12 weeks)
  - refresh and activity-type filter interactions
- Added View timing utility in `chronicle-ui/src/features/view/view-timing.ts` and emitted `chronicle:ui-timing` events for load/refresh/filter interactions.
- Added View page tests in `chronicle-ui/src/features/view/view-page.test.tsx` covering:
  - trend + heatmap rendering and payload reflection
  - type filter behavior
  - forced refresh behavior
  - error handling
  - telemetry p95 assertions for load/refresh durations (<1000ms).
- Code review pass: no correctness or regression issues remained after implementation; no additional code fixes were required.
- Validation commands executed:
  - `npm run test -- src/api/view-api.test.ts src/features/view/view-page.test.tsx`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`
  - `npm run test`

### Completion Notes List

- Implemented typed dashboard data API wrapper for SPA View feature.
- Delivered trend and heatmap dashboard visualizations that reflect current activity payload data.
- Added dashboard refresh + activity-type filter interactions with timing telemetry instrumentation.
- Added comprehensive View API/UI automated coverage, including FR30 p95 timing checks.
- Completed dev/review/fix/QA workflow and finalized Story 7.1 as `done`.

### File List

- _bmad-output/implementation-artifacts/7-1-view-trends-and-heatmaps-dashboard.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle-ui/src/api/view-api.ts
- chronicle-ui/src/api/view-api.test.ts
- chronicle-ui/src/features/view/view-page.tsx
- chronicle-ui/src/features/view/view-page.test.tsx
- chronicle-ui/src/features/view/view-timing.ts

### Change Log

- 2026-03-04: Created Story 7.1 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented View trends + heatmap dashboard with telemetry and tests; completed review/QA and set status to done.
