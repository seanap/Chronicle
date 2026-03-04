# Story 2.2: Validate Template Before Save (with Jinja Hints)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,
I want to validate a template before saving, with Jinja hints,
so that I can fix syntax or logic errors quickly.

## Acceptance Criteria

1. **Given** I have edited a template  
   **When** I run validation  
   **Then** I see a success state if valid  
   **And** if invalid, I see actionable Jinja error hints/examples.  
   **And** the validate flow can be completed in <= 3 steps and <= 60 seconds under normal load (FR29)  
   **And** validation interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30)

## Tasks / Subtasks

- [x] Implement template validation API wrappers for Build page usage (AC: 1)
  - [x] Extend `chronicle-ui/src/api/template-editor-api.ts` with `validateEditorTemplate(...)` wrapper for `POST /editor/validate`.
  - [x] Add `getEditorSnippets(...)` wrapper for `GET /editor/snippets` and typed response models for snippets + context modes.
  - [x] Add/extend API tests in `chronicle-ui/src/api/template-editor-api.test.ts` for validate + snippets requests, including request payload shape and response handling.

- [x] Add Validate-before-save UX with actionable Jinja hints (AC: 1)
  - [x] Update `chronicle-ui/src/features/build/build-page.tsx` to add a `Validate Template` action in the existing editor workflow.
  - [x] Render explicit success feedback for valid templates and explicit error feedback for invalid templates.
  - [x] Show actionable hint/example content when invalid by combining backend validation errors with snippet guidance from `/editor/snippets`.
  - [x] Keep the user path compact (Build -> edit -> Validate) to preserve FR29 simplicity.

- [x] Enforce non-persistence and state safety during validation (AC: 1)
  - [x] Ensure validate action does not call save endpoint and does not persist template changes.
  - [x] Preserve current editor text and unsaved state after validation failure.
  - [x] Keep existing load-failure guardrails from Story 2.1 intact (no validate/save actions before successful template load).

- [x] Extend timing telemetry for validation interactions (AC: 1)
  - [x] Reuse `chronicle-ui/src/features/build/template-editor-timing.ts` and add `template.validate` timing around validation calls.
  - [x] Keep telemetry implementation dependency-free and reusable for Story 2.3 preview instrumentation.

- [x] Add focused automated coverage for validate flow and regressions (AC: 1)
  - [x] Extend `chronicle-ui/src/features/build/build-page.test.tsx` with validate success and validate invalid/hints scenarios.
  - [x] Add assertions that validate does not trigger template save.
  - [x] Add assertions for validation telemetry event emission and <1s durations in test runs.
  - [x] Preserve existing route/shell regression coverage (`app-smoke`, `app-routes`) and existing Story 2.1 behaviors.

## Dev Notes

- Scope boundary for Story 2.2:
  - Include validate-before-save UX and Jinja hints/examples only.
  - Do not implement preview output rendering (Story 2.3), rollback UX (Story 2.4), or profile-selection UX (Story 2.5).
- Story 2.1 already delivered template load/edit/save and timing scaffolding; Story 2.2 should extend that flow, not replace it.
- UX specification calls for validation-first interactions with inline actionable feedback and low-friction flows.

### Technical Requirements

- Backend endpoints relevant to this story:
  - `POST /editor/validate` for template validation (status `ok` or `error`, `validation` details).
  - `GET /editor/snippets` for curated Jinja snippets/examples and supported context modes.
- Validation endpoint behavior:
  - Accepts template text and optional context controls (`context_mode`, `fixture_name`, `profile_id`).
  - Returns HTTP 200 for valid templates and HTTP 400 for invalid templates while preserving structured validation payload.
- UI behavior requirements:
  - Validation must be explicit and user-triggered before save.
  - Invalid validation states must present corrective guidance that is directly actionable.
  - Validation must not persist template data or alter committed template state.
- API client expectations:
  - Reuse `getJson` from `chronicle-ui/src/api/http-client.ts`.
  - Preserve `ApiRequestError` behavior and structured error-detail handling.

### Architecture Compliance

- Keep implementation in SPA frontend scope:
  - `chronicle-ui/src/features/build/` for Build page UI/state.
  - `chronicle-ui/src/api/` for HTTP wrappers.
- Do not modify backend endpoint paths, response contracts, or server template-validation logic in this story.
- Respect backend as source of truth for validation outcomes.
- Keep JSON key casing and endpoint naming consistent with existing contracts (`snake_case`, no `/api/v1` prefix).

### Library / Framework Requirements

- Use project-pinned stack already in repo:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- Do not add dependencies for this story.
- Continue using React Testing Library + Vitest patterns already established in Epic 1 and Story 2.1.

### File Structure Requirements

- Expected files to modify:
  - `chronicle-ui/src/features/build/build-page.tsx`
  - `chronicle-ui/src/features/build/build-page.test.tsx`
  - `chronicle-ui/src/api/template-editor-api.ts`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
- Existing helper to extend:
  - `chronicle-ui/src/features/build/template-editor-timing.ts`
- Optional extraction only if complexity requires:
  - `chronicle-ui/src/features/build/*` for local hint-rendering helpers/components.

### Testing Requirements

