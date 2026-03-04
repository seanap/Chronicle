# UI Rollout Rollback Playbook (Story 8.3)

## Purpose
Provide an executable rollback procedure for brownfield MPA/SPA coexistence so that core flows can be restored to legacy MPA routing within 15 minutes after regression detection.

## Core Flows in Scope
- Sources
- Build
- Plan
- View
- Control

## Rollback SLO
- Target: restore canonical core journey traffic to MPA fallback targets within **15 minutes**.

## Trigger Conditions
- Critical regression in a migrated flow (broken navigation, non-functional page, blocked user action).
- Smoke test failure on canonical core journey routes.
- Release validation detects unreachable SPA target without acceptable fallback behavior.

## Procedure

### 1) Confirm current rollout status
```bash
curl http://localhost:1609/ops/ui-rollout/status
```

### 2) Trigger rollback
```bash
curl -X POST http://localhost:1609/ops/ui-rollout/rollback \
  -H "Content-Type: application/json" \
  -d '{"source":"oncall","reason":"regression"}'
```

### 3) Validate route recovery
```bash
./.venv/bin/python scripts/verify_ui_rollout_smoke.py
```

### 4) Manually spot-check canonical routes (optional but recommended)
```bash
curl -I http://localhost:1609/sources
curl -I http://localhost:1609/build
curl -I http://localhost:1609/plan
curl -I http://localhost:1609/view
curl -I http://localhost:1609/control
```

## Verification Checklist
- [ ] Rollback endpoint returns `mode: mpa`.
- [ ] Rollback payload includes `rollback_target_minutes: 15`.
- [ ] Canonical routes for all core flows resolve to working MPA behavior.
- [ ] Legacy fallback routes for all core flows are reachable.
- [ ] Smoke script exits successfully.

## Escalation
- If rollback endpoint fails, set `UI_ROLLOUT_DEFAULT_MODE=mpa` in `.env`, restart services, and re-run smoke verification.
- If individual core flow remains degraded, keep traffic on legacy fallback and open incident follow-up with route-specific evidence.
