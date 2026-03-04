# Story 2.5: Select Profile for Template Editing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to select a working profile while editing templates,  
so that I can target the right activity classification.

## Acceptance Criteria

1. **Given** I am editing a template  
   **When** I choose a profile from a list  
   **Then** the template editor reflects the selected profile context  
   **And** I can switch profiles without losing my edits.  
   **And** the profile-switch flow can be completed in <= 3 steps and <= 60 seconds under normal load (FR29)  
   **And** profile-switch interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30)

## Tasks / Subtasks

- [x] Add profile-selection API wrappers for Build page usage (AC: 1)
  - [x] Extend `chronicle-ui/src/api/template-editor-api.ts` with `getEditorProfiles(...)` for `GET /editor/profiles`.
  - [x] Add typed response models for profile list payload (`working_profile_id`, `profiles[]`, and profile metadata fields used by UI).
  - [x] Add `setEditorWorkingProfile(...)` wrapper for `POST /editor/profiles/working` with typed request/response.
  - [x] Extend `chronicle-ui/src/api/template-editor-api.test.ts` to cover request/response behavior for both profile endpoints.

- [x] Add working-profile selector UX to Build page (AC: 1)
  - [x] Update `chronicle-ui/src/features/build/build-page.tsx` to load profile metadata and render a working-profile selector.
  - [x] On profile change, call `POST /editor/profiles/working` and refresh profile-scoped template data using selected `profile_id`.
  - [x] Ensure template load and version-history load use selected profile context (`GET /editor/template?profile_id=...`, `GET /editor/template/versions?profile_id=...`).
  - [x] Keep active profile context visible in UI (selector value + profile label in editor metadata text).
  - [x] Show clear, actionable feedback for profile-load or profile-switch failures.

- [x] Preserve unsaved-edit safety while switching profiles (AC: 1)
  - [x] Keep unsaved editor text per profile in local Build-page state so switching profiles does not discard local edits.
  - [x] Restore per-profile draft text when user switches back to a previously edited profile.
  - [x] Avoid accidental cross-profile overwrite by ensuring save/validate/preview/rollback always use current selected `profile_id`.
  - [x] Keep Story 2.1/2.2/2.3/2.4 guardrails intact (stale request protection, rollback confirmation, action disabling during in-flight operations).

- [x] Extend telemetry for profile-selection interactions (AC: 1)
  - [x] Add timing around profile list load (for example `template.profiles.load`) in `chronicle-ui/src/features/build/template-editor-timing.ts` usage.
  - [x] Add timing around profile switch orchestration (for example `template.profile.switch`) including working-profile update + template refresh.
  - [x] Assert profile-switch telemetry meets <1s p95 in test runs.

- [x] Add focused automated coverage for profile-selection behavior and regressions (AC: 1)
  - [x] Extend `chronicle-ui/src/features/build/build-page.test.tsx` for profile selector rendering and initial working-profile selection.
  - [x] Add tests for successful profile switch and refreshed template/version context.
  - [x] Add tests confirming unsaved edits survive profile switching and are restored correctly per profile.
  - [x] Add tests that save/validate/preview/rollback calls include selected `profile_id`.
  - [x] Add error-path tests for profile loading or working-profile update failures with clear user feedback.

## Dev Notes

- Scope boundary for Story 2.5:
  - Include Build-page profile selection and profile-scoped template editing behavior.
  - Do not implement profile CRUD (Epic 3), template bundle import/export (Stories 2.6/2.7), or backend endpoint redesign.
- Epic 2 continuity:
  - Story 2.1 implemented baseline template editing/save.
  - Story 2.2 added validate-before-save and accessibility/error hinting.
  - Story 2.3 added preview contexts and stale preview protection.
  - Story 2.4 added version history + rollback with refresh-confirmed success behavior.
  - Story 2.5 should layer profile-selection context into existing flows without regression.

### Technical Requirements

- Existing backend contracts for this story:
  - `GET /editor/profiles` returns `{status, working_profile_id, profiles[]}`.
  - `POST /editor/profiles/working` requires `profile_id` and returns `{status, working_profile_id, profile}`.
  - `GET /editor/template` accepts optional `profile_id` query and returns profile-scoped template + metadata.
  - `GET /editor/template/versions` accepts optional `profile_id` query and returns profile-scoped version history.
  - `PUT /editor/template`, `POST /editor/validate`, `POST /editor/preview`, and `POST /editor/template/rollback` accept optional `profile_id` in payload.
- UI behavior requirements:
  - User can intentionally choose working profile from explicit list.
  - Selected profile context is reflected in editor content/metadata and version history.
  - Switching profile does not discard unsaved in-memory edits.
  - Profile errors remain actionable and non-destructive.

### Architecture Compliance

- Keep implementation in SPA frontend scope:
  - `chronicle-ui/src/features/build/` for Build-page UI/state orchestration.
  - `chronicle-ui/src/api/` for typed HTTP wrappers and contracts.
- Keep backend as source of truth for profile selection and active template/version state.
- Do not change endpoint paths, casing, or routing conventions (`snake_case`, no `/api/v1` prefix).
- Maintain feature-first structure and avoid introducing unrelated abstractions.

### Library / Framework Requirements

- Stay on project-pinned stack:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- No dependency additions required for Story 2.5.
- Continue React Testing Library + Vitest patterns used in Stories 2.1-2.4.

### File Structure Requirements

- Expected files to modify:
  - `chronicle-ui/src/api/template-editor-api.ts`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
  - `chronicle-ui/src/features/build/build-page.tsx`
  - `chronicle-ui/src/features/build/build-page.test.tsx`
