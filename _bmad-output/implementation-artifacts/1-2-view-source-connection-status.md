# Story 1.2: View Source Connection Status

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,
I want to see the status of each external data source connection,
so that I can quickly confirm which sources are healthy or need attention.

## Acceptance Criteria

1. **Given** I open the Sources page  
   **When** the page loads  
   **Then** I can see each source with a clear status (`connected`, `warning`, `error`, `disconnected`)  
   **And** the status reflects the latest known connection state.

## Tasks / Subtasks

- [x] Implement Sources status view model and API integration in SPA (AC: 1)
  - [x] Add a Sources API client module in `chronicle-ui/src/api/` to read setup payload/state from backend setup endpoints.
  - [x] Define a normalized status enum in SPA for UI rendering: `connected`, `warning`, `error`, `disconnected`.
  - [x] Map backend setup payload (including Strava status and provider config presence) into the normalized UI status model.

- [x] Build accessible provider status UI on Sources page (AC: 1)
  - [x] Replace placeholder `sources-page.tsx` with provider cards/list that renders each source name + status indicator + short status text.
  - [x] Ensure status indicators are not color-only (include text/icon semantics for WCAG AA alignment).
  - [x] Keep routing/page shell conventions established in Story 1.1 and project context.

- [x] Wire load/error/refresh behavior for latest known state (AC: 1)
  - [x] Load source status data on page mount.
  - [x] Display clear error state if status fetch fails.
  - [x] Add a manual refresh action to re-query status and update the rendered state.

- [x] Add test coverage for status rendering and state transitions (AC: 1)
  - [x] Add component tests for initial load, success render, and failed fetch handling.
  - [x] Add assertions for each required status value (`connected`, `warning`, `error`, `disconnected`).
  - [x] Keep tests deterministic (no live network); mock API responses.

## Dev Notes

- Story 1.2 scope is display + status clarity only; credential editing and OAuth initiation are handled by follow-on stories (1.3+).
- Reuse existing backend setup endpoints; avoid backend contract changes unless absolutely required for AC completion.

### Technical Requirements

- Use existing setup backend endpoints already available in `chronicle/api_server.py`:
  - `GET /setup/api/config` (provider fields, links, values, strava status, env metadata)
  - `GET /setup/api/strava/status` (latest strava connection signals)
- Normalize backend signals into the story-required UI statuses:
  - `connected`: source fully configured and authenticated/ready
  - `warning`: partially configured, attention needed before full use
  - `error`: fetch failure or explicit backend error condition
  - `disconnected`: source not configured or not connected
- Keep backend as source of truth for status determination; frontend should map and present, not invent state.

### Architecture Compliance

- Preserve architectural boundaries:
  - SPA UI in `chronicle-ui/src/features/sources/`
  - API wrapper logic in `chronicle-ui/src/api/`
  - Backend APIs remain under existing `/setup/*` routes.
- Do not move domain logic into frontend.
- Maintain MPA/SPA coexistence posture while implementing this SPA story increment.

### Project Structure Notes

- Primary files expected:
  - `chronicle-ui/src/features/sources/sources-page.tsx`
  - `chronicle-ui/src/api/*` (new source-status client utilities as needed)
  - `chronicle-ui/src/features/sources/*.test.tsx` or co-located test file(s)
- Follow established naming conventions from Story 1.1:
  - `kebab-case` filenames
  - `PascalCase` React component exports.

### Testing Requirements

- Add/extend frontend tests to validate:
  - Source status list renders after successful load.
  - Fallback UI for failed status fetch.
  - All four required status labels are rendered correctly from mapped payload cases.
- Keep backend regression suite unaffected (no backend behavior changes expected in this story).

### Previous Story Intelligence

- Story 1.1 completed SPA scaffold, route shell, API client foundations, and smoke-test posture.
- Reuse Story 1.1 patterns for route/page composition, typed API errors, and test setup.

### Git Intelligence Summary

