# Story 8.2: Troubleshooting Guide with Actionable Fixes

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want a troubleshooting guide with actionable fixes,  
so that I can resolve common issues quickly.

## Acceptance Criteria

1. **Given** I open the Troubleshooting guide  
   **When** I review a common issue  
   **Then** I see clear steps to resolve it  
   **And** the steps reference known fixes (tokens, Docker, connectivity).

## Tasks / Subtasks

- [x] Add Troubleshooting guide route and page shell (AC: 1)
  - [x] Add a dedicated SPA route for Troubleshooting guide access.
  - [x] Render guide heading and purpose text.
  - [x] Keep existing route and navigation behavior stable.

- [x] Implement actionable troubleshooting issue sections (AC: 1)
  - [x] Add token/OAuth troubleshooting section with explicit remediation steps.
  - [x] Add Docker/runtime troubleshooting section with explicit remediation steps.
  - [x] Add connectivity/API troubleshooting section with explicit remediation steps.
  - [x] Include quick links to relevant pages (Sources, Health, Control) where applicable.

- [x] Add automated coverage for troubleshooting guide behavior (AC: 1)
  - [x] Add page tests verifying common issues and action steps are rendered.
  - [x] Add route/smoke coverage for troubleshooting route.
  - [x] Validate that references to tokens, Docker, and connectivity are present.

## Dev Notes

- Scope boundary for Story 8.2:
  - Implements a UI troubleshooting guide page with actionable fixes.
  - Reuses existing app routes/features; no backend endpoint changes required.
  - Does not include rollback guardrails (Story 8.3).

### Technical Requirements

- Primary requirement sources:
  - Epic 8 Story 8.2 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR34 in `_bmad-output/planning-artifacts/prd.md`.
- Troubleshooting topics required:
  - token issues
  - Docker/runtime issues
  - connectivity/API issues

### Architecture Compliance

- Keep architecture boundaries:
  - Troubleshooting UI in `chronicle-ui/src/features/health/`.
  - Route registration in `chronicle-ui/src/config/routes.tsx`.
  - Shared nav wiring in `chronicle-ui/src/components/app-shell.tsx`.
- No endpoint path changes.

### Library / Framework Requirements

- Use current stack without upgrades:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4

### File Structure Requirements

- Likely files to modify:
  - `chronicle-ui/src/features/health/troubleshooting-page.tsx` (new)
  - `chronicle-ui/src/features/health/troubleshooting-page.test.tsx` (new)
  - `chronicle-ui/src/features/health/health-page.tsx`
  - `chronicle-ui/src/config/routes.tsx`
  - `chronicle-ui/src/components/app-shell.tsx`
  - `chronicle-ui/src/app-smoke.test.tsx`
  - `_bmad-output/implementation-artifacts/8-2-troubleshooting-guide-with-actionable-fixes.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Testing Requirements

- Acceptance coverage:
  - Troubleshooting guide renders common issues with clear, ordered action steps.
  - Guide content explicitly references tokens, Docker, and connectivity fixes.
  - Route is reachable and integrated in app navigation.
- Regression coverage:
  - Existing health/status and feature routes remain stable.
- Suggested verification commands:
  - `npm run test -- src/features/health/troubleshooting-page.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`

### Previous Story Intelligence

- Story 8.1 introduced Health page and `/status` route.
- Story 8.2 should integrate cleanly with 8.1 by providing quick access from Health.

### Git Intelligence Summary

- Existing SPA patterns favor:
  - MUI card-based sections with concise guidance
  - route-driven page composition
  - deterministic page-level tests

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Avoid backend contract churn.
  - Keep guidance actionable and user-facing.
  - Keep tests deterministic.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: Troubleshooting guide is available as a first-class SPA route with actionable token/OAuth, Docker/runtime, and connectivity/API fixes plus quick links to Sources/Control/Health and Health-page entry link.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story file created from Epic 8 Story 8.2 and PRD FR34 requirements.
- Added `TroubleshootingPage` with structured issue cards, symptom/cause context, and ordered remediation steps.
- Added quick links for direct navigation to Sources, Control, and Health where applicable.
- Wired `/troubleshooting` into route config and top navigation.
- Added Health page CTA link to open the troubleshooting guide.
- Added/updated deterministic tests for troubleshooting content, route smoke behavior, and health-page troubleshooting CTA.
- Code review identified and fixed:
  - nav label drift risk between route config and AppShell link constants (AppShell now derives links from `APP_ROUTES`)
  - router-context test regression for `HealthPage` after adding RouterLink CTA (tests now render inside `MemoryRouter`)
- Verification commands executed:
  - `npm run test -- src/features/health/troubleshooting-page.test.tsx src/features/health/health-page.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`

### Completion Notes List

- Delivered Troubleshooting guide route and page with actionable fixes for token/OAuth, Docker/runtime, and connectivity/API issues.
- Added explicit quick links from troubleshooting issues to relevant pages (Sources, Control, Health).
- Added Health page entry point to troubleshooting guide for faster issue resolution flow.
- Completed dev/review/fix/QA cycle with passing targeted, full frontend, and backend verification.

### File List

- _bmad-output/implementation-artifacts/8-2-troubleshooting-guide-with-actionable-fixes.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle-ui/src/features/health/troubleshooting-page.tsx
- chronicle-ui/src/features/health/troubleshooting-page.test.tsx
- chronicle-ui/src/features/health/health-page.tsx
- chronicle-ui/src/features/health/health-page.test.tsx
- chronicle-ui/src/config/routes.tsx
- chronicle-ui/src/components/app-shell.tsx
- chronicle-ui/src/app-smoke.test.tsx

### Change Log

- 2026-03-04: Created Story 8.2 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented Troubleshooting guide route/content/tests, completed code-review fixes, and finished QA with story status set to done.
