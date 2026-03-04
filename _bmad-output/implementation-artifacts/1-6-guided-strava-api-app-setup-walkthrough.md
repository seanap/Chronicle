# Story 1.6: Guided Strava API App Setup Walkthrough

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a runner,
I want a guided walkthrough for creating a Strava API app,
so that I can complete OAuth setup without confusion.

## Acceptance Criteria

1. **Given** I have not created a Strava API app  
   **When** I open the Strava setup walkthrough  
   **Then** I see step-by-step instructions with required fields  
   **And** I can confirm completion and proceed to OAuth setup.
2. **Given** I am uncertain about required values for Strava app setup  
   **When** I use the walkthrough in Sources  
   **Then** the guidance points me to the correct official Strava app creation surface  
   **And** it clearly maps required values (callback URL, Client ID, Client Secret) to the existing credential + OAuth flow without creating false "connected" status.

## Tasks / Subtasks

- [x] Add guided setup walkthrough UI in Sources feature (AC: 1, 2)
  - [x] Add a Strava-specific walkthrough entry point in `chronicle-ui/src/features/sources/sources-page.tsx` (for example: "Strava Setup Walkthrough").
  - [x] Render clear ordered steps for creating a Strava API app with field-level guidance:
    - [x] where to create app (official Strava Developers app page)
    - [x] what to enter for app settings (app name/category as guidance only)
    - [x] required authorization callback domain/URL expectations that match backend callback behavior
    - [x] where to paste resulting Client ID/Client Secret in existing Sources config panel.
  - [x] Include a clear "continue to OAuth" action that routes the user into the existing OAuth connect flow.

- [x] Preserve existing OAuth/status safety behavior (AC: 2)
  - [x] Reuse Story 1.4/1.5 verification-first behavior: guidance must not imply connected status before backend refresh confirms it.
  - [x] Do not alter existing endpoint paths or OAuth callback contract.
  - [x] Ensure guidance text does not expose or log secrets.

- [x] Add focused test coverage for walkthrough behavior (AC: 1, 2)
  - [x] Add Sources page tests validating walkthrough entry point visibility and step rendering.
  - [x] Add test coverage that walkthrough "continue" action leads to existing OAuth-start action path (or equivalent UX hook) without bypassing validations.
  - [x] Add regression assertions that existing connection status and disconnect/reconnect UX behavior remain unchanged.

## Dev Notes

- Story 1.4 and 1.5 already completed OAuth start/callback verification and disconnect/reconnect hardening; Story 1.6 adds guidance-only UX and must preserve those reliability guardrails.
- FR31 is a Phase-2 requirement in PRD; this story intentionally scopes to an implementation-ready guided UX on Sources that helps non-technical setup completion.

### Technical Requirements

- Existing backend endpoints that remain source-of-truth:
  - `POST /setup/api/strava/oauth/start`
  - `GET /setup/strava/callback`
  - `GET /setup/api/strava/status`
  - `POST /setup/api/strava/disconnect`
- Existing credential flow in Sources already supports Strava credential entry and setup documentation link (`https://developers.strava.com/`).
- Walkthrough must remain orchestration/guidance in frontend; do not add backend token handling logic in UI.

### Architecture Compliance

- Keep implementation in Sources feature:
  - `chronicle-ui/src/features/sources/`
  - optional shared presentational components in `chronicle-ui/src/components/` only if reuse is clear.
- Keep API abstractions in `chronicle-ui/src/api/`.
- Backend remains authority for connection status; frontend must not compute authoritative connected state.
- Keep route and API contracts unchanged (`/setup/*` paths).

### Library / Framework Requirements

- Use existing pinned stack in repo:
  - React 19.2.0
  - React Router 7.13.0
  - MUI 7.3.7
  - Vite 7.2.6
  - Vitest 3.2.4
- Continue using existing testing style (React Testing Library + Vitest).
- Do not introduce new dependencies for this story.

### File Structure Requirements

- Primary expected files:
  - `chronicle-ui/src/features/sources/sources-page.tsx`
  - `chronicle-ui/src/features/sources/sources-page.test.tsx`
- Optional only if needed:
  - `chronicle-ui/src/features/sources/*` component extraction for walkthrough panel/steps
  - `chronicle-ui/src/api/source-status-api.ts` only if existing API wrappers are reused without contract changes

### Testing Requirements

- Validate ACs directly:
  - Walkthrough is discoverable from Sources and renders actionable step-by-step setup guidance.
  - User can proceed from walkthrough into existing OAuth connect flow.
  - No false success/connected messaging introduced by walkthrough interactions.
- Regression-protect Story 1.4/1.5 behavior:
  - OAuth callback verification-first success handling remains intact.
  - Disconnect/reconnect guardrails and credential gating remain intact.
- Minimum verification commands:
  - `npm run test -- src/features/sources/sources-page.test.tsx src/api/source-status-api.test.ts`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 1.5 established:
  - Verification-first disconnect feedback and credential-aware disconnect action gating.
  - Robust Sources test coverage for success/failure, refresh sequencing, and safety messaging.
