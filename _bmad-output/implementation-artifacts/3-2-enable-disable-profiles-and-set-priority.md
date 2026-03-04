# Story 3.2: Enable/Disable Profiles and Set Priority

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to enable/disable profiles and set their priority,  
so that the correct profile is selected for an activity.

## Acceptance Criteria

1. **Given** I have multiple profiles  
   **When** I toggle a profile on/off or change its priority  
   **Then** the profile list reflects the new enabled state and ordering  
   **And** only enabled profiles are considered active.

## Tasks / Subtasks

- [x] Add profile-state controls to Build UI (AC: 1)
  - [x] In `chronicle-ui/src/features/build/build-page.tsx`, add explicit controls for selected profile `enabled` state and `priority` value.
  - [x] Keep default/locked profile guardrails in UI (cannot disable default; priority remains fixed for locked profile).
  - [x] Ensure controls are keyboard accessible and readable in the existing MUI form layout.

- [x] Wire profile-state controls to existing backend update contract (AC: 1)
  - [x] Use `updateEditorProfile(profileId, { enabled, priority })` in `chronicle-ui/src/api/template-editor-api.ts` consumer flow.
  - [x] Preserve current feedback patterns: inline actionable success/error messages and no stale success masking reload failures.
  - [x] Reload profile/template state after updates so list ordering and working-profile metadata are consistent with persisted backend state.

- [x] Enforce active-profile behavior and working-profile safety (AC: 1)
  - [x] Ensure disabled profiles cannot be selected as working profile in the dropdown.
  - [x] If the current working profile is disabled, verify UI reflects backend fallback to `default`.
  - [x] Keep template draft behavior stable across profile refreshes and profile switching.

- [x] Add/extend automated coverage for profile enable/disable + priority flows (AC: 1)
  - [x] Extend `chronicle-ui/src/features/build/build-page.test.tsx` with cases for toggling enabled state and changing priority.
  - [x] Add assertions that profile ordering updates after priority changes (highest priority first, then label).
  - [x] Add regression tests for disabled-profile working selection and default-profile guardrails.
  - [x] Extend `chronicle-ui/src/api/template-editor-api.test.ts` to verify enabled/priority payload wiring.

- [x] Harden backend/API tests where needed (AC: 1)
  - [x] Extend `tests/test_api_server.py` for profile priority ordering and disable behavior to ensure API contract remains deterministic.
  - [x] Verify failed/invalid updates do not partially persist profile data.

## Dev Notes

- Scope boundary for Story 3.2:
  - Include enable/disable and priority management UX and API contract usage for profiles.
  - Do not implement profile applicability preview (Story 3.3).
  - Do not implement profile YAML import/export (Story 3.4).
- Epic continuity:
  - Story 2.5 introduced working-profile selection in Build.
  - Story 3.1 introduced profile create/edit for label + criteria.
  - Story 3.2 should extend profile management without regressing Story 2.x template flows or Story 3.1 create/edit behavior.

### Technical Requirements

- Primary requirement source:
  - Epic 3 Story 3.2 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR11 in `_bmad-output/planning-artifacts/prd.md`: users can enable/disable profiles and set priority.
- Existing backend capabilities to leverage:
  - `PUT /editor/profiles/<profile_id>` already parses and applies `enabled` and `priority`.
  - `list_template_profiles(...)` sorts deterministic output by `priority desc, label asc`.
  - Disabling the current working profile falls back `working_profile_id` to default.
- Required UX behavior:
  - Profile-state updates must be explicit and easy to apply from Build.
  - Disabled profiles remain visible but clearly marked non-active/non-selectable.
  - Ordering changes from priority updates must be visible after refresh.
- Validation and persistence behavior:
  - Invalid values (for example non-integer priority) must show actionable guidance.
  - Failed updates must not partially mutate profile persistence.

### Architecture Compliance

- Keep architecture boundaries:
  - Backend profile logic in `chronicle/description_template.py`.
  - API orchestration in `chronicle/api_server.py`.
  - Build UI behavior in `chronicle-ui/src/features/build/`.
  - Frontend API contracts in `chronicle-ui/src/api/`.
- Keep endpoint and payload conventions:
  - No endpoint renames or `/api/v1` prefix.
  - Continue `snake_case` API payload keys.
- Preserve backend authority:
  - Frontend displays and edits profile state, but backend remains source of truth for enabled/priority/working-profile resolution.

### Library / Framework Requirements

- Use currently pinned/selected stack in this repository:
  - React 19.2.x
  - React Router 7.13.x
  - MUI 7.3.x
  - Vite 7.2.x
  - Vitest 3.2.x
- Do not introduce new dependencies for Story 3.2 unless explicitly requested.

### File Structure Requirements

