# Story 3.4: Import/Export Profiles as YAML

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to import and export profiles as YAML,  
so that I can share and reuse profile setups.

## Acceptance Criteria

1. **Given** I have saved profiles  
   **When** I export profiles  
   **Then** I receive a YAML file with the selected profiles  
   **And** when I import a YAML file, valid profiles are added and errors shown if invalid.

## Tasks / Subtasks

- [x] Add backend profile-bundle export/import domain logic (AC: 1)
  - [x] In `chronicle/description_template.py`, add profile-bundle helpers that export selected profiles and import bundle payloads with strict validation.
  - [x] Preserve locked/default profile guardrails and deterministic profile ordering (`priority desc`, `label asc`).
  - [x] Ensure failed imports do not partially persist invalid profile entries.

- [x] Add API endpoints for profile YAML workflows (AC: 1)
  - [x] In `chronicle/api_server.py`, add profile bundle export endpoint (for example `GET /editor/profiles/export`) with optional selected-profile filtering.
  - [x] Add profile bundle import endpoint (for example `POST /editor/profiles/import`) accepting `bundle` payloads and returning actionable validation errors.
  - [x] Keep API payload keys and response keys in `snake_case`; do not alter existing endpoint paths.

- [x] Add frontend API contract wrappers for profile bundle export/import (AC: 1)
  - [x] In `chronicle-ui/src/api/template-editor-api.ts`, add typed request/response contracts for profile bundle export/import endpoints.
  - [x] Add API wrapper tests in `chronicle-ui/src/api/template-editor-api.test.ts`.

- [x] Add Build UI profile YAML export/import controls (AC: 1)
  - [x] In `chronicle-ui/src/features/build/build-page.tsx`, add dedicated profile sharing controls to export selected profile bundles and import YAML bundles.
  - [x] Use YAML serialization/parsing in the frontend for download/import UX while preserving backend JSON API contracts.
  - [x] Keep feedback actionable for malformed bundles and backend validation failures.
  - [x] Preserve existing template export/import and profile preview flows without regressions.

- [x] Add/extend automated tests for backend + UI profile YAML flows (AC: 1)
  - [x] Add backend endpoint tests in `tests/test_api_server.py` for successful export/import, selected-profile export filtering, and invalid import payload handling.
  - [x] Add Build page tests in `chronicle-ui/src/features/build/build-page.test.tsx` for profile YAML export and import UX outcomes.
  - [x] Verify existing Epic 3 profile management tests remain green.

## Dev Notes

- Scope boundary for Story 3.4:
  - Include profile bundle sharing workflows (export/import) for profile settings.
  - Do not redesign template bundle repository workflows from Epic 2.
  - Do not change profile-matching heuristics or template rendering behavior beyond what import/export requires.
- Epic continuity:
  - Story 3.1 implemented profile create/edit.
  - Story 3.2 implemented enable/disable + priority.
  - Story 3.3 implemented profile applicability preview.
  - Story 3.4 adds profile sharing/import-export as the final Epic 3 capability.

### Technical Requirements

- Primary requirement source:
  - Epic 3 Story 3.4 AC in `_bmad-output/planning-artifacts/epics.md`.
  - PRD FR13 / FR37 in `_bmad-output/planning-artifacts/prd.md` for profile import/export sharing.
- Existing backend capabilities to leverage:
  - Profile persistence and guards in `chronicle/description_template.py` (`list_template_profiles`, `create_template_profile`, `update_template_profile`).
  - Current profile API namespace in `chronicle/api_server.py` (`/editor/profiles*`).
- Required import/export behavior:
  - Export returns bundle metadata + selected profile records in a stable structure for YAML serialization.
  - Import validates profile bundle shape and rejects invalid entries with actionable errors.
  - Locked/default guardrails remain enforced (cannot disable/illegally mutate default profile behavior).
  - Successful import returns refreshed profile list + working profile metadata.

### Architecture Compliance

- Keep architecture boundaries:
  - Domain import/export logic in `chronicle/description_template.py` (and re-exported via `chronicle/template_profiles.py`).
  - API orchestration in `chronicle/api_server.py`.
  - Build UI and interaction logic in `chronicle-ui/src/features/build/`.
  - Frontend API contracts in `chronicle-ui/src/api/`.
- Maintain backend as source of truth for profile state.
- Keep endpoint naming/path conventions unchanged and JSON keys `snake_case`.

### Library / Framework Requirements

- Use current project stack:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- Add frontend-only `yaml` package for parsing/serializing profile bundle files in Build UI.
- Do not introduce backend parser dependencies unless explicitly approved.

### File Structure Requirements

