# Story 2.1: Edit Description Template (Jinja)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,
I want to edit a description template using Jinja,
so that I can customize how my activity descriptions read.

## Acceptance Criteria

1. **Given** I am on the Build page  
   **When** I open a template editor  
   **Then** I can modify the template text using Jinja syntax  
   **And** I can save changes to the template  
   **And** a typical edit + save flow completes in <= 3 steps and <= 60 seconds (FR29)  
   **And** edit/save interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30).
2. **Given** I attempt to save invalid template content  
   **When** I submit the save action  
   **Then** the save is rejected with clear error details  
   **And** no partial template update is persisted.

## Tasks / Subtasks

- [x] Implement Build page template editor foundation (AC: 1)
  - [x] Replace placeholder Build page UI in `chronicle-ui/src/features/build/build-page.tsx` with an editable multiline Jinja template form.
  - [x] Load the active template from backend on page load using `GET /editor/template`.
  - [x] Show clear loading and error states for template fetch.
  - [x] Keep the interaction path compact (Build -> edit -> Save) to preserve FR29 flow simplicity.

- [x] Implement template save workflow with explicit failure handling (AC: 1, 2)
  - [x] Add frontend API wrapper(s) for template editing endpoints (expected new file: `chronicle-ui/src/api/template-editor-api.ts`).
  - [x] Persist edits through `PUT /editor/template` with required payload fields (`template`; optional `name`, `author`, `source`, `context_mode`, `profile_id`).
  - [x] Surface backend validation failures from `status: error` responses with actionable UI messaging.
  - [x] Ensure failed save attempts do not clear or overwrite current editor text in UI.

- [x] Add basic performance timing instrumentation for edit/save path (AC: 1)
  - [x] Use lightweight client-side timing markers around template load and save (existing or new utility, no new dependency).
  - [x] Keep instrumentation scoped to this story and reusable by Story 2.2/2.3 validation+preview flows.

- [x] Add focused automated coverage for editor load/save behavior (AC: 1, 2)
  - [x] Add/extend API tests for template editor endpoints (expected: `chronicle-ui/src/api/template-editor-api.test.ts`).
  - [x] Add Build page UI tests for load success, save success, and validation error handling (expected: `chronicle-ui/src/features/build/build-page.test.tsx`).
  - [x] Preserve existing route/shell test behavior (`app-smoke`, `app-routes`) as regression coverage.

## Dev Notes

- Scope boundary for Story 2.1:
  - Include only template edit + save UX and error handling.
  - Do not implement template validate button/hints (Story 2.2), preview flow (Story 2.3), rollback (Story 2.4), or profile selection UX (Story 2.5).
- Build page currently uses a placeholder heading and can be expanded directly without route changes.
- Backend template APIs already exist and are stable; this story should consume existing contracts and avoid backend changes.

### Technical Requirements

- Backend endpoints relevant to this story:
  - `GET /editor/template` -> loads current active template (`template`, `profile_id`, metadata fields).
  - `PUT /editor/template` -> saves template text; returns `status`, `saved_version`, `active`, and validation context metadata.
- Error semantics:
  - Invalid template save returns HTTP 400 with JSON `status: "error"` and validation details.
  - Frontend must preserve user text on save failure and show explicit corrective guidance.
- API client expectations:
  - Reuse `getJson` from `chronicle-ui/src/api/http-client.ts`.
  - Preserve existing error envelope handling behavior (`ApiRequestError`) and do not bypass it.

### Architecture Compliance

- Keep implementation in SPA frontend scope:
  - `chronicle-ui/src/features/build/` for page UI/state.
  - `chronicle-ui/src/api/` for HTTP wrappers.
- Do not modify backend endpoint paths, response shapes, or server-side template logic in this story.
- Respect architecture rule that backend remains source of truth for template persistence and validation outcome.

### Library / Framework Requirements

- Use project-pinned stack already in repo:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- Do not add new dependencies for this story.
- Testing stack remains React Testing Library + Vitest.

### File Structure Requirements

- Existing files to modify:
  - `chronicle-ui/src/features/build/build-page.tsx`
- Expected new files:
  - `chronicle-ui/src/api/template-editor-api.ts`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
  - `chronicle-ui/src/features/build/build-page.test.tsx`
