# Epic 8 Retrospective: Reliability & Recovery

Date: 2026-03-04  
Status: done

## Scope Reviewed

- Story 8.1: Health/Status page
- Story 8.2: Troubleshooting guide with actionable fixes
- Story 8.3: Brownfield MPA/SPA coexistence and rollback guardrails

## Outcomes

- Added operational health visibility and clear next actions for system states.
- Added user-facing troubleshooting guidance for token/OAuth, Docker/runtime, and connectivity/API failures.
- Added phased rollout guardrails with explicit MPA fallback routes, rollout status/mode APIs, rollback trigger, and executable rollback smoke verification.
- Completed full dev/review/fix/QA loop for all Epic 8 stories with passing verification runs.

## What Went Well

- Story slicing was coherent: status visibility first, troubleshooting second, guardrail operations third.
- Deterministic tests caught regressions early (route label drift, router context assumptions, rollout path assumptions).
- Backward compatibility was preserved while adding migration controls.
- Documentation and executable verification were delivered together for operability.

## Issues Encountered

- Initial nav/route label divergence caused smoke-test mismatch during 8.2.
- Health page tests required router context after adding troubleshooting CTA.
- Rollout tests/scripts initially hardcoded SPA base path; needed dynamic derivation from status endpoint.

## Corrective Actions Applied

- Derived app-shell nav links from route config to reduce drift risk.
- Wrapped health page tests with `MemoryRouter` for stable link assertions.
- Updated rollout tests and smoke script to use status endpoint `spa_base_path`.
- Added structured error responses for rollout mode/rollback state-write failures.

## Verification Summary

- Frontend:
  - `npm run test` passed (235 tests)
  - `npm run build` passed
- Backend:
  - `./.venv/bin/python -m unittest tests.test_worker tests.test_api_server` passed (129 tests)
  - `./.venv/bin/python scripts/verify_ui_rollout_smoke.py` passed

## Residual Risks

- Rollout mode currently depends on runtime state persistence; deployment-level fallback still depends on environment/ops discipline.
- Chunk-size warning remains in SPA build output (non-blocking but worth future optimization).

## Next Recommendations

1. Normalize earlier epic status rows (`epic-1` through `epic-7`) to `done` since their story rows are already complete.
2. Add rollout/rollback checks to CI as a non-flaky backend smoke job.
3. Consider follow-up story for SPA chunk splitting/performance hardening.
