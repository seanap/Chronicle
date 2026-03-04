# Story 1.4: Complete Strava OAuth and Verify Connection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,
I want to complete Strava OAuth and verify the connection,
so that I can trust Strava data is flowing into the system.

## Acceptance Criteria

1. **Given** I have entered Strava credentials
   **When** I initiate OAuth
   **Then** I am redirected to Strava to authorize access
   **And** after approval, I return to the app and see a verified connection status.
2. **Given** OAuth start/callback fails (missing credentials, state mismatch, token exchange failure, denied auth)
   **When** I return to the Sources flow
   **Then** I see clear corrective guidance
   **And** the UI does not claim a verified connection state.

## Tasks / Subtasks

- [x] Add Strava OAuth API client methods and typed payloads in SPA (AC: 1, 2)
  - [x] Add `startStravaOauth()` wrapper for `POST /setup/api/strava/oauth/start` in `chronicle-ui/src/api/source-status-api.ts`.
  - [x] Extend API tests to cover success + error envelopes for OAuth start response.
  - [x] Keep backend contract unchanged; no route/path renames.
- [x] Implement OAuth initiation and callback result handling in Sources UI (AC: 1, 2)
  - [x] Add a Strava-scoped action in `SourcesPage` to start OAuth and redirect browser to backend-provided `authorize_url`.
  - [x] Read callback status from URL query (`strava_oauth`, optional `reason`) on page load and show success/error banners.
  - [x] After callback status is shown, refresh source statuses so Strava state reflects latest backend status.
- [x] Harden UX feedback and safety behavior (AC: 2)
  - [x] Surface backend start errors (for example, missing client ID/secret) as actionable user messages.
  - [x] Ensure failed OAuth paths do not display false "connected" states.
  - [x] Preserve existing Story 1.2/1.3 loading, retry, and provider configuration behavior.
- [x] Add focused tests for OAuth workflow in UI/API layers (AC: 1, 2)
  - [x] Add API tests for OAuth start request shape and response mapping.
  - [x] Add Sources page tests for start flow, callback success, callback error, and status refresh.
  - [x] Keep tests deterministic with mocked API responses and location state.

## Dev Notes

- Story 1.3 completed credentials UI and explicitly deferred OAuth start/callback verification to Story 1.4.
- Backend already exposes OAuth endpoints/callback behavior; this story is primarily SPA orchestration + validation feedback.

### Technical Requirements

- Existing backend endpoints relevant to this story:
  - `POST /setup/api/strava/oauth/start` returns `authorize_url`, `state`, `redirect_uri` or explicit error.
  - `GET /setup/strava/callback` processes code/state, stores tokens, then redirects to setup page with `strava_oauth` status query.
  - `GET /setup/api/strava/status` returns current Strava connection state for verification display.
- OAuth callback status values are surfaced via query parameter from backend redirect helper; UI must map these to clear user guidance.
- Callback failure reasons from backend include: `missing_code`, `state_mismatch`, `missing_client_credentials`, `token_exchange_failed`, `missing_refresh_token`, `missing_access_token`, `env_write_failed`, and passthrough provider error text.
- Preserve backend behavior:
  - No frontend token handling beyond redirect orchestration.
  - Backend remains source of truth for connection status.
  - No route/path shape changes.

### Architecture Compliance

- Keep Sources feature UI logic in `chronicle-ui/src/features/sources/`.
- Keep API request abstractions in `chronicle-ui/src/api/`.
- Respect service boundary: do not move domain logic from backend into frontend.
- Keep API paths under `/setup/*` as currently implemented.

### Library / Framework Requirements

- Use existing project stack already in repo:
  - React 19.2.0 (project pinned), React Router 7.13.0, MUI 7.3.7, Vite 7.2.6, Vitest 3.2.4.
- Follow existing HTTP abstraction via `chronicle-ui/src/api/http-client.ts`.
- Avoid adding new frontend libraries for this story.

### File Structure Requirements

- Primary expected files:
  - `chronicle-ui/src/features/sources/sources-page.tsx`
  - `chronicle-ui/src/features/sources/sources-page.test.tsx`
  - `chronicle-ui/src/api/source-status-api.ts`
  - `chronicle-ui/src/api/source-status-api.test.ts`
- Follow established repo conventions:
  - `kebab-case` filenames
  - React component exports in `PascalCase`
  - colocated feature tests under same feature folder.

### Testing Requirements

- Validate acceptance criteria directly:
  - OAuth initiation path redirects through `authorize_url`.
  - Success callback status is shown and Strava status refresh confirms connected/warning/error correctly.
  - Failure callback status (`strava_oauth=error` + `reason`) shows corrective guidance and no false-connected UI state.
- Regression-protect Story 1.2/1.3 behaviors:
  - Source status load/refresh behavior remains intact.
  - Credential editor flows still pass.
