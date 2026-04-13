import tempfile
import unittest
from pathlib import Path

from chronicle.agent_store import (
    append_audit_event,
    create_draft,
    create_job,
    get_draft,
    get_job,
    list_audit_events,
    list_drafts,
    list_jobs,
    update_draft,
    update_job,
)


class TestAgentStore(unittest.TestCase):
    def test_draft_lifecycle(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_dir = Path(temp_dir)
            draft = create_draft(
                state_dir,
                resource_kind="template",
                payload={"template": "Hello {{ activity.name }}", "profile_id": "default"},
                title="Template draft",
                requested_by="tester",
            )
            loaded = get_draft(state_dir, draft["draft_id"])
            self.assertIsNotNone(loaded)
            self.assertEqual(loaded["resource_kind"], "template")

            updated = update_draft(
                state_dir,
                draft["draft_id"],
                status="validated",
                validation={"valid": True},
            )
            self.assertEqual(updated["status"], "validated")
            self.assertTrue(updated["validation"]["valid"])
            self.assertEqual(len(list_drafts(state_dir)), 1)

    def test_job_and_audit_lifecycle(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_dir = Path(temp_dir)
            job = create_job(
                state_dir,
                task_kind="plan_next_week",
                request_payload={"request": "Build next week"},
                requested_by="tester",
            )
            updated = update_job(
                state_dir,
                job["job_id"],
                status="awaiting_approval",
                result={"draft_id": "draft_123"},
            )
            self.assertEqual(updated["status"], "awaiting_approval")
            self.assertEqual(get_job(state_dir, job["job_id"])["result"]["draft_id"], "draft_123")
            self.assertEqual(len(list_jobs(state_dir)), 1)

            event = append_audit_event(
                state_dir,
                event_type="draft.created",
                actor="tester",
                resource_kind="draft",
                resource_id="draft_123",
                payload={"title": "Example"},
            )
            events = list_audit_events(state_dir)
            self.assertEqual(events[0]["event_id"], event["event_id"])
            self.assertEqual(events[0]["payload"]["title"], "Example")


if __name__ == "__main__":
    unittest.main()
