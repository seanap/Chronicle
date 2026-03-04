# Story 2.4: Roll Back to a Previous Template Version

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,  
I want to roll back to a previous template version,  
so that I can recover quickly after a bad change.

## Acceptance Criteria

1. **Given** I have multiple saved versions of a template  
   **When** I select a previous version  
   **Then** the template is restored to that version  
   **And** I can confirm it is now active.  
   **And** the rollback flow can be completed in <= 3 steps and <= 60 seconds under normal load (FR29)  
   **And** rollback interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30)

## Tasks / Subtasks

- [x] Implement rollback API client wrappers for Build page usage (AC: 1)
  - [x] Extend `chronicle-ui/src/api/template-editor-api.ts` with `getEditorTemplateVersions(...)` wrapper for `GET /editor/template/versions`.
  - [x] Add typed models for versions list entries (`version_id`, `name`, `author`, `source`, `operation`, `notes`, `rolled_back_from`, `created_at_utc`, `template_sha256`).
  - [x] Add `rollbackEditorTemplate(...)` wrapper for `POST /editor/template/rollback` with typed request/response contracts.
  - [x] Extend `chronicle-ui/src/api/template-editor-api.test.ts` for versions and rollback API request/response handling.

- [x] Add rollback UX to Build page with active-version confirmation (AC: 1)
  - [x] Update `chronicle-ui/src/features/build/build-page.tsx` to load and display template version history.
  - [x] Render a clear active-version indicator and metadata for each version entry (created time, source/operation, author).
  - [x] Add rollback action per version entry that requires explicit user confirmation before replacing the active template.
  - [x] On rollback success, refresh active template + versions and show clear success feedback confirming the active version changed.
  - [x] On rollback failure, show actionable error feedback and keep current editor state predictable.

- [x] Preserve state safety and regression guardrails during rollback (AC: 1)
  - [x] Disable rollback actions when load/save/validate/preview/rollback operations are running.
  - [x] Guard unsaved edits before rollback with explicit confirmation so user intent is clear.
  - [x] Keep Story 2.1/2.2/2.3 load-save-validate-preview behavior intact and non-regressive.

- [x] Add rollback timing telemetry and keep performance assertions aligned with FR30 (AC: 1)
  - [x] Reuse `chronicle-ui/src/features/build/template-editor-timing.ts` and add `template.rollback` timing around rollback operations.
  - [x] Add optional `template.versions.load` timing around version-history refresh to aid performance diagnostics.

- [x] Add focused automated coverage for rollback flow and regressions (AC: 1)
  - [x] Extend `chronicle-ui/src/features/build/build-page.test.tsx` with rollback success flow using real version IDs.
  - [x] Add rollback error-path coverage (unknown version, bad request payload, API failure messaging).
  - [x] Add coverage for unsaved-edit confirmation and cancel path (no rollback call on cancel).
  - [x] Add assertions that rollback updates the active template/metadata display and does not break preview/validate/save controls.
  - [x] Add telemetry checks for `template.rollback` with <1s p95 durations in test runs.

## Dev Notes

- Scope boundary for Story 2.4:
  - Include template version history visibility + rollback action for the active editing workflow.
  - Do not implement profile-selection UX (Story 2.5), template import/export UX (Stories 2.6/2.7), or backend endpoint redesign.
- Epic 2 continuity:
  - Story 2.1 established template load/save.
  - Story 2.2 added validate-before-save, hints, and accessibility feedback.
  - Story 2.3 added preview contexts, fixture fallback, timing telemetry patterns, and stale-request protection.
  - Story 2.4 should extend these patterns without regressing existing behaviors.

### Technical Requirements

- Backend contracts already available for this story:
  - `GET /editor/template/versions` returns latest versions list with optional `limit` (default 30, max 200) and optional `profile_id`.
  - `GET /editor/template/version/<version_id>` returns full version record; use only if needed for richer UX.
  - `POST /editor/template/rollback` requires `version_id`; supports optional `author`, `source`, `notes`, `profile_id`.
- Rollback behavior:
  - Unknown or missing `version_id` returns `status: error` (HTTP 400).
  - Successful rollback returns `status: ok`, `saved_version`, and `active` payload for the restored template.
  - Rollback persists a new version entry with operation metadata (`operation=rollback`, `rolled_back_from=<version_id>`).
- UI behavior requirements:
  - User must be able to choose a previous version and execute rollback in a compact, explicit flow.
  - UI must provide clear confirmation that rollback became active (updated active version/template feedback).
  - Error messaging must remain actionable and non-destructive.

### Architecture Compliance

- Keep implementation in SPA frontend scope:
  - `chronicle-ui/src/features/build/` for Build page state/UI behavior.
  - `chronicle-ui/src/api/` for HTTP wrapper contracts.
- Do not change backend endpoint paths, payload key casing (`snake_case`), or add `/api/v1` prefixes.
- Treat backend rollback response as source of truth for active template/version state.
- Avoid backend/domain logic duplication in frontend; UI should orchestrate API contracts, not recalculate template authority.

### Library / Framework Requirements

- Stay on project-pinned stack in repo:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- No dependency additions required for Story 2.4.
- Continue existing React Testing Library + Vitest test patterns used across Stories 2.1-2.3.

### File Structure Requirements

- Expected files to modify:
  - `chronicle-ui/src/api/template-editor-api.ts`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
  - `chronicle-ui/src/features/build/build-page.tsx`
  - `chronicle-ui/src/features/build/build-page.test.tsx`
