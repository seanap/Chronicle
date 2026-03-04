# Story 1.3: Configure Source Credentials in UI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,
I want to enter and update source credentials in a web UI,
so that I can connect sources without editing files manually.

## Acceptance Criteria

1. **Given** I am on the Sources page  
   **When** I open a source's configuration panel  
   **Then** I can enter required credentials (e.g., client ID/secret, tokens)  
   **And** I can save changes and see a clear success or error message.
2. **Given** I submit invalid or expired credentials  
   **When** I save credential changes  
   **Then** the save is rejected with clear corrective guidance  
   **And** no partial or incorrect credentials are persisted.

## Tasks / Subtasks

- [x] Implement Sources credential form data model + API integration (AC: 1, 2)
  - [x] Add Sources API methods for loading setup config and saving updates via `GET/PUT /setup/api/config`.
  - [x] Model editable fields per provider using backend `provider_fields`, `secret_keys`, and current values.
  - [x] Preserve secret-entry semantics: empty secret field means "keep existing secret".

- [x] Build provider credential configuration panel(s) in SPA Sources page (AC: 1)
  - [x] Add expandable/provider-scoped configuration UI that includes required provider fields and labels.
  - [x] Render boolean toggles for `ENABLE_*` keys and text/password inputs for non-boolean fields.
  - [x] Show contextual source docs links where available from backend payload.

- [x] Implement save flow + user feedback (AC: 1, 2)
  - [x] Add save action that submits only changed/valid values to backend config endpoint.
  - [x] Show clear success feedback on save and refresh Sources status data after successful update.
  - [x] Surface backend errors with actionable, human-readable guidance (including invalid/expired credential cases).

- [x] Implement validation and persistence-safety behavior (AC: 2)
  - [x] Add client-side guardrails for obvious invalid input shapes (empty required non-secret identifiers, malformed basic formats where applicable).
  - [x] Ensure failed saves do not optimistically mutate persisted credential state in UI.
  - [x] Preserve current backend error envelopes/messages without introducing contract drift.

- [x] Add focused test coverage for credential configuration workflows (AC: 1, 2)
  - [x] Add API-level tests for load/save payload mapping and secret-field handling.
  - [x] Add Sources page tests for open/edit/save success path and error path with corrective messaging.
  - [x] Keep tests deterministic with mocked network responses; no live network dependency.

## Dev Notes

- Story 1.3 is credential configuration only. OAuth start/callback verification remains Story 1.4 scope.
- Reuse and extend existing Sources SPA patterns introduced in Story 1.2 (status cards, fetch lifecycle, request ordering guard).

### Technical Requirements

- Backend endpoints already available for this story:
  - `GET /setup/api/config`
  - `PUT /setup/api/config`
  - `GET /setup/api/env` (optional post-save refresh for `.env` snippet display if UX includes it)
- Use backend-provided setup metadata as source-of-truth:
  - `provider_fields`
  - `provider_links`
  - `secret_keys`
  - `secret_presence`
  - `masked_values`
- Preserve backend semantics from `setup_config_put`:
  - Unknown keys ignored
  - Empty secret values should not overwrite persisted secrets
  - Save failures return explicit error text; do not claim success in UI

### Architecture Compliance

- Keep UI concerns in `chronicle-ui/src/features/sources/`.
- Keep API request/response handling in `chronicle-ui/src/api/`.
- Do not change backend route paths or add `/api/v1` prefixes.
- Keep backend as system of record for connection/config state; frontend is display/edit orchestration only.

### Library / Framework Requirements

- Use existing project stack:
  - React 19.2
  - MUI 7.3.7
  - React Router 7.13.0
  - Vite 7.2.6
- Use existing HTTP abstraction patterns in `chronicle-ui/src/api/http-client.ts` for error handling consistency.

### File Structure Requirements

- Expected primary files:
  - `chronicle-ui/src/features/sources/sources-page.tsx`
  - `chronicle-ui/src/features/sources/sources-page.test.tsx`
  - `chronicle-ui/src/api/source-status-api.ts` (extend or split as needed for setup-config CRUD)
  - `chronicle-ui/src/api/source-status-api.test.ts` (or add dedicated setup-config API test file if cleaner)
