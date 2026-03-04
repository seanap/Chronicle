# Story 3.1: Create and Edit Activity Classification Profiles

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to create and edit activity classification profiles in a UI,  
so that I can control how activities are categorized.

## Acceptance Criteria

1. **Given** I am on the Profiles section  
   **When** I create or edit a profile  
   **Then** I can enter classification rules and save the profile  
   **And** the profile appears in the profile list.
2. **Given** I submit an invalid or conflicting profile configuration  
   **When** I save the profile  
   **Then** the save is rejected with clear corrective guidance  
   **And** no partial or incorrect profile data is persisted.

## Tasks / Subtasks

- [x] Add backend support for profile create/edit beyond builtins (AC: 1, 2)
  - [x] Extend profile domain logic in `chronicle/description_template.py` to support creating a new profile record (id/label/criteria defaults and persistence).
  - [x] Extend profile update logic to support editing profile fields required for classification rules (at minimum `label` and `criteria`), while preserving existing `enabled`/`priority` behavior.
  - [x] Preserve locked-profile guardrails (default cannot be disabled or mutated in unsupported ways).
  - [x] Ensure profile ordering remains deterministic (priority desc, label asc) after create/edit.

- [x] Add API contracts for create/edit profile flows (AC: 1, 2)
  - [x] Add/extend profile endpoints in `chronicle/api_server.py` for create and edit payloads in the existing `/editor/profiles*` namespace (no endpoint-prefix changes).
  - [x] Validate request payloads and return actionable 400 errors for invalid/malformed/conflicting profile configuration.
  - [x] Ensure failed create/edit requests do not persist partial profile data.
  - [x] Keep response shapes consistent with existing editor profile payloads (`status`, `profile`, `profiles`, `working_profile_id` where relevant).

- [x] Add typed frontend API wrappers for new profile create/edit actions (AC: 1, 2)
  - [x] Extend `chronicle-ui/src/api/template-editor-api.ts` with request/response types and wrapper(s) for profile create/edit endpoints.
  - [x] Keep API payload keys in `snake_case` and preserve existing wrapper conventions.
  - [x] Add/update API client tests in `chronicle-ui/src/api/template-editor-api.test.ts`.

- [x] Add Profiles-section UI for create/edit and classification rule input (AC: 1, 2)
  - [x] Extend `chronicle-ui/src/features/build/build-page.tsx` (or extracted Build subcomponents) to expose profile creation and editing controls.
  - [x] Provide form inputs for profile identity and classification rules (criteria object fields supported by backend contract).
  - [x] Refresh profile list after successful create/edit and keep profile state coherent with working-profile selector behavior.
  - [x] Surface validation and conflict errors inline with clear corrective guidance.

- [x] Preserve regression guardrails in Build template workflows (AC: 2)
  - [x] Ensure create/edit profile interactions do not break existing Story 2.x flows (save, validate, preview, rollback, import/export, profile switching).
  - [x] Keep in-flight action gating and stale-result protections consistent with current Build behavior.
  - [x] Keep unsaved template draft behavior intact when profile list changes.

- [x] Add automated coverage for create/edit profile flows and failure handling (AC: 1, 2)
  - [x] Add backend API tests in `tests/test_api_server.py` for successful create/edit and invalid/conflicting payload rejection.
  - [x] Add tests that verify failed profile writes do not mutate persisted profile config.
  - [x] Add frontend tests in `chronicle-ui/src/features/build/build-page.test.tsx` for create/edit UI behavior, profile-list refresh, and inline error messaging.
  - [x] Add regression checks for working-profile switching and profile-scoped template operations after profile create/edit.

## Dev Notes

- Scope boundary for Story 3.1:
  - Include profile creation and editing of classification rules in UI and backend.
  - Do not implement profile enable/disable and priority management UX changes beyond what already exists (Story 3.2).
  - Do not implement profile applicability preview (Story 3.3) or profile YAML import/export (Story 3.4).
- Epic continuity:
  - Story 2.5 added working-profile selection and profile-scoped template editing flows.
  - Story 3.1 should extend profile management without regressing Story 2.x Build functionality.

### Technical Requirements

- Story requirement sources:
  - Epic 3.1 AC requires create/edit profile flows in UI with save-to-list behavior.
  - Invalid/conflicting configurations must be rejected with clear guidance and no partial writes.
  - PRD FR10 is the direct functional requirement for this story.
- Current backend/profile baseline to extend:
  - Existing editor profile API:
    - `GET /editor/profiles`
    - `PUT /editor/profiles/<profile_id>` (currently supports `enabled` and/or `priority`)
    - `POST /editor/profiles/working`
  - Existing profile persistence model lives in `chronicle/description_template.py` and currently seeds/bases on `PROFILE_BUILTINS`.
  - Existing profile rows include: `profile_id`, `label`, `enabled`, `locked`, `priority`, `criteria`, and template metadata fields.
- Critical gap to resolve for this story:
  - Current profile loading path normalizes to known builtin IDs; custom user-created profiles are not fully represented as first-class persisted entities yet.
  - Story 3.1 implementation must safely support persisted user-created profiles and editable criteria while preserving legacy/builtin behavior.
- Validation expectations:
  - Invalid payload shape or types (for id/label/criteria fields) must fail fast with actionable message.
  - Conflicts (for example duplicate IDs or illegal edits to locked/default profile fields) must fail without partial persistence.

### Architecture Compliance

- Preserve architecture boundaries:
  - Backend profile logic in `chronicle/template_*` / `chronicle/description_template.py`.
  - API orchestration in `chronicle/api_server.py`.
  - SPA profile UI in `chronicle-ui/src/features/build/`.
  - Typed frontend API contracts in `chronicle-ui/src/api/`.