- Existing helper likely to extend:
  - `chronicle-ui/src/features/build/template-editor-timing.ts`
- Keep rollback UI within Build feature scope; avoid creating unrelated shared abstractions for this story.

### Testing Requirements

- Direct AC validation:
  - Rollback list renders when versions exist and user can select a prior version.
  - Rollback success updates active template/version state and shows clear confirmation.
  - Rollback error path is visible and actionable.
- FR30 validation:
  - `template.rollback` telemetry event emitted and asserted under <1s p95 in test runs.
- Regression checks:
  - Existing save/validate/preview/reload controls continue to behave as in Story 2.3.
  - Existing route shell behavior remains unchanged (`app-smoke`, `app-routes`).
- Minimum verification commands:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 2.3 established critical guardrails that should be reused:
  - Stale async request protection for preview actions.
  - Action disabling while async build operations are running.
  - Split timing metrics (`template.load`, `template.snippets.load`, `template.fixtures.load`, `template.preview`).
  - Deterministic, network-isolated frontend tests via mocked API modules.
- Apply same patterns to rollback:
  - Prevent stale rollback writeback and confusing state flashes.
  - Ensure optimistic UI updates do not claim success before backend confirmation.
  - Keep user feedback explicit, accessible, and reversible.

### Git Intelligence Summary

- Recent commits are documentation/housekeeping focused and do not establish new rollback implementation patterns.
- Existing Epic 2 story artifacts show stable Build-page and API-wrapper patterns; Story 2.4 should extend these files directly.
- Keep changes tightly scoped to rollback context to reduce review noise and regression risk.

### Latest Tech Information

- Latest-version snapshot previously captured on 2026-02-27 (npm registry):
  - `react` latest 19.2.4 (project uses 19.2.0)
  - `react-router-dom` latest 7.13.1 (project uses 7.13.0)
  - `@mui/material` latest 7.3.8 (project uses 7.3.7)
  - `vite` latest 7.3.1 (project uses 7.2.6)
  - `vitest` latest 4.0.18 (project uses 3.2.4)
- Do not upgrade dependencies in this story; implementation should remain on pinned project versions.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Do not change endpoint paths or add `/api/v1`.
  - Backend remains source of truth for active template state/version.
  - Keep tests deterministic and free of live network dependencies.
  - Do not log secrets or create new secret persistence paths.
  - Keep frontend feature-first organization (`features/*`, `api/*`, `components/*`).

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
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

- Auto-selected next backlog story from sprint order: `2-4-roll-back-to-a-previous-template-version`.
- Loaded planning artifacts (`epics`, `prd`, `architecture`, `ux`) and project context.
- Reviewed previous story (`2-3`) to preserve established Build/API/testing patterns.
- Extracted rollback contracts and response shapes from backend endpoints and tests.
- Captured recent git commit patterns and latest-tech snapshot for dependency guardrails.
- Added frontend API wrappers for template version history and rollback endpoints with typed contracts.
- Implemented Build page rollback UX with version history listing, active version indicator, explicit confirmation, unsaved-change guard, and state-safe action disabling.
- Added rollback + version-load telemetry integration using existing build timing helper.
- Added rollback-focused unit/integration tests for API wrapper behavior and Build-page success/error/confirmation/telemetry flows.
- Verification commands executed successfully:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`
- Adversarial code-review remediation applied for Story 2.4:
  - Rollback success now requires a successful active-template refresh; false-success feedback is prevented.
  - `template.rollback` telemetry now wraps rollback + post-rollback refresh to measure full user interaction.
  - Added refresh-failure regression coverage to ensure rollback reports failure if confirmation state cannot be reloaded.
- Post-remediation verification commands executed successfully:
  - `npm run test -- src/features/build/build-page.test.tsx src/api/template-editor-api.test.ts`
  - `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Implemented rollback API integration and Build-page rollback workflow end-to-end.
- Added template version history section with active-version highlighting and rollback actions.
- Added explicit rollback confirmation (including unsaved-change warning) and robust rollback error/success feedback.
- Preserved Story 2.1-2.3 behaviors while adding rollback state guards and telemetry (`template.rollback`, `template.versions.load`).
- Full frontend regression and build verification completed successfully; story is ready for review.
- Addressed code-review HIGH/MEDIUM findings; story now enforces accurate rollback activation confirmation and complete rollback telemetry.

### File List

- chronicle-ui/src/api/template-editor-api.ts
- chronicle-ui/src/api/template-editor-api.test.ts
- chronicle-ui/src/features/build/build-page.tsx
- chronicle-ui/src/features/build/build-page.test.tsx
- _bmad-output/implementation-artifacts/2-4-roll-back-to-a-previous-template-version.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-02-27: Created Story 2.4 with comprehensive context for rollback implementation and updated sprint tracking to ready-for-dev.
- 2026-02-27: Updated sprint tracking for Story 2.4 to in-progress at development start.
- 2026-02-27: Implemented Story 2.4 rollback API + Build page UX + telemetry + automated test coverage.
- 2026-02-27: Completed all Story 2.4 tasks, passed full test/build validation, and set story status to review.
- 2026-02-27: Resolved Story 2.4 code-review findings (rollback refresh confirmation, rollback telemetry scope, refresh-failure regression test) and set story status to done.