- Existing helper likely to extend:
  - `chronicle-ui/src/features/build/template-editor-timing.ts` (usage for new metrics)
- Keep profile-selection behavior localized to Build feature scope.

### Testing Requirements

- Direct AC validation:
  - Profile selector is visible and initialized from backend working profile.
  - Selecting a profile updates working profile and refreshes profile-scoped template context.
  - Switching profiles does not lose unsaved editor drafts.
- FR30 validation:
  - Profile load/switch timing metrics emitted and verified under <1s p95 in test runs.
- Regression checks:
  - Story 2.1 save flow still works.
  - Story 2.2 validation + hint flow still works.
  - Story 2.3 preview flow still works.
  - Story 2.4 rollback flow still works (including refresh-confirmed success guardrail).
- Minimum verification commands:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 2.4 patterns to preserve:
  - Template reload after rollback must confirm active state before success feedback.
  - Rollback and version-load warnings are explicit and user-visible.
  - Async request id guards prevent stale writeback.
- Story 2.3/2.2 patterns to preserve:
  - Preview and validate are non-destructive to unsaved edits.
  - Action buttons disable during conflicting in-flight operations.
  - Accessibility relationships (`aria-describedby`) for helper/error/hint content remain intact.
- Apply these patterns to profile switching:
  - Avoid stale profile-switch results overriding newer user intent.
  - Keep each profile draft isolated in UI state and restore deterministically.

### Git Intelligence Summary

- Recent commits are docs/housekeeping focused and do not provide new implementation patterns for Build profile selection.
- Existing Epic 2 code patterns remain the primary source of implementation guidance for this story.
- Keep Story 2.5 changes tightly scoped to Build/API files to reduce review noise.

### Latest Tech Information

- Snapshot check (2026-02-27 via npm registry):
  - `react` latest 19.2.4 (project uses 19.2.0)
  - `react-router-dom` latest 7.13.1 (project uses 7.13.0)
  - `@mui/material` latest 7.3.8 (project uses 7.3.7)
  - `vite` latest 7.3.1 (project uses 7.2.6)
  - `vitest` latest 4.0.18 (project uses 3.2.4)
- Do not upgrade dependencies in this story; stay aligned with pinned project versions.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Do not change endpoint paths or add `/api/v1`.
  - Keep backend as authoritative source for template/profile state.
  - Keep tests deterministic and free of live network dependencies.
  - Do not log secrets/tokens or create new secret persistence paths.
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
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/2-4-roll-back-to-a-previous-template-version.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/2-3-preview-template-against-sample-or-latest-activity.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/description_template.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/tests/test_api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/features/build/build-page.tsx]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/api/template-editor-api.ts]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Auto-selected next backlog story from sprint order: `2-5-select-profile-for-template-editing`.
- Loaded planning artifacts (`epics`, `prd`, `architecture`, `ux`) and project context.
- Reviewed previous Story 2.4 and Story 2.3 context files for continuity guardrails.
- Analyzed profile-related backend contracts in `chronicle/api_server.py` and `chronicle/description_template.py`.
- Analyzed current Build-page and template editor API wrappers/tests for concrete file-level implementation guidance.
- Captured recent git commit patterns and latest-tech snapshot for version guardrails.
- Implemented profile API wrappers in frontend API client:
  - `getEditorProfiles` (`GET /editor/profiles`)
  - `setEditorWorkingProfile` (`POST /editor/profiles/working`)
- Implemented Build-page working-profile selector with profile-scoped template and version loading.
- Implemented per-profile unsaved draft retention and restoration across profile switches.
- Updated save/validate/preview/rollback payloads to include current selected `profile_id`.
- Added timing metrics for profile load/switch (`template.profiles.load`, `template.profile.switch`) and preserved existing timing instrumentation.
- Expanded Build-page tests for profile selector, profile switching, draft restoration, and profile-scoped operation payloads.
- Verification commands executed successfully:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test`
  - `npm run build`
- Adversarial code review findings identified and fixed automatically:
  - Added missing profile-switch error-path test coverage.
  - Added missing profile load/switch timing assertions with p95 thresholds.
  - Hardened working-profile state updates so switch state remains consistent with successful refresh.
- Post-review verification commands executed successfully:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Implemented Story 2.5 end-to-end profile selection in the Build flow.
- Added profile API contracts and tests in `template-editor-api`.
- Added Build working-profile selector and profile-scoped load behavior.
- Added per-profile draft preservation so switching profiles does not lose unsaved edits.
- Ensured save/validate/preview/rollback requests are scoped to selected profile id.
- Added automated coverage for profile switch behavior, per-profile draft restoration, and payload scoping.
- Passed focused and full frontend regression suites plus production build.
- Resolved code-review follow-up gaps and re-verified all frontend tests and build.

### File List

- chronicle-ui/src/api/template-editor-api.ts
- chronicle-ui/src/api/template-editor-api.test.ts
- chronicle-ui/src/features/build/build-page.tsx
- chronicle-ui/src/features/build/build-page.test.tsx
- _bmad-output/implementation-artifacts/2-5-select-profile-for-template-editing.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-02-27: Created Story 2.5 with comprehensive context for profile-scoped template editing and set story status to ready-for-dev.
- 2026-02-27: Implemented Story 2.5 profile selector + profile-scoped template operations + per-profile draft retention, added tests, and set story status to review.
- 2026-02-27: Completed code review for Story 2.5, fixed identified gaps, and set story status to done.
