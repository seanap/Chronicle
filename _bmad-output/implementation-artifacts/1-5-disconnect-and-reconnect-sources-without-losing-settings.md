# Story 1.5: Disconnect and Reconnect Sources Without Losing Settings

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,
I want to disconnect and reconnect a source without losing other settings,
so that I can safely reauthorize or reset a connection.

## Acceptance Criteria

1. **Given** a source is connected  
   **When** I choose to disconnect it  
   **Then** the connection is removed but other app settings remain unchanged  
   **And** I can reconnect later without re-entering unrelated configuration.
2. **Given** disconnect/reconnect actions fail  
   **When** I complete the action from Sources  
   **Then** I receive clear corrective guidance  
   **And** the UI does not show a false-connected/false-disconnected state.

## Tasks / Subtasks

- [x] Add Strava disconnect API client integration in SPA (AC: 1, 2)
  - [x] Add typed API wrapper for `POST /setup/api/strava/disconnect` in `chronicle-ui/src/api/source-status-api.ts`.
  - [x] Add API tests validating request shape and response handling for disconnect.
  - [x] Keep existing backend contract and route paths unchanged.

- [x] Add disconnect/reconnect controls to Sources UI (AC: 1)
  - [x] Show `Disconnect Strava` action when Strava is connected/warning and OAuth credentials exist.
  - [x] Keep existing `Connect Strava OAuth` action for reconnect flow after disconnect.
  - [x] Refresh source statuses after disconnect/reconnect actions to show authoritative backend state.

- [x] Preserve settings + failure safety behavior (AC: 1, 2)
  - [x] Ensure disconnect flow only removes token connection state, not unrelated provider credentials/settings.
  - [x] Surface backend disconnect/start errors with actionable feedback.
  - [x] Avoid optimistic state mutations; only update displayed status from refreshed backend response.

- [x] Expand focused tests for disconnect/reconnect workflows (AC: 1, 2)
  - [x] Add UI tests for disconnect success, disconnect failure, and reconnect availability after disconnect.
  - [x] Add tests proving no false-connected/false-disconnected message is shown on failed operations.
  - [x] Keep tests deterministic with mocked API responses and location state.

## Dev Notes

- Story 1.4 completed OAuth connect + callback verification. Story 1.5 extends the same Sources surface with disconnect/reset behavior.
- Backend endpoint already exists for disconnect; frontend needs orchestration + feedback and regression safety.

### Technical Requirements

- Relevant backend endpoints:
  - `POST /setup/api/strava/disconnect` clears `STRAVA_REFRESH_TOKEN` and `STRAVA_ACCESS_TOKEN` only, and returns updated Strava status.
  - `POST /setup/api/strava/oauth/start` remains reconnect path.
  - `GET /setup/api/strava/status` and existing sources status loading remain source-of-truth for UI state.
- Preserve backend semantics:
  - Disconnect should not remove Strava client ID/secret or unrelated source settings.
  - Frontend must not assume disconnect success until API confirms and status refresh completes.

### Architecture Compliance

- Keep Sources feature UI in `chronicle-ui/src/features/sources/`.
- Keep API request handling in `chronicle-ui/src/api/`.
- Do not change backend route paths or response contracts.
- Backend remains authoritative for source connection state.

### Library / Framework Requirements

- Use existing project stack:
  - React 19.2.0 (repo pinned), React Router 7.13.0, MUI 7.3.7, Vite 7.2.6, Vitest 3.2.4.
- Continue using existing HTTP abstraction (`chronicle-ui/src/api/http-client.ts`).
- Do not introduce new frontend dependencies for this story.

### File Structure Requirements

- Primary expected files:
  - `chronicle-ui/src/features/sources/sources-page.tsx`
  - `chronicle-ui/src/features/sources/sources-page.test.tsx`
  - `chronicle-ui/src/api/source-status-api.ts`
  - `chronicle-ui/src/api/source-status-api.test.ts`
- Keep naming and organization consistent with current feature-first SPA structure.

### Testing Requirements

- Validate ACs directly:
  - Disconnect removes active connection state while retaining reconnect capability and existing credentials/settings context.
  - Failed disconnect/reconnect actions show corrective guidance and no false-success state.
- Regression-protect Story 1.2–1.4 behavior:
  - Status load/refresh sequencing remains stable.
  - OAuth callback handling and verification-first success messaging remain intact.
  - Credential configuration behavior remains unchanged.
