# Story 2.7: Import Template Bundles (Phase-2)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to import a template bundle,  
so that I can try new styles without rebuilding from scratch.

## Acceptance Criteria

1. **Given** I have a template bundle file  
   **When** I import it  
   **Then** the templates are added and available for selection  
   **And** any validation errors are shown clearly.

## Tasks / Subtasks

- [x] Add import-focused API wrappers for Build usage (AC: 1)
  - [x] Extend `chronicle-ui/src/api/template-editor-api.ts` with typed wrappers for `POST /editor/template/import`.
  - [x] Add typed wrapper for `POST /editor/repository/import` to support repository-first import-and-select flow.
  - [x] Add request/response types covering import payload fields and envelopes: `bundle`, `context_mode`, `fixture_name`, `profile_id`, `author`, `source`, `name`, `notes`, `validation`, `context_source`, `active`, `template_record`.
  - [x] Ensure wrapper payloads stay `snake_case` across API boundaries.
  - [x] Extend `chronicle-ui/src/api/template-editor-api.test.ts` for request-body composition and response typing.

- [x] Add template-import UX in Build page (AC: 1)
  - [x] Add import controls in `chronicle-ui/src/features/build/build-page.tsx` without disrupting existing edit/validate/preview/rollback/profile/export flows.
  - [x] Support selecting a local JSON bundle file and robust client-side parse/shape validation before API submission.
  - [x] Wire repository import path (`/editor/repository/import`) so imported templates become available in repository selection UI.
  - [x] Wire active-profile import path (`/editor/template/import`) for applying imported bundles directly to current profile when requested.
  - [x] Refresh relevant state after successful import (repository list and/or active template + versions metadata) and show clear success feedback.
  - [x] Show actionable error messaging for malformed JSON, API validation errors, and unsupported bundle shapes.

- [x] Preserve safety and regression guardrails while importing (AC: 1)
  - [x] Keep unsaved editor text untouched by failed imports.
  - [x] If active-profile import may overwrite in-progress edits, require explicit user confirmation when unsaved changes exist.
  - [x] Keep profile-scoped behavior consistent: active import respects currently selected profile unless explicit `profile_id` is provided.
  - [x] Keep in-flight disabling/stale-request protections used in prior Build actions.
  - [x] Keep existing save/validate/preview/rollback/export behavior unchanged.

- [x] Add telemetry around import interactions (AC: 1)
  - [x] Add timing metric for import orchestration (for example `template.import`) using existing timing utilities.
  - [x] If JSON parse/validation step is substantial, add timing metric for client parse (for example `template.import.parse`) using current metric style.
  - [x] Add deterministic test assertions for import timing thresholds in test runs where applicable.

- [x] Add focused automated coverage for import behavior (AC: 1)
  - [x] Add API client unit tests for import endpoint body composition and response handling.
  - [x] Add Build-page tests for successful repository import making templates available for selection.
  - [x] Add Build-page tests for successful active-profile import refreshing editor/template-version state.
  - [x] Add tests for malformed JSON and backend validation failures with actionable feedback.
  - [x] Add regression tests ensuring failed import does not mutate editor text, selected profile, or version-history state.

## Dev Notes

- Scope boundary for Story 2.7:
  - Include Build-page template bundle import UX and API integration.
  - Reuse existing backend import contracts; do not redesign endpoint shapes.
  - Do not implement profile YAML import/export in this story (Epic 3 / FR37).
- Epic 2 continuity:
  - Story 2.6 export now emits import-compatible per-template bundle files for repository multi-export.
  - Story 2.7 should support round-trip workflow for those exported JSON bundles.

### Technical Requirements

- Story requirement sources:
  - Epic AC for 2.7 requires imported templates to be added and selectable, with clear validation error surfaces.
  - PRD FR36 defines template import from bundle as a Phase-2 requirement.
- Existing backend contracts already available for import workflows:
  - `POST /editor/template/import`
    - Accepts either `bundle` object or direct request body fields as source payload.
    - Requires `template` string in resolved source payload.
    - Supports `context_mode`, `fixture_name`, `profile_id`, `author`, `source`, optional `name` and `notes`.
    - Validates template content and returns `status: error` + `validation` + `context_source` with 400 on failure.
    - Returns `status: ok` + `active` + `saved_version` on success.
  - `POST /editor/repository/import`
    - Requires `bundle` object containing `template`.
    - Supports `context_mode`, `fixture_name`, `author`, `source`, optional `name`.
    - Returns `status: ok` + `template_record` on success.
  - Related export contracts that produce input bundles:
    - `GET /editor/template/export`
    - `GET /editor/repository/template/<template_id>/export`
- Keep payload keys in `snake_case` when crossing API boundaries.
- Do not change endpoint paths, add `/api/v1`, or alter established response envelopes.

### Architecture Compliance

- Keep implementation scoped to existing architecture boundaries:
  - SPA/UI logic in `chronicle-ui/src/features/build/`.
  - Typed backend contract wrappers in `chronicle-ui/src/api/`.
  - Backend remains source of truth for template state and validation outcomes.
- Preserve feature-first frontend organization and avoid unrelated abstractions.
- Preserve backward compatibility of existing editor endpoints and tests.

### Library / Framework Requirements

- Stay on project-pinned stack:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- No dependency upgrades for Story 2.7 unless explicitly requested.
- Prefer existing browser APIs (`File`, `Blob`, `FileReader`) and project utilities before adding libraries.

### File Structure Requirements

- Expected files to modify:
  - `chronicle-ui/src/api/template-editor-api.ts`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
  - `chronicle-ui/src/features/build/build-page.tsx`
  - `chronicle-ui/src/features/build/build-page.test.tsx`
