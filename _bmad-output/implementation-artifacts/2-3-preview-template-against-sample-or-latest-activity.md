# Story 2.3: Preview Template Against Sample or Latest Activity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,
I want to preview a template against sample or latest activity data,
so that I can see the output before publishing.

## Acceptance Criteria

1. **Given** a template is edited  
   **When** I run preview against sample or latest activity  
   **Then** I see the rendered description output  
   **And** any render errors are shown clearly.  
   **And** the preview flow can be completed in <= 3 steps and <= 60 seconds under normal load (FR29)  
   **And** preview interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30)

## Tasks / Subtasks

- [x] Implement preview API wrappers for Build page usage (AC: 1)
  - [x] Extend `chronicle-ui/src/api/template-editor-api.ts` with `previewEditorTemplate(...)` wrapper for `POST /editor/preview`.
  - [x] Add typed request/response models for preview (`status`, `profile_id`, `context_source`, `preview`, `length`).
  - [x] Add `getEditorFixtures(...)` wrapper for `GET /editor/fixtures` so the preview flow can support sample fixture selection.
  - [x] Add/extend API tests in `chronicle-ui/src/api/template-editor-api.test.ts` for preview and fixtures requests, including request payload shape and response handling.

- [x] Add Preview workflow UX on Build page (AC: 1)
  - [x] Update `chronicle-ui/src/features/build/build-page.tsx` to add a `Preview Template` action in the existing editor workflow.
  - [x] Add context selection controls for preview mode (`sample`, `latest`) and fixture selection when sample context is chosen.
  - [x] Render preview output in a dedicated panel/section with explicit context-source feedback.
  - [x] Render clear preview error feedback for render failures, invalid context mode, and missing latest context.
  - [x] Keep the user path compact (Build -> edit -> Preview) to preserve FR29 simplicity.

- [x] Enforce non-persistence and state safety during preview (AC: 1)
  - [x] Ensure preview action does not call save endpoint and does not persist template changes.
  - [x] Preserve current editor text and unsaved state after preview success or failure.
  - [x] Keep existing load-failure guardrails from Stories 2.1/2.2 intact (no preview/save actions before successful template load).

- [x] Extend timing telemetry for preview interactions (AC: 1)
  - [x] Reuse `chronicle-ui/src/features/build/template-editor-timing.ts` and add `template.preview` timing around preview calls.
  - [x] Keep telemetry implementation dependency-free and consistent with existing `template.load`, `template.save`, and `template.validate` metrics.

- [x] Add focused automated coverage for preview flow and regressions (AC: 1)
  - [x] Extend `chronicle-ui/src/features/build/build-page.test.tsx` with preview success scenarios for sample and latest contexts.
  - [x] Add preview error-path coverage for backend render/context failures.
  - [x] Add assertions that preview does not trigger template save.
  - [x] Add assertions for preview telemetry event emission and <1s p95 durations in test runs.
  - [x] Preserve existing route/shell regression coverage (`app-smoke`, `app-routes`) and Story 2.1/2.2 behaviors.

## Dev Notes

- Scope boundary for Story 2.3:
  - Include preview-before-save UX and clear render/error feedback only.
  - Do not implement rollback UX (Story 2.4), profile-selection UX (Story 2.5), or import/export template flows (Stories 2.6/2.7).
- Story 2.2 delivered validate-before-save, hinting, fallback hints, and accessibility/timing hardening; Story 2.3 should extend that flow, not replace it.
- UX specification emphasizes validation/feedback-first interactions, explicit error guidance, and low-friction core actions.

### Technical Requirements

- Backend endpoints relevant to this story:
  - `POST /editor/preview` for rendering preview output from provided template text or active template.
  - `GET /editor/fixtures` for available sample fixture names.
- Preview endpoint behavior:
  - Accepts template text and optional context controls (`context_mode`, `fixture_name`, `profile_id`).
  - Supported `context_mode` values: `latest`, `sample`, `latest_or_sample`, `fixture`.
  - Returns HTTP 200 with preview payload when render succeeds.
  - Returns HTTP 400 for invalid context mode, non-string template payloads, or template render failures.
  - Returns HTTP 404 when latest context is requested but no latest context is available.
- UI behavior requirements:
  - Preview must be explicit and user-triggered.
  - Preview output and context source must be visible without persisting template edits.
  - Preview failures must surface actionable, user-visible messages.
- API client expectations:
  - Reuse `getJson` from `chronicle-ui/src/api/http-client.ts`.
  - Preserve `ApiRequestError` behavior and structured error-detail handling patterns established in Story 2.2.

### Architecture Compliance

- Keep implementation in SPA frontend scope:
  - `chronicle-ui/src/features/build/` for Build page UI/state.
  - `chronicle-ui/src/api/` for HTTP wrappers.
- Do not modify backend endpoint paths, response contracts, or server template-render logic in this story.
- Respect backend as source of truth for preview outcomes and context selection.
- Keep JSON key casing and endpoint naming consistent with existing contracts (`snake_case`, no `/api/v1` prefix).

### Library / Framework Requirements

- Use project-pinned stack already in repo:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- Do not add dependencies for this story.
- Continue using React Testing Library + Vitest patterns already established in Epic 1 and Stories 2.1/2.2.

### File Structure Requirements

- Expected files to modify:
  - `chronicle-ui/src/features/build/build-page.tsx`
  - `chronicle-ui/src/features/build/build-page.test.tsx`
  - `chronicle-ui/src/api/template-editor-api.ts`
  - `chronicle-ui/src/api/template-editor-api.test.ts`
- Existing helper to extend:
  - `chronicle-ui/src/features/build/template-editor-timing.ts`
