import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

try:
    import chronicle.api_server as api_server
except ModuleNotFoundError:
    api_server = None


@unittest.skipIf(api_server is None, "Flask is not installed in this test environment.")
class TestApiServer(unittest.TestCase):
    def setUp(self) -> None:
        self.client = api_server.app.test_client()
        self._original_run_once = api_server.run_once
        self._original_is_worker_healthy = api_server.is_worker_healthy
        self._original_get_dashboard_payload = api_server.get_dashboard_payload
        self._original_get_plan_payload = api_server.get_plan_payload
        self._original_settings = api_server.settings
        self._original_state_dir_env = os.environ.get("STATE_DIR")
        self._original_setup_env_file = os.environ.get("SETUP_ENV_FILE")

    def tearDown(self) -> None:
        api_server.run_once = self._original_run_once
        api_server.is_worker_healthy = self._original_is_worker_healthy
        api_server.get_dashboard_payload = self._original_get_dashboard_payload
        api_server.get_plan_payload = self._original_get_plan_payload
        api_server.settings = self._original_settings
        if self._original_state_dir_env is None:
            os.environ.pop("STATE_DIR", None)
        else:
            os.environ["STATE_DIR"] = self._original_state_dir_env
        if self._original_setup_env_file is None:
            os.environ.pop("SETUP_ENV_FILE", None)
        else:
            os.environ["SETUP_ENV_FILE"] = self._original_setup_env_file

    def _set_temp_state_dir(self, temp_dir: str) -> None:
        os.environ["STATE_DIR"] = temp_dir
        os.environ["SETUP_ENV_FILE"] = str(Path(temp_dir) / ".env")
        api_server.settings = api_server.Settings.from_env()
        api_server.settings.ensure_state_paths()

    def _set_ui_rollout_mode(self, mode: str, *, source: str = "test-suite") -> dict:
        response = self.client.post(
            "/ops/ui-rollout/mode",
            json={"mode": mode, "source": source},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json() or {}
        self.assertEqual(payload.get("status"), "ok")
        self.assertEqual(payload.get("mode"), mode)
        return payload

    def test_rerun_latest_endpoint(self) -> None:
        refresh_calls: list[tuple[tuple, dict]] = []
        api_server.run_once = lambda **kwargs: {"status": "updated", "kwargs": kwargs}
        api_server.get_dashboard_payload = lambda *args, **kwargs: refresh_calls.append((args, kwargs)) or {
            "generated_at": "2026-02-19T00:00:00+00:00",
            "years": [2026],
            "types": [],
            "type_meta": {},
            "other_bucket": "OtherSports",
            "aggregates": {},
            "units": {"distance": "mi", "elevation": "ft"},
            "week_start": "sunday",
            "activities": [],
        }
        response = self.client.post("/rerun/latest")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["result"]["kwargs"]["force_update"], True)
        self.assertEqual(payload.get("status_code"), "updated")
        self.assertIn("T", str(payload.get("timestamp_utc") or ""))
        self.assertEqual(payload.get("dashboard_refresh"), "updated")
        self.assertEqual(len(refresh_calls), 1)
        self.assertTrue(refresh_calls[0][1].get("force_refresh"))

    def test_rerun_activity_endpoint(self) -> None:
        refresh_calls: list[tuple[tuple, dict]] = []
        api_server.run_once = lambda **kwargs: {"status": "updated", "kwargs": kwargs}
        api_server.get_dashboard_payload = lambda *args, **kwargs: refresh_calls.append((args, kwargs)) or {
            "generated_at": "2026-02-19T00:00:00+00:00",
            "years": [2026],
            "types": [],
            "type_meta": {},
            "other_bucket": "OtherSports",
            "aggregates": {},
            "units": {"distance": "mi", "elevation": "ft"},
            "week_start": "sunday",
            "activities": [],
        }
        response = self.client.post("/rerun/activity/123456")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["result"]["kwargs"]["activity_id"], 123456)
        self.assertEqual(payload.get("status_code"), "updated")
        self.assertIn("T", str(payload.get("timestamp_utc") or ""))
        self.assertEqual(payload.get("dashboard_refresh"), "updated")
        self.assertEqual(len(refresh_calls), 1)

    def test_rerun_activity_returns_retry_guidance_for_locked_status(self) -> None:
        api_server.run_once = lambda **kwargs: {
            "status": "locked",
            "lock_owner": "run_once:def",
            "kwargs": kwargs,
        }
        response = self.client.post("/rerun/activity/654321")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload.get("status"), "ok")
        self.assertEqual(payload.get("status_code"), "locked")
        self.assertEqual(payload.get("result", {}).get("kwargs", {}).get("activity_id"), 654321)
        self.assertIn("T", str(payload.get("timestamp_utc") or ""))
        self.assertIn("already in progress", str(payload.get("retry_guidance") or ""))
        self.assertIn("run_once:def", str(payload.get("retry_guidance") or ""))

    def test_rerun_latest_skips_dashboard_refresh_when_not_updated(self) -> None:
        refresh_calls: list[tuple[tuple, dict]] = []
        api_server.run_once = lambda **kwargs: {"status": "already_processed", "kwargs": kwargs}
        api_server.get_dashboard_payload = lambda *args, **kwargs: refresh_calls.append((args, kwargs)) or {}
        response = self.client.post("/rerun/latest")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload.get("status_code"), "already_processed")
        self.assertIn("T", str(payload.get("timestamp_utc") or ""))
        self.assertNotIn("dashboard_refresh", payload)
        self.assertEqual(len(refresh_calls), 0)

    def test_rerun_latest_returns_retry_guidance_for_locked_status(self) -> None:
        api_server.run_once = lambda **_kwargs: {"status": "locked", "lock_owner": "run_once:abc"}
        response = self.client.post("/rerun/latest")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload.get("status"), "ok")
        self.assertEqual(payload.get("status_code"), "locked")
        self.assertIn("T", str(payload.get("timestamp_utc") or ""))
        self.assertIn("already in progress", str(payload.get("retry_guidance") or ""))
        self.assertIn("run_once:abc", str(payload.get("retry_guidance") or ""))

    def test_rerun_latest_error_includes_status_code_and_timestamp(self) -> None:
        def _raise(**_kwargs):
            raise RuntimeError("rerun exploded")

        api_server.run_once = _raise
        response = self.client.post("/rerun/latest")
        self.assertEqual(response.status_code, 500)
        payload = response.get_json()
        self.assertEqual(payload.get("status"), "error")
        self.assertEqual(payload.get("status_code"), "error")
        self.assertIn("T", str(payload.get("timestamp_utc") or ""))
        self.assertIn("rerun exploded", str(payload.get("error") or ""))

    def test_rerun_generic_with_invalid_id(self) -> None:
        response = self.client.post("/rerun", json={"activity_id": "abc"})
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")

    def test_editor_schema_endpoint(self) -> None:
        response = self.client.get("/editor/schema")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertTrue(str(payload.get("context_source")).startswith("sample"))

    def test_editor_catalog_endpoint(self) -> None:
        response = self.client.get("/editor/catalog?context_mode=fixture&fixture_name=humid_hammer")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertTrue(payload["has_context"])
        self.assertIn("catalog", payload)
        self.assertIn("fixtures", payload)
        self.assertIn("context_modes", payload)
        self.assertIn("helper_transforms", payload["catalog"])
        self.assertTrue(str(payload.get("context_source")).startswith("sample:"))

    def test_ready_endpoint(self) -> None:
        response = self.client.get("/ready")
        self.assertIn(response.status_code, {200, 503})
        payload = response.get_json()
        self.assertIn(payload["status"], {"ready", "not_ready"})
        self.assertIn("checks", payload)

    def test_ready_endpoint_requires_worker_heartbeat(self) -> None:
        api_server.is_worker_healthy = lambda *_args, **_kwargs: False
        response = self.client.get("/ready")
        self.assertEqual(response.status_code, 503)
        payload = response.get_json()
        self.assertEqual(payload["status"], "not_ready")
        self.assertFalse(payload["checks"]["worker_heartbeat_healthy"])

    def test_service_metrics_endpoint(self) -> None:
        response = self.client.get("/service-metrics")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("cycle_service_calls", payload)

    def test_setup_page_endpoint(self) -> None:
        response = self.client.get("/setup")
        self.assertEqual(response.status_code, 200)

    def test_root_redirects_to_dashboard(self) -> None:
        response = self.client.get("/", follow_redirects=False)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers.get("Location"), "/dashboard")

    def test_dashboard_page_endpoint(self) -> None:
        response = self.client.get("/dashboard")
        self.assertEqual(response.status_code, 200)

    def test_control_page_endpoint(self) -> None:
        response = self.client.get("/control")
        self.assertEqual(response.status_code, 200)

    def test_ui_rollout_core_flows_default_to_mpa_and_keep_legacy_fallback_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            self._set_ui_rollout_mode("mpa", source="test-mpa")

            status_response = self.client.get("/ops/ui-rollout/status")
            self.assertEqual(status_response.status_code, 200)
            status_payload = status_response.get_json() or {}
            self.assertEqual(status_payload.get("status"), "ok")
            self.assertEqual(status_payload.get("mode"), "mpa")

            flow_targets = {
                str(item.get("flow") or ""): str(item.get("target_path") or "")
                for item in status_payload.get("flows") or []
                if isinstance(item, dict)
            }
            self.assertEqual(flow_targets.get("sources"), "/legacy/sources")
            self.assertEqual(flow_targets.get("build"), "/legacy/build")
            self.assertEqual(flow_targets.get("plan"), "/legacy/plan")
            self.assertEqual(flow_targets.get("view"), "/legacy/view")
            self.assertEqual(flow_targets.get("control"), "/legacy/control")

            for path in ["/sources", "/build", "/plan", "/view", "/control"]:
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200, path)

            for path in ["/legacy/sources", "/legacy/build", "/legacy/plan", "/legacy/view", "/legacy/control"]:
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200, path)

    def test_ui_rollout_spa_mode_redirects_core_flows_and_preserves_legacy_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            self._set_ui_rollout_mode("spa", source="test-spa")
            status_payload = (self.client.get("/ops/ui-rollout/status").get_json() or {})
            spa_base_path = str(status_payload.get("spa_base_path") or "/app").rstrip("/")
            if not spa_base_path:
                spa_base_path = "/app"

            expected_redirects = {
                "/sources": f"{spa_base_path}/sources",
                "/build": f"{spa_base_path}/build",
                "/plan": f"{spa_base_path}/plan",
                "/view": f"{spa_base_path}/view",
                "/control": f"{spa_base_path}/control",
            }
            for path, expected_target in expected_redirects.items():
                response = self.client.get(path, follow_redirects=False)
                self.assertEqual(response.status_code, 302, path)
                self.assertEqual(response.headers.get("Location"), expected_target)

            response = self.client.get(f"{spa_base_path}/sources", follow_redirects=False)
            if response.status_code == 302:
                # When SPA assets are unavailable, app entry routes back to MPA fallback.
                self.assertEqual(response.headers.get("Location"), "/legacy/sources")
            else:
                # When SPA assets exist, app entry serves the built SPA index.
                self.assertEqual(response.status_code, 200)
                response.close()

            for path in ["/legacy/sources", "/legacy/build", "/legacy/plan", "/legacy/view", "/legacy/control"]:
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200, path)

    def test_ui_rollout_rollback_endpoint_forces_mpa_mode_with_guardrail_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            self._set_ui_rollout_mode("spa", source="test-pre-rollback")

            rollback_response = self.client.post(
                "/ops/ui-rollout/rollback",
                json={"source": "test-rollback", "reason": "regression"},
            )
            self.assertEqual(rollback_response.status_code, 200)
            rollback_payload = rollback_response.get_json() or {}
            self.assertEqual(rollback_payload.get("status"), "ok")
            self.assertEqual(rollback_payload.get("mode"), "mpa")
            self.assertEqual(rollback_payload.get("rollback_target_minutes"), 15)
            self.assertLess(int(rollback_payload.get("elapsed_ms") or 0), 15 * 60 * 1000)
            self.assertIn("T", str(rollback_payload.get("rolled_back_at_utc") or ""))
            self.assertIn("T", str(rollback_payload.get("rollback_deadline_utc") or ""))

            checklist = rollback_payload.get("verification_checklist") or []
            self.assertEqual(len(checklist), 5)

            # After rollback, canonical core routes should resolve back to legacy flow behavior.
            for path in ["/sources", "/build", "/plan", "/view", "/control"]:
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200, path)

    def test_ui_rollout_mode_rejects_invalid_mode(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.post(
                "/ops/ui-rollout/mode",
                json={"mode": "invalid", "source": "test-invalid-mode"},
            )
            self.assertEqual(response.status_code, 400)
            payload = response.get_json() or {}
            self.assertEqual(payload.get("status"), "error")
            error = payload.get("error") or {}
            self.assertEqual(error.get("code"), "UI_ROLLOUT_MODE_INVALID")

    def test_legacy_core_flow_rejects_unknown_flow(self) -> None:
        response = self.client.get("/legacy/unknown-flow")
        self.assertEqual(response.status_code, 404)
        payload = response.get_json() or {}
        self.assertEqual(payload.get("status"), "error")
        error = payload.get("error") or {}
        self.assertEqual(error.get("code"), "LEGACY_FLOW_NOT_FOUND")

    def test_control_activity_detection_endpoint_reports_new_activity_available(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            now_iso = api_server.datetime.now(api_server.timezone.utc).isoformat()
            api_server.set_runtime_value(
                api_server.settings.processed_log_file,
                "worker.last_heartbeat_utc",
                now_iso,
            )
            api_server.set_runtime_value(
                api_server.settings.processed_log_file,
                "worker.activity_detection.status",
                "new_activity_detected",
            )
            api_server.set_runtime_value(
                api_server.settings.processed_log_file,
                "worker.activity_detection.new_activity_available",
                True,
            )
            api_server.set_runtime_value(
                api_server.settings.processed_log_file,
                "worker.activity_detection.last_activity_id",
                "17455368360",
            )
            api_server.set_runtime_value(
                api_server.settings.processed_log_file,
                "worker.activity_detection.last_checked_at_utc",
                now_iso,
            )
            api_server.set_runtime_value(
                api_server.settings.processed_log_file,
                "worker.activity_detection.last_detected_at_utc",
                now_iso,
            )

            response = self.client.get("/control/activity-detection")
            self.assertEqual(response.status_code, 200)
            payload = response.get_json() or {}
            self.assertEqual(payload.get("status"), "ok")
            self.assertTrue(bool(payload.get("worker_heartbeat_healthy")))
            detection = payload.get("activity_detection") or {}
            self.assertEqual(str(detection.get("status") or ""), "new_activity_detected")
            self.assertTrue(bool(detection.get("new_activity_available")))
            self.assertEqual(str(detection.get("last_activity_id") or ""), "17455368360")

    def test_control_activity_detection_endpoint_defaults_without_state(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.get("/control/activity-detection")
            self.assertEqual(response.status_code, 200)
            payload = response.get_json() or {}
            self.assertEqual(payload.get("status"), "ok")
            self.assertFalse(bool(payload.get("worker_heartbeat_healthy")))
            detection = payload.get("activity_detection") or {}
            self.assertEqual(str(detection.get("status") or ""), "unknown")
            self.assertFalse(bool(detection.get("new_activity_available")))
            self.assertIsNone(detection.get("last_activity_id"))

    def test_plan_page_endpoint(self) -> None:
        response = self.client.get("/plan")
        self.assertEqual(response.status_code, 200)

    def test_plan_pace_workshop_defaults_endpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.get("/plan/pace-workshop.json")
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(payload.get("marathon_goal"), "5:00:00")
            supported = payload.get("supported_distances") or []
            self.assertGreaterEqual(len(supported), 8)

    def test_plan_pace_workshop_goal_persists(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            put_response = self.client.put(
                "/plan/pace-workshop/goal",
                json={"marathon_goal": "3:30:00"},
            )
            self.assertEqual(put_response.status_code, 200)
            put_payload = put_response.get_json()
            self.assertEqual(put_payload.get("status"), "ok")
            self.assertEqual(put_payload.get("marathon_goal"), "3:30:00")

            get_response = self.client.get("/plan/pace-workshop.json")
            self.assertEqual(get_response.status_code, 200)
            get_payload = get_response.get_json()
            self.assertEqual(get_payload.get("marathon_goal"), "3:30:00")

    def test_plan_pace_workshop_calculate_endpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.post(
                "/plan/pace-workshop/calculate",
                json={"distance": "10k", "time": "0:44:45"},
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(payload.get("derived_marathon_goal"), "3:29:36")
            self.assertEqual(payload.get("training", {}).get("matched_marathon_goal"), "3:30:00")
            race_list = payload.get("race_equivalency") or []
            distances = {item.get("distance"): item.get("time") for item in race_list if isinstance(item, dict)}
            self.assertEqual(distances.get("10k"), "44:40")
            self.assertEqual(distances.get("marathon"), "3:29:36")

    def test_plan_pace_workshop_calculate_rejects_invalid_payload(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.post(
                "/plan/pace-workshop/calculate",
                json={"distance": "foo", "time": "44:45"},
            )
            self.assertEqual(response.status_code, 400)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("distance", str(payload.get("error")))

    def test_plan_workouts_endpoint_defaults_empty(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.get("/plan/workouts")
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(payload.get("workouts"), [])

    def test_plan_workouts_put_creates_and_updates_definition(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            create_response = self.client.put(
                "/plan/workouts/2E-5x1k-I",
                json={
                    "title": "2E + 5x1k @I + 2E",
                    "structure": "warmup: 2E\nmain: 5x1k @I w/3:00 jog\ncooldown: 2E",
                },
            )
            self.assertEqual(create_response.status_code, 200)
            create_payload = create_response.get_json()
            self.assertEqual(create_payload.get("status"), "ok")
            workout = create_payload.get("workout") if isinstance(create_payload, dict) else {}
            self.assertEqual(str(workout.get("workout_code") or ""), "2E-5x1k-I")
            self.assertEqual(str(workout.get("title") or ""), "2E + 5x1k @I + 2E")
            self.assertIn("warmup:", str(workout.get("structure") or ""))

            list_response = self.client.get("/plan/workouts")
            self.assertEqual(list_response.status_code, 200)
            list_payload = list_response.get_json()
            workouts = list_payload.get("workouts") if isinstance(list_payload, dict) else []
            self.assertEqual(len(workouts), 1)
            self.assertEqual(str(workouts[0].get("workout_code") or ""), "2E-5x1k-I")

            update_response = self.client.put(
                "/plan/workouts/2E-5x1k-I",
                json={
                    "workout_code": "2E-5x1k-I",
                    "title": "2E + 6x1k @I + 2E",
                    "structure": "warmup: 2E\nmain: 6x1k @I w/3:00 jog\ncooldown: 2E",
                },
            )
            self.assertEqual(update_response.status_code, 200)
            update_payload = update_response.get_json()
            update_workout = update_payload.get("workout") if isinstance(update_payload, dict) else {}
            self.assertEqual(str(update_workout.get("workout_code") or ""), "2E-5x1k-I")
            self.assertEqual(str(update_workout.get("title") or ""), "2E + 6x1k @I + 2E")
            self.assertIn("6x1k", str(update_workout.get("structure") or ""))

            verify_response = self.client.get("/plan/workouts")
            self.assertEqual(verify_response.status_code, 200)
            verify_payload = verify_response.get_json()
            verify_workouts = verify_payload.get("workouts") if isinstance(verify_payload, dict) else []
            self.assertEqual(len(verify_workouts), 1)
            self.assertIn("6x1k", str(verify_workouts[0].get("structure") or ""))

    def test_plan_workouts_put_rejects_missing_required_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            missing_structure = self.client.put(
                "/plan/workouts/tempo-day",
                json={"title": "Tempo day"},
            )
            self.assertEqual(missing_structure.status_code, 400)
            missing_payload = missing_structure.get_json()
            self.assertEqual(missing_payload.get("status"), "error")
            self.assertIn("structure", str(missing_payload.get("error")))

            mismatch = self.client.put(
                "/plan/workouts/tempo-day",
                json={"workout_code": "different-code", "structure": "main: tempo"},
            )
            self.assertEqual(mismatch.status_code, 400)
            mismatch_payload = mismatch.get_json()
            self.assertEqual(mismatch_payload.get("status"), "error")
            self.assertIn("match path", str(mismatch_payload.get("error")))

    def test_plan_workouts_put_rejects_invalid_workout_code_characters(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.put(
                "/plan/workouts/tempo%5Cbad",
                json={"workout_code": "tempo\\bad", "structure": "main: tempo"},
            )
            self.assertEqual(response.status_code, 400)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("cannot contain", str(payload.get("error")))

    def test_dashboard_data_endpoint(self) -> None:
        api_server.get_dashboard_payload = lambda *_args, **_kwargs: {
            "generated_at": "2026-02-19T00:00:00+00:00",
            "years": [2026],
            "types": ["Run"],
            "type_meta": {"Run": {"label": "Run", "accent": "#01cdfe"}},
            "other_bucket": "OtherSports",
            "aggregates": {},
            "units": {"distance": "mi", "elevation": "ft"},
            "week_start": "sunday",
            "activities": [],
        }
        response = self.client.get("/dashboard/data.json")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn("years", payload)
        self.assertIn("types", payload)
        self.assertIn("activities", payload)

    def test_dashboard_data_endpoint_passes_response_mode_and_year(self) -> None:
        calls: list[dict] = []

        def _payload(*_args, **kwargs):
            calls.append(kwargs)
            return {
                "generated_at": "2026-02-19T00:00:00+00:00",
                "years": [2026],
                "types": ["Run"],
                "type_meta": {"Run": {"label": "Run", "accent": "#01cdfe"}},
                "other_bucket": "OtherSports",
                "aggregates": {},
                "units": {"distance": "mi", "elevation": "ft"},
                "week_start": "sunday",
                "activities": [],
            }

        api_server.get_dashboard_payload = _payload
        response = self.client.get("/dashboard/data.json?mode=year&year=2026&force=true")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].get("response_mode"), "year")
        self.assertEqual(calls[0].get("response_year"), "2026")
        self.assertTrue(bool(calls[0].get("force_refresh")))

    def test_dashboard_data_endpoint_returns_400_for_invalid_mode(self) -> None:
        def _raise(*_args, **_kwargs):
            raise ValueError("Invalid dashboard mode")

        api_server.get_dashboard_payload = _raise
        response = self.client.get("/dashboard/data.json?mode=bad")
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload.get("status"), "error")
        self.assertIn("Invalid dashboard mode", str(payload.get("error")))

    def test_plan_data_endpoint(self) -> None:
        calls: list[dict] = []

        def _payload(*_args, **kwargs):
            calls.append(kwargs)
            return {
                "status": "ok",
                "center_date": "2026-02-22",
                "window_days": 14,
                "rows": [],
            }

        api_server.get_plan_payload = _payload
        response = self.client.get("/plan/data.json?center_date=2026-02-22&window_days=14")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload.get("status"), "ok")
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].get("center_date"), "2026-02-22")
        self.assertEqual(calls[0].get("window_days"), "14")
        self.assertIsNone(calls[0].get("start_date"))
        self.assertIsNone(calls[0].get("end_date"))
        self.assertTrue(bool(calls[0].get("include_meta")))

    def test_plan_data_endpoint_passes_range_dates(self) -> None:
        calls: list[dict] = []

        def _payload(*_args, **kwargs):
            calls.append(kwargs)
            return {
                "status": "ok",
                "start_date": "2025-01-01",
                "end_date": "2027-02-22",
                "rows": [],
            }

        api_server.get_plan_payload = _payload
        response = self.client.get("/plan/data.json?start_date=2025-01-01&end_date=2027-02-22")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload.get("status"), "ok")
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].get("start_date"), "2025-01-01")
        self.assertEqual(calls[0].get("end_date"), "2027-02-22")

    def test_plan_data_endpoint_can_disable_meta(self) -> None:
        calls: list[dict] = []

        def _payload(*_args, **kwargs):
            calls.append(kwargs)
            return {
                "status": "ok",
                "rows": [],
            }

        api_server.get_plan_payload = _payload
        response = self.client.get("/plan/data.json?include_meta=0")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(calls), 1)
        self.assertFalse(bool(calls[0].get("include_meta")))

    def test_plan_data_endpoint_returns_400_for_invalid_center_date(self) -> None:
        def _raise(*_args, **_kwargs):
            raise ValueError("center_date must be YYYY-MM-DD.")

        api_server.get_plan_payload = _raise
        response = self.client.get("/plan/data.json?center_date=02/22/2026")
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload.get("status"), "error")
        self.assertIn("center_date", str(payload.get("error")))

    def test_plan_today_endpoint_returns_today_plan(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            initial = self.client.get("/plan/today.json")
            self.assertEqual(initial.status_code, 200)
            initial_payload = initial.get_json()
            today_key = str(initial_payload.get("date_local") or "")
            self.assertTrue(today_key)

            seed = self.client.put(
                f"/plan/day/{today_key}",
                json={
                    "sessions": [{"planned_miles": 7.0, "run_type": "Easy"}],
                    "run_type": "Easy",
                },
            )
            self.assertEqual(seed.status_code, 200)

            response = self.client.get("/plan/today.json")
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("date_local"), today_key)
            self.assertEqual(payload.get("run_type"), "Easy")
            self.assertEqual(float(payload.get("miles") or 0.0), 7.0)
            self.assertNotIn("workout_shorthand", payload)

    def test_plan_today_endpoint_includes_sos_workout_shorthand(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            initial = self.client.get("/plan/today.json")
            self.assertEqual(initial.status_code, 200)
            today_key = str((initial.get_json() or {}).get("date_local") or "")
            self.assertTrue(today_key)

            seed = self.client.put(
                f"/plan/day/{today_key}",
                json={
                    "sessions": [
                        {
                            "planned_miles": 9.0,
                            "run_type": "SOS",
                            "planned_workout": "2E + 20T + 2E",
                        }
                    ],
                    "run_type": "SOS",
                },
            )
            self.assertEqual(seed.status_code, 200)

            response = self.client.get("/plan/today.json")
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("date_local"), today_key)
            self.assertEqual(payload.get("run_type"), "SOS")
            self.assertEqual(float(payload.get("miles") or 0.0), 9.0)
            self.assertEqual(payload.get("workout_shorthand"), "2E + 20T + 2E")

    def test_plan_day_put_persists_distance_and_run_type(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.put(
                "/plan/day/2026-02-22",
                json={
                    "distance": "6+4",
                    "run_type": "Easy",
                    "is_complete": False,
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(payload.get("session_count"), 2)
            self.assertEqual(payload.get("distance_saved"), "6+4")
            self.assertEqual(payload.get("run_type"), "Easy")

    def test_plan_day_put_rejects_invalid_distance_format(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.put(
                "/plan/day/2026-02-22",
                json={
                    "distance": "6++4",
                    "run_type": "Easy",
                },
            )
            self.assertEqual(response.status_code, 400)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("distance", str(payload.get("error")))

    def test_plan_day_put_rejects_unsupported_run_type(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.put(
                "/plan/day/2026-02-22",
                json={
                    "distance": "6",
                    "run_type": "Tempo Builder",
                },
            )
            self.assertEqual(response.status_code, 400)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("run_type", str(payload.get("error")))

    def test_plan_day_put_normalizes_supported_run_type_aliases(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.put(
                "/plan/day/2026-02-22",
                json={
                    "distance": "6",
                    "run_type": "longtrail",
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(payload.get("run_type"), "Long Trail")

    def test_plan_day_put_allows_distance_update_when_legacy_run_type_exists(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            from chronicle.storage import upsert_plan_day

            upsert_plan_day(
                api_server.settings.processed_log_file,
                date_local="2026-02-22",
                timezone_name=api_server.settings.timezone,
                run_type="Tempo Builder",
                planned_total_miles=5.0,
                actual_total_miles=None,
                is_complete=False,
                notes=None,
            )

            response = self.client.put(
                "/plan/day/2026-02-22",
                json={
                    "distance": "6",
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(payload.get("run_type"), "Tempo Builder")
            self.assertEqual(payload.get("distance_saved"), "6")

    def test_plan_day_put_accepts_is_complete_null_for_auto_reset(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            first = self.client.put(
                "/plan/day/2026-02-22",
                json={
                    "distance": "6",
                    "run_type": "Easy",
                    "is_complete": True,
                },
            )
            self.assertEqual(first.status_code, 200)
            second = self.client.put(
                "/plan/day/2026-02-22",
                json={
                    "distance": "6",
                    "run_type": "Easy",
                    "is_complete": None,
                },
            )
            self.assertEqual(second.status_code, 200)
            payload = second.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertIsNone(payload.get("is_complete"))

    def test_plan_day_put_accepts_sessions_payload(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.put(
                "/plan/day/2026-02-23",
                json={
                    "sessions": [6, 4],
                    "run_type": "Easy",
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(payload.get("session_count"), 2)
            self.assertEqual(payload.get("distance_saved"), "6+4")

    def test_plan_day_put_accepts_session_objects_with_run_type(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.put(
                "/plan/day/2026-02-23",
                json={
                    "sessions": [
                        {"planned_miles": 6, "run_type": "Easy"},
                        {"planned_miles": 4, "run_type": "SOS"},
                    ],
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(payload.get("session_count"), 2)
            self.assertEqual(payload.get("distance_saved"), "6+4")
            self.assertEqual(payload.get("run_type"), "Easy")
            sessions = payload.get("sessions") or []
            self.assertEqual(len(sessions), 2)
            self.assertEqual(str(sessions[0].get("run_type") or ""), "Easy")
            self.assertEqual(str(sessions[1].get("run_type") or ""), "SOS")
            self.assertEqual(str(sessions[0].get("planned_workout") or ""), "")
            self.assertEqual(str(sessions[1].get("planned_workout") or ""), "")

    def test_plan_day_put_accepts_planned_workout_alias(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.put(
                "/plan/day/2026-02-23",
                json={
                    "sessions": [
                        {
                            "planned_miles": 9,
                            "run_type": "SOS",
                            "planned_workout": "15WU + 4x4min @LT2 / 3min easy + 10CD",
                        }
                    ],
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            sessions = payload.get("sessions") or []
            self.assertEqual(len(sessions), 1)
            self.assertEqual(str(sessions[0].get("run_type") or ""), "SOS")
            self.assertEqual(
                str(sessions[0].get("planned_workout") or ""),
                "15WU + 4x4min @LT2 / 3min easy + 10CD",
            )
            self.assertEqual(
                str(sessions[0].get("workout_code") or ""),
                "15WU + 4x4min @LT2 / 3min easy + 10CD",
            )

    def test_plan_days_bulk_endpoint_accepts_workout_association(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 7,
                                    "workout_code": "2E + 20T + 2E",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            days = payload.get("days") or []
            self.assertEqual(len(days), 1)
            sessions = days[0].get("sessions") if isinstance(days[0], dict) else []
            self.assertEqual(len(sessions), 1)
            self.assertEqual(str(sessions[0].get("workout_code") or ""), "2E + 20T + 2E")

            metrics = self.client.get("/plan/day/2026-02-22/metrics")
            self.assertEqual(metrics.status_code, 200)
            metrics_payload = metrics.get_json()
            row = metrics_payload.get("row") if isinstance(metrics_payload, dict) else {}
            session_detail = row.get("planned_sessions_detail") if isinstance(row, dict) else []
            self.assertTrue(isinstance(session_detail, list) and len(session_detail) == 1)
            self.assertEqual(str(session_detail[0].get("workout_code") or ""), "2E + 20T + 2E")

    def test_plan_day_garmin_sync_endpoint_initiates_pending_request(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 7,
                                    "run_type": "SOS",
                                    "workout_code": "2E + 20T + 2E",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed.status_code, 200)

            response = self.client.post("/plan/day/2026-02-22/garmin-sync", json={})
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(payload.get("date_local"), "2026-02-22")
            sync = payload.get("sync") if isinstance(payload, dict) else {}
            self.assertEqual(str(sync.get("workout_code") or ""), "2E + 20T + 2E")
            self.assertEqual(str(sync.get("status") or ""), "pending")
            self.assertEqual(str(sync.get("status_code") or ""), "queued")
            self.assertTrue(str(sync.get("request_id") or "").startswith("sync-"))

    def test_plan_day_garmin_sync_endpoint_is_idempotent_for_pending_requests(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 7,
                                    "run_type": "SOS",
                                    "workout_code": "2E + 20T + 2E",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed.status_code, 200)

            first = self.client.post("/plan/day/2026-02-22/garmin-sync", json={})
            second = self.client.post("/plan/day/2026-02-22/garmin-sync", json={})
            self.assertEqual(first.status_code, 200)
            self.assertEqual(second.status_code, 200)
            first_payload = first.get_json()
            second_payload = second.get_json()
            first_sync = first_payload.get("sync") if isinstance(first_payload, dict) else {}
            second_sync = second_payload.get("sync") if isinstance(second_payload, dict) else {}
            self.assertEqual(str(first_sync.get("request_id") or ""), str(second_sync.get("request_id") or ""))
            self.assertEqual(str(first_sync.get("status") or ""), "pending")
            self.assertEqual(str(second_sync.get("status") or ""), "pending")

    def test_plan_day_garmin_sync_endpoint_rejects_missing_workout_attachment(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed = self.client.put(
                "/plan/day/2026-02-22",
                json={
                    "distance": "7",
                    "run_type": "Easy",
                },
            )
            self.assertEqual(seed.status_code, 200)

            response = self.client.post("/plan/day/2026-02-22/garmin-sync", json={})
            self.assertEqual(response.status_code, 400)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("No workout is attached", str(payload.get("error") or ""))

    def test_plan_day_garmin_sync_endpoint_rejects_workout_not_on_day(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 8,
                                    "run_type": "SOS",
                                    "workout_code": "2E + 20T + 2E",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed.status_code, 200)

            response = self.client.post(
                "/plan/day/2026-02-22/garmin-sync",
                json={"workout_code": "5k-intervals"},
            )
            self.assertEqual(response.status_code, 400)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("not attached", str(payload.get("error") or ""))

    def test_plan_day_garmin_sync_run_creates_missing_workout_and_advances_sync(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed_day = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 8,
                                    "run_type": "SOS",
                                    "workout_code": "Tempo-6x1k",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed_day.status_code, 200)

            initiated = self.client.post("/plan/day/2026-02-22/garmin-sync", json={})
            self.assertEqual(initiated.status_code, 200)

            run_response = self.client.post("/plan/day/2026-02-22/garmin-sync/run", json={})
            self.assertEqual(run_response.status_code, 200)
            run_payload = run_response.get_json()
            self.assertEqual(run_payload.get("status"), "ok")
            sync = run_payload.get("sync") if isinstance(run_payload, dict) else {}
            garmin_workout = run_payload.get("garmin_workout") if isinstance(run_payload, dict) else {}

            self.assertEqual(str(sync.get("status") or ""), "in-progress")
            self.assertEqual(str(sync.get("status_code") or ""), "workout_created")
            self.assertEqual(str(sync.get("workout_code") or ""), "Tempo-6x1k")
            self.assertEqual(str(sync.get("next_step") or ""), "schedule_workout_on_calendar")
            self.assertTrue(bool(sync.get("garmin_workout_created")))
            self.assertTrue(str(sync.get("garmin_workout_id") or "").startswith("gw-"))

            self.assertEqual(str(garmin_workout.get("workout_code") or ""), "Tempo-6x1k")
            self.assertEqual(
                str(garmin_workout.get("garmin_workout_id") or ""),
                str(sync.get("garmin_workout_id") or ""),
            )

    def test_plan_day_garmin_sync_run_reuses_existing_garmin_workout_when_present(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed_day_1 = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 8,
                                    "run_type": "SOS",
                                    "workout_code": "Tempo-6x1k",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed_day_1.status_code, 200)

            first_initiated = self.client.post("/plan/day/2026-02-22/garmin-sync", json={})
            self.assertEqual(first_initiated.status_code, 200)
            first_run = self.client.post("/plan/day/2026-02-22/garmin-sync/run", json={})
            self.assertEqual(first_run.status_code, 200)
            first_payload = first_run.get_json()
            first_sync = first_payload.get("sync") if isinstance(first_payload, dict) else {}
            first_workout_id = str(first_sync.get("garmin_workout_id") or "")
            self.assertTrue(first_workout_id.startswith("gw-"))

            seed_day_2 = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-23",
                            "sessions": [
                                {
                                    "planned_miles": 7,
                                    "run_type": "SOS",
                                    "workout_code": "Tempo-6x1k",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed_day_2.status_code, 200)

            second_initiated = self.client.post("/plan/day/2026-02-23/garmin-sync", json={})
            self.assertEqual(second_initiated.status_code, 200)
            second_run = self.client.post("/plan/day/2026-02-23/garmin-sync/run", json={})
            self.assertEqual(second_run.status_code, 200)
            second_payload = second_run.get_json()
            second_sync = second_payload.get("sync") if isinstance(second_payload, dict) else {}

            self.assertEqual(str(second_sync.get("status") or ""), "in-progress")
            self.assertEqual(str(second_sync.get("status_code") or ""), "workout_exists")
            self.assertFalse(bool(second_sync.get("garmin_workout_created")))
            self.assertEqual(str(second_sync.get("garmin_workout_id") or ""), first_workout_id)

    def test_plan_day_garmin_sync_run_is_idempotent_for_existing_processed_request(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 8,
                                    "run_type": "SOS",
                                    "workout_code": "Tempo-6x1k",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed.status_code, 200)

            initiated = self.client.post("/plan/day/2026-02-22/garmin-sync", json={})
            self.assertEqual(initiated.status_code, 200)
            first_run = self.client.post("/plan/day/2026-02-22/garmin-sync/run", json={})
            second_run = self.client.post("/plan/day/2026-02-22/garmin-sync/run", json={})
            self.assertEqual(first_run.status_code, 200)
            self.assertEqual(second_run.status_code, 200)

            first_sync = (first_run.get_json() or {}).get("sync") or {}
            second_sync = (second_run.get_json() or {}).get("sync") or {}
            self.assertEqual(str(first_sync.get("request_id") or ""), str(second_sync.get("request_id") or ""))
            self.assertEqual(
                str(first_sync.get("garmin_workout_id") or ""),
                str(second_sync.get("garmin_workout_id") or ""),
            )
            self.assertEqual(str(second_sync.get("status") or ""), "in-progress")

    def test_plan_day_garmin_sync_run_requires_existing_sync_request(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed_day = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 8,
                                    "run_type": "SOS",
                                    "workout_code": "Tempo-6x1k",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed_day.status_code, 200)

            run_response = self.client.post("/plan/day/2026-02-22/garmin-sync/run", json={})
            self.assertEqual(run_response.status_code, 400)
            run_payload = run_response.get_json()
            self.assertEqual(run_payload.get("status"), "error")
            self.assertIn("Send to Garmin first", str(run_payload.get("error") or ""))

    def test_plan_day_garmin_sync_schedule_schedules_calendar_entry_for_plan_day(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed_day = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 8,
                                    "run_type": "SOS",
                                    "workout_code": "Tempo-6x1k",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed_day.status_code, 200)
            initiated = self.client.post("/plan/day/2026-02-22/garmin-sync", json={})
            self.assertEqual(initiated.status_code, 200)
            run_response = self.client.post("/plan/day/2026-02-22/garmin-sync/run", json={})
            self.assertEqual(run_response.status_code, 200)

            schedule_response = self.client.post("/plan/day/2026-02-22/garmin-sync/schedule", json={})
            self.assertEqual(schedule_response.status_code, 200)
            payload = schedule_response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            sync = payload.get("sync") if isinstance(payload, dict) else {}
            calendar_entry = payload.get("calendar_entry") if isinstance(payload, dict) else {}

            self.assertEqual(str(sync.get("status") or ""), "succeeded")
            self.assertEqual(str(sync.get("status_code") or ""), "calendar_scheduled")
            self.assertEqual(str(sync.get("next_step") or ""), "report_sync_result")
            self.assertTrue(str(sync.get("calendar_entry_id") or "").startswith("gcal-"))
            self.assertEqual(str(calendar_entry.get("date_local") or ""), "2026-02-22")
            self.assertEqual(str(calendar_entry.get("workout_code") or ""), "Tempo-6x1k")
            self.assertEqual(
                str(calendar_entry.get("calendar_entry_id") or ""),
                str(sync.get("calendar_entry_id") or ""),
            )

    def test_plan_day_garmin_sync_schedule_uses_requested_workout_code(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed_day = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 8,
                                    "run_type": "SOS",
                                    "workout_code": "Tempo-6x1k",
                                },
                                {
                                    "planned_miles": 6,
                                    "run_type": "SOS",
                                    "workout_code": "Threshold-3x10",
                                },
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed_day.status_code, 200)

            send_tempo = self.client.post(
                "/plan/day/2026-02-22/garmin-sync",
                json={"workout_code": "Tempo-6x1k"},
            )
            send_threshold = self.client.post(
                "/plan/day/2026-02-22/garmin-sync",
                json={"workout_code": "Threshold-3x10"},
            )
            self.assertEqual(send_tempo.status_code, 200)
            self.assertEqual(send_threshold.status_code, 200)

            run_tempo = self.client.post(
                "/plan/day/2026-02-22/garmin-sync/run",
                json={"workout_code": "Tempo-6x1k"},
            )
            run_threshold = self.client.post(
                "/plan/day/2026-02-22/garmin-sync/run",
                json={"workout_code": "Threshold-3x10"},
            )
            self.assertEqual(run_tempo.status_code, 200)
            self.assertEqual(run_threshold.status_code, 200)

            schedule_response = self.client.post(
                "/plan/day/2026-02-22/garmin-sync/schedule",
                json={"workout_code": "Threshold-3x10"},
            )
            self.assertEqual(schedule_response.status_code, 200)
            payload = schedule_response.get_json() or {}
            sync = payload.get("sync") or {}
            calendar_entry = payload.get("calendar_entry") or {}
            self.assertEqual(str(sync.get("workout_code") or ""), "Threshold-3x10")
            self.assertEqual(str(calendar_entry.get("workout_code") or ""), "Threshold-3x10")

    def test_plan_day_garmin_sync_schedule_reuses_existing_calendar_entry(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed_day = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 8,
                                    "run_type": "SOS",
                                    "workout_code": "Tempo-6x1k",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed_day.status_code, 200)
            self.assertEqual(self.client.post("/plan/day/2026-02-22/garmin-sync", json={}).status_code, 200)
            self.assertEqual(self.client.post("/plan/day/2026-02-22/garmin-sync/run", json={}).status_code, 200)

            first = self.client.post("/plan/day/2026-02-22/garmin-sync/schedule", json={})
            second = self.client.post("/plan/day/2026-02-22/garmin-sync/schedule", json={})
            self.assertEqual(first.status_code, 200)
            self.assertEqual(second.status_code, 200)
            first_sync = (first.get_json() or {}).get("sync") or {}
            second_sync = (second.get_json() or {}).get("sync") or {}
            self.assertEqual(
                str(first_sync.get("calendar_entry_id") or ""),
                str(second_sync.get("calendar_entry_id") or ""),
            )
            self.assertEqual(str(second_sync.get("status_code") or ""), "calendar_scheduled")

    def test_plan_day_garmin_sync_schedule_requires_run_phase_first(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed_day = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 8,
                                    "run_type": "SOS",
                                    "workout_code": "Tempo-6x1k",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed_day.status_code, 200)
            initiated = self.client.post("/plan/day/2026-02-22/garmin-sync", json={})
            self.assertEqual(initiated.status_code, 200)

            schedule_response = self.client.post("/plan/day/2026-02-22/garmin-sync/schedule", json={})
            self.assertEqual(schedule_response.status_code, 400)
            payload = schedule_response.get_json()
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("Run Garmin sync first", str(payload.get("error") or ""))

    def test_plan_day_garmin_sync_schedule_requires_existing_sync_request(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            schedule_response = self.client.post("/plan/day/2026-02-22/garmin-sync/schedule", json={})
            self.assertEqual(schedule_response.status_code, 400)
            payload = schedule_response.get_json()
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("Send to Garmin first", str(payload.get("error") or ""))

    def test_plan_day_garmin_sync_result_returns_scheduled_confirmation_with_timestamp(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed_day = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 8,
                                    "run_type": "SOS",
                                    "workout_code": "Tempo-6x1k",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed_day.status_code, 200)
            initiated = self.client.post("/plan/day/2026-02-22/garmin-sync", json={})
            self.assertEqual(initiated.status_code, 200)

            result_response = self.client.post("/plan/day/2026-02-22/garmin-sync/result", json={})
            self.assertEqual(result_response.status_code, 200)
            payload = result_response.get_json() or {}
            self.assertEqual(payload.get("status"), "ok")
            result = payload.get("result") if isinstance(payload, dict) else {}
            sync = payload.get("sync") if isinstance(payload, dict) else {}
            self.assertEqual(str(result.get("outcome") or ""), "scheduled")
            self.assertEqual(str(sync.get("status") or ""), "succeeded")
            self.assertIn(str(result.get("status_code") or ""), {"calendar_scheduled", "calendar_exists"})
            self.assertIn("T", str(result.get("timestamp_utc") or ""))

    def test_plan_day_garmin_sync_result_returns_retry_guidance_when_schedule_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed_day = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 8,
                                    "run_type": "SOS",
                                    "workout_code": "Tempo-6x1k",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed_day.status_code, 200)
            initiated = self.client.post("/plan/day/2026-02-22/garmin-sync", json={})
            self.assertEqual(initiated.status_code, 200)

            with patch("chronicle.api_server.schedule_garmin_sync_request", side_effect=RuntimeError("schedule unavailable")):
                result_response = self.client.post("/plan/day/2026-02-22/garmin-sync/result", json={})

            self.assertEqual(result_response.status_code, 200)
            payload = result_response.get_json() or {}
            self.assertEqual(payload.get("status"), "error")
            result = payload.get("result") if isinstance(payload, dict) else {}
            sync = payload.get("sync") if isinstance(payload, dict) else {}
            self.assertEqual(str(result.get("outcome") or ""), "failed")
            self.assertEqual(str(sync.get("status") or ""), "failed")
            self.assertEqual(str(sync.get("status_code") or ""), "schedule_failed")
            self.assertIn("Retry Garmin sync from Plan", str(result.get("retry_guidance") or ""))
            self.assertIn("Retry Garmin sync from Plan", str(sync.get("retry_guidance") or ""))

    def test_plan_day_garmin_sync_result_requires_existing_sync_request(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            result_response = self.client.post("/plan/day/2026-02-22/garmin-sync/result", json={})
            self.assertEqual(result_response.status_code, 400)
            payload = result_response.get_json() or {}
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("Send to Garmin first", str(payload.get("error") or ""))

    def test_plan_day_put_run_type_only_preserves_existing_workout_sessions(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {
                            "date_local": "2026-02-22",
                            "sessions": [
                                {
                                    "planned_miles": 7,
                                    "run_type": "SOS",
                                    "workout_code": "2E + 20T + 2E",
                                }
                            ],
                            "run_type": "SOS",
                        }
                    ]
                },
            )
            self.assertEqual(seed.status_code, 200)

            response = self.client.put(
                "/plan/day/2026-02-22",
                json={
                    "run_type": "Easy",
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(payload.get("run_type"), "Easy")
            sessions = payload.get("sessions") or []
            self.assertEqual(len(sessions), 1)
            self.assertEqual(str(sessions[0].get("workout_code") or ""), "2E + 20T + 2E")

            metrics = self.client.get("/plan/day/2026-02-22/metrics")
            self.assertEqual(metrics.status_code, 200)
            metrics_payload = metrics.get_json()
            row = metrics_payload.get("row") if isinstance(metrics_payload, dict) else {}
            session_detail = row.get("planned_sessions_detail") if isinstance(row, dict) else []
            self.assertTrue(isinstance(session_detail, list) and len(session_detail) == 1)
            self.assertEqual(str(session_detail[0].get("workout_code") or ""), "2E + 20T + 2E")

    def test_plan_day_put_rejects_invalid_sessions_payload(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.put(
                "/plan/day/2026-02-23",
                json={
                    "sessions": "6+4",
                    "run_type": "Easy",
                },
            )
            self.assertEqual(response.status_code, 400)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("sessions", str(payload.get("error")))

    def test_plan_days_bulk_endpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {"date_local": "2026-02-22", "sessions": [6, 4], "run_type": "Easy"},
                        {"date_local": "2026-02-23", "sessions": [5], "run_type": "Recovery"},
                    ]
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(int(payload.get("saved_count") or 0), 2)
            days = payload.get("days") or []
            self.assertEqual(len(days), 2)

    def test_plan_days_bulk_endpoint_is_atomic_on_invalid_row(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {"date_local": "2026-02-22", "sessions": [6, 4], "run_type": "Easy"},
                        {"date_local": "bad-date", "sessions": [5], "run_type": "Recovery"},
                    ]
                },
            )
            self.assertEqual(response.status_code, 400)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("date_local", str(payload.get("error")))

            from chronicle.storage import list_plan_days

            rows = list_plan_days(
                api_server.settings.processed_log_file,
                start_date="2026-02-01",
                end_date="2026-02-28",
            )
            self.assertEqual(rows, [])

    def test_plan_days_bulk_endpoint_is_atomic_on_unsupported_run_type(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.post(
                "/plan/days/bulk",
                json={
                    "days": [
                        {"date_local": "2026-02-22", "sessions": [6, 4], "run_type": "Easy"},
                        {"date_local": "2026-02-23", "sessions": [5], "run_type": "Tempo Builder"},
                    ]
                },
            )
            self.assertEqual(response.status_code, 400)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "error")
            self.assertIn("run_type", str(payload.get("error")))

            from chronicle.storage import list_plan_days

            rows = list_plan_days(
                api_server.settings.processed_log_file,
                start_date="2026-02-01",
                end_date="2026-02-28",
            )
            self.assertEqual(rows, [])

    def test_plan_day_metrics_endpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            api_server.get_dashboard_payload = lambda *_args, **_kwargs: {"activities": []}
            seed = self.client.put(
                "/plan/day/2026-02-22",
                json={"distance": "6.2", "run_type": "Easy"},
            )
            self.assertEqual(seed.status_code, 200)
            response = self.client.get("/plan/day/2026-02-22/metrics")
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertEqual(payload.get("date_local"), "2026-02-22")
            self.assertIn("summary", payload)
            self.assertIn("row", payload)

    def test_plan_seed_from_actuals_endpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            api_server.get_dashboard_payload = lambda *_args, **_kwargs: {
                "activities": [
                    {"start_date_local": "2026-02-20T06:30:00Z", "distance": 1609.34 * 5.0},
                    {"start_date_local": "2026-02-21T06:30:00Z", "distance": 1609.34 * 7.0},
                ]
            }
            response = self.client.post("/plan/seed/from-actuals", json={})
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            self.assertGreaterEqual(int(payload.get("seeded_days") or 0), 2)
            self.assertGreater(float(payload.get("seeded_total_miles") or 0.0), 0.0)

            from chronicle.storage import get_plan_day

            day_1 = get_plan_day(api_server.settings.processed_log_file, date_local="2026-02-20")
            day_2 = get_plan_day(api_server.settings.processed_log_file, date_local="2026-02-21")
            self.assertIsNotNone(day_1)
            self.assertIsNotNone(day_2)
            self.assertAlmostEqual(float(day_1.get("planned_total_miles") or 0.0), 5.0, places=2)
            self.assertAlmostEqual(float(day_2.get("planned_total_miles") or 0.0), 7.0, places=2)

    def test_setup_config_and_env_endpoints(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            env_path = Path(temp_dir) / ".env"
            env_path.write_text(
                "TIMEZONE=UTC\nENABLE_WEATHER=true\n",
                encoding="utf-8",
            )

            get_response = self.client.get("/setup/api/config")
            self.assertEqual(get_response.status_code, 200)
            get_payload = get_response.get_json()
            self.assertEqual(get_payload["status"], "ok")
            self.assertIn("provider_fields", get_payload)
            self.assertIn("values", get_payload)
            self.assertEqual(get_payload["env_file"]["path"], str(env_path))

            put_response = self.client.put(
                "/setup/api/config",
                json={
                    "values": {
                        "TIMEZONE": "America/Chicago",
                        "ENABLE_WEATHER": False,
                        "WEATHER_API_KEY": "weather-secret",
                    }
                },
            )
            self.assertEqual(put_response.status_code, 200)
            put_payload = put_response.get_json()
            self.assertEqual(put_payload["status"], "ok")
            self.assertEqual(put_payload["values"]["TIMEZONE"], "America/Chicago")
            self.assertFalse(put_payload["values"]["ENABLE_WEATHER"])
            self.assertEqual(put_payload["values"]["WEATHER_API_KEY"], "")
            self.assertTrue(put_payload["secret_presence"]["WEATHER_API_KEY"])

            env_response = self.client.get("/setup/api/env")
            self.assertEqual(env_response.status_code, 200)
            env_payload = env_response.get_json()
            self.assertEqual(env_payload["status"], "ok")
            self.assertIn("TIMEZONE=America/Chicago", env_payload["env"])
            self.assertIn("ENABLE_WEATHER=false", env_payload["env"])
            self.assertIn("WEATHER_API_KEY=weather-secret", env_payload["env"])

            overrides_path = Path(temp_dir) / "setup_overrides.json"
            self.assertTrue(overrides_path.exists())
            env_written = env_path.read_text(encoding="utf-8")
            self.assertIn("TIMEZONE=America/Chicago", env_written)
            self.assertIn("ENABLE_WEATHER=false", env_written)
            self.assertIn("WEATHER_API_KEY=weather-secret", env_written)

    def test_setup_strava_oauth_start_endpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            with patch.dict(
                os.environ,
                {
                    "STRAVA_CLIENT_ID": "",
                    "STRAVA_CLIENT_SECRET": "",
                    "CLIENT_ID": "",
                    "CLIENT_SECRET": "",
                },
                clear=False,
            ):
                missing_response = self.client.post("/setup/api/strava/oauth/start", json={})
                self.assertEqual(missing_response.status_code, 400)

            self.client.put(
                "/setup/api/config",
                json={
                    "values": {
                        "STRAVA_CLIENT_ID": "12345",
                        "STRAVA_CLIENT_SECRET": "secret-abc",
                    }
                },
            )

            start_response = self.client.post(
                "/setup/api/strava/oauth/start",
                json={"redirect_uri": "http://localhost:1609/setup/strava/callback"},
            )
            self.assertEqual(start_response.status_code, 200)
            start_payload = start_response.get_json()
            self.assertEqual(start_payload["status"], "ok")
            self.assertIn("strava.com/oauth/authorize", start_payload["authorize_url"])
            self.assertIn("client_id=12345", start_payload["authorize_url"])
            self.assertIn("state", start_payload)

    def test_editor_schema_sample_context_endpoint(self) -> None:
        response = self.client.get("/editor/schema?context_mode=sample")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertTrue(payload["has_context"])
        self.assertTrue(str(payload["context_source"]).startswith("sample"))

    def test_editor_snippets_endpoint(self) -> None:
        response = self.client.get("/editor/snippets")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("snippets", payload)

    def test_editor_starter_templates_endpoint(self) -> None:
        response = self.client.get("/editor/starter-templates")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("starter_templates", payload)
        self.assertIn("count", payload)
        self.assertGreaterEqual(payload["count"], 1)

    def test_editor_profiles_endpoints(self) -> None:
        list_response = self.client.get("/editor/profiles")
        self.assertEqual(list_response.status_code, 200)
        list_payload = list_response.get_json()
        self.assertEqual(list_payload["status"], "ok")
        self.assertIn("profiles", list_payload)
        self.assertTrue(any(str(item.get("profile_id")) == "default" for item in list_payload["profiles"]))

        update_response = self.client.put(
            "/editor/profiles/pet",
            json={"enabled": True},
        )
        self.assertEqual(update_response.status_code, 200)
        update_payload = update_response.get_json()
        self.assertEqual(update_payload["status"], "ok")
        self.assertTrue(update_payload["profile"]["enabled"])

        working_response = self.client.post(
            "/editor/profiles/working",
            json={"profile_id": "pet"},
        )
        self.assertEqual(working_response.status_code, 200)
        working_payload = working_response.get_json()
        self.assertEqual(working_payload["status"], "ok")
        self.assertEqual(working_payload["working_profile_id"], "pet")

        reset_response = self.client.post(
            "/editor/profiles/working",
            json={"profile_id": "default"},
        )
        self.assertEqual(reset_response.status_code, 200)
        self.client.put("/editor/profiles/pet", json={"enabled": False})

    def test_editor_profiles_export_endpoint_honors_selected_profile_filters(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            create_response = self.client.post(
                "/editor/profiles",
                json={
                    "profile_id": "tempo_focus",
                    "label": "Tempo Focus",
                    "criteria": {"kind": "activity", "keywords": ["tempo"]},
                },
            )
            self.assertEqual(create_response.status_code, 200)

            response = self.client.get("/editor/profiles/export?profile_id=default&profile_id=tempo_focus")
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload["status"], "ok")
            self.assertEqual(payload["bundle_version"], 1)
            self.assertIn("exported_at_utc", payload)
            profile_ids = [item.get("profile_id") for item in payload["profiles"]]
            self.assertEqual(set(profile_ids), {"default", "tempo_focus"})

    def test_editor_profiles_export_endpoint_rejects_unknown_profile_filter(self) -> None:
        response = self.client.get("/editor/profiles/export?profile_id=does-not-exist")
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")
        self.assertIn("Unknown profile_id", str(payload.get("error", "")))

    def test_editor_profiles_import_endpoint_imports_valid_profiles_and_reports_invalid_items(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            response = self.client.post(
                "/editor/profiles/import",
                json={
                    "bundle": {
                        "bundle_version": 1,
                        "exported_at_utc": "2026-03-03T12:00:00+00:00",
                        "working_profile_id": "tempo_focus",
                        "profiles": [
                            {
                                "profile_id": "tempo_focus",
                                "label": "Tempo Focus",
                                "enabled": True,
                                "priority": 70,
                                "criteria": {"kind": "activity", "keywords": ["tempo"]},
                            },
                            {
                                "profile_id": "default",
                                "label": "Default Override",
                                "enabled": True,
                                "priority": 10,
                                "criteria": {"kind": "fallback", "description": "override"},
                            },
                        ],
                    }
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload["status"], "ok")
            self.assertEqual(payload["imported_count"], 1)
            self.assertEqual(payload["imported_profile_ids"], ["tempo_focus"])
            self.assertEqual(payload["working_profile_id"], "tempo_focus")
            self.assertTrue(any("default profile cannot be imported" in str(item) for item in payload["errors"]))

            list_response = self.client.get("/editor/profiles")
            self.assertEqual(list_response.status_code, 200)
            list_payload = list_response.get_json()
            self.assertTrue(any(item.get("profile_id") == "tempo_focus" for item in list_payload["profiles"]))
            self.assertEqual(list_payload["working_profile_id"], "tempo_focus")

    def test_editor_profiles_import_endpoint_rejects_invalid_bundle(self) -> None:
        response = self.client.post(
            "/editor/profiles/import",
            json={"bundle": {"bundle_version": 1, "profiles": []}},
        )
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")
        self.assertIn("bundle.profiles", str(payload.get("error", "")))

    def test_editor_working_profile_rejects_disabled_profile(self) -> None:
        enable_response = self.client.put(
            "/editor/profiles/pet",
            json={"enabled": True},
        )
        self.assertEqual(enable_response.status_code, 200)

        disable_response = self.client.put(
            "/editor/profiles/pet",
            json={"enabled": False},
        )
        self.assertEqual(disable_response.status_code, 200)

        working_response = self.client.post(
            "/editor/profiles/working",
            json={"profile_id": "pet"},
        )
        self.assertEqual(working_response.status_code, 400)
        working_payload = working_response.get_json()
        self.assertEqual(working_payload["status"], "error")
        self.assertIn("disabled", str(working_payload.get("error", "")).lower())

        reset_response = self.client.post(
            "/editor/profiles/working",
            json={"profile_id": "default"},
        )
        self.assertEqual(reset_response.status_code, 200)

    def test_editor_profile_preview_endpoint_returns_match_for_sample_context(self) -> None:
        response = self.client.post(
            "/editor/profiles/preview",
            json={"context_mode": "sample", "fixture_name": "strength_training"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["context_source"], "sample:strength_training")
        self.assertEqual(payload["profile_match"]["profile_id"], "strength_training")
        self.assertTrue(len(payload["profile_match"].get("reasons") or []) > 0)
        self.assertIsInstance(payload["profile_match"].get("criteria"), dict)

    def test_editor_profile_preview_endpoint_returns_404_when_latest_context_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            response = self.client.post(
                "/editor/profiles/preview",
                json={"context_mode": "latest"},
            )
            self.assertEqual(response.status_code, 404)
            payload = response.get_json()
            self.assertEqual(payload["status"], "error")
            self.assertIn("No template context", str(payload.get("error", "")))

    def test_editor_profile_preview_endpoint_uses_latest_context_when_available(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            latest_context = api_server.get_sample_template_context("strength_training")
            api_server.write_json(
                api_server.settings.latest_json_file,
                {"template_context": latest_context},
            )
            response = self.client.post(
                "/editor/profiles/preview",
                json={"context_mode": "latest"},
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload["status"], "ok")
            self.assertEqual(payload["context_source"], "latest")
            self.assertEqual(payload["profile_match"]["profile_id"], "strength_training")

    def test_editor_profile_preview_excludes_disabled_profiles(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            disable_response = self.client.put(
                "/editor/profiles/strength_training",
                json={"enabled": False},
            )
            self.assertEqual(disable_response.status_code, 200)

            response = self.client.post(
                "/editor/profiles/preview",
                json={"context_mode": "sample", "fixture_name": "strength_training"},
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload["status"], "ok")
            self.assertNotEqual(payload["profile_match"]["profile_id"], "strength_training")

    def test_editor_profile_put_accepts_string_false(self) -> None:
        response = self.client.put(
            "/editor/profiles/long_run",
            json={"enabled": "false"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertFalse(payload["profile"]["enabled"])

    def test_editor_profile_put_rejects_invalid_enabled_value(self) -> None:
        response = self.client.put(
            "/editor/profiles/long_run",
            json={"enabled": "not-a-bool"},
        )
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")

    def test_editor_profile_priority_updates_affect_list_order(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            create_trail = self.client.post(
                "/editor/profiles",
                json={"profile_id": "trail_focus", "label": "Trail Focus", "criteria": {"kind": "activity"}},
            )
            self.assertEqual(create_trail.status_code, 200)
            create_tempo = self.client.post(
                "/editor/profiles",
                json={"profile_id": "tempo_focus", "label": "Tempo Focus", "criteria": {"kind": "activity"}},
            )
            self.assertEqual(create_tempo.status_code, 200)

            raise_tempo = self.client.put(
                "/editor/profiles/tempo_focus",
                json={"priority": 120},
            )
            self.assertEqual(raise_tempo.status_code, 200)

            lower_trail = self.client.put(
                "/editor/profiles/trail_focus",
                json={"priority": 10},
            )
            self.assertEqual(lower_trail.status_code, 200)

            list_response = self.client.get("/editor/profiles")
            self.assertEqual(list_response.status_code, 200)
            payload = list_response.get_json()
            self.assertEqual(payload["status"], "ok")

            profile_order = [item.get("profile_id") for item in payload["profiles"]]
            self.assertLess(profile_order.index("tempo_focus"), profile_order.index("trail_focus"))

    def test_editor_profile_put_rejects_invalid_priority_without_partial_write(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            create_response = self.client.post(
                "/editor/profiles",
                json={
                    "profile_id": "tempo_focus",
                    "label": "Tempo Focus",
                    "criteria": {"kind": "activity", "keywords": ["tempo"]},
                },
            )
            self.assertEqual(create_response.status_code, 200)

            invalid_update = self.client.put(
                "/editor/profiles/tempo_focus",
                json={"priority": "not-an-int"},
            )
            self.assertEqual(invalid_update.status_code, 400)
            invalid_payload = invalid_update.get_json()
            self.assertEqual(invalid_payload["status"], "error")

            list_response = self.client.get("/editor/profiles")
            self.assertEqual(list_response.status_code, 200)
            list_payload = list_response.get_json()
            profile = next(
                (item for item in list_payload["profiles"] if item.get("profile_id") == "tempo_focus"),
                None,
            )
            self.assertIsNotNone(profile)
            self.assertEqual(profile.get("priority"), 0)

    def test_editor_profile_create_and_edit_criteria(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            create_response = self.client.post(
                "/editor/profiles",
                json={
                    "profile_id": "tempo_focus",
                    "label": "Tempo Focus",
                    "criteria": {
                        "kind": "activity",
                        "keywords": ["tempo", "threshold"],
                    },
                },
            )
            self.assertEqual(create_response.status_code, 200)
            create_payload = create_response.get_json()
            self.assertEqual(create_payload["status"], "ok")
            self.assertEqual(create_payload["profile"]["profile_id"], "tempo_focus")
            self.assertEqual(create_payload["profile"]["label"], "Tempo Focus")
            self.assertEqual(
                create_payload["profile"]["criteria"],
                {"kind": "activity", "keywords": ["tempo", "threshold"]},
            )

            list_response = self.client.get("/editor/profiles")
            self.assertEqual(list_response.status_code, 200)
            list_payload = list_response.get_json()
            created_profile = next(
                (item for item in list_payload["profiles"] if item.get("profile_id") == "tempo_focus"),
                None,
            )
            self.assertIsNotNone(created_profile)
            self.assertEqual(created_profile["label"], "Tempo Focus")

            update_response = self.client.put(
                "/editor/profiles/tempo_focus",
                json={
                    "label": "Tempo Builder",
                    "criteria": {"kind": "activity", "sport_types": ["Run"]},
                },
            )
            self.assertEqual(update_response.status_code, 200)
            update_payload = update_response.get_json()
            self.assertEqual(update_payload["status"], "ok")
            self.assertEqual(update_payload["profile"]["label"], "Tempo Builder")
            self.assertEqual(update_payload["profile"]["criteria"], {"kind": "activity", "sport_types": ["Run"]})

    def test_editor_profile_create_rejects_invalid_or_conflicting_payload_without_partial_write(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            create_response = self.client.post(
                "/editor/profiles",
                json={
                    "profile_id": "tempo_focus",
                    "label": "Tempo Focus",
                    "criteria": {"kind": "activity", "keywords": ["tempo"]},
                },
            )
            self.assertEqual(create_response.status_code, 200)

            duplicate_response = self.client.post(
                "/editor/profiles",
                json={
                    "profile_id": "tempo_focus",
                    "label": "Tempo Focus Copy",
                    "criteria": {"kind": "activity", "keywords": ["copy"]},
                },
            )
            self.assertEqual(duplicate_response.status_code, 400)
            duplicate_payload = duplicate_response.get_json()
            self.assertEqual(duplicate_payload["status"], "error")

            invalid_criteria_response = self.client.put(
                "/editor/profiles/tempo_focus",
                json={"criteria": ["not", "an", "object"]},
            )
            self.assertEqual(invalid_criteria_response.status_code, 400)
            invalid_criteria_payload = invalid_criteria_response.get_json()
            self.assertEqual(invalid_criteria_payload["status"], "error")

            list_response = self.client.get("/editor/profiles")
            self.assertEqual(list_response.status_code, 200)
            list_payload = list_response.get_json()
            created_profile = next(
                (item for item in list_payload["profiles"] if item.get("profile_id") == "tempo_focus"),
                None,
            )
            self.assertIsNotNone(created_profile)
            self.assertEqual(created_profile["label"], "Tempo Focus")
            self.assertEqual(created_profile["criteria"], {"kind": "activity", "keywords": ["tempo"]})

    def test_editor_profile_put_rejects_default_profile_label_or_criteria_edits(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            rename_response = self.client.put(
                "/editor/profiles/default",
                json={"label": "Default Updated"},
            )
            self.assertEqual(rename_response.status_code, 400)
            rename_payload = rename_response.get_json()
            self.assertEqual(rename_payload["status"], "error")

            criteria_response = self.client.put(
                "/editor/profiles/default",
                json={"criteria": {"kind": "activity", "keywords": ["new"]}},
            )
            self.assertEqual(criteria_response.status_code, 400)
            criteria_payload = criteria_response.get_json()
            self.assertEqual(criteria_payload["status"], "error")

            list_response = self.client.get("/editor/profiles")
            self.assertEqual(list_response.status_code, 200)
            list_payload = list_response.get_json()
            default_profile = next(
                (item for item in list_payload["profiles"] if item.get("profile_id") == "default"),
                None,
            )
            self.assertIsNotNone(default_profile)
            self.assertEqual(default_profile["label"], "Default")

    def test_editor_repository_endpoints(self) -> None:
        list_response = self.client.get("/editor/repository/templates")
        self.assertEqual(list_response.status_code, 200)
        list_payload = list_response.get_json()
        self.assertEqual(list_payload["status"], "ok")
        self.assertIn("templates", list_payload)

        save_as_response = self.client.post(
            "/editor/repository/save_as",
            json={
                "template": "Repo {{ activity.distance_miles }}",
                "name": "Repo Template",
                "author": "tester",
                "context_mode": "sample",
            },
        )
        self.assertEqual(save_as_response.status_code, 200)
        save_payload = save_as_response.get_json()
        self.assertEqual(save_payload["status"], "ok")
        template_id = save_payload["template_record"]["template_id"]

        get_response = self.client.get(f"/editor/repository/template/{template_id}")
        self.assertEqual(get_response.status_code, 200)
        get_payload = get_response.get_json()
        self.assertEqual(get_payload["status"], "ok")
        self.assertEqual(get_payload["template_record"]["name"], "Repo Template")

        update_response = self.client.put(
            f"/editor/repository/template/{template_id}",
            json={
                "template": "Repo Updated {{ activity.distance_miles }}",
                "name": "Repo Template v2",
                "author": "tester2",
                "context_mode": "sample",
            },
        )
        self.assertEqual(update_response.status_code, 200)
        update_payload = update_response.get_json()
        self.assertEqual(update_payload["status"], "ok")
        self.assertEqual(update_payload["template_record"]["author"], "tester2")

        duplicate_response = self.client.post(
            f"/editor/repository/template/{template_id}/duplicate",
            json={"name": "Repo Copy"},
        )
        self.assertEqual(duplicate_response.status_code, 200)
        duplicate_payload = duplicate_response.get_json()
        self.assertEqual(duplicate_payload["status"], "ok")
        self.assertNotEqual(duplicate_payload["template_record"]["template_id"], template_id)

        export_response = self.client.get(f"/editor/repository/template/{template_id}/export")
        self.assertEqual(export_response.status_code, 200)
        export_payload = export_response.get_json()
        self.assertEqual(export_payload["status"], "ok")
        self.assertEqual(export_payload["name"], "Repo Template v2")
        self.assertEqual(export_payload["author"], "tester2")

        import_response = self.client.post(
            "/editor/repository/import",
            json={
                "bundle": export_payload,
                "author": "importer",
                "context_mode": "sample",
            },
        )
        self.assertEqual(import_response.status_code, 200)
        import_payload = import_response.get_json()
        self.assertEqual(import_payload["status"], "ok")
        self.assertIn("template_id", import_payload["template_record"])

    def test_editor_sample_context_endpoint(self) -> None:
        response = self.client.get("/editor/context/sample")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("context", payload)

    def test_editor_page_endpoint(self) -> None:
        response = self.client.get("/editor")
        self.assertEqual(response.status_code, 200)

    def test_editor_default_template_endpoint(self) -> None:
        response = self.client.get("/editor/template/default")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("template", payload)

    def test_editor_template_export_endpoint(self) -> None:
        response = self.client.get("/editor/template/export")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("bundle_version", payload)
        self.assertIn("template", payload)
        self.assertIn("exported_at_utc", payload)

    def test_editor_template_export_endpoint_honors_profile_versions_and_limit(self) -> None:
        save_response = self.client.put(
            "/editor/template",
            json={
                "template": "Trail Export {{ activity.distance_miles }}",
                "author": "tester",
                "name": "Trail Export Template",
                "source": "test",
                "context_mode": "sample",
                "profile_id": "trail",
            },
        )
        self.assertEqual(save_response.status_code, 200)

        response = self.client.get("/editor/template/export?profile_id=trail&include_versions=true&limit=1")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["profile_id"], "trail")
        self.assertIn("versions", payload)
        self.assertEqual(len(payload["versions"]), 1)
        self.assertIn("template", payload)
        self.assertIn("bundle_version", payload)

    def test_editor_template_export_endpoint_supports_repository_template_id(self) -> None:
        save_as_response = self.client.post(
            "/editor/repository/save_as",
            json={
                "template": "Repo Export {{ activity.distance_miles }}",
                "name": "Repo Export Template",
                "author": "tester",
                "context_mode": "sample",
            },
        )
        self.assertEqual(save_as_response.status_code, 200)
        template_id = save_as_response.get_json()["template_record"]["template_id"]

        response = self.client.get(
            f"/editor/template/export?template_id={template_id}&include_versions=true&limit=1"
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["template_id"], template_id)
        self.assertEqual(payload["bundle_version"], 2)
        self.assertIn("exported_at_utc", payload)
        self.assertIn("versions", payload)
        self.assertEqual(len(payload["versions"]), 1)

    def test_editor_template_export_endpoint_rejects_unknown_repository_template_id(self) -> None:
        response = self.client.get("/editor/template/export?template_id=does-not-exist")
        self.assertEqual(response.status_code, 404)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")
        self.assertIn("Unknown template_id", str(payload.get("error", "")))

    def test_editor_template_import_endpoint(self) -> None:
        response = self.client.post(
            "/editor/template/import",
            json={
                "bundle": {
                    "template": "Imported {{ activity.distance_miles }}",
                    "name": "Imported Template",
                    "exported_at_utc": "2026-02-16T00:00:00Z",
                },
                "author": "tester",
                "context_mode": "sample",
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("saved_version", payload)
        self.assertIn("active", payload)

    def test_editor_template_import_rejects_invalid_payload(self) -> None:
        response = self.client.post(
            "/editor/template/import",
            json={"bundle": {"name": "Missing template"}},
        )
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")

    def test_editor_fixtures_endpoint(self) -> None:
        response = self.client.get("/editor/fixtures")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("fixtures", payload)

    def test_editor_validate_endpoint(self) -> None:
        response = self.client.post(
            "/editor/validate",
            json={"template": "Hello {{ activity.distance_miles }}"},
        )
        # Can be 200 if context exists, 400 if strict validation fails due missing context vars.
        self.assertIn(response.status_code, {200, 400})

    def test_editor_preview_sample_context(self) -> None:
        response = self.client.post(
            "/editor/preview",
            json={
                "context_mode": "sample",
                "template": "Miles {{ activity.distance_miles }}",
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertTrue(str(payload["context_source"]).startswith("sample"))

    def test_editor_preview_fixture_context(self) -> None:
        response = self.client.post(
            "/editor/preview",
            json={
                "context_mode": "fixture",
                "fixture_name": "winter_grind",
                "template": "MI {{ weather.misery_index }}",
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertTrue(str(payload["context_source"]).startswith("sample:"))

    def test_editor_preview_invalid_context_mode(self) -> None:
        response = self.client.post(
            "/editor/preview",
            json={"context_mode": "nope", "template": "{{ streak_days }}"},
        )
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")

    def test_editor_template_put_respects_context_mode(self) -> None:
        response = self.client.put(
            "/editor/template",
            json={
                "template": "Fitness {{ intervals.fitness }}",
                "author": "tester",
                "name": "Mode Aware Template",
                "source": "test",
                "context_mode": "sample",
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertTrue(str(payload.get("context_source")).startswith("sample"))

    def test_editor_template_profile_scoping(self) -> None:
        save_response = self.client.put(
            "/editor/template",
            json={
                "template": "Trail {{ activity.distance_miles }}",
                "author": "tester",
                "name": "Trail Template",
                "source": "test",
                "context_mode": "sample",
                "profile_id": "trail",
            },
        )
        self.assertEqual(save_response.status_code, 200)
        save_payload = save_response.get_json()
        self.assertEqual(save_payload["status"], "ok")
        self.assertEqual(save_payload["profile_id"], "trail")

        load_response = self.client.get("/editor/template?profile_id=trail")
        self.assertEqual(load_response.status_code, 200)
        load_payload = load_response.get_json()
        self.assertEqual(load_payload["status"], "ok")
        self.assertEqual(load_payload["profile_id"], "trail")
        self.assertIn("Trail", load_payload["template"])

    def test_editor_template_get_uses_working_profile_when_profile_id_omitted(self) -> None:
        save_response = self.client.put(
            "/editor/template",
            json={
                "template": "Trail Working {{ activity.distance_miles }}",
                "author": "tester",
                "name": "Trail Working Template",
                "source": "test",
                "context_mode": "sample",
                "profile_id": "trail",
            },
        )
        self.assertEqual(save_response.status_code, 200)

        working_response = self.client.post(
            "/editor/profiles/working",
            json={"profile_id": "trail"},
        )
        self.assertEqual(working_response.status_code, 200)

        load_response = self.client.get("/editor/template")
        self.assertEqual(load_response.status_code, 200)
        load_payload = load_response.get_json()
        self.assertEqual(load_payload["status"], "ok")
        self.assertEqual(load_payload["profile_id"], "trail")
        self.assertIn("Trail Working", load_payload["template"])

        reset_response = self.client.post(
            "/editor/profiles/working",
            json={"profile_id": "default"},
        )
        self.assertEqual(reset_response.status_code, 200)

    def test_editor_template_put_rejects_invalid_context_mode(self) -> None:
        response = self.client.put(
            "/editor/template",
            json={
                "template": "Miles {{ activity.distance_miles }}",
                "context_mode": "nope",
            },
        )
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")

    def test_editor_template_versions_and_rollback_endpoints(self) -> None:
        put_response = self.client.put(
            "/editor/template",
            json={
                "template": "Miles {{ activity.distance_miles }}",
                "author": "tester",
                "name": "Unit Test Template",
                "source": "test",
            },
        )
        self.assertEqual(put_response.status_code, 200)

        versions_response = self.client.get("/editor/template/versions")
        self.assertEqual(versions_response.status_code, 200)
        versions_payload = versions_response.get_json()
        self.assertEqual(versions_payload["status"], "ok")
        self.assertGreaterEqual(len(versions_payload["versions"]), 1)
        version_id = versions_payload["versions"][0]["version_id"]

        version_response = self.client.get(f"/editor/template/version/{version_id}")
        self.assertEqual(version_response.status_code, 200)
        version_payload = version_response.get_json()
        self.assertEqual(version_payload["status"], "ok")
        self.assertIn("template", version_payload["version"])

        rollback_response = self.client.post(
            "/editor/template/rollback",
            json={"version_id": version_id, "author": "tester"},
        )
        self.assertEqual(rollback_response.status_code, 200)
        rollback_payload = rollback_response.get_json()
        self.assertEqual(rollback_payload["status"], "ok")

    def test_editor_template_rollback_requires_version_id(self) -> None:
        response = self.client.post("/editor/template/rollback", json={"author": "tester"})
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")
        self.assertEqual(payload["error"], "version_id is required.")

    def test_editor_template_rollback_rejects_unknown_version(self) -> None:
        response = self.client.post(
            "/editor/template/rollback",
            json={"version_id": "does-not-exist", "author": "tester"},
        )
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")
        self.assertIn("Unknown template version", str(payload["error"]))

    def test_editor_template_versions_respects_limit_query(self) -> None:
        save_one = self.client.put(
            "/editor/template",
            json={
                "template": "Version 1 {{ activity.distance_miles }}",
                "author": "tester",
                "name": "Template One",
                "source": "test",
            },
        )
        self.assertEqual(save_one.status_code, 200)
        save_two = self.client.put(
            "/editor/template",
            json={
                "template": "Version 2 {{ activity.distance_miles }}",
                "author": "tester",
                "name": "Template Two",
                "source": "test",
            },
        )
        self.assertEqual(save_two.status_code, 200)

        response = self.client.get("/editor/template/versions?limit=1")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(len(payload["versions"]), 1)

    def test_editor_template_versions_profile_scoping(self) -> None:
        save_default = self.client.put(
            "/editor/template",
            json={
                "template": "Default Scope {{ activity.distance_miles }}",
                "author": "tester",
                "name": "Default Scope Template",
                "source": "test",
            },
        )
        self.assertEqual(save_default.status_code, 200)
        default_payload = save_default.get_json()
        self.assertEqual(default_payload["status"], "ok")
        default_saved_version = default_payload["saved_version"]
        default_version_id = (
            default_saved_version["version_id"]
            if isinstance(default_saved_version, dict)
            else str(default_saved_version)
        )

        save_trail = self.client.put(
            "/editor/template",
            json={
                "template": "Trail Scope {{ activity.distance_miles }}",
                "author": "tester",
                "name": "Trail Scope Template",
                "source": "test",
                "profile_id": "trail",
                "context_mode": "sample",
            },
        )
        self.assertEqual(save_trail.status_code, 200)
        trail_payload = save_trail.get_json()
        self.assertEqual(trail_payload["status"], "ok")
        trail_saved_version = trail_payload["saved_version"]
        trail_version_id = (
            trail_saved_version["version_id"]
            if isinstance(trail_saved_version, dict)
            else str(trail_saved_version)
        )

        default_versions_response = self.client.get("/editor/template/versions?profile_id=default")
        self.assertEqual(default_versions_response.status_code, 200)
        default_versions_payload = default_versions_response.get_json()
        self.assertEqual(default_versions_payload["status"], "ok")
        default_version_ids = {row["version_id"] for row in default_versions_payload["versions"]}
        self.assertIn(default_version_id, default_version_ids)
        self.assertNotIn(trail_version_id, default_version_ids)

        trail_versions_response = self.client.get("/editor/template/versions?profile_id=trail")
        self.assertEqual(trail_versions_response.status_code, 200)
        trail_versions_payload = trail_versions_response.get_json()
        self.assertEqual(trail_versions_payload["status"], "ok")
        trail_version_ids = {row["version_id"] for row in trail_versions_payload["versions"]}
        self.assertIn(trail_version_id, trail_version_ids)
        self.assertNotIn(default_version_id, trail_version_ids)


if __name__ == "__main__":
    unittest.main()