- Minimum verification commands:
  - `npm run test -- src/api/source-status-api.test.ts src/features/sources/sources-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- From Story 1.3 implementation and reviews:
  - Sources page already has robust async request sequencing and provider-panel state management.
  - Error/success alert patterns are established and should be reused for OAuth status feedback.
  - Accessibility semantics (`aria-expanded`, region labeling) and regression coverage are already strong; preserve these patterns.
  - Do not regress secret-preservation, validation, or provider-switch race handling tests.

### Git Intelligence Summary

- Recent git commits are mostly docs/repo housekeeping and do not establish new implementation constraints for Sources.
- Working tree may contain unrelated churn; keep Story 1.4 changes tightly scoped to Sources API/UI + tests.

### Latest Tech Information

- Snapshot check (2026-02-26 via npm registry) indicates newer upstream versions exist:
  - `react` latest 19.2.4 (project uses 19.2.0)
  - `react-router-dom` latest 7.13.1 (project uses 7.13.0)
  - `@mui/material` latest 7.3.8 (project uses 7.3.7)
  - `vite` latest 7.3.1 (project uses 7.2.6)
  - `vitest` latest 4.0.18 (project uses 3.2.4)
- For this story, stay on project-pinned versions; do not upgrade dependencies during feature implementation.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` constraints:
  - Do not log/store secrets in frontend code or test output.
  - Do not modify endpoint paths or response contracts.
  - Keep frontend as orchestration layer; backend remains authority for Strava connection state.
  - Keep deterministic tests with no live network calls.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/1-3-configure-source-credentials-in-ui.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Auto-selected next backlog story from sprint status: `1-4-complete-strava-oauth-and-verify-connection`.
- Parsed Epic 1 and Story 1.4 acceptance criteria from epics + PRD FR3 context.
- Mapped architecture and UX guidance for Sources/OAuth flow and status feedback.
- Reviewed Story 1.3 completion notes/review passes for continuity and anti-regression guidance.
- Checked backend OAuth endpoints and callback semantics in `chronicle/api_server.py`.
- Checked latest upstream frontend package versions to avoid accidental in-story upgrades.
- Implemented SPA Strava OAuth start API wrapper and response typing in `source-status-api.ts`.
- Implemented Sources page OAuth start action, callback query parsing, status refresh, and feedback alerts.
- `npm run test -- src/api/source-status-api.test.ts src/features/sources/sources-page.test.tsx`
- `npm run test`
- `npm run build`
- `.venv/bin/python -m pytest`

### Completion Notes List

- Created comprehensive Story 1.4 implementation context with explicit API/UI/test scope.
- Included prior-story guardrails, architecture constraints, and contract-safety rules.
- Prepared story for direct execution by `dev-story` with minimal ambiguity.
- Added `startStravaOauth()` API call with optional redirect URI support and typed response handling.
- Added Strava OAuth CTA on Sources cards and redirected via backend-provided `authorize_url`.
- Added callback status handling for `strava_oauth` + `reason`, including user guidance mapping and URL cleanup.
- Refreshed source statuses immediately after callback result processing so Strava state is verified in UI.
- Added regression tests for OAuth start success/error and callback success/error states.
- Preserved OAuth callback query params when wildcard-routing `/setup?...` back into `/sources?...`.
- Added Strava authorize URL validation guard before browser navigation to prevent unexpected redirect targets.
- Added route-level regression coverage for query-preserving wildcard redirect behavior.
- Updated callback feedback flow to require refreshed Strava status before showing success.
- Added regression test for `strava_oauth=connected` with non-connected refreshed status.
- Verified frontend test/build and full backend pytest suites pass with no regressions.

### File List

- _bmad-output/implementation-artifacts/1-4-complete-strava-oauth-and-verify-connection.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- chronicle-ui/src/api/source-status-api.ts
- chronicle-ui/src/api/source-status-api.test.ts
- chronicle-ui/src/features/sources/sources-page.tsx
- chronicle-ui/src/features/sources/sources-page.test.tsx
- chronicle-ui/src/app-routes.tsx
- chronicle-ui/src/app-routes.test.tsx

### Change Log

- 2026-02-26: Implemented Story 1.4 Strava OAuth start/callback verification flow in Sources UI and API client, added focused tests, and validated via full frontend/backend regression suites.
- 2026-02-26: Code review remediation applied for callback-route query preservation, OAuth authorize URL validation, and additional route-level regression coverage.
- 2026-02-26: Follow-up code review remediation applied for verification-first OAuth callback success messaging and non-connected callback regression coverage.

### Senior Developer Review (AI)

- Reviewer: GPT-5 Codex
- Date: 2026-02-26
- Outcome: Approved after fixes

#### Findings Summary

- High: 1
- Medium: 2
- Low: 0

#### Issues Fixed

- Preserved callback query params when redirecting unmatched routes so backend `/setup?strava_oauth=...` callbacks reliably reach Sources feedback handling.
- Added defensive validation for `authorize_url` before redirecting to Strava OAuth.
- Added route-level automated test coverage for wildcard redirect query preservation.

#### Validation Evidence

- `npm run test -- src/app-routes.test.tsx src/features/sources/sources-page.test.tsx src/api/source-status-api.test.ts`
- `npm run test`
- `npm run build`
- `.venv/bin/python -m pytest`

### Senior Developer Review (AI) - Pass 2

- Reviewer: GPT-5 Codex
- Date: 2026-02-26
- Outcome: Approved after fixes

#### Findings Summary

- High: 1
- Medium: 2
- Low: 0

#### Issues Fixed

- Success callback messaging now depends on refreshed Strava status being `connected` instead of query param alone.
- Reduced trust in callback query as a primary signal by grounding user-facing success on backend-refreshed connection state.
- Added regression test for connected callback query combined with non-connected refreshed status.

#### Validation Evidence

- `npm run test -- src/features/sources/sources-page.test.tsx src/app-routes.test.tsx src/api/source-status-api.test.ts`
- `npm run test`
- `npm run build`