- Likely files to modify:
  - `chronicle-ui/src/features/build/build-page.tsx`
  - `chronicle-ui/src/features/build/build-page.test.tsx`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
  - `tests/test_api_server.py`
- Backend code changes in `chronicle/api_server.py` or `chronicle/description_template.py` should be minimal and only if tests reveal behavior gaps.

### Testing Requirements

- Acceptance coverage:
  - Update profile enabled state from UI and verify disabled profiles are marked and not considered active.
  - Update profile priority and verify list order reflects priority sorting.
  - Confirm only enabled profiles are selectable as working profile.
- Regression coverage:
  - Existing template flows (save, validate, preview, rollback, import/export) remain stable after profile-state changes.
  - Story 3.1 profile create/edit flows remain intact.
  - Default profile guardrails remain enforced.
- Suggested verification commands:
  - `npm run test -- src/features/build/build-page.test.tsx src/api/template-editor-api.test.ts`
  - `npm run test`
  - `npm run build`
  - `python3 -m unittest tests.test_api_server`

### Previous Story Intelligence

- From Story 3.1 implementation and hardening:
  - Keep profile feedback resilient when post-save refresh fails (success should not be hidden by refresh error).
  - Keep profile management controls discoverable in the Build page (explicit Profiles section context).
  - Preserve JSON criteria validation quality and actionable inline messaging.
  - Reuse existing profile API wrappers and avoid introducing parallel code paths.

### Git Intelligence Summary

- Last 5 commits are documentation/repo housekeeping updates and do not change runtime profile architecture.
- No recent commit introduces conflicting implementation patterns for profile-state handling; Story 3.2 should follow current Story 3.1 code conventions.

### Latest Tech Information

- Snapshot check (2026-03-03 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- Story 3.2 should not upgrade dependencies; implement on current project versions unless separately scoped.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Keep backend as source of truth.
  - Keep API shapes stable and `snake_case`.
  - Do not change endpoint paths.
  - Do not introduce auth/CSRF for local-only flow.
  - Keep tests deterministic and avoid live network behavior.

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
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/3-1-create-and-edit-activity-classification-profiles.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/description_template.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/features/build/build-page.tsx]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/api/template-editor-api.ts]
- [Source: /home/shipyard/src/Auto-Stat-Description/tests/test_api_server.py]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Auto-discovered next backlog story from sprint status: `3-2-enable-disable-profiles-and-set-priority`.
- Analyzed full planning artifacts (`epics.md`, `prd.md`, `architecture.md`, `ux-design-specification.md`) and project context.
- Reviewed Story 3.1 implementation artifact for continuity and guardrails.
- Reviewed current backend/frontend code paths for profile update and working-profile behavior.
- Added failing-first tests for:
  - frontend profile enabled/priority payload wiring and Build UI behavior
  - backend profile priority ordering and invalid-priority no-partial-write behavior
- Implemented Build profile editor controls for:
  - `Edit Profile Enabled` (enabled/disabled)
  - `Edit Profile Priority` (integer)
- Updated profile refresh behavior so working-profile status reflects backend fallback when a selected profile becomes disabled.
- Code review auto-fix pass corrected template action routing so save/validate/preview/rollback/import/export use active working-profile fallback when selected profile is disabled.
- Added regression assertion that save payload uses fallback active profile after disabling selected profile.
- Verification commands executed:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test`
  - `./.venv/bin/python -m unittest tests.test_api_server`

### Completion Notes List

- Added explicit profile-state edit controls in Build for enabled/disabled and priority updates.
- Kept default-profile guardrails enforced by disabling profile-state edit controls for locked/default profile.
- Updated profile update flow to send `enabled` + `priority` with label/criteria and validate priority input as integer before save.
- Ensured working-profile indicator reflects backend `working_profile_id` fallback after disabling the previously active profile.
- Added/updated automated coverage:
  - `chronicle-ui/src/features/build/build-page.test.tsx`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
  - `tests/test_api_server.py`
- Validation results:
  - Frontend tests: 143 passed
  - Backend API tests: 76 passed (`./.venv/bin/python -m unittest tests.test_api_server`)

### File List

- chronicle-ui/src/features/build/build-page.tsx
- chronicle-ui/src/features/build/build-page.test.tsx
- chronicle-ui/src/api/template-editor-api.test.ts
- tests/test_api_server.py
- _bmad-output/implementation-artifacts/3-2-enable-disable-profiles-and-set-priority.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-03-03: Created Story 3.2 with comprehensive context and set status to ready-for-dev.
- 2026-03-03: Implemented Story 3.2 profile enabled/disabled + priority management in Build UI, expanded automated tests, and set status to review.
- 2026-03-03: Per code-review auto-fix, routed template actions to active fallback profile when selected profile is disabled, tightened regression coverage, hardened backend test assertion shape handling, and set status to done.
