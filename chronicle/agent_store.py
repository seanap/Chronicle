from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _agent_root(state_dir: Path) -> Path:
    return state_dir / "agent_control"


def _drafts_dir(state_dir: Path) -> Path:
    return _agent_root(state_dir) / "drafts"


def _jobs_dir(state_dir: Path) -> Path:
    return _agent_root(state_dir) / "jobs"


def _audit_log_path(state_dir: Path) -> Path:
    return _agent_root(state_dir) / "audit.jsonl"


def ensure_agent_store(state_dir: Path) -> None:
    _drafts_dir(state_dir).mkdir(parents=True, exist_ok=True)
    _jobs_dir(state_dir).mkdir(parents=True, exist_ok=True)
    _audit_log_path(state_dir).parent.mkdir(parents=True, exist_ok=True)


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    return raw if isinstance(raw, dict) else None


def _new_id(prefix: str) -> str:
    return f"{prefix}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_{secrets.token_hex(4)}"


def create_draft(
    state_dir: Path,
    *,
    resource_kind: str,
    payload: dict[str, Any],
    title: str | None = None,
    base_version: str | None = None,
    requested_by: str | None = None,
    source: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ensure_agent_store(state_dir)
    draft_id = _new_id("draft")
    now_iso = _utc_now_iso()
    record = {
        "draft_id": draft_id,
        "resource_kind": str(resource_kind or "").strip(),
        "title": str(title or resource_kind or "draft").strip() or "draft",
        "payload": payload,
        "base_version": str(base_version or "").strip() or None,
        "status": "draft",
        "created_at_utc": now_iso,
        "updated_at_utc": now_iso,
        "requested_by": str(requested_by or "").strip() or None,
        "source": str(source or "").strip() or None,
        "metadata": metadata or {},
        "validation": None,
        "apply_result": None,
    }
    _write_json(_drafts_dir(state_dir) / f"{draft_id}.json", record)
    return record


def get_draft(state_dir: Path, draft_id: str) -> dict[str, Any] | None:
    ensure_agent_store(state_dir)
    return _read_json(_drafts_dir(state_dir) / f"{draft_id}.json")


def update_draft(state_dir: Path, draft_id: str, **updates: Any) -> dict[str, Any]:
    existing = get_draft(state_dir, draft_id)
    if existing is None:
        raise ValueError("Unknown draft_id.")
    existing.update(updates)
    existing["updated_at_utc"] = _utc_now_iso()
    _write_json(_drafts_dir(state_dir) / f"{draft_id}.json", existing)
    return existing


def list_drafts(state_dir: Path, *, resource_kind: str | None = None) -> list[dict[str, Any]]:
    ensure_agent_store(state_dir)
    records: list[dict[str, Any]] = []
    for path in sorted(_drafts_dir(state_dir).glob("*.json"), reverse=True):
        record = _read_json(path)
        if not isinstance(record, dict):
            continue
        if resource_kind and str(record.get("resource_kind") or "").strip() != resource_kind:
            continue
        records.append(record)
    return records


def create_job(
    state_dir: Path,
    *,
    task_kind: str,
    request_payload: dict[str, Any],
    requested_by: str | None = None,
    source: str | None = None,
) -> dict[str, Any]:
    ensure_agent_store(state_dir)
    job_id = _new_id("job")
    now_iso = _utc_now_iso()
    record = {
        "job_id": job_id,
        "task_kind": str(task_kind or "").strip(),
        "status": "queued",
        "request_payload": request_payload,
        "result": None,
        "error": None,
        "created_at_utc": now_iso,
        "updated_at_utc": now_iso,
        "requested_by": str(requested_by or "").strip() or None,
        "source": str(source or "").strip() or None,
    }
    _write_json(_jobs_dir(state_dir) / f"{job_id}.json", record)
    return record


def get_job(state_dir: Path, job_id: str) -> dict[str, Any] | None:
    ensure_agent_store(state_dir)
    return _read_json(_jobs_dir(state_dir) / f"{job_id}.json")


def update_job(
    state_dir: Path,
    job_id: str,
    *,
    status: str | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    existing = get_job(state_dir, job_id)
    if existing is None:
        raise ValueError("Unknown job_id.")
    if status is not None:
        existing["status"] = str(status).strip() or existing.get("status")
    if result is not None:
        existing["result"] = result
    if error is not None:
        existing["error"] = str(error)
    existing["updated_at_utc"] = _utc_now_iso()
    _write_json(_jobs_dir(state_dir) / f"{job_id}.json", existing)
    return existing


def list_jobs(state_dir: Path, *, task_kind: str | None = None) -> list[dict[str, Any]]:
    ensure_agent_store(state_dir)
    records: list[dict[str, Any]] = []
    for path in sorted(_jobs_dir(state_dir).glob("*.json"), reverse=True):
        record = _read_json(path)
        if not isinstance(record, dict):
            continue
        if task_kind and str(record.get("task_kind") or "").strip() != task_kind:
            continue
        records.append(record)
    return records


def append_audit_event(
    state_dir: Path,
    *,
    event_type: str,
    actor: str | None = None,
    resource_kind: str | None = None,
    resource_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ensure_agent_store(state_dir)
    event = {
        "event_id": _new_id("audit"),
        "event_type": str(event_type or "").strip() or "unknown",
        "actor": str(actor or "").strip() or None,
        "resource_kind": str(resource_kind or "").strip() or None,
        "resource_id": str(resource_id or "").strip() or None,
        "payload": payload or {},
        "created_at_utc": _utc_now_iso(),
    }
    with _audit_log_path(state_dir).open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, sort_keys=True))
        handle.write("\n")
    return event


def list_audit_events(state_dir: Path, *, limit: int = 100) -> list[dict[str, Any]]:
    ensure_agent_store(state_dir)
    path = _audit_log_path(state_dir)
    if not path.is_file():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    records: list[dict[str, Any]] = []
    for line in reversed(lines):
        if len(records) >= max(1, limit):
            break
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            records.append(payload)
    return records