- Direct AC validation:
  - Validate action shows success state for valid template input.
  - Validate action surfaces actionable errors and Jinja hints/examples for invalid input.
  - Validate flow remains compact and does not persist template changes.
- FR30 validation:
  - Validation timing telemetry (`template.validate`) is emitted and asserted under 1s in test runs.
- Regression checks:
  - Story 2.1 load/save behaviors remain intact.
  - Existing navigation and route behavior remain unchanged (`app-smoke` / `app-routes`).
- Minimum verification commands:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 2.1 established:
  - Build page load/edit/save foundation and guarded load-error UX.
  - Structured backend validation message surfacing through `ApiRequestError` details.
  - Reusable timing helper with `template.load` and `template.save` metrics and test assertions.
- Reuse Story 2.1 patterns:
  - Keep feedback messaging explicit and non-destructive to user edits.
  - Extend existing timing telemetry instead of introducing a new instrumentation mechanism.
  - Preserve deterministic frontend tests with mocked API modules and no live network calls.

### Git Intelligence Summary

- Recent commits in this repository are mostly documentation/housekeeping and do not define Story 2.2 implementation patterns.
- Workspace currently includes broad untracked baseline content; keep Story 2.2 code changes tightly scoped to Build/API files and story artifacts.
- Maintain accurate story file list and status updates to reduce git/story traceability drift during review.

### Latest Tech Information

- Snapshot check (2026-02-27 via npm registry):
  - `react` latest 19.2.4 (project uses 19.2.0)
  - `react-router-dom` latest 7.13.1 (project uses 7.13.0)
  - `@mui/material` latest 7.3.8 (project uses 7.3.7)
  - `vite` latest 7.3.1 (project uses 7.2.6)
  - `vitest` latest 4.0.18 (project uses 3.2.4)
- Stay on project-pinned versions for this story; do not upgrade dependencies in Story 2.2.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Do not change endpoint paths or add `/api/v1`.
  - Keep backend as authority for template validation and persistence.
  - Keep tests deterministic and network-isolated.
  - Do not log or persist secrets in repo artifacts.
  - Maintain feature-first frontend structure (`features/*`, `api/*`, `components/*`).

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/2-1-edit-description-template-jinja.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/description_template.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/tests/test_api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/features/build/build-page.tsx]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/api/template-editor-api.ts]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Auto-discovered next backlog story from sprint status: `2-2-validate-template-before-save-with-jinja-hints`.
- Loaded sprint tracking, Epic 2 story definitions, PRD, architecture, UX, and project-context artifacts.
- Extracted backend validation and snippet contracts from `chronicle/api_server.py` and template helpers.
- Reviewed Story 2.1 completion notes and implemented patterns for continuity and guardrails.
- Collected latest frontend package snapshot via npm registry (`npm view`) for implementation guidance.
- Created Story 2.2 with comprehensive implementation context, constraints, and test expectations.
- Entered red phase by adding failing API and Build page tests for validate-before-save, snippet hints, and validation telemetry.
- Implemented `validateEditorTemplate` and `getEditorSnippets` API wrappers with typed responses.
- Implemented Build page validate action, inline validation feedback states, validation detail rendering, and snippet-based hint examples.
- Reused existing timing helper to emit `template.validate` telemetry events.
- `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx` (red -> green).
- `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
- `npm run test`
- `npm run build`
- Addressed code-review findings:
  - Added fallback built-in Jinja hints when `/editor/snippets` is unavailable.
  - Expanded `template.load` timing to include snippet fetch for full load telemetry.
  - Added `aria-describedby` linkage for helper text, validation errors, warnings, and hints.
  - Upgraded validation timing assertions to p95 over repeated samples.
- Verified out-of-scope tracked workspace deltas remain pre-existing: `.gitignore`, `README.md`, `chronicle/plan_data.py`.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story 2.2 is scoped to validate-before-save and Jinja hinting only.
- Story includes explicit API contracts, non-persistence requirements, telemetry expectations, and regression boundaries.
- Added validate-before-save API surface in frontend API client and extended API test coverage.
- Added validate workflow to Build page with explicit success/error feedback and non-persistent validation behavior.
- Added actionable Jinja hint/example rendering from `/editor/snippets` when validation fails.
- Added validation telemetry coverage proving `template.validate` stays under 1s in test runs.
- Full frontend regression suite and build are green after implementation.
- Resolved review findings for fallback hints, full-load telemetry timing, accessibility hint/error linkage, and p95 timing assertions.
- Story moved from `review` to `done` after remediation and verification.

### File List

- _bmad-output/implementation-artifacts/2-2-validate-template-before-save-with-jinja-hints.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- chronicle-ui/src/api/template-editor-api.ts
- chronicle-ui/src/api/template-editor-api.test.ts
- chronicle-ui/src/features/build/build-page.tsx
- chronicle-ui/src/features/build/build-page.test.tsx

### Change Log

- 2026-02-27: Created Story 2.2 with comprehensive implementation context and updated sprint tracking to ready-for-dev.
- 2026-02-27: Implemented Story 2.2 validate-before-save + Jinja hint UX, added telemetry/test coverage, and moved story to review.
- 2026-02-27: Applied code-review remediation updates and advanced Story 2.2 to done.