- Optional extraction only if complexity requires:
  - `chronicle-ui/src/features/build/*` for local preview panel/context-selector helpers.

### Testing Requirements

- Direct AC validation:
  - Preview action shows rendered output for valid template input and context mode.
  - Preview action surfaces clear render/context errors when preview fails.
  - Preview flow remains compact and does not persist template changes.
- FR30 validation:
  - Preview timing telemetry (`template.preview`) is emitted and asserted under 1s p95 in test runs.
- Regression checks:
  - Story 2.1 load/save behaviors remain intact.
  - Story 2.2 validate/hint behaviors remain intact.
  - Existing navigation and route behavior remain unchanged (`app-smoke` / `app-routes`).
- Minimum verification commands:
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 2.2 established:
  - Validate-before-save flow with explicit success/error states.
  - Fallback Jinja hints when snippet service is unavailable.
  - Accessibility linkage for helper/errors/hints using `aria-describedby`.
  - p95-based timing telemetry assertions for interactive operations.
- Reuse Story 2.2 patterns:
  - Keep feedback messaging explicit and non-destructive to user edits.
  - Reuse timing helper patterns for new `template.preview` metric.
  - Preserve deterministic frontend tests with mocked API modules and no live network calls.

### Git Intelligence Summary

- Recent commits in this repository are mostly documentation/housekeeping and do not define Story 2.3 implementation patterns.
- Workspace currently includes broad untracked baseline content; keep Story 2.3 code changes tightly scoped to Build/API files and story artifacts.
- Maintain accurate story file list and status updates to reduce git/story traceability drift during review.

### Latest Tech Information

- Snapshot check (2026-02-27 via npm registry):
  - `react` latest 19.2.4 (project uses 19.2.0)
  - `react-router-dom` latest 7.13.1 (project uses 7.13.0)
  - `@mui/material` latest 7.3.8 (project uses 7.3.7)
  - `vite` latest 7.3.1 (project uses 7.2.6)
  - `vitest` latest 4.0.18 (project uses 3.2.4)
- Stay on project-pinned versions for this story; do not upgrade dependencies in Story 2.3.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Do not change endpoint paths or add `/api/v1`.
  - Keep backend as authority for template rendering and persistence.
  - Keep tests deterministic and network-isolated.
  - Do not log or persist secrets in repo artifacts.
  - Maintain feature-first frontend structure (`features/*`, `api/*`, `components/*`).

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/2-2-validate-template-before-save-with-jinja-hints.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/description_template.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/tests/test_api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/features/build/build-page.tsx]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle-ui/src/api/template-editor-api.ts]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- User-specified target story: `2.3` -> `2-3-preview-template-against-sample-or-latest-activity`.
- Loaded sprint tracking, Epic 2 story definitions, PRD, architecture, UX, and project-context artifacts.
- Analyzed backend preview contracts from `chronicle/api_server.py` and existing test coverage in `tests/test_api_server.py`.
- Reviewed Story 2.2 implementation and QA hardening outcomes for continuity and guardrails.
- Added frontend API wrappers and types for `POST /editor/preview` and `GET /editor/fixtures`.
- Implemented Build page preview controls (`Preview Context`, `Sample Fixture`) and `Preview Template` action with non-persistence behavior.
- Implemented preview feedback panel with `Preview generated.`, rendered output text, and `Preview context: ...` source display.
- Added preview error handling using `ApiRequestError` messages for clear user-facing failures.
- Added preview telemetry emission via `timeBuildOperation("template.preview", ...)`.
- Verification commands executed successfully:
  - `npm run test -- src/features/build/build-page.test.tsx`
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`
- Code review remediation applied for Story 2.3:
  - Added preview request stale-result guard to prevent preview/writeback races during concurrent UI edits.
  - Disabled save/validate/reload actions while preview is in progress for state safety.
  - Split load telemetry (`template.load`, `template.snippets.load`, `template.fixtures.load`) to avoid conflating sequential operations.
  - Added explicit fixtures-load warning and fallback to latest-context preview when sample fixtures are unavailable.
  - Extended preview error coverage with fixture-failure fallback and render-failure scenarios.
- Post-remediation verification commands executed successfully:
  - `npm run test -- src/features/build/build-page.test.tsx`
  - `npm run test -- src/api/template-editor-api.test.ts src/features/build/build-page.test.tsx`
  - `npm run test -- src/app-routes.test.tsx src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`

### Completion Notes List

- Preview UX is implemented end-to-end on Build page with context selection, fixture selection, and a dedicated rendered-output panel.
- Preview requests are non-persistent and preserve unsaved editor text and save-state guardrails.
- Telemetry now includes `template.preview` and is validated under sub-second p95 expectations in frontend tests.
- Full regression and build verification passed with no failing tests.
- Adversarial review findings (HIGH/MEDIUM) were resolved in code and test coverage; story is ready for closure.

### File List

- chronicle-ui/src/api/template-editor-api.ts
- chronicle-ui/src/api/template-editor-api.test.ts
- chronicle-ui/src/features/build/build-page.tsx
- chronicle-ui/src/features/build/build-page.test.tsx
- _bmad-output/implementation-artifacts/2-3-preview-template-against-sample-or-latest-activity.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-02-27: Created Story 2.3 with comprehensive implementation context and updated sprint tracking to ready-for-dev.
- 2026-02-27: Implemented Story 2.3 preview API + Build UX + telemetry + test coverage and set story status to review.
- 2026-02-27: Completed code-review remediation for Story 2.3 (state-race guardrails, fixture-fallback UX, telemetry split, and expanded preview error tests) and set story status to done.