- Story 1.4 established:
  - Verified OAuth callback handling and strict authorize URL validation.
- Reuse existing alert + button patterns in Sources instead of adding parallel state systems.

### Git Intelligence Summary

- Current workspace includes broad untracked directories and unrelated tracked modifications.
- Keep Story 1.6 implementation tightly scoped to Sources walkthrough UX + tests.
- Ensure story file list is kept accurate during dev/review to avoid git/story traceability issues.

### Latest Tech Information

- Snapshot check (2026-02-27 via npm registry) shows newer upstream versions:
  - `react` latest 19.2.4 (project uses 19.2.0)
  - `react-router-dom` latest 7.13.1 (project uses 7.13.0)
  - `@mui/material` latest 7.3.8 (project uses 7.3.7)
  - `vite` latest 7.3.1 (project uses 7.2.6)
  - `vitest` latest 4.0.18 (project uses 3.2.4)
- Stay on project-pinned versions; no dependency upgrades in this story.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` constraints:
  - Do not log secrets/tokens or persist secrets in repo artifacts.
  - Do not change endpoint paths or response shapes.
  - Keep tests deterministic and network-isolated.
  - Keep backend service boundaries intact (`api_server.py` thin; no domain logic shift to frontend).

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/chronicle/api_server.py]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/1-4-complete-strava-oauth-and-verify-connection.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/implementation-artifacts/1-5-disconnect-and-reconnect-sources-without-losing-settings.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- User requested explicit story creation for Story 1.6.
- Parsed Epic 1 Story 1.6 from planning artifacts and sprint status.
- Loaded PRD FR31 context and Journey J3 onboarding constraints.
- Mapped architecture boundaries for FR31-34 guidance features.
- Reviewed prior stories 1.4 and 1.5 for continuity, reliability, and regression guardrails.
- Checked current pinned-vs-latest frontend package versions (npm registry snapshot) for implementation guidance.
- Marked sprint status `1-6-guided-strava-api-app-setup-walkthrough` as `in-progress`.
- Implemented Strava walkthrough entry point, instruction panel, and continue-to-OAuth CTA in Sources UI.
- Added walkthrough-focused Sources tests (entry + step rendering + continue-to-OAuth flow).
- `npm run test -- src/features/sources/sources-page.test.tsx` (red: failing walkthrough tests, then green after implementation)
- `npm run test -- src/features/sources/sources-page.test.tsx`
- `npm run test -- src/api/source-status-api.test.ts src/features/sources/sources-page.test.tsx`
- `npm run test`
- `npm run build`
- Review workflow executed for Story 1.6 with adversarial AC validation and git/story traceability checks.
- `npm run test -- src/features/sources/sources-page.test.tsx` (post-review fixes)
- `npm run test -- src/api/source-status-api.test.ts src/features/sources/sources-page.test.tsx` (post-review fixes)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story is ready for direct `dev-story` execution with scoped files, contracts, and regression constraints.
- Added guided Strava API app walkthrough flow in Sources with explicit callback domain/URL and credential placement guidance.
- Added "Continue to OAuth" action in walkthrough that reuses the existing OAuth-start validation path.
- Preserved verification-first status safety behavior and existing `/setup/*` contracts.
- Added walkthrough regression coverage and validated full frontend test/build suite.
- Code review fixes applied: callback domain now uses hostname (no port), walkthrough includes direct official Strava Developers link, and walkthrough tests assert domain/link correctness.
- Walkthrough now closes when continuing to OAuth to keep flow state clean on return.

### File List

- _bmad-output/implementation-artifacts/1-6-guided-strava-api-app-setup-walkthrough.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- chronicle-ui/src/features/sources/sources-page.tsx
- chronicle-ui/src/features/sources/sources-page.test.tsx

### Change Log

- 2026-02-27: Created Story 1.6 with comprehensive implementation context and updated sprint tracking to ready-for-dev.
- 2026-02-27: Implemented Story 1.6 walkthrough UX + tests; validated frontend suites and moved story to review.
- 2026-02-27: Completed code review remediation for Story 1.6 and verified targeted test suites; story moved to done.

### Senior Developer Review (AI)

- Reviewer: GPT-5 Codex
- Date: 2026-02-27
- Outcome: Approved after fixes

#### Findings Fixed

- [HIGH] Corrected Strava callback domain guidance to use hostname instead of host-with-port.
- [MEDIUM] Added a direct link to the official Strava Developers app creation surface in walkthrough guidance.
- [MEDIUM] Expanded walkthrough test coverage to assert direct Strava Developers link and callback domain rendering.
- [LOW] Improved walkthrough UX by closing the panel on "Continue to OAuth."

#### Notes

- Git/story discrepancy signal is influenced by a workspace-wide untracked baseline and unrelated tracked changes; Story 1.6 implementation remained scoped to Sources UI and test files listed in this story.