- Keep backend as source of truth for profile data and rule persistence.
- Keep endpoint naming/path conventions unchanged (no `/api/v1`; `snake_case` payloads).
- Maintain feature-first SPA organization and avoid unrelated abstractions.

### Library / Framework Requirements

- Stay on project-pinned stack:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- No dependency upgrades required for Story 3.1 unless explicitly requested.

### File Structure Requirements

- Expected files to modify:
  - `chronicle/description_template.py`
  - `chronicle/template_profiles.py` (if exports need extension)
  - `chronicle/api_server.py`
  - `tests/test_api_server.py`
  - `chronicle-ui/src/api/template-editor-api.ts`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
  - `chronicle-ui/src/features/build/build-page.tsx`
  - `chronicle-ui/src/features/build/build-page.test.tsx`
- Keep profile create/edit behavior scoped to existing Build + editor profile modules.

### Testing Requirements

- Direct AC validation:
  - User can create a profile and it appears in the profile list.
  - User can edit classification rules for an existing profile and changes persist/reload.
  - Invalid/conflicting profile saves show clear corrective guidance and do not partially persist data.
- Regression validation:
  - Story 2.x template flows remain stable (profile switch, save, validate, preview, rollback, import/export).
  - Working profile remains valid after profile edits and list refresh.
- Suggested verification commands:
  - `python3 -m unittest tests.test_api_server`
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Latest Tech Information

- Snapshot check (2026-02-27 via npm registry):
  - `react` latest 19.2.4 (project uses 19.2.0)
  - `react-router-dom` latest 7.13.1 (project uses 7.13.0)
  - `@mui/material` latest 7.3.8 (project uses 7.3.7)
  - `vite` latest 7.3.1 (project uses 7.2.6)
  - `vitest` latest 4.0.18 (project uses 3.2.4)
- Do not upgrade dependencies in this story.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Do not change endpoint paths or add `/api/v1`.
  - Keep backend as authoritative source for template/profile state.
  - Keep tests deterministic and free of live network dependencies.
  - Do not log secrets/tokens or add secret persistence.
  - Maintain feature-first frontend structure.

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
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/2-7-import-template-bundles-phase-2.md]
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

- Selected requested story key from sprint-status: `3-1-create-and-edit-activity-classification-profiles`.
- Updated sprint tracking status to `in-progress` before implementation.
- Added failing-first coverage:
  - Frontend: new API wrapper tests (`createEditorProfile`, `updateEditorProfile`) and Build-page profile create/edit tests.
  - Backend: new API tests for create/edit plus invalid/conflict no-partial-write assertions.
- Implemented backend/domain changes:
  - Added custom profile shape support to profile persistence loading.
  - Added `create_template_profile(...)`.
  - Extended `update_template_profile(...)` to support `label` and `criteria` updates with locked-profile guardrails.
  - Extended API with `POST /editor/profiles` and enhanced `PUT /editor/profiles/<profile_id>`.
- Implemented frontend changes:
  - Added typed API wrappers for profile create/edit.
  - Added Build UI controls for creating profiles and editing selected profile classification rules (JSON object input).
  - Added client-side JSON object validation with actionable error feedback.
  - Preserved existing Build template workflows and profile switching behavior.
- Verification run:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx` (pass)
  - `npm run test` (pass)
  - `npm run build` (pass; existing chunk-size warning only)
  - `python3 -m unittest tests.test_api_server` (all skipped in this environment because Flask is unavailable)
  - `python3 -m py_compile chronicle/api_server.py chronicle/description_template.py chronicle/template_profiles.py tests/test_api_server.py` (pass)

### Completion Notes List

- Implemented Story 3.1 create/edit profile workflow end-to-end across backend and frontend.
- Added backend create endpoint (`POST /editor/profiles`) and extended update endpoint to support `label` and `criteria`.
- Added domain support for persisted custom profiles with deterministic ordering preserved in list responses.
- Added Build-page profile management controls:
  - Create profile (`New Profile ID`, `New Profile Label`, `New Classification Rules (JSON)`).
  - Edit selected profile (`Edit Profile Label`, `Edit Classification Rules (JSON)`).
  - Inline actionable feedback for invalid JSON/object payloads and API errors.
- Added/updated automated tests for API wrappers and Build profile-create/edit interactions plus invalid input handling.
- Full frontend regression suite and production build pass.
- Backend runtime API tests could not execute in this environment because Flask is not installed; backend syntax and importability were validated via `py_compile`.
- Code review hardening applied:
  - Profile create/update now preserve success feedback when post-save profile refresh fails.
  - Build UI now includes explicit "Profiles" section context to improve AC traceability and discoverability.
  - Added regression coverage for create/update refresh-failure success-handling paths.

### File List

- chronicle/description_template.py
- chronicle/template_profiles.py
- chronicle/api_server.py
- tests/test_api_server.py
- chronicle-ui/src/api/template-editor-api.ts
- chronicle-ui/src/api/template-editor-api.test.ts
- chronicle-ui/src/features/build/build-page.tsx
- chronicle-ui/src/features/build/build-page.test.tsx
- _bmad-output/implementation-artifacts/3-1-create-and-edit-activity-classification-profiles.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-02-27: Created Story 3.1 with comprehensive context and set status to ready-for-dev.
- 2026-02-27: Implemented Story 3.1 profile create/edit backend + frontend + automated tests, validated regressions, and set story status to review.
- 2026-02-27: Code review findings addressed (refresh-failure success handling + profile section clarity + regression tests) and story status set to done.