- Follow established naming rules:
  - `kebab-case` file names
  - `PascalCase` React component exports

### Testing Requirements

- Validate both acceptance criteria directly:
  - Credential fields can be edited and saved with clear success feedback.
  - Invalid/expired credentials produce clear corrective error feedback with no partial persistence in UI state.
- Maintain existing Story 1.2 test coverage and avoid regressions in source status rendering.
- Run full `chronicle-ui` test suite and build before completion.

### Previous Story Intelligence

- Story 1.2 established:
  - Sources page status cards and loading/error/refresh UX.
  - Request sequencing guard to prevent stale overwrite.
  - API mapping patterns in `source-status-api.ts`.
- Extend these patterns instead of introducing parallel or conflicting Sources page state management.

### Git Intelligence Summary

- Recent commit history is primarily docs/repo hygiene oriented; Story 1.3 should keep focused code deltas in SPA Sources + API tests.
- Working tree may contain unrelated churn; implementation should scope file changes tightly to Story 1.3 requirements.

### Latest Tech Information

- Use currently pinned project versions from architecture/project-context for consistency.
- Keep implementation aligned with existing React + MUI + Vitest test patterns already passing in repository.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - No secret leakage in logs or UI snapshots.
  - Backend contract stability.
  - Feature-first SPA structure.
  - Deterministic test behavior.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md#L198]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md#L233]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md#L393]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md#L276]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py#L1059]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py#L1064]
- [Source: /home/shipyard/src/Auto-Stat-Description/static/setup.js]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/1-2-view-source-connection-status.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Auto-selected next backlog item from sprint status: `1-3-configure-source-credentials-in-ui`.
- Context assembled from epics, PRD, architecture, UX spec, project context, current Sources SPA implementation, and setup backend endpoints.
- `npm run test -- src/api/http-client.test.ts src/api/source-status-api.test.ts src/features/sources/sources-page.test.tsx`
- `npm run test`
- `npm run build`
- `.venv/bin/python -m pytest`

### Completion Notes List

- Added setup config CRUD support to Sources API client and expanded setup payload typing for provider metadata.
- Extended HTTP client request support to handle JSON PUT bodies and backend string/object error envelopes.
- Implemented provider-scoped credential editor UI in Sources page with dynamic field rendering (text/password/toggle), docs link support, and save/close actions.
- Added client-side validation for required non-secret fields and changed-values-only save payload construction.
- Preserved secret semantics (blank secrets are not submitted) and no-optimistic-persistence behavior on failed saves.
- Added and passed focused tests for credential edit success/error flows and setup-config API request mapping.
- Validated with full frontend test/build and full backend pytest regression.

### File List

- _bmad-output/implementation-artifacts/1-3-configure-source-credentials-in-ui.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- chronicle-ui/src/api/http-client.ts
- chronicle-ui/src/api/http-client.test.ts
- chronicle-ui/src/api/source-status-api.ts
- chronicle-ui/src/api/source-status-api.test.ts
- chronicle-ui/src/features/sources/sources-page.tsx
- chronicle-ui/src/features/sources/sources-page.test.tsx

### Change Log

- 2026-02-26: Implemented Story 1.3 credential configuration UI + API integration, added targeted coverage, and moved story to review.
- 2026-02-26: Senior code review fixes applied for disabled-provider validation, save-controls-on-load-failure UX, and additional edge-case coverage.
- 2026-02-26: Follow-up code review fixes applied for accessibility semantics, acronym label correctness, secret-preservation UI test coverage, and validation scope refinement.
- 2026-02-26: Additional review fixes applied for provider-config refresh behavior, OAuth acronym mapping, and expanded accessibility/refresh test coverage.
- 2026-02-26: Additional review fixes applied for unchanged-required-identifier validation and expanded email/URL validation regression coverage.
- 2026-02-26: Additional review fixes applied for provider config loading-state scoping, non-secret required-field enforcement, and region landmark accessibility semantics.
- 2026-02-26: Additional review fixes applied for optional-field validation relaxation and rapid provider-switch loading race regression coverage.

### Senior Developer Review (AI)

- Reviewer: GPT-5 Codex
- Date: 2026-02-26
- Outcome: Approved after fixes

#### Findings Summary