- Possible backend/test touchpoints only if contract gaps are discovered:
  - `tests/test_api_server.py`
  - `chronicle/api_server.py`

### Testing Requirements

- Direct AC validation:
  - Importing a valid bundle adds templates to an available selection path in Build.
  - Import failures surface validation and parse errors clearly.
- Regression validation:
  - Existing Story 2.1-2.6 behaviors remain stable (save, validate, preview, rollback, profile switch, export).
  - Failed imports do not wipe editor text or break working-profile context.
- Suggested verification commands:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `python3 -m unittest tests.test_api_server`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 2.6 established import-relevant patterns to preserve:
  - Exported repository bundles are downloaded as individual per-template files; each should be import-compatible.
  - Build page already uses clear success/error feedback and in-flight disabling for long-running actions.
  - Profile-scoped behavior and per-profile draft protections are critical guardrails.
  - Timing instrumentation follows `timeBuildOperation` + deterministic p95 assertions.
- Apply these patterns to import:
  - Keep import feedback actionable and non-destructive.
  - Keep active-profile import explicitly scoped and predictable.
  - Keep repository list refresh deterministic after successful repository import.

### Git Intelligence Summary

- Recent commits are documentation/housekeeping focused and do not supersede current Build/API conventions.
- Existing Epic 2 code style in Build/API/tests remains the primary implementation reference.

### Latest Tech Information

- Snapshot check (2026-02-27 via npm registry):
  - `react` latest 19.2.4 (project uses 19.2.0)
  - `react-router-dom` latest 7.13.1 (project uses 7.13.0)
  - `@mui/material` latest 7.3.8 (project uses 7.3.7)
  - `vite` latest 7.3.1 (project uses 7.2.6)
  - `vitest` latest 4.0.18 (project uses 3.2.4)
- Do not upgrade dependencies in Story 2.7.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Do not change endpoint paths or add `/api/v1`.
  - Keep backend as authoritative source for template/profile state.
  - Keep tests deterministic and free of live network dependencies.
  - Do not log secrets/tokens or add secret persistence.
  - Keep feature-first frontend structure.

### Story Completion Status

- Story context generation complete.
- Story status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/2-6-export-templates-for-sharing-phase-2.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/description_template.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/tests/test_api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/features/build/build-page.tsx]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/api/template-editor-api.ts]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Selected requested story key: `2-7-import-template-bundles-phase-2`.
- Loaded sprint tracking and planning artifacts (`epics`, `prd`, `architecture`, `ux`) plus project context.
- Reviewed previous Story 2.6 implementation and notes for continuity and regression guardrails.
- Analyzed backend import/export contracts and existing API tests.
- Analyzed current Build page import/export integration points and existing frontend test patterns.
- Updated sprint status for this story to `in-progress` at implementation start.
- Added failing-first API tests for `POST /editor/template/import` and `POST /editor/repository/import` wrappers.
- Added failing-first Build-page tests for repository import refresh, active-profile import, malformed JSON handling, validation failures, and import telemetry.
- Implemented typed import API contracts and wrappers in `template-editor-api.ts`.
- Implemented Build-page import controls, JSON parsing/shape checks, active/repository import orchestration, success/error feedback, and import in-flight guardrails.
- Added import telemetry metrics `template.import` and `template.import.parse` and deterministic p95 assertions in tests.
- Code review findings addressed:
  - Fixed import context coupling to preview mode by using deterministic import validation context (`sample` when fixtures exist, otherwise `latest`).
  - Fixed file-picker reselect bug by clearing file input value on click so the same file can be re-imported.
  - Fixed active/repository import post-success refresh handling to keep success state and show refresh-specific warnings when metadata/list reload fails.
- Added/updated tests for code-review fixes:
  - Active import metadata refresh failure keeps success feedback and imported editor content.
  - Repository import refresh failure keeps success feedback and warns user to reload.
  - Import uses deterministic sample context even when preview mode is switched to latest.
- Verification executed:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test`
  - `npm run build`
  - `python3 -m unittest tests.test_api_server`

### Completion Notes List

- Completed Story 2.7 import implementation for both active-profile and repository catalog flows in Build.
- Added typed frontend import request/response models and wrappers for `/editor/template/import` and `/editor/repository/import`.
- Added import controls with local JSON file selection, parse/shape validation, and actionable feedback for malformed bundles and backend validation errors.
- Preserved regression guardrails: failed imports keep unsaved editor text/profile state, active import requires overwrite confirmation on unsaved changes, and import actions respect in-flight disabling.
- Added import telemetry instrumentation (`template.import`, `template.import.parse`) and automated p95 threshold assertions.
- Validated full frontend regression suite, focused import tests, frontend production build, and backend API test module execution.
- Addressed code-review hardening issues around import context, import file re-selection reliability, and import-refresh resilience with additional automated coverage.

### File List

- chronicle-ui/src/api/template-editor-api.ts
- chronicle-ui/src/api/template-editor-api.test.ts
- chronicle-ui/src/features/build/build-page.tsx
- chronicle-ui/src/features/build/build-page.test.tsx
- _bmad-output/implementation-artifacts/2-7-import-template-bundles-phase-2.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-02-27: Created Story 2.7 with comprehensive context for template bundle import and set story status to ready-for-dev.
- 2026-02-27: Implemented Story 2.7 import flow (API wrappers + Build UX + telemetry + automated tests) and set story status to review.
- 2026-02-27: Applied code-review hardening fixes (deterministic import context, same-file re-import support, resilient success handling on refresh failures), expanded import tests, and set story status to done.
