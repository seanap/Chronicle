# Story 2.6: Export Templates for Sharing (Phase-2)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to export templates for sharing,  
so that I can reuse them or share with others.

## Acceptance Criteria

1. **Given** I have saved templates  
   **When** I choose export  
   **Then** I receive a downloadable template bundle  
   **And** it includes all selected templates.

## Tasks / Subtasks

- [x] Add export-focused API wrappers for Build usage (AC: 1)
  - [x] Extend `chronicle-ui/src/api/template-editor-api.ts` with typed wrappers for `GET /editor/template/export`.
  - [x] Support query parameters used by backend contract: `profile_id`, `template_id`, `include_versions`, `limit`.
  - [x] Add typed response models for export payload fields (`bundle_version`, `exported_at_utc`, `template`, `name`, metadata fields, optional versions).
  - [x] Add or extend wrappers for repository discovery/export used by selection UX (`GET /editor/repository/templates`, `GET /editor/repository/template/<template_id>/export`) if selection requires repository template ids.
  - [x] Extend `chronicle-ui/src/api/template-editor-api.test.ts` to validate query encoding and payload typing.

- [x] Add template-export UX in Build page (AC: 1)
  - [x] Add export controls in `chronicle-ui/src/features/build/build-page.tsx` without disrupting existing edit/validate/preview/rollback/profile flows.
  - [x] Wire export action to selected profile context by default (`profile_id` from current working profile).
  - [x] Add clear selection affordance for what will be exported (active template and, if implemented, repository-selected template).
  - [x] Convert API payload to downloadable JSON bundle client-side (for example, Blob + object URL + filename convention).
  - [x] Show clear success/error feedback for export operations and avoid destructive side effects on editor state.

- [x] Preserve safety and regression guardrails while exporting (AC: 1)
  - [x] Keep unsaved editor text untouched by export actions.
  - [x] Keep stale-request protections and in-flight button disabling patterns used in prior stories.
  - [x] Keep profile-scoped behavior consistent: export reflects currently selected profile unless explicit repository template id is selected.
  - [x] Keep existing validation/preview/rollback behavior unchanged.

- [x] Add telemetry around export interactions (AC: 1)
  - [x] Add timing metric for export flow orchestration (for example `template.export`) using existing timing utilities.
  - [x] If repository template selection is added, add timing metric for repository template list loading (for example `template.repository.list.load`).
  - [x] Assert export timing remains within sub-second thresholds in test runs where applicable.

- [x] Add focused automated coverage for export behavior (AC: 1)
  - [x] Add API client unit tests for export endpoint query composition and response handling.
  - [x] Add Build-page tests for successful export triggering download behavior with expected payload fields.
  - [x] Add tests for export failure surfaces (network/API validation errors) with actionable messaging.
  - [x] Add regression tests ensuring export does not mutate editor text, selected profile, or version-history state.

## Dev Notes

- Scope boundary for Story 2.6:
  - Include Build-page export UX and API integration for template bundle download.
  - Do not implement import flow (Story 2.7) in this story.
  - Do not implement profile YAML import/export (Epic 3 / FR37) in this story.
- Epic 2 continuity:
  - Story 2.1 established editor save flow.
  - Story 2.2 added validate-before-save + Jinja hints guardrails.
  - Story 2.3 added preview contexts and stale preview protections.
  - Story 2.4 added version history + rollback with refresh-confirmed success.
  - Story 2.5 added profile-scoped editing and per-profile draft retention.
  - Story 2.6 must layer export functionality on top of these behaviors without regression.

### Technical Requirements

- Story requirement sources:
  - Epic AC for 2.6 requires downloadable bundle export for selected template context.
  - PRD FR35 defines template export for sharing as a Phase-2 requirement.
- Existing backend contracts already available for export workflows:
  - `GET /editor/template/export`
    - Optional query parameters: `profile_id`, `template_id`, `include_versions`, `limit`.
    - Active-template export path returns `bundle_version` (v1 shape), `exported_at_utc`, `profile_id`, `template`, `name`, metadata fields, optional versions.
    - Repository-template export path (when `template_id` supplied) returns repository bundle payload (`bundle_version` v2 shape).
  - `GET /editor/repository/templates` returns repository template list for selection UI.
  - `GET /editor/repository/template/<template_id>/export` exports a repository template bundle directly.
- Keep payload keys in `snake_case` when crossing API boundaries.
- Do not change endpoint paths, add `/api/v1`, or alter established response envelopes.

### Architecture Compliance

- Keep implementation scoped to existing architecture boundaries:
  - SPA/UI logic in `chronicle-ui/src/features/build/`.
  - Typed backend contract wrappers in `chronicle-ui/src/api/`.
  - Backend remains source of truth; frontend only orchestrates selection and download formatting.
- Preserve feature-first frontend organization and avoid introducing unrelated abstractions.
- Preserve backward compatibility of existing editor endpoints and tests.

