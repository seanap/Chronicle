# Story 3.3: Preview Which Profile Applies to an Activity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to preview which profile applies to a given activity context,  
so that I can verify my rules are working.

## Acceptance Criteria

1. **Given** I have a sample or latest activity context  
   **When** I run a profile preview  
   **Then** the system shows which profile would apply  
   **And** I can see the matching criteria.

## Tasks / Subtasks

- [x] Add backend profile-preview API endpoint for context-based matching (AC: 1)
  - [x] In `chronicle/api_server.py`, add a dedicated endpoint for profile preview (for example `POST /editor/profiles/preview`) that accepts context mode inputs (`latest`, `sample`, `latest_or_sample`, `fixture`) and optional `fixture_name`.
  - [x] Reuse existing context resolution patterns (`_resolve_context_mode`, `_context_for_mode`) and return actionable errors for unsupported modes or missing context.
  - [x] Return matched profile details and match rationale in a stable `snake_case` JSON shape.

- [x] Reuse existing profile-selection heuristics without duplicating logic (AC: 1)
  - [x] Expose/compose existing profile matching logic from `chronicle/activity_pipeline.py` (currently `_select_activity_profile` and `_profile_match_reasons`) so API preview and pipeline behavior stay aligned.
  - [x] Ensure preview only considers enabled profiles and preserves deterministic priority ordering behavior established in Story 3.2.
  - [x] Include fallback behavior (`default`) when no non-default profile matches, with clear reason text.

- [x] Add Build UI profile-preview flow (AC: 1)
  - [x] In `chronicle-ui/src/features/build/build-page.tsx`, add a profile-preview control in the existing Profiles area, using current context mode + fixture choices from Build.
  - [x] Provide a clear trigger action (for example `Preview Matching Profile`) and display the matched profile and reasons/criteria in an accessible, scannable format.
  - [x] Preserve current Build workflows (template save/validate/preview/rollback/import/export/profile editing) and ensure no regressions in unsaved-draft handling.

- [x] Add frontend API wrapper + types for profile preview (AC: 1)
  - [x] In `chronicle-ui/src/api/template-editor-api.ts`, add typed request/response functions for the new profile preview endpoint.
  - [x] Keep API payload keys and response keys in `snake_case`.
  - [x] Add contract-level API wrapper tests in `chronicle-ui/src/api/template-editor-api.test.ts`.

- [x] Add/extend automated tests for backend + UI preview behavior (AC: 1)
  - [x] Add backend endpoint tests in `tests/test_api_server.py` for sample/latest context, fallback/default match behavior, disabled-profile exclusion, and malformed input handling.
  - [x] Add UI workflow coverage in `chronicle-ui/src/features/build/build-page.test.tsx` for successful profile preview rendering and error states.
  - [x] Verify existing Story 3.1 and 3.2 profile-management tests remain green.

## Dev Notes

- Scope boundary for Story 3.3:
  - Include profile applicability preview against sample/latest context.
  - Do not implement profile YAML import/export (Story 3.4).
  - Do not modify template repository semantics unless required for preview integration.
- Epic continuity:
  - Story 3.1 introduced profile create/edit.
  - Story 3.2 introduced enable/disable + priority and working-profile safety.
  - Story 3.3 extends observability of profile resolution behavior and must remain consistent with runtime selection logic.

### Technical Requirements

- Primary requirement source:
  - Epic 3 Story 3.3 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR12 in `_bmad-output/planning-artifacts/prd.md`: preview which profile applies to a given activity context.
- Existing backend capabilities to leverage:
  - `_context_for_mode(...)` and context-mode validation in `chronicle/api_server.py`.
  - Profile list and state controls in `chronicle/description_template.py` (`list_template_profiles`, enabled/priority/working profile behavior).
  - Profile matching heuristics in `chronicle/activity_pipeline.py` (`_profile_match_reasons`, `_select_activity_profile`).
- Required UX behavior:
  - Preview should clearly identify selected profile and why it matched.
  - Preview must support both latest and sample/fixture contexts.
  - Preview errors (missing context, invalid input) should be actionable and not erase current editor work.

### Architecture Compliance

- Keep architecture boundaries:
  - API orchestration in `chronicle/api_server.py`.
  - Profile matching/domain logic in pipeline/domain modules (avoid duplicating heuristics in API route code).
  - Build UI behavior in `chronicle-ui/src/features/build/`.
  - Frontend API contracts in `chronicle-ui/src/api/`.
- Keep endpoint/payload conventions:
  - Do not rename existing endpoints.
  - Keep new payload keys and response keys in `snake_case`.
- Preserve backend authority:
  - Backend remains the source of truth for profile resolution outcome.
  - UI renders backend result, not re-implementing matching heuristics client-side.

