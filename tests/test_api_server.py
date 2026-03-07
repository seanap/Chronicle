import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

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
        self.assertEqual(payload.get("dashboard_refresh"), "updated")
        self.assertEqual(len(refresh_calls), 1)

    def test_rerun_latest_skips_dashboard_refresh_when_not_updated(self) -> None:
        refresh_calls: list[tuple[tuple, dict]] = []
        api_server.run_once = lambda **kwargs: {"status": "already_processed", "kwargs": kwargs}
        api_server.get_dashboard_payload = lambda *args, **kwargs: refresh_calls.append((args, kwargs)) or {}
        response = self.client.post("/rerun/latest")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertNotIn("dashboard_refresh", payload)
        self.assertEqual(len(refresh_calls), 0)

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

    def test_root_redirects_to_view(self) -> None:
        response = self.client.get("/", follow_redirects=False)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers.get("Location"), "/view")

    def test_app_route_is_not_available(self) -> None:
        response = self.client.get("/app/view")
        self.assertEqual(response.status_code, 404)

    def test_legacy_route_is_not_available(self) -> None:
        response = self.client.get("/legacy/view")
        self.assertEqual(response.status_code, 404)

    def test_ui_rollout_status_route_is_not_available(self) -> None:
        response = self.client.get("/ops/ui-rollout/status")
        self.assertEqual(response.status_code, 404)

    def test_dashboard_page_endpoint(self) -> None:
        response = self.client.get("/dashboard")
        self.assertEqual(response.status_code, 200)

    def test_control_page_endpoint(self) -> None:
        response = self.client.get("/control")
        self.assertEqual(response.status_code, 200)

    def test_design_review_page_endpoint(self) -> None:
        response = self.client.get("/design-review")
        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        self.assertIn("Eye Doctor Review", html)
        self.assertIn("/design-review/preview/view", html)

    def test_design_review_preview_page_endpoint(self) -> None:
        response = self.client.get("/design-review/preview/view?variant=a")
        self.assertEqual(response.status_code, 200)

    def test_design_review_preview_includes_variant_assets_when_present(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            variant_dir = root / "static" / "review-variants" / "plan"
            variant_dir.mkdir(parents=True, exist_ok=True)
            (variant_dir / "a.css").write_text("/* review css */", encoding="utf-8")
            (variant_dir / "a.js").write_text("console.log('review js');", encoding="utf-8")

            with patch.object(api_server, "PROJECT_ROOT", root):
                response = self.client.get("/design-review/preview/plan?variant=a")
                self.assertEqual(response.status_code, 200)
                html = response.get_data(as_text=True)
                self.assertIn("/static/review-variants/plan/a.css", html)
                self.assertIn("/static/review-variants/plan/a.js", html)

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
            families = (payload.get("goal_training") or {}).get("plan_families") or []
            family_lookup = {item.get("label"): item for item in families if isinstance(item, dict)}
            self.assertIn("JD", family_lookup)

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
            training_families = (payload.get("training") or {}).get("plan_families") or []
            jd = next(item for item in training_families if isinstance(item, dict) and item.get("label") == "JD")
            jd_items = {item.get("label"): item.get("display") for item in jd.get("items") or [] if isinstance(item, dict)}
            self.assertEqual(jd_items.get("T"), "7:51")

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

    def test_plan_workouts_yaml_endpoints_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            create_response = self.client.post(
                "/plan/workouts",
                json={
                    "workout_name": "Hansons Strength 8 mi Custom",
                    "yaml_text": "\n".join(
                        [
                            "library: Hansons",
                            "run_type_default: SOS",
                            "workout:",
                            "  type: Run",
                            "  \"Hansons Strength 8 mi Custom\":",
                            "    - warmup: 2mi @H(z2)",
                            "    - repeat(3):",
                            "        - run: 2mi @P($strength)",
                            "        - recovery: 800m",
                            "    - cooldown: 2mi @H(z2)",
                            "tags:",
                            "  - threshold",
                        ]
                    )
                },
            )
            self.assertEqual(create_response.status_code, 200)
            created = create_response.get_json()
            self.assertEqual(created.get("status"), "ok")
            workout = created.get("workout") or {}
            self.assertEqual(workout.get("workout_id"), "hansons-strength-8-mi-custom")
            self.assertEqual(workout.get("library"), "Hansons")
            self.assertEqual(
                workout.get("shorthand"),
                "WU 2mi @H(z2) + 3x2mi @P($strength) w/ 800m rec + 2mi CD @H(z2)",
            )
            target_lookup = {item.get("raw"): item for item in workout.get("resolved_targets") or [] if isinstance(item, dict)}
            self.assertEqual((target_lookup.get("P($strength)") or {}).get("display"), "11:17")

            get_response = self.client.get("/plan/workouts/hansons-strength-8-mi-custom")
            self.assertEqual(get_response.status_code, 200)
            fetched = get_response.get_json()
            self.assertEqual(fetched.get("status"), "ok")
            yaml_text = str(fetched.get("yaml_text") or "")
            self.assertIn('type: Run', yaml_text)
            self.assertIn('Hansons Strength 8 mi Custom', yaml_text)
            self.assertNotIn("shorthand:", yaml_text)
            fetched_target_lookup = {
                item.get("raw"): item
                for item in (fetched.get("workout") or {}).get("resolved_targets") or []
                if isinstance(item, dict)
            }
            self.assertEqual((fetched_target_lookup.get("P($strength)") or {}).get("display"), "11:17")

            update_response = self.client.put(
                "/plan/workouts/hansons-strength-8-mi-custom",
                json={
                    "yaml_text": "\n".join(
                        [
                            "library: Hansons",
                            "run_type_default: SOS",
                            "workout:",
                            "  type: Run",
                            "  \"Hansons Strength 8 mi Custom\":",
                            "    - warmup: 2mi @H(z2)",
                            "    - repeat(4):",
                            "        - run: 2mi @P($strength)",
                            "        - recovery: 800m",
                            "    - cooldown: 2mi @H(z2)",
                        ]
                    )
                },
            )
            self.assertEqual(update_response.status_code, 200)
            updated = update_response.get_json()
            self.assertEqual(updated.get("status"), "ok")
            self.assertEqual(
                str((updated.get("workout") or {}).get("shorthand") or ""),
                "WU 2mi @H(z2) + 4x2mi @P($strength) w/ 800m rec + 2mi CD @H(z2)",
            )

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
                "15WU + 4x4min @LT2 w/ 3min easy + 10CD",
            )
            workout_code = str(sessions[0].get("workout_code") or "")
            self.assertTrue(workout_code)
            self.assertNotEqual(workout_code, "15WU + 4x4min @LT2 / 3min easy + 10CD")
            stored = self.client.get(f"/plan/workouts/{workout_code}")
            self.assertEqual(stored.status_code, 200)
            stored_payload = stored.get_json()
            self.assertEqual(
                str((stored_payload.get("workout") or {}).get("shorthand") or ""),
                "15WU + 4x4min @LT2 w/ 3min easy + 10CD",
            )

    def test_plan_day_put_derives_variant_when_sos_shorthand_changes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed = self.client.post(
                "/plan/workouts",
                json={
                    "yaml_text": "\n".join(
                        [
                            "workout_id: jd-threshold-6x1k",
                            "label: JD Threshold 6x1k",
                            "library: JD",
                            "workout_type: run",
                            "run_type_default: SOS",
                            "shorthand: 2E + 6x1k @T w/ 90sec jog + 2E",
                        ]
                    )
                },
            )
            self.assertEqual(seed.status_code, 200)

            response = self.client.put(
                "/plan/day/2026-02-23",
                json={
                    "sessions": [
                        {
                            "planned_miles": 10,
                            "run_type": "SOS",
                            "workout_code": "jd-threshold-6x1k",
                            "planned_workout": "2E + 7x1k @T w/ 90sec jog + 2E",
                        }
                    ],
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            sessions = payload.get("sessions") or []
            self.assertEqual(len(sessions), 1)
            self.assertEqual(
                str(sessions[0].get("planned_workout") or ""),
                "2E + 7x1k @T w/ 90sec jog + 2E",
            )
            workout_code = str(sessions[0].get("workout_code") or "")
            self.assertNotEqual(workout_code, "jd-threshold-6x1k")
            derived = self.client.get(f"/plan/workouts/{workout_code}")
            self.assertEqual(derived.status_code, 200)
            derived_payload = derived.get_json()
            workout = derived_payload.get("workout") or {}
            self.assertEqual(workout.get("source_workout_id"), "jd-threshold-6x1k")
            self.assertEqual(workout.get("library"), "JD")
            self.assertEqual(workout.get("shorthand"), "2E + 7x1k @T w/ 90sec jog + 2E")

    def test_plan_day_put_allows_clearing_sos_workout(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seed = self.client.put(
                "/plan/day/2026-02-23",
                json={
                    "sessions": [
                        {
                            "planned_miles": 9,
                            "run_type": "SOS",
                            "planned_workout": "2E + 20T + 2E",
                        }
                    ],
                },
            )
            self.assertEqual(seed.status_code, 200)
            seeded_sessions = (seed.get_json() or {}).get("sessions") or []
            self.assertEqual(len(seeded_sessions), 1)
            workout_code = str(seeded_sessions[0].get("workout_code") or "")
            self.assertTrue(workout_code)

            cleared = self.client.put(
                "/plan/day/2026-02-23",
                json={
                    "sessions": [
                        {
                            "planned_miles": 9,
                            "run_type": "SOS",
                            "workout_code": workout_code,
                            "planned_workout": "",
                        }
                    ],
                },
            )
            self.assertEqual(cleared.status_code, 200)
            cleared_sessions = (cleared.get_json() or {}).get("sessions") or []
            self.assertEqual(len(cleared_sessions), 1)
            self.assertEqual(str(cleared_sessions[0].get("planned_workout") or ""), "")
            self.assertEqual(str(cleared_sessions[0].get("workout_code") or ""), "")

    def test_plan_day_garmin_sync_send_sends_all_attached_workouts_for_day(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seeded = self.client.put(
                "/plan/day/2026-02-23",
                json={
                    "sessions": [
                        {"planned_miles": 8, "run_type": "SOS", "planned_workout": "2E + 20T + 2E"},
                        {"planned_miles": 4, "run_type": "SOS", "planned_workout": "WU lap @H(z2) + 6x1k @P($10k) w/ 90sec rec + 2mi CD @H(z2)"},
                    ],
                },
            )
            self.assertEqual(seeded.status_code, 200)

            response = self.client.post("/plan/day/2026-02-23/garmin-sync/send", json={})
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "ok")
            summary = payload.get("summary") or {}
            self.assertEqual(int(summary.get("requested_count") or 0), 2)
            self.assertEqual(int(summary.get("succeeded_count") or 0), 2)
            self.assertEqual(int(summary.get("failed_count") or 0), 0)
            results = payload.get("results") or []
            self.assertEqual(len(results), 2)
            for item in results:
                self.assertEqual(item.get("status"), "ok")
                self.assertIn(str((item.get("result") or {}).get("status_code") or ""), {"calendar_scheduled", "calendar_exists"})

    def test_plan_day_garmin_sync_send_window_handles_skipped_days(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            first = self.client.put(
                "/plan/day/2026-02-23",
                json={
                    "sessions": [
                        {"planned_miles": 8, "run_type": "SOS", "planned_workout": "2E + 20T + 2E"},
                    ],
                },
            )
            self.assertEqual(first.status_code, 200)
            third = self.client.put(
                "/plan/day/2026-02-25",
                json={
                    "sessions": [
                        {"planned_miles": 10, "run_type": "SOS", "planned_workout": "2E + 7x1k @T w/ 90sec jog + 2E"},
                    ],
                },
            )
            self.assertEqual(third.status_code, 200)

            response = self.client.post(
                "/plan/day/2026-02-23/garmin-sync/send-window",
                json={"span_days": 7},
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertIn(payload.get("status"), {"ok", "partial"})
            self.assertEqual(payload.get("start_date_local"), "2026-02-23")
            self.assertEqual(int(payload.get("span_days") or 0), 7)
            summary = payload.get("summary") or {}
            self.assertEqual(int(summary.get("requested_count") or 0), 2)
            self.assertEqual(int(summary.get("succeeded_count") or 0), 2)
            self.assertEqual(int(summary.get("failed_count") or 0), 0)
            self.assertEqual(int(summary.get("skipped_day_count") or 0), 5)
            days = payload.get("days") or []
            self.assertEqual(len(days), 7)
            skipped = [item for item in days if item.get("status") == "skipped"]
            self.assertEqual(len(skipped), 5)

    def test_plan_day_garmin_sync_send_captures_per_workout_failures(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seeded = self.client.put(
                "/plan/day/2026-02-23",
                json={
                    "sessions": [
                        {"planned_miles": 8, "run_type": "SOS", "planned_workout": "2E + 20T + 2E"},
                        {"planned_miles": 5, "run_type": "SOS", "planned_workout": "WU lap @H(z2) + 8x400m @P($5k) w/ 200m rec + CD"},
                    ],
                },
            )
            self.assertEqual(seeded.status_code, 200)

            original = api_server.initiate_garmin_sync_request

            def flaky_request(path, *, date_local, workout_code):
                if "8x400m" in str(workout_code):
                    raise RuntimeError("Garmin queue write failed")
                return original(path, date_local=date_local, workout_code=workout_code)

            with patch.object(api_server, "initiate_garmin_sync_request", side_effect=flaky_request):
                response = self.client.post("/plan/day/2026-02-23/garmin-sync/send", json={})

            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "partial")
            summary = payload.get("summary") or {}
            self.assertEqual(int(summary.get("requested_count") or 0), 2)
            self.assertEqual(int(summary.get("succeeded_count") or 0), 1)
            self.assertEqual(int(summary.get("failed_count") or 0), 1)
            results = payload.get("results") or []
            self.assertEqual(len(results), 2)
            failed = next(item for item in results if item.get("status") == "error")
            self.assertEqual(failed.get("error"), "Garmin queue write failed")

    def test_plan_day_garmin_sync_send_window_marks_day_error_when_all_workouts_fail(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)
            seeded = self.client.put(
                "/plan/day/2026-02-23",
                json={
                    "sessions": [
                        {"planned_miles": 8, "run_type": "SOS", "planned_workout": "2E + 20T + 2E"},
                    ],
                },
            )
            self.assertEqual(seeded.status_code, 200)

            with patch.object(api_server, "initiate_garmin_sync_request", side_effect=RuntimeError("Garmin offline")):
                response = self.client.post(
                    "/plan/day/2026-02-23/garmin-sync/send-window",
                    json={"span_days": 7},
                )

            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload.get("status"), "error")
            summary = payload.get("summary") or {}
            self.assertEqual(int(summary.get("requested_count") or 0), 1)
            self.assertEqual(int(summary.get("succeeded_count") or 0), 0)
            self.assertEqual(int(summary.get("failed_count") or 0), 1)
            self.assertEqual(int(summary.get("skipped_day_count") or 0), 6)
            days = payload.get("days") or []
            first_day = next(item for item in days if item.get("date_local") == "2026-02-23")
            self.assertEqual(first_day.get("status"), "error")

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
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            list_response = self.client.get("/editor/profiles")
            self.assertEqual(list_response.status_code, 200)
            list_payload = list_response.get_json()
            self.assertEqual(list_payload["status"], "ok")
            self.assertIn("profiles", list_payload)
            self.assertTrue(any(str(item.get("profile_id")) == "default" for item in list_payload["profiles"]))

            create_response = self.client.post(
                "/editor/profiles",
                json={
                    "profile_id": "custom-pet",
                    "label": "Custom Pet",
                    "criteria": {"text_contains_any": ["dog"]},
                },
            )
            self.assertEqual(create_response.status_code, 200)

            update_response = self.client.put(
                "/editor/profiles/custom-pet",
                json={"enabled": True},
            )
            self.assertEqual(update_response.status_code, 200)
            update_payload = update_response.get_json()
            self.assertEqual(update_payload["status"], "ok")
            self.assertTrue(update_payload["profile"]["enabled"])

            working_response = self.client.post(
                "/editor/profiles/working",
                json={"profile_id": "custom-pet"},
            )
            self.assertEqual(working_response.status_code, 200)
            working_payload = working_response.get_json()
            self.assertEqual(working_payload["status"], "ok")
            self.assertEqual(working_payload["working_profile_id"], "custom-pet")

            reset_response = self.client.post(
                "/editor/profiles/working",
                json={"profile_id": "default"},
            )
            self.assertEqual(reset_response.status_code, 200)

            disable_response = self.client.put("/editor/profiles/custom-pet", json={"enabled": False})
            self.assertEqual(disable_response.status_code, 200)
            self.assertFalse(disable_response.get_json()["profile"]["enabled"])

    def test_editor_profile_put_accepts_string_false(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            create_response = self.client.post(
                "/editor/profiles",
                json={
                    "profile_id": "late-run",
                    "label": "Late Run",
                    "criteria": {"time_of_day_after": "20:00"},
                },
            )
            self.assertEqual(create_response.status_code, 200)

            response = self.client.put(
                "/editor/profiles/late-run",
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

    def test_editor_profile_put_rejects_builtin_structured_edit(self) -> None:
        response = self.client.put(
            "/editor/profiles/long_run",
            json={"priority": 999},
        )
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")
        self.assertIn("immutable", str(payload["error"]).lower())

    def test_editor_profile_put_allows_builtin_enable_toggle(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            response = self.client.put(
                "/editor/profiles/long_run",
                json={"enabled": False},
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload["status"], "ok")
            self.assertFalse(payload["profile"]["enabled"])

    def test_editor_profile_document_endpoint_returns_yaml_for_builtin(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            response = self.client.get("/editor/profiles/walk")
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload["status"], "ok")
            self.assertEqual(payload["profile"]["profile_id"], "walk")
            self.assertTrue(payload["read_only"])
            self.assertIn("profile_id: walk", payload["yaml_text"])
            self.assertNotIn("enabled:", payload["yaml_text"])
            self.assertTrue(str(payload["source_path"]).endswith("profile_rules/walk.yaml"))

    def test_editor_profile_document_endpoint_rejects_unknown_profile(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            response = self.client.get("/editor/profiles/not-real")
            self.assertEqual(response.status_code, 400)
            payload = response.get_json()
            self.assertEqual(payload["status"], "error")

    def test_editor_profiles_post_accepts_yaml_text(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            response = self.client.post(
                "/editor/profiles",
                json={
                    "profile_name": "Evening Run",
                    "yaml_text": "\n".join(
                        [
                            "profile_id: evening-run",
                            "label: Evening Run",
                            "priority: 22",
                            "criteria:",
                            "  sport_type:",
                            "    - run",
                            "  time_of_day_after: '17:00'",
                            "",
                        ]
                    ),
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload["status"], "ok")
            self.assertEqual(payload["profile"]["profile_id"], "evening-run")
            self.assertEqual(payload["profile"]["priority"], 22)
            self.assertIn("time_of_day_after", payload["profile"]["criteria"])
            self.assertFalse(payload["read_only"])
            self.assertTrue(any(str(item.get("profile_id")) == "evening-run" for item in payload["profiles"]))

    def test_editor_profile_put_accepts_yaml_text(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            create_response = self.client.post(
                "/editor/profiles",
                json={
                    "yaml_text": "\n".join(
                        [
                            "profile_id: commute-walk",
                            "label: Commute Walk",
                            "priority: 18",
                            "criteria:",
                            "  sport_type:",
                            "    - walk",
                            "",
                        ]
                    ),
                },
            )
            self.assertEqual(create_response.status_code, 200)

            update_response = self.client.put(
                "/editor/profiles/commute-walk",
                json={
                    "yaml_text": "\n".join(
                        [
                            "profile_id: commute-walk",
                            "label: Commute Walk",
                            "priority: 21",
                            "criteria:",
                            "  sport_type:",
                            "    - walk",
                            "  strava_tags_any:",
                            "    - commute",
                            "",
                        ]
                    ),
                },
            )
            self.assertEqual(update_response.status_code, 200)
            payload = update_response.get_json()
            self.assertEqual(payload["status"], "ok")
            self.assertTrue(payload["profile"]["enabled"])
            self.assertEqual(payload["profile"]["priority"], 21)
            self.assertIn("strava_tags_any", payload["profile"]["criteria"])

    def test_editor_profile_put_rejects_builtin_yaml_edit(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            response = self.client.put(
                "/editor/profiles/walk",
                json={
                    "yaml_text": "\n".join(
                        [
                            "profile_id: walk",
                            "label: Walk",
                            "priority: 40",
                            "criteria:",
                            "  sport_type:",
                            "    - walk",
                            "",
                        ]
                    ),
                },
            )
            self.assertEqual(response.status_code, 400)
            payload = response.get_json()
            self.assertEqual(payload["status"], "error")
            self.assertIn("read-only", str(payload["error"]).lower())

    def test_editor_profile_preview_accepts_yaml_text(self) -> None:
        with patch.object(
            api_server,
            "_context_for_mode",
            return_value=(
                {
                    "activity": {
                        "sport_type": "Run",
                        "type": "Run",
                        "name": "Evening Commute Run",
                        "commute": True,
                        "moving_time": 2400,
                        "start_date_local": "2026-03-02T18:10:00-05:00",
                        "start_latlng": [34.24, -83.96],
                    },
                    "training": {},
                },
                "patched:test",
            ),
        ):
            response = self.client.post(
                "/editor/profiles/preview",
                json={
                    "context_mode": "sample",
                    "yaml_text": "\n".join(
                        [
                            "profile_id: evening-commute-run",
                            "label: Evening Commute Run",
                            "priority: 55",
                            "criteria:",
                            "  all_of:",
                            "    - sport_type:",
                            "        - run",
                            "    - strava_tags_any:",
                            "        - commute",
                            "    - time_of_day_after: '17:00'",
                            "",
                        ]
                    ),
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload["status"], "ok")
            self.assertEqual(payload["context_source"], "patched:test")
            self.assertEqual(payload["profile_match"]["profile_id"], "evening-commute-run")
            self.assertTrue(payload["profile_match"]["matched"])
            self.assertIn("strava_tags_any matched", payload["profile_match"]["reasons"])

    def test_editor_profile_preview_rejects_yaml_without_executable_rules(self) -> None:
        response = self.client.post(
            "/editor/profiles/preview",
            json={
                "context_mode": "sample",
                "yaml_text": "\n".join(
                    [
                        "profile_id: blank-custom",
                        "label: Blank Custom",
                        "priority: 5",
                        "criteria:",
                        "  kind: activity",
                        "  description: Missing executable rules.",
                        "",
                    ]
                ),
            },
        )
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")
        self.assertIn("executable", str(payload["error"]).lower())

    def test_editor_profile_validate_activity_reports_match(self) -> None:
        mock_strava = Mock()
        mock_strava.get_activity_details.return_value = {
            "id": 17618774880,
            "sport_type": "Weight Training",
            "type": "Workout",
            "name": "Garage Strength",
            "moving_time": 2700,
            "start_date_local": "2026-03-05T18:12:00-05:00",
        }
        with patch.object(api_server, "StravaClient", return_value=mock_strava), patch.object(
            api_server,
            "build_profile_preview_training",
            return_value={"_garmin_activity_aligned": False},
        ):
            response = self.client.post(
                "/editor/profiles/validate-activity",
                json={
                    "activity_id": 17618774880,
                    "enabled": True,
                    "yaml_text": "\n".join(
                        [
                            "profile_id: strength-training-custom",
                            "label: Strength Training Custom",
                            "priority: 60",
                            "criteria:",
                            "  sport_type:",
                            "    - weight training",
                            "",
                        ]
                    ),
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["activity"]["id"], 17618774880)
        self.assertTrue(payload["profile_match"]["matched"])
        self.assertTrue(payload["profile_match"]["would_process"])

    def test_editor_profile_validate_activity_respects_disabled_status(self) -> None:
        mock_strava = Mock()
        mock_strava.get_activity_details.return_value = {
            "id": 17571492798,
            "sport_type": "Walk",
            "type": "Walk",
            "name": "Evening Walk",
            "moving_time": 1800,
            "start_date_local": "2026-03-05T19:00:00-05:00",
        }
        with patch.object(api_server, "StravaClient", return_value=mock_strava), patch.object(
            api_server,
            "build_profile_preview_training",
            return_value={"_garmin_activity_aligned": False},
        ):
            response = self.client.post(
                "/editor/profiles/validate-activity",
                json={
                    "activity_id": 17571492798,
                    "enabled": False,
                    "yaml_text": "\n".join(
                        [
                            "profile_id: walk",
                            "label: Walk",
                            "priority: 40",
                            "criteria:",
                            "  sport_type:",
                            "    - walk",
                            "",
                        ]
                    ),
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertFalse(payload["profile_match"]["would_process"])
        self.assertEqual(payload["profile_match"]["reasons"][0], "profile disabled")

    def test_editor_profile_validate_activity_rejects_invalid_activity_id(self) -> None:
        response = self.client.post(
            "/editor/profiles/validate-activity",
            json={
                "activity_id": "abc",
                "yaml_text": "profile_id: walk\nlabel: Walk\npriority: 40\ncriteria:\n  sport_type:\n    - walk\n",
            },
        )
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["status"], "error")
        self.assertIn("activity_id", str(payload["error"]))

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
        html = response.get_data(as_text=True)
        self.assertIn("profileValidationActivityId", html)
        self.assertIn("btnProfileValidateActivity", html)
        self.assertNotIn("btnProfilePreview", html)

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

    def test_editor_template_uses_and_persists_working_profile_when_profile_id_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            working_response = self.client.post(
                "/editor/profiles/working",
                json={"profile_id": "trail"},
            )
            self.assertEqual(working_response.status_code, 200)
            self.assertEqual(working_response.get_json()["working_profile_id"], "trail")

            save_response = self.client.put(
                "/editor/template",
                json={
                    "template": "Working Trail {{ activity.distance_miles }}",
                    "author": "tester",
                    "name": "Working Trail Template",
                    "source": "test",
                    "context_mode": "sample",
                },
            )
            self.assertEqual(save_response.status_code, 200)
            save_payload = save_response.get_json()
            self.assertEqual(save_payload["profile_id"], "trail")

            stored_config = Path(temp_dir) / "template_profiles.json"
            stored_payload = json.loads(stored_config.read_text(encoding="utf-8"))
            self.assertEqual(stored_payload.get("working_profile_id"), "trail")

            get_working_response = self.client.get("/editor/template")
            self.assertEqual(get_working_response.status_code, 200)
            get_working_payload = get_working_response.get_json()
            self.assertEqual(get_working_payload["profile_id"], "trail")
            self.assertIn("Working Trail", get_working_payload["template"])

            default_response = self.client.get("/editor/template?profile_id=default")
            self.assertEqual(default_response.status_code, 200)
            default_payload = default_response.get_json()
            self.assertEqual(default_payload["profile_id"], "default")
            self.assertNotIn("Working Trail", default_payload["template"])

    def test_editor_template_working_profile_save_load_for_builtin_profiles(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self._set_temp_state_dir(temp_dir)

            cases = [
                ("strength_training", "Working Strength {{ activity.distance_miles }}"),
                ("walk", "Working Walk {{ activity.distance_miles }}"),
            ]

            for profile_id, template_text in cases:
                with self.subTest(profile_id=profile_id):
                    working_response = self.client.post(
                        "/editor/profiles/working",
                        json={"profile_id": profile_id},
                    )
                    self.assertEqual(working_response.status_code, 200)
                    self.assertEqual(working_response.get_json()["working_profile_id"], profile_id)

                    save_response = self.client.put(
                        "/editor/template",
                        json={
                            "template": template_text,
                            "author": "tester",
                            "name": f"{profile_id} template",
                            "source": "test",
                            "context_mode": "sample",
                        },
                    )
                    self.assertEqual(save_response.status_code, 200)
                    save_payload = save_response.get_json()
                    self.assertEqual(save_payload["profile_id"], profile_id)

                    load_response = self.client.get(f"/editor/template?profile_id={profile_id}")
                    self.assertEqual(load_response.status_code, 200)
                    load_payload = load_response.get_json()
                    self.assertEqual(load_payload["profile_id"], profile_id)
                    self.assertIn(template_text.split(" {{", 1)[0], load_payload["template"])

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


if __name__ == "__main__":
    unittest.main()