### Library / Framework Requirements

- Stay on project-pinned stack:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- No dependency additions required for Story 2.6.
- Use existing browser APIs (`Blob`, `URL.createObjectURL`) for download behavior.

### File Structure Requirements

- Expected files to modify:
  - `chronicle-ui/src/api/template-editor-api.ts`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
  - `chronicle-ui/src/features/build/build-page.tsx`
  - `chronicle-ui/src/features/build/build-page.test.tsx`
- Possible additional frontend helper updates:
  - `chronicle-ui/src/features/build/template-editor-timing.ts` (metric additions if needed)
- Backend code changes are not required unless a contract gap is discovered during implementation.

### Testing Requirements

- Direct AC validation:
  - Export action returns downloadable bundle data for selected template context.
  - Export result includes expected core payload fields (`bundle_version`, `exported_at_utc`, template payload fields).
  - Export is user-visible and non-destructive to current editing state.
- Regression validation:
  - Existing Story 2.1-2.5 flows remain passing (save, validate, preview, rollback, profile switching).
  - Export failures present actionable messages and do not clear editor text.
- Suggested verification commands:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 2.5 established critical patterns to preserve:
  - Profile-scoped API usage for template read/write/version workflows.
  - Per-profile unsaved draft retention in Build state.
  - Explicit, user-visible error messaging for profile load/switch failures.
  - Timing instrumentation with p95 assertions in tests.
- Apply these patterns to export:
  - Export should use current selected profile context by default.
  - Export should not discard local drafts or reset selected profile.
  - Export telemetry should follow the existing metric style and deterministic test patterns.

### Git Intelligence Summary

- Recent commits are documentation and housekeeping focused, with no newer implementation pattern overriding existing Build/API conventions.
- Existing Epic 2 code style in Build/API/tests remains the primary implementation reference for this story.

### Latest Tech Information

- Snapshot check (2026-02-27 via npm registry):
  - `react` latest 19.2.4 (project uses 19.2.0)
  - `react-router-dom` latest 7.13.1 (project uses 7.13.0)
  - `@mui/material` latest 7.3.8 (project uses 7.3.7)
  - `vite` latest 7.3.1 (project uses 7.2.6)
  - `vitest` latest 4.0.18 (project uses 3.2.4)
- Do not upgrade dependencies in Story 2.6.

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
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/2-5-select-profile-for-template-editing.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/description_template.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/tests/test_api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/features/build/build-page.tsx]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/api/template-editor-api.ts]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Auto-selected next backlog story from sprint order: `2-6-export-templates-for-sharing-phase-2`.
- Loaded planning artifacts (`epics`, `prd`, `architecture`, `ux`) and project context.
- Reviewed previous Story 2.5 context for continuity and regression guardrails.
- Analyzed backend export/import contracts in `chronicle/api_server.py` and `chronicle/description_template.py`.
- Confirmed existing backend test coverage and payload expectations for template export/import endpoints.
- Analyzed current Build page and API client/test files to identify required integration points.
- Captured latest package-version snapshot from npm registry for dependency guardrails.
- Updated sprint status for this story to `in-progress` at implementation start.
- Added failing-first API tests for export wrappers and Build-page export behavior.
- Implemented typed export/repository API wrappers and query encoding.
- Implemented Build-page export state/UX, repository template selection, client-side JSON download, and export feedback.
- Added export telemetry (`template.export`) and repository list telemetry (`template.repository.list.load`) in Build flow.
- Added automated coverage for active export, repository export, telemetry, and no-state-mutation regression behavior.
- Verification executed:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Completed Story 2.6 implementation for template export from Build, including active-profile and repository-based export sources.
- Added typed frontend API support for template export and repository template listing/export.
- Added client-side bundle download behavior with success/error feedback and no destructive impact on unsaved edits/profile context.
- Added export-related telemetry and threshold assertions in automated tests.
- Validated full frontend regression suite and production build with all tests passing.
- Addressed code-review findings by hardening repository export API input validation, making multi-template repository export emit per-template import-compatible bundles, and adding explicit export payload/error-path coverage in tests.
- Re-ran focused frontend tests and production build after review fixes.

### File List

- chronicle-ui/src/api/template-editor-api.ts
- chronicle-ui/src/api/template-editor-api.test.ts
- chronicle-ui/src/features/build/build-page.tsx
- chronicle-ui/src/features/build/build-page.test.tsx
- _bmad-output/implementation-artifacts/2-6-export-templates-for-sharing-phase-2.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-02-27: Created Story 2.6 with comprehensive context for template bundle export and set story status to ready-for-dev.
- 2026-02-27: Implemented Story 2.6 export flow (API wrappers + Build UX + telemetry + automated tests) and set story status to review.
- 2026-02-27: Applied code-review hardening fixes, expanded export coverage, and set story status to done.
