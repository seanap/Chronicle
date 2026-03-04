# Story 7.3: View Activity-Type Labels and Custom Metrics

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to view activity-type labels and custom metrics on the dashboard,  
so that I can interpret trends with my own classification and stats.

## Acceptance Criteria

1. **Given** the dashboard is displayed  
   **When** I view trend panels  
   **Then** activity-type labels and custom metrics are shown where applicable  
   **And** they match my configured profiles and metrics.

## Tasks / Subtasks

- [x] Add activity-type label + custom-metric trend panel (AC: 1)
  - [x] Add a dashboard panel that lists activity types using backend `type_meta` labels.
  - [x] Show custom metrics per type where available (efficiency, fitness, fatigue and pace/volume context).
  - [x] Show clear fallback text when custom metrics are not available for current scope.

- [x] Wire panel to scoped dashboard data (AC: 1)
  - [x] Derive type labels and metrics from current scoped payload (`full`, `summary`, `year`).
  - [x] Respect selected activity type filter so displayed metrics match visible scope.
  - [x] Keep existing dashboard cards and interactions intact.

- [x] Add automated coverage for label/metric behavior (AC: 1)
  - [x] Add View page tests validating activity-type labels from `type_meta`.
  - [x] Add tests validating custom metric values rendered from payload data.
  - [x] Add tests validating fallback handling when scoped payload lacks custom metrics.

## Dev Notes

- Scope boundary for Story 7.3:
  - Extends View dashboard trends with activity-type labels and custom metric visualization.
  - Builds on Story 7.2 scoped mode/year behavior and existing telemetry patterns.
  - Does not introduce new backend endpoints or alter dashboard payload schema.

### Technical Requirements

- Primary requirement sources:
  - Epic 7 Story 7.3 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR25 in `_bmad-output/planning-artifacts/prd.md`.
- Backend data sources:
  - `type_meta` for display labels/accent metadata.
  - `aggregates` and optional custom metric fields (`avg_pace_mps`, `avg_efficiency_factor`, `avg_fitness`, `avg_fatigue`).

### Architecture Compliance

- Keep architecture boundaries:
  - Frontend API types in `chronicle-ui/src/api/`.
  - View rendering and scope logic in `chronicle-ui/src/features/view/`.
- Keep backend as source-of-truth (no frontend-authored custom metric values outside deterministic aggregation from payload).

### Library / Framework Requirements

- Use current stack without upgrades:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4

### File Structure Requirements

- Likely files to modify:
  - `chronicle-ui/src/features/view/view-page.tsx`
  - `chronicle-ui/src/features/view/view-page.test.tsx`
  - `_bmad-output/implementation-artifacts/7-3-view-activity-type-labels-and-custom-metrics.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Trend panel shows activity-type labels from payload `type_meta`.
  - Custom metric values render when available and align with payload scope/filter.
  - Fallback copy appears when scope has no custom metrics.
- Regression coverage:
  - Existing trend, heatmap, scope mode/year, refresh, and error flows remain intact.
- Suggested verification commands:
  - `npm run test -- src/features/view/view-page.test.tsx`
  - `npm run test -- src/api/view-api.test.ts src/features/view/view-page.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`

### Previous Story Intelligence

- Story 7.1 delivered trend + heatmap rendering and dashboard timing instrumentation.
- Story 7.2 delivered scope mode/year controls, scoped request behavior, and selected scope indicator.
- Story 7.3 should integrate directly with existing scope/filter state and avoid duplicate fetch paths.

### Git Intelligence Summary

- Existing frontend patterns favor:
  - deterministic, payload-driven rendering tests
  - feature-local helper functions for data projection
  - UI-state guardrails for empty/partial payloads

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Backend remains source-of-truth for metrics.
  - Do not alter endpoint paths or response envelopes.
  - Maintain deterministic tests and local-only verification.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: View dashboard trend area now includes activity-type labels and payload-derived custom metrics (efficiency, fitness, fatigue) with fallback behavior for scopes that do not provide custom metrics.

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

- Story file created from Epic 7 Story 7.3 and PRD FR25 requirements.
- Implemented dashboard type-metric panel derivation from scoped `aggregates` + `type_meta` payload content.
- Added scoped year filtering and selected-type filtering logic for type metric card rows.
- Added custom metric render formatting and fallback copy when no scoped metric rows are available.
- Added View page test fixture aggregate generation with custom metric enrichment to emulate backend payload shape.
- Added UI tests for:
  - rendering activity-type labels from `type_meta`
  - rendering custom metric values from scoped payload
  - filtering type-metric rows via activity type filter
  - fallback behavior when summary scope has no custom metric rows.
- Code review pass: no additional correctness or regression fixes required after implementation.
- Validation commands executed:
  - `npm run test -- src/features/view/view-page.test.tsx`
  - `npm run test -- src/api/view-api.test.ts src/features/view/view-page.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`

### Completion Notes List

- Added activity-type label and custom metric panel to the View dashboard trend area.
- Bound panel rows to backend payload classification labels (`type_meta`) and scoped aggregate metrics.
- Ensured mode/year scope and activity-type filtering apply consistently to displayed type metric rows.
- Added fallback handling for scopes without available custom metrics.
- Completed dev/review/fix/QA flow for Story 7.3 and finalized status as `done`.

### File List

- _bmad-output/implementation-artifacts/7-3-view-activity-type-labels-and-custom-metrics.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle-ui/src/features/view/view-page.tsx
- chronicle-ui/src/features/view/view-page.test.tsx

### Change Log

- 2026-03-04: Created Story 7.3 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented activity-type labels and custom metric trend panel, added coverage, and completed review/QA with status set to done.
