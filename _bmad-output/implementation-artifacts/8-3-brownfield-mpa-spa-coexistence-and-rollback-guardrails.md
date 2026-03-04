# Story 8.3: Brownfield MPA/SPA Coexistence and Rollback Guardrails

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,  
I want phased MPA/SPA coexistence guardrails with rollback checks,  
so that UI migration can ship safely without breaking existing core flows.

## Acceptance Criteria

1. **Given** a new SPA route is introduced  
   **When** it is released  
   **Then** the corresponding legacy MPA flow remains available behind a fallback path  
   **And** smoke tests verify core journeys (Sources, Build, Plan, View, Control) before and after release.

2. **Given** a regression is detected in a migrated flow  
   **When** rollback is triggered  
   **Then** traffic can return to the MPA fallback within 15 minutes  
   **And** the rollback procedure and verification checklist are documented and executable.

## Tasks / Subtasks

- [x] Implement MPA/SPA coexistence route guardrails for core journeys (AC: 1)
  - [x] Add canonical core journey route entry points for Sources, Build, Plan, View, and Control.
  - [x] Ensure legacy MPA pages remain reachable through explicit fallback paths for each core journey.
  - [x] Keep existing legacy endpoints (`/setup`, `/editor`, `/dashboard`, `/plan`, `/control`) stable and backward compatible.

- [x] Implement rollout mode and rollback trigger behavior (AC: 1, 2)
  - [x] Add rollout status endpoint exposing effective mode and route targets for core journeys.
  - [x] Add rollout mode switch endpoint for release simulation and smoke testing.
  - [x] Add rollback trigger endpoint that forces MPA mode and returns rollback verification payload.

- [x] Add automated smoke coverage for before/after release and rollback (AC: 1, 2)
  - [x] Add tests validating MPA mode core-journey behavior and fallback-path availability.
  - [x] Add tests validating SPA mode route target behavior while legacy fallback remains available.
  - [x] Add tests validating rollback switches effective routing back to MPA guardrails.

- [x] Document rollback procedure and executable verification checklist (AC: 2)
  - [x] Add operator-facing rollback runbook with 15-minute target and concrete verification steps.
  - [x] Add executable verification script/checklist for core journey route smoke checks.
  - [x] Ensure docs and script align with implemented endpoints and route behavior.

## Dev Notes

- Scope boundary for Story 8.3:
  - Introduces brownfield route guardrails and rollback operations for phased UI migration.
  - Focuses on routing safety, rollback operability, and validation coverage.
  - Does not migrate all UI pages to SPA hosting in this story.

### Technical Requirements

- Primary requirement sources:
  - Epic 8 Story 8.3 AC in `_bmad-output/planning-artifacts/epics.md`.
  - Architecture requirement: preserve existing MPA routes unless SPA clearly improves UX/velocity.
  - Architecture requirement: brownfield migration must include MPA/SPA coexistence safeguards and rollback validation.
- Core journeys in scope:
  - Sources
  - Build
  - Plan
  - View
  - Control
- Rollback SLO requirement:
  - rollback path must be operable to return traffic to legacy MPA within 15 minutes.

### Architecture Compliance

- Keep API and route contract stability:
  - Preserve existing MPA endpoints and template rendering paths.
  - Add guardrail endpoints without changing existing JSON payload contracts unrelated to rollout.
- Keep backend source of truth for routing mode:
  - do not move authoritative routing decisions into frontend-only logic.

### Library / Framework Requirements

- Use current stack without upgrades:
  - Flask 3.1.0 backend routing
  - Python `unittest` for backend smoke/route verification
  - Existing React/Vite SPA route definitions remain consistent with guarded journey names.

### File Structure Requirements

- Likely files to modify:
  - `chronicle/api_server.py`
  - `tests/test_api_server.py`
  - `docs/API_DOCUMENTATION.md`
  - `docs/deployment-guide.md`
  - `scripts/verify_ui_rollout_smoke.py` (new)
  - `_bmad-output/implementation-artifacts/8-3-brownfield-mpa-spa-coexistence-and-rollback-guardrails.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`
  - `_bmad-output/implementation-artifacts/tests/test-summary.md`

### Testing Requirements