### Library / Framework Requirements

- Use currently pinned/selected stack in this repository:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.x
- Do not introduce new dependencies for Story 3.3 unless explicitly requested.

### File Structure Requirements

- Likely files to modify:
  - `chronicle/api_server.py`
  - `chronicle/activity_pipeline.py` (or nearest domain helper module exposing the same logic)
  - `tests/test_api_server.py`
  - `chronicle-ui/src/api/template-editor-api.ts`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
  - `chronicle-ui/src/features/build/build-page.tsx`
  - `chronicle-ui/src/features/build/build-page.test.tsx`

### Testing Requirements

- Acceptance coverage:
  - Latest-context preview returns a matched profile and matching criteria details.
  - Sample/fixture-context preview returns a matched profile and matching criteria details.
  - Disabled profiles are not selected in preview results.
  - Fallback default profile is returned when no enabled non-default profile matches.
- Regression coverage:
  - Existing Story 3.1 and Story 3.2 profile management behavior remains intact.
  - Build page template operations and profile switching continue to work.
- Suggested verification commands:
  - `npm run test -- src/features/build/build-page.test.tsx src/api/template-editor-api.test.ts`
  - `npm run test`
  - `./.venv/bin/python -m unittest tests.test_api_server`

### Previous Story Intelligence

- From Story 3.2 implementation and hardening:
  - Preserve backend fallback semantics when selected/working profile becomes disabled.
  - Keep profile operations and feedback explicit in Build UI; avoid hidden state changes.
  - Keep success/error messaging robust even when refresh calls fail after successful operations.
  - Ensure template actions continue using the active fallback profile path where required.

### Git Intelligence Summary

- Last 5 commits are primarily repo/docs housekeeping; no recent runtime changes alter profile-matching architecture.
- Story 3.3 should follow existing code conventions from Stories 3.1/3.2 and avoid introducing parallel matching implementations.

### Latest Tech Information

- Snapshot check (2026-03-03 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
- Story 3.3 should not upgrade dependencies; implement on current project versions unless separately scoped.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Keep API response shapes stable and `snake_case`.
  - Do not change endpoint paths or add `/api/v1` prefixes.
  - Backend is source of truth for authoritative decisions.
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
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/3-2-enable-disable-profiles-and-set-priority.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/activity_pipeline.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/description_template.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/features/build/build-page.tsx]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/api/template-editor-api.ts]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `3.3`.
- Parsed Epic 3 Story 3.3 acceptance criteria from planning artifacts.
- Cross-checked Story 3.2 completion artifact for continuity constraints.
- Reviewed current backend context resolution and profile endpoints.
- Reviewed existing profile matching heuristics and Build page profile UX/state patterns.
- Added backend profile preview route: `POST /editor/profiles/preview`.
- Added `preview_profile_match(...)` in `chronicle/activity_pipeline.py` to reuse runtime matching heuristics for preview.
- Added frontend API wrapper: `previewEditorProfile(...)` with typed request/response contracts.
- Added Build profile-match preview controls and result panel in the Profiles section.
- Verification commands executed:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_api_server`

### Completion Notes List

- Created Story 3.3 implementation artifact with comprehensive context and clear file-level implementation targets.
- Added explicit guardrails to keep matching logic centralized and avoid frontend/backend divergence.
- Included focused regression expectations for Story 3.1 and Story 3.2 behaviors.
- Implemented backend profile preview API route with context-mode support and error handling for missing latest context.
- Implemented shared profile-match preview helper that composes existing `_select_activity_profile` logic and returns criteria/reasons.
- Implemented Build UI flow for "Preview Matching Profile" including contextual reasons and criteria rendering.
- Added backend, frontend API contract, and Build UI tests for Story 3.3 profile preview behavior.
- Validation results:
  - Frontend targeted tests: 86 passed
  - Frontend full suite: 146 passed
  - Frontend build: passed
  - Backend API tests: 79 passed
- Code review outcome: no remaining HIGH/MEDIUM issues identified; acceptance criteria verified against implementation and tests.

### File List

- chronicle/activity_pipeline.py
- chronicle/api_server.py
- tests/test_api_server.py
- chronicle-ui/src/api/template-editor-api.ts
- chronicle-ui/src/api/template-editor-api.test.ts
- chronicle-ui/src/features/build/build-page.tsx
- chronicle-ui/src/features/build/build-page.test.tsx
- _bmad-output/implementation-artifacts/3-3-preview-which-profile-applies-to-an-activity.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-03-03: Created Story 3.3 with comprehensive context and set status to ready-for-dev.
- 2026-03-03: Implemented Story 3.3 profile-match preview API/UI/tests and set status to review.
- 2026-03-03: Completed code review for Story 3.3 and set status to done.