- Likely files to modify:
  - `chronicle/description_template.py`
  - `chronicle/template_profiles.py`
  - `chronicle/api_server.py`
  - `tests/test_api_server.py`
  - `chronicle-ui/src/api/template-editor-api.ts`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
  - `chronicle-ui/src/features/build/build-page.tsx`
  - `chronicle-ui/src/features/build/build-page.test.tsx`
  - `chronicle-ui/package.json`
  - `chronicle-ui/package-lock.json`

### Testing Requirements

- Acceptance coverage:
  - Exporting profiles returns a bundle that contains selected profile data and metadata.
  - Importing a valid profile bundle creates/updates profiles and surfaces the refreshed profile list.
  - Invalid profile bundles return clear error feedback and do not partially write invalid data.
- Regression coverage:
  - Existing Epic 3 create/edit, enable/disable/priority, and preview flows remain stable.
  - Existing Build template export/import flows remain stable.
- Suggested verification commands:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- From Story 3.3:
  - Keep profile-related logic centralized in backend; UI should not implement profile matching/authority logic.
  - Preserve actionable feedback patterns and avoid resetting unrelated editor state on failures.
- From Story 3.2:
  - Preserve working-profile fallback behavior when imported profile states affect enabled profiles.
  - Keep default profile guardrails explicit and test-backed.

### Git Intelligence Summary

- Latest commits are primarily docs/repo hygiene and do not alter profile-management architecture.
- Story 3.4 should follow existing Epic 3 patterns in `api_server.py`, `description_template.py`, and Build page test style.

### Latest Tech Information

- Snapshot check (2026-03-03 via npm registry):
  - `react`: latest 19.2.4
  - `react-router-dom`: latest 7.13.1
  - `@mui/material`: latest 7.3.8
  - `vite`: latest 7.3.1
  - `vitest`: latest 4.0.18
  - `yaml`: latest 2.8.2
- Story 3.4 should not upgrade existing framework versions; only add `yaml` dependency for this feature.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Keep API response shapes stable and `snake_case`.
  - Backend remains the source of truth for profile state.
  - Do not change endpoint paths or add `/api/v1` prefixes.
  - Keep tests deterministic and avoid live network behavior.

### Story Completion Status

- Story implementation complete.
- Story status set to `done`.
- Completion note: Profile YAML export/import is fully implemented with backend, API contracts, Build UI, review hardening, and automated coverage.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/3-1-create-and-edit-activity-classification-profiles.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/3-2-enable-disable-profiles-and-set-priority.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/3-3-preview-which-profile-applies-to-an-activity.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/description_template.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/features/build/build-page.tsx]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/api/template-editor-api.ts]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story explicitly targeted by user request: `3.4`.
- Parsed Epic 3 Story 3.4 acceptance criteria from planning artifacts.
- Cross-checked Stories 3.1, 3.2, and 3.3 for implementation continuity and guardrails.
- Reviewed current backend/frontend profile management and template import/export paths.
- Added backend profile bundle functions in `chronicle/description_template.py` and re-exports in `chronicle/template_profiles.py`.
- Added API endpoints: `GET /editor/profiles/export`, `POST /editor/profiles/import`.
- Added frontend API wrappers for profile bundle export/import.
- Added Build page profile YAML controls for selecting profiles, exporting YAML bundles, and importing YAML bundles.
- Added `yaml` frontend dependency for serialization/parsing.
- Added backend and frontend test coverage for profile YAML export/import flows.
- Verification commands executed:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test -- src/features/build/build-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Implemented backend profile bundle export/import with selected-profile filtering and guarded import semantics.
- Implemented API routes for profile export/import in the existing `/editor/profiles*` namespace.
- Implemented Build UI profile YAML sharing controls:
  - Multi-select export profile picker.
  - Profile YAML file chooser and import action.
  - Actionable success/error feedback, including partial-import warnings.
- Preserved existing Build template export/import and profile preview behavior.
- Hardened import parsing flow so invalid bundle entries are surfaced by backend validation instead of being silently dropped client-side.
- Completed review and resolved identified medium issue (partial-invalid import reporting gap).
- Full backend and frontend automated suites pass.

### File List

- chronicle/description_template.py
- chronicle/template_profiles.py
- chronicle/api_server.py
- tests/test_api_server.py
- chronicle-ui/src/api/template-editor-api.ts
- chronicle-ui/src/api/template-editor-api.test.ts
- chronicle-ui/src/features/build/build-page.tsx
- chronicle-ui/src/features/build/build-page.test.tsx
- chronicle-ui/package.json
- chronicle-ui/package-lock.json
- _bmad-output/implementation-artifacts/3-4-import-export-profiles-as-yaml.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md

### Change Log

- 2026-03-03: Created Story 3.4 with comprehensive context and set status to ready-for-dev.
- 2026-03-03: Implemented Story 3.4 backend/API/frontend profile YAML import/export and set status to review.
- 2026-03-03: Completed code review hardening and set status to done.