- Current branch already contains Story 1.1 scaffold and review hardening.
- Keep Story 1.2 changes scoped to sources feature + frontend tests to minimize churn.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Backend contract stability
  - Feature-first SPA structure
  - No secret leakage in UI
  - Deterministic automated tests.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md#L185]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md#L393]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md#L442]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md#L179]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md#L276]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py#L148]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py#L1112]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story key resolved from sprint status: `1-2-view-source-connection-status`.
- Context assembled from epics, PRD, architecture, UX spec, project context, and current source tree.
- Updated sprint status from `ready-for-dev` to `in-progress` before implementation.
- Implemented source status mapping and fetch layer in `source-status-api.ts`.
- Implemented Sources UI status cards with loading/error/refresh states and text status labels.
- Added unit + integration test coverage for status mapping and Sources page rendering behaviors.
- Validation commands run:
  - `npm run test -- source-status-api.test.ts sources-page.test.tsx`
  - `npm run test`
  - `npm run build`
  - `.venv/bin/python -m pytest`

### Completion Notes List

- Created implementation-ready Story 1.2 with AC-traceable tasks/subtasks.
- Added architecture-aligned technical guidance and testing expectations.
- Implemented `chronicle-ui/src/api/source-status-api.ts` with normalized source status model and setup endpoint integration.
- Replaced Sources placeholder page with an accessible status dashboard including refresh and error states.
- Added deterministic tests for mapping logic and Sources UI success/error/refresh behavior.
- All frontend tests pass and frontend production build succeeds.
- Backend regression suite now runs via local venv Python and passes (`242 passed`).
- Code review follow-up fixes applied: non-Strava statuses no longer overstate "connected", Strava endpoint failures produce source-level `error`, and Sources refresh now guards stale request races.
- Follow-up code review fixes applied: non-Strava providers default to `warning` when configured unless explicit backend `provider_statuses` is provided, optional backend `provider_statuses` is honored for explicit source errors, and Source-page test fixtures now align to reachable status paths.
- Follow-up code review fixes applied: backend `provider_statuses` values are now runtime-sanitized to the allowed status set, non-Strava fallback mapping avoids overstating live connection health, and an in-flight request ordering regression test now covers stale-response overwrite protection.

### File List

- _bmad-output/implementation-artifacts/1-2-view-source-connection-status.md
- chronicle-ui/src/api/source-status-api.ts
- chronicle-ui/src/api/source-status-api.test.ts
- chronicle-ui/src/features/sources/sources-page.tsx
- chronicle-ui/src/features/sources/sources-page.test.tsx

### Change Log

- 2026-02-26: Implemented Story 1.2 source connection status UI and status-mapping API module; added frontend tests and validated build/test. Backend regression execution blocked by missing `pytest` in environment.
- 2026-02-26: Code review fixes applied for status-truthfulness, source-level error semantics, stale-refresh race handling, and backend regression execution via local venv pytest.
- 2026-02-26: Follow-up review fixes aligned status mapping semantics and test realism; validated with full frontend + backend regression runs.
- 2026-02-26: Follow-up review fixes added provider-status sanitization and StrictMode in-flight ordering coverage; revalidated full frontend and backend regression suites.

## Senior Developer Review (AI)

### Outcome

Approved

### Findings Addressed Automatically

- Updated source-status mapping so only Strava can be marked `connected` from live connection telemetry; non-Strava providers now avoid false "connected" signals.
- Added source-level Strava `error` state when live Strava status endpoint is unavailable.
- Added request sequencing guard to Sources page refresh flow to prevent stale-response overwrite races.
- Added/updated tests for Strava status endpoint failure handling and refresh loading-state behavior.
- Created local venv test path and executed full backend regression suite (`242 passed`) to close review confidence gaps.
- Added optional `provider_statuses` contract support and updated mapping/tests to reduce synthetic-status drift in Source-page test coverage.
- Hardened `provider_statuses` parsing to ignore invalid values and preserve AC-compliant status vocabulary.
- Added StrictMode race test to verify older in-flight responses cannot overwrite newer status data.
