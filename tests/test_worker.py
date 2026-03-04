import unittest
from datetime import datetime, timezone

from chronicle.worker import (
    _activity_detection_runtime_updates,
    _in_quiet_hours,
    _seconds_until_quiet_end,
    _should_refresh_dashboard,
)


class TestWorkerTiming(unittest.TestCase):
    def test_quiet_hours_simple_range(self) -> None:
        self.assertTrue(_in_quiet_hours(0, 0, 4))
        self.assertTrue(_in_quiet_hours(3, 0, 4))
        self.assertFalse(_in_quiet_hours(4, 0, 4))
        self.assertFalse(_in_quiet_hours(23, 0, 4))

    def test_quiet_hours_wrap_range(self) -> None:
        self.assertTrue(_in_quiet_hours(23, 22, 3))
        self.assertTrue(_in_quiet_hours(1, 22, 3))
        self.assertFalse(_in_quiet_hours(12, 22, 3))

    def test_seconds_until_quiet_end(self) -> None:
        now = datetime(2026, 2, 15, 1, 30, 0, tzinfo=timezone.utc)
        seconds = _seconds_until_quiet_end(now, 0, 4)
        self.assertEqual(seconds, 9000)


class TestWorkerDashboardRefresh(unittest.TestCase):
    def test_should_refresh_dashboard_on_updated_status(self) -> None:
        self.assertTrue(_should_refresh_dashboard({"status": "updated"}))
        self.assertTrue(_should_refresh_dashboard({"status": "UPDATED"}))

    def test_should_not_refresh_dashboard_for_non_updated_status(self) -> None:
        self.assertFalse(_should_refresh_dashboard({"status": "already_processed"}))
        self.assertFalse(_should_refresh_dashboard({"status": "no_activities"}))
        self.assertFalse(_should_refresh_dashboard({"status": "locked"}))
        self.assertFalse(_should_refresh_dashboard({"status": "error"}))
        self.assertFalse(_should_refresh_dashboard({}))
        self.assertFalse(_should_refresh_dashboard(None))


class TestWorkerActivityDetectionState(unittest.TestCase):
    def test_activity_detection_runtime_updates_for_new_activity(self) -> None:
        now = datetime(2026, 3, 4, 20, 0, 0, tzinfo=timezone.utc)
        updates = _activity_detection_runtime_updates(
            {"status": "updated", "activity_id": 17455368360},
            now_utc=now,
        )
        self.assertEqual(updates["worker.activity_detection.status"], "new_activity_detected")
        self.assertEqual(updates["worker.activity_detection.new_activity_available"], True)
        self.assertEqual(updates["worker.activity_detection.last_activity_id"], "17455368360")
        self.assertEqual(updates["worker.activity_detection.last_checked_at_utc"], now.isoformat())
        self.assertEqual(updates["worker.activity_detection.last_detected_at_utc"], now.isoformat())

    def test_activity_detection_runtime_updates_for_no_new_activity(self) -> None:
        now = datetime(2026, 3, 4, 20, 0, 0, tzinfo=timezone.utc)
        updates = _activity_detection_runtime_updates(
            {"status": "already_processed", "activity_id": 17455368360},
            now_utc=now,
        )
        self.assertEqual(updates["worker.activity_detection.status"], "no_new_activity")
        self.assertEqual(updates["worker.activity_detection.new_activity_available"], False)
        self.assertEqual(updates["worker.activity_detection.last_checked_at_utc"], now.isoformat())
        self.assertNotIn("worker.activity_detection.last_detected_at_utc", updates)

    def test_activity_detection_runtime_updates_for_unknown_result(self) -> None:
        updates = _activity_detection_runtime_updates(None)
        self.assertEqual(updates["worker.activity_detection.status"], "unknown")
        self.assertIn("worker.activity_detection.last_checked_at_utc", updates)

    def test_activity_detection_runtime_updates_does_not_clear_flag_for_non_detection_status(self) -> None:
        updates = _activity_detection_runtime_updates({"status": "locked"})
        self.assertEqual(updates["worker.activity_detection.status"], "locked")
        self.assertNotIn("worker.activity_detection.new_activity_available", updates)


if __name__ == "__main__":
    unittest.main()
