#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from chronicle import api_server

CORE_FLOWS = ("sources", "build", "plan", "view", "control")


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _set_mode(client, mode: str, *, source: str) -> None:
    response = client.post(
        "/ops/ui-rollout/mode",
        json={"mode": mode, "source": source},
    )
    payload = response.get_json() or {}
    _assert(response.status_code == 200, f"Failed to set mode {mode}: {payload}")
    _assert(payload.get("mode") == mode, f"Mode mismatch after set: expected {mode}, got {payload}")


def _verify_mpa_mode(client) -> None:
    for flow_name in CORE_FLOWS:
        response = client.get(f"/{flow_name}", follow_redirects=False)
        _assert(response.status_code == 200, f"Expected /{flow_name} to return 200 in mpa mode, got {response.status_code}")

    for flow_name in CORE_FLOWS:
        response = client.get(f"/legacy/{flow_name}", follow_redirects=False)
        _assert(
            response.status_code == 200,
            f"Expected /legacy/{flow_name} to return 200 in mpa mode, got {response.status_code}",
        )


def _verify_spa_mode(client, *, spa_base_path: str) -> None:
    expected_targets = {flow_name: f"{spa_base_path}/{flow_name}" for flow_name in CORE_FLOWS}
    for flow_name, target in expected_targets.items():
        response = client.get(f"/{flow_name}", follow_redirects=False)
        _assert(response.status_code == 302, f"Expected /{flow_name} to redirect in spa mode, got {response.status_code}")
        _assert(
            response.headers.get("Location") == target,
            f"Expected /{flow_name} to target {target}, got {response.headers.get('Location')}",
        )

    for flow_name in CORE_FLOWS:
        app_response = client.get(f"{spa_base_path}/{flow_name}", follow_redirects=False)
        _assert(app_response.status_code in {200, 302}, f"Unexpected /app/{flow_name} status {app_response.status_code}")
        if app_response.status_code == 302:
            _assert(
                app_response.headers.get("Location") == f"/legacy/{flow_name}",
                f"Expected /app/{flow_name} fallback to /legacy/{flow_name}, got {app_response.headers.get('Location')}",
            )

    for flow_name in CORE_FLOWS:
        legacy_response = client.get(f"/legacy/{flow_name}", follow_redirects=False)
        _assert(
            legacy_response.status_code == 200,
            f"Expected /legacy/{flow_name} to remain available in spa mode, got {legacy_response.status_code}",
        )


def _verify_rollback(client) -> dict[str, object]:
    response = client.post(
        "/ops/ui-rollout/rollback",
        json={"source": "verify-ui-rollout-smoke", "reason": "smoke-check"},
    )
    payload = response.get_json() or {}
    _assert(response.status_code == 200, f"Rollback endpoint failed: {payload}")
    _assert(payload.get("mode") == "mpa", f"Rollback did not force mpa mode: {payload}")
    _assert(payload.get("rollback_target_minutes") == 15, "Rollback target minutes changed unexpectedly.")
    _assert(int(payload.get("elapsed_ms") or 0) < 15 * 60 * 1000, "Rollback elapsed time exceeds 15-minute guardrail.")
    checklist = payload.get("verification_checklist") or []
    _assert(len(checklist) == 5, f"Expected 5 rollback checklist items, got {len(checklist)}")
    return payload


def run_smoke_checks() -> dict[str, object]:
    original_state_dir = os.environ.get("STATE_DIR")
    original_setup_env = os.environ.get("SETUP_ENV_FILE")
    original_settings = api_server.settings
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            os.environ["STATE_DIR"] = temp_dir
            os.environ["SETUP_ENV_FILE"] = str(Path(temp_dir) / ".env")
            api_server.settings = api_server.Settings.from_env()
            api_server.settings.ensure_state_paths()

            client = api_server.app.test_client()
            _set_mode(client, "mpa", source="verify-ui-rollout-smoke")
            _verify_mpa_mode(client)

            _set_mode(client, "spa", source="verify-ui-rollout-smoke")
            status_payload = client.get("/ops/ui-rollout/status").get_json() or {}
            spa_base_path = str(status_payload.get("spa_base_path") or "/app").rstrip("/")
            if not spa_base_path:
                spa_base_path = "/app"
            _verify_spa_mode(client, spa_base_path=spa_base_path)

            rollback_payload = _verify_rollback(client)
            _verify_mpa_mode(client)

        return {
            "status": "ok",
            "flows": list(CORE_FLOWS),
            "rollback_target_minutes": rollback_payload.get("rollback_target_minutes"),
            "rollback_elapsed_ms": rollback_payload.get("elapsed_ms"),
        }
    finally:
        if original_state_dir is None:
            os.environ.pop("STATE_DIR", None)
        else:
            os.environ["STATE_DIR"] = original_state_dir
        if original_setup_env is None:
            os.environ.pop("SETUP_ENV_FILE", None)
        else:
            os.environ["SETUP_ENV_FILE"] = original_setup_env
        api_server.settings = original_settings


if __name__ == "__main__":
    summary = run_smoke_checks()
    print(json.dumps(summary, indent=2, sort_keys=True))
    print("PASS: UI rollout smoke checks completed.")