- High: 1
- Medium: 2
- Low: 0

#### Issues Fixed

- Fixed provider disable flow so required credential validation is skipped when provider toggle is off.
- Fixed no-op save UX by hiding save controls when provider config failed to load.
- Added tests for disable-with-missing-fields behavior and config-load failure behavior.

#### Validation Evidence

- `npm run test -- src/features/sources/sources-page.test.tsx src/api/source-status-api.test.ts src/api/http-client.test.ts`
- `npm run test`
- `npm run build`

### Senior Developer Review (AI) - Pass 2

- Reviewer: GPT-5 Codex
- Date: 2026-02-26
- Outcome: Approved after fixes

#### Findings Summary

- High: 0
- Medium: 4
- Low: 0

#### Issues Fixed

- Refined required-field validation to enforce obvious identifier fields only, reducing false validation blocks on optional non-secret fields.
- Added `aria-expanded` + `aria-controls` semantics to provider configuration toggles for improved accessibility.
- Improved credential field labels by preserving common acronyms (`ID`, `API`, `URL`, `OAuth`).
- Added UI regression test proving blank secret input preserves existing stored secret while saving changed non-secret values.

#### Validation Evidence

- `npm run test -- src/features/sources/sources-page.test.tsx src/api/source-status-api.test.ts src/api/http-client.test.ts`
- `npm run test`
- `npm run build`

### Senior Developer Review (AI) - Pass 3

- Reviewer: GPT-5 Codex
- Date: 2026-02-26
- Outcome: Approved after fixes

#### Findings Summary

- High: 0
- Medium: 4
- Low: 0

#### Issues Fixed

- Provider configuration now reloads from backend when reopening a provider panel (eliminates stale in-session config cache behavior).
- Fixed acronym preservation bug for OAuth labels by mapping uppercase token to canonical display form.
- Replaced brittle required-field suffix guard with changed-field shape validation (`ID`, `EMAIL`, `URL`/`BASE_URL`) to reduce false blocks and catch obvious malformed input.
- Added tests for panel accessibility semantics (`aria-expanded`, `aria-controls`) and reopen-triggered config reload behavior.

#### Validation Evidence

- `npm run test -- src/features/sources/sources-page.test.tsx`
- `npm run test`
- `npm run build`

### Senior Developer Review (AI) - Pass 4

- Reviewer: GPT-5 Codex
- Date: 2026-02-26
- Outcome: Approved after fixes

#### Findings Summary

- High: 1
- Medium: 3
- Low: 0

#### Issues Fixed

- Tightened client guardrails so required identifier checks run even when those fields were not changed.
- Added regression test proving save is blocked when a required identifier remains empty while other fields are edited.
- Added regression tests for email-shape and URL-shape validation guidance.

#### Validation Evidence

- `npm run test -- src/features/sources/sources-page.test.tsx`
- `npm run test`
- `npm run build`

### Senior Developer Review (AI) - Pass 5

- Reviewer: GPT-5 Codex
- Date: 2026-02-26
- Outcome: Approved after fixes

#### Findings Summary

- High: 0
- Medium: 3
- Low: 0

#### Issues Fixed

- Scoped provider-config loading state to the active provider request to reduce cross-provider loading-state race behavior.
- Replaced heuristic required-field behavior with deterministic required checks for all non-secret, non-boolean fields when provider is enabled.
- Added explicit region landmark semantics (`role="region"` + `aria-labelledby`) and assertions in tests for accessibility relationship coverage.

#### Validation Evidence

- `npm run test -- src/features/sources/sources-page.test.tsx`
- `npm run test`
- `npm run build`

### Senior Developer Review (AI) - Pass 6

- Reviewer: GPT-5 Codex
- Date: 2026-02-26
- Outcome: Approved after fixes

#### Findings Summary

- High: 0
- Medium: 3
- Low: 0

#### Issues Fixed

- Relaxed non-secret validation so optional non-secret fields are not blocked when unchanged; required identifier checks remain enforced.
- Added race-condition regression test for rapid provider switching with out-of-order config loads.
- Stabilized test isolation by resetting mock implementations after each test.

#### Validation Evidence

- `npm run test -- src/features/sources/sources-page.test.tsx`
- `npm run test`
- `npm run build`