- Optional shared helper (only if reused immediately by later stories):
  - `chronicle-ui/src/features/build/*` (local helper/components)
  - `chronicle-ui/src/hooks/*` (timing utility reuse)

### Testing Requirements

- Direct AC validation:
  - Build page loads current template and allows text edits.
  - Save action sends expected payload and reports success clearly.
  - Invalid template save reports backend validation guidance and does not persist partial/incorrect updates in UI.
- Regression checks:
  - Existing navigation and route behavior remain unchanged (`app-smoke` / `app-routes` tests).
  - Existing Epic 1 Sources flows remain unaffected.
- Minimum verification commands:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`

### Latest Tech Information

- Snapshot check (2026-02-27 via npm registry):
  - `react` latest 19.2.4 (project uses 19.2.0)
  - `react-router-dom` latest 7.13.1 (project uses 7.13.0)
  - `@mui/material` latest 7.3.8 (project uses 7.3.7)
  - `vite` latest 7.3.1 (project uses 7.2.6)
  - `vitest` latest 4.0.18 (project uses 3.2.4)
- Stay on project-pinned versions for this story; no upgrades in Story 2.1.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Do not change endpoint paths or add `/api/v1`.
  - Use existing frontend structure (`features/*`, `api/*`, `components/*`).
  - Keep tests deterministic and network-isolated.
  - Do not log or persist secrets in repo artifacts.
  - Keep backend domain logic in backend; do not shift validation/persistence authority to frontend.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/tests/test_api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/api/http-client.ts]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/features/build/build-page.tsx]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Auto-discovered next backlog story from sprint status: `2-1-edit-description-template-jinja`.
- Loaded complete sprint tracking, epics, PRD, architecture, UX, and project-context artifacts.
- Extracted backend editor API contracts from `chronicle/api_server.py` and related server tests.
- Verified current frontend structure and Build page baseline to constrain implementation scope.
- Collected latest package versions via npm registry snapshot for implementation guidance.
- Marked sprint tracking for Epic 2 start and Story 2.1 readiness.
- Entered red phase with new failing tests for editor API wrapper and Build page load/save flows.
- Implemented template editor API client, Build page edit/save UI, and reusable timing instrumentation helper.
- `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx` (red -> green)
- `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
- `npm run test`
- `npm run build`
- Code review hardening pass: fixed validation-error detail surfacing, load-error edit guardrail, and telemetry assertions for FR30.
- `npm run test -- src/api/http-client.test.ts src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
- `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
- `npm run test`
- `npm run build`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story 2.1 is scoped to edit/save only and intentionally excludes validation/preview/rollback/profile-selection stories.
- Story includes explicit API contracts, failure handling expectations, and test guardrails to prevent regression and scope creep.
- Build page now loads active template text, supports inline Jinja editing, and saves through `PUT /editor/template`.
- Save failure messaging now preserves edited text so users can immediately correct invalid template content.
- Added lightweight UI timing event instrumentation for template load/save paths via reusable build helper.
- Added targeted API and Build page tests and validated full frontend regression + build suites.
- Code review hardening now surfaces backend `validation.errors` messages from `PUT /editor/template` failures.
- Build page now blocks editing/saving until template load succeeds, preventing accidental overwrite after failed load.
- Telemetry tests now assert `template.load` and `template.save` timing events remain under 1s in test runs.

### File List

- _bmad-output/implementation-artifacts/2-1-edit-description-template-jinja.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- chronicle-ui/src/api/template-editor-api.ts
- chronicle-ui/src/api/template-editor-api.test.ts
- chronicle-ui/src/api/http-client.ts
- chronicle-ui/src/api/http-client.test.ts
- chronicle-ui/src/features/build/build-page.tsx
- chronicle-ui/src/features/build/build-page.test.tsx
- chronicle-ui/src/features/build/template-editor-timing.ts

### Change Log

- 2026-02-27: Created Story 2.1 with comprehensive implementation context and updated sprint tracking to ready-for-dev.
- 2026-02-27: Implemented Story 2.1 template edit/save UI + API wrappers + tests; validated frontend suite and moved story to review.
- 2026-02-27: Completed code-review hardening fixes for Story 2.1, reran targeted + full frontend tests, and marked story done.