- Acceptance coverage:
  - Core journeys remain reachable under MPA mode.
  - Fallback legacy paths exist for core journeys even when rollout mode changes.
  - Rollback trigger flips routing behavior back to MPA mode.
  - Rollback verification path is executable and scriptable.
- Suggested verification commands:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `./.venv/bin/python scripts/verify_ui_rollout_smoke.py`
  - `npm run test -- src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`

### Previous Story Intelligence

- Story 8.1 added Health page and operational status panels.
- Story 8.2 added Troubleshooting guide and explicit remediation patterns.
- Story 8.3 should leverage those reliability UX gains and add safe migration/rollback controls without destabilizing existing flows.

### Git Intelligence Summary

- Recent implementation pattern is test-first with deterministic route/API assertions.
- Existing code emphasizes preserving route contracts and adding targeted, high-signal regression tests.

### Project Context Reference

- Enforce `_bmad-output/project-context.md` rules:
  - Do not change existing endpoint paths used by current consumers without compatibility guardrails.
  - Keep backend as source of truth for operational routing state.
  - Avoid introducing new dependencies unless explicitly required.

### Story Completion Status

- Story implementation completed.
- Story status set to `done`.
- Completion note: MPA/SPA coexistence route guardrails, rollback trigger endpoints, backend smoke coverage, and executable rollback verification playbook are in place for safe phased migration.

### References

- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/epics.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md]
- [Source: /home/shipyard/src/Auto-Stat-Description/_bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story file created from Epic 8 Story 8.3 and brownfield architecture guardrail requirements.
- Added canonical guardrail routes: `/sources`, `/build`, `/plan`, `/view`, `/control`.
- Added legacy fallback routes for core flows: `/legacy/<flow_name>`.
- Added SPA entry route with fallback behavior when built SPA assets are unavailable: `/app` and `/app/<path>`.
- Added rollout operational endpoints:
  - `GET /ops/ui-rollout/status`
  - `POST /ops/ui-rollout/mode`
  - `POST /ops/ui-rollout/rollback`
- Added regression coverage in `tests/test_api_server.py` for:
  - MPA mode journey behavior
  - SPA mode canonical route targeting + legacy fallback availability
  - rollback guardrail metadata + route restoration
  - invalid mode validation + unknown legacy flow handling
- Added executable smoke verification script:
  - `scripts/verify_ui_rollout_smoke.py`
- Documentation updates:
  - API route docs for rollout/fallback endpoints
  - Deployment guide rollout/rollback section
  - dedicated rollback playbook and docs index link
- Code review follow-up fixes applied:
  - rollout tests and smoke script now derive SPA base path dynamically from status endpoint instead of hardcoding `/app`
  - smoke script now restores environment and settings in `finally` for safe failure handling
  - rollout endpoints now return explicit structured errors when runtime-state writes fail
- Verification commands executed:
  - `./.venv/bin/python -m unittest tests.test_api_server`
  - `./.venv/bin/python scripts/verify_ui_rollout_smoke.py`
  - `npm run test -- src/app-smoke.test.tsx`
  - `npm run test`
  - `npm run build`
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server`

### Completion Notes List

- Delivered phased core-flow route guardrails so canonical routes can safely target SPA or MPA based on rollout mode.
- Ensured explicit MPA fallback paths remain available for Sources/Build/Plan/View/Control journeys.
- Added rollback operation endpoint with 15-minute target metadata and executable verification checklist payload.
- Added operator runbook and executable smoke script to validate before/after release and rollback behavior.
- Completed dev/review/fix/QA cycle with passing backend + frontend + smoke verification runs.

### File List

- _bmad-output/implementation-artifacts/8-3-brownfield-mpa-spa-coexistence-and-rollback-guardrails.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- chronicle/api_server.py
- tests/test_api_server.py
- scripts/verify_ui_rollout_smoke.py
- docs/API_DOCUMENTATION.md
- docs/deployment-guide.md
- docs/ui-rollout-rollback.md
- docs/index.md

### Change Log

- 2026-03-04: Created Story 8.3 with comprehensive context and set status to ready-for-dev.
- 2026-03-04: Implemented coexistence/rollback guardrails, fixed review follow-ups, and completed QA with story status set to done.