- Minimum verification commands:
  - `npm run test -- src/api/source-status-api.test.ts src/features/sources/sources-page.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 1.4 established:
  - Strava OAuth start integration and callback result handling on Sources page.
  - Query-preserving route redirect behavior for `/setup?...` callback handoff.
  - Verification-first OAuth success messaging (must align success with refreshed backend status).
  - Defensive authorize URL validation before navigation.
- Reuse existing async request sequencing and alert patterns; avoid introducing parallel state systems.

### Git Intelligence Summary

- Recent git history remains repo/docs housekeeping heavy; keep this story’s code changes tightly scoped to Sources API/UI/tests.
- Working tree may include unrelated changes; do not expand scope beyond Story 1.5 implementation.

### Latest Tech Information

- Snapshot check (2026-02-27 via npm registry) shows newer upstream versions:
  - `react` latest 19.2.4 (project uses 19.2.0)
  - `react-router-dom` latest 7.13.1 (project uses 7.13.0)
  - `@mui/material` latest 7.3.8 (project uses 7.3.7)
  - `vite` latest 7.3.1 (project uses 7.2.6)
  - `vitest` latest 4.0.18 (project uses 3.2.4)
- Stay on project-pinned versions; do not upgrade dependencies in this story.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` constraints:
  - Do not log secrets/tokens or persist secrets in frontend artifacts.
  - Do not alter endpoint paths or break response shapes.
  - Keep frontend orchestration-only; backend is the source of truth.
  - Keep tests deterministic and free of live network calls.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/1-4-complete-strava-oauth-and-verify-connection.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- User-specified target story: `1.5` (`1-5-disconnect-and-reconnect-sources-without-losing-settings`).
- Loaded sprint status, Epic 1/PRD FR4, architecture FR1–4 mapping, UX sources/status guidance, and project context.
- Reviewed completed Story 1.4 for continuity and guardrails.
- Verified backend disconnect endpoint behavior in `chronicle/api_server.py`.
- Checked latest upstream frontend package versions and retained pinned-project guidance.
- Implemented `disconnectStrava()` API client wrapper and typed response contract.
- Added disconnect request coverage in `source-status-api.test.ts`.
- Implemented Strava disconnect UI action with success/error feedback and status refresh.
- Added Sources page tests for disconnect success and failure flows.
- Code review hardening: gated disconnect action on OAuth credential presence and made disconnect success verification-first after refreshed backend status check.
- Added regression coverage for hidden disconnect action without credentials and disconnect verification-failure guidance.
- `npm run test -- src/api/source-status-api.test.ts src/features/sources/sources-page.test.tsx`
- `npm run test`
- `npm run build`
- `.venv/bin/python -m pytest`
- `npm test -- --run src/features/sources/sources-page.test.tsx`
- `npm run test -- src/api/source-status-api.test.ts src/features/sources/sources-page.test.tsx`
- Follow-up code review rerun (auto-fix): removed unnecessary `useCallback` dependency churn and added post-disconnect refresh-failure regression coverage.
- Git discrepancy note: workspace baseline currently contains broad untracked directories, so story validation uses story file list + source verification + targeted test evidence rather than tracked diff-only evidence.

### Completion Notes List

- Created implementation-ready Story 1.5 context with explicit disconnect/reconnect scope.
- Included backend contract constraints, continuity guardrails from Story 1.4, and targeted QA/testing expectations.
- Prepared story for direct `dev-story` execution with minimal ambiguity.
- Added API support for `POST /setup/api/strava/disconnect` in Sources API client.
- Added disconnect control for Strava in Sources UI while preserving reconnect OAuth action.
- Added deterministic success and failure feedback handling for disconnect actions.
- Ensured UI status transitions are driven by refreshed backend status, not optimistic local mutations.
- Added focused regression tests for disconnect success/failure and reconnect availability.
- Validated frontend tests/build and full backend pytest regression suite.
- Hardened disconnect UX to prevent false-success messaging unless refreshed backend status confirms disconnect.
- Limited `Disconnect Strava` action visibility to states with OAuth credentials present.
- Added regression tests for disconnect verification failure and credential-based action gating.
- Added regression test for disconnect success followed by status refresh failure to prevent false-success messaging.
- Removed unused dependency from `openProviderConfig` callback to avoid avoidable re-creation.

### File List

- _bmad-output/implementation-artifacts/1-5-disconnect-and-reconnect-sources-without-losing-settings.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- chronicle-ui/src/api/source-status-api.ts
- chronicle-ui/src/api/source-status-api.test.ts
- chronicle-ui/src/features/sources/sources-page.tsx
- chronicle-ui/src/features/sources/sources-page.test.tsx

### Change Log

- 2026-02-27: Implemented Story 1.5 Strava disconnect/reconnect UX and API integration, added focused tests, and validated via frontend/backend regression suites.
- 2026-02-27: Applied code-review hardening fixes for verification-first disconnect success and credential-aware disconnect action visibility; expanded regression tests and revalidated targeted suites.
- 2026-02-27: Reran code review and applied follow-up fixes (callback dependency cleanup + disconnect refresh-failure test), then revalidated targeted suites.
