from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from .storage import get_plan_setting, set_plan_setting

PLAN_GARMIN_SYNC_SETTINGS_KEY = "garmin_sync.requests"
PLAN_GARMIN_WORKOUTS_SETTINGS_KEY = "garmin_sync.workouts"
PLAN_GARMIN_CALENDAR_SETTINGS_KEY = "garmin_sync.calendar_entries"
ACTIVE_GARMIN_SYNC_STATUSES = {"pending", "in-progress"}
GARMIN_SYNC_CREATE_PHASE_CODES = {"workout_created", "workout_exists"}
GARMIN_SYNC_SCHEDULE_PHASE_CODES = {"calendar_scheduled", "calendar_exists"}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _normalize_sync_status(raw_value: Any) -> str:
    value = str(raw_value or "").strip().lower()
    if value in {"pending", "in-progress", "succeeded", "failed"}:
        return value
    return "pending"


def _default_status_code_for(status: str) -> str:
    if status == "in-progress":
        return "in_progress"
    if status == "succeeded":
        return "scheduled"
    if status == "failed":
        return "failed"
    return "queued"


def _normalize_sync_record(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    date_local = str(item.get("date_local") or "").strip()
    workout_code = str(item.get("workout_code") or "").strip()
    request_id = str(item.get("request_id") or "").strip()
    if not date_local or not workout_code or not request_id:
        return None

    status = _normalize_sync_status(item.get("status"))
    queued_at = str(item.get("queued_at_utc") or "").strip() or _utc_now_iso()
    updated_at = str(item.get("updated_at_utc") or "").strip() or queued_at
    status_code = str(item.get("status_code") or "").strip() or _default_status_code_for(status)
    normalized: dict[str, Any] = {
        "request_id": request_id,
        "date_local": date_local,
        "workout_code": workout_code,
        "status": status,
        "status_code": status_code,
        "queued_at_utc": queued_at,
        "updated_at_utc": updated_at,
    }
    garmin_workout_id = str(item.get("garmin_workout_id") or "").strip()
    if garmin_workout_id:
        normalized["garmin_workout_id"] = garmin_workout_id
    if isinstance(item.get("garmin_workout_created"), bool):
        normalized["garmin_workout_created"] = bool(item.get("garmin_workout_created"))
    calendar_entry_id = str(item.get("calendar_entry_id") or "").strip()
    if calendar_entry_id:
        normalized["calendar_entry_id"] = calendar_entry_id
    next_step = str(item.get("next_step") or "").strip()
    if next_step:
        normalized["next_step"] = next_step
    error_message = str(item.get("error_message") or "").strip()
    if error_message:
        normalized["error_message"] = error_message
    retry_guidance = str(item.get("retry_guidance") or "").strip()
    if retry_guidance:
        normalized["retry_guidance"] = retry_guidance
    return normalized


def list_garmin_sync_requests(path: Path) -> list[dict[str, Any]]:
    raw = get_plan_setting(path, PLAN_GARMIN_SYNC_SETTINGS_KEY, [])
    if not isinstance(raw, list):
        return []
    normalized: list[dict[str, Any]] = []
    for item in raw:
        record = _normalize_sync_record(item)
        if record is None:
            continue
        normalized.append(record)
    return normalized


def _record_sort_key(record: dict[str, Any]) -> tuple[str, str]:
    return (
        str(record.get("updated_at_utc") or ""),
        str(record.get("queued_at_utc") or ""),
    )


def _persist_sync_requests(path: Path, records: list[dict[str, Any]]) -> None:
    if not set_plan_setting(path, PLAN_GARMIN_SYNC_SETTINGS_KEY, records):
        raise RuntimeError("Failed to persist Garmin sync request.")


def _normalize_garmin_workout_record(item: Any) -> dict[str, str] | None:
    if not isinstance(item, dict):
        return None
    workout_code = str(item.get("workout_code") or "").strip()
    garmin_workout_id = str(item.get("garmin_workout_id") or "").strip()
    if not workout_code or not garmin_workout_id:
        return None
    title = str(item.get("title") or "").strip() or workout_code
    created_at = str(item.get("created_at_utc") or "").strip() or _utc_now_iso()
    updated_at = str(item.get("updated_at_utc") or "").strip() or created_at
    return {
        "garmin_workout_id": garmin_workout_id,
        "workout_code": workout_code,
        "title": title,
        "created_at_utc": created_at,
        "updated_at_utc": updated_at,
    }


def list_garmin_workouts(path: Path) -> list[dict[str, str]]:
    raw = get_plan_setting(path, PLAN_GARMIN_WORKOUTS_SETTINGS_KEY, [])
    if not isinstance(raw, list):
        return []
    normalized: list[dict[str, str]] = []
    seen_code_keys: set[str] = set()
    for item in raw:
        workout = _normalize_garmin_workout_record(item)
        if workout is None:
            continue
        code_key = str(workout.get("workout_code") or "").lower()
        if code_key in seen_code_keys:
            continue
        seen_code_keys.add(code_key)
        normalized.append(workout)
    return normalized


def _persist_garmin_workouts(path: Path, workouts: list[dict[str, str]]) -> None:
    if not set_plan_setting(path, PLAN_GARMIN_WORKOUTS_SETTINGS_KEY, workouts):
        raise RuntimeError("Failed to persist Garmin workout records.")


def ensure_garmin_workout(path: Path, *, workout_code: str) -> tuple[dict[str, str], bool]:
    normalized_code = str(workout_code or "").strip()
    if not normalized_code:
        raise ValueError("workout_code is required.")
    workouts = list_garmin_workouts(path)
    existing = next(
        (
            workout
            for workout in workouts
            if str(workout.get("workout_code") or "").lower() == normalized_code.lower()
        ),
        None,
    )
    if existing is not None:
        return dict(existing), False

    now_iso = _utc_now_iso()
    created = {
        "garmin_workout_id": f"gw-{uuid4().hex}",
        "workout_code": normalized_code,
        "title": normalized_code,
        "created_at_utc": now_iso,
        "updated_at_utc": now_iso,
    }
    workouts.append(created)
    _persist_garmin_workouts(path, workouts)
    return dict(created), True


def _normalize_garmin_calendar_entry(item: Any) -> dict[str, str] | None:
    if not isinstance(item, dict):
        return None
    calendar_entry_id = str(item.get("calendar_entry_id") or "").strip()
    date_local = str(item.get("date_local") or "").strip()
    garmin_workout_id = str(item.get("garmin_workout_id") or "").strip()
    workout_code = str(item.get("workout_code") or "").strip()
    if not calendar_entry_id or not date_local or not garmin_workout_id or not workout_code:
        return None
    scheduled_at = str(item.get("scheduled_at_utc") or "").strip() or _utc_now_iso()
    updated_at = str(item.get("updated_at_utc") or "").strip() or scheduled_at
    return {
        "calendar_entry_id": calendar_entry_id,
        "date_local": date_local,
        "garmin_workout_id": garmin_workout_id,
        "workout_code": workout_code,
        "scheduled_at_utc": scheduled_at,
        "updated_at_utc": updated_at,
    }


def list_garmin_calendar_entries(path: Path) -> list[dict[str, str]]:
    raw = get_plan_setting(path, PLAN_GARMIN_CALENDAR_SETTINGS_KEY, [])
    if not isinstance(raw, list):
        return []
    normalized: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    for item in raw:
        entry = _normalize_garmin_calendar_entry(item)
        if entry is None:
            continue
        entry_id = str(entry.get("calendar_entry_id") or "")
        if entry_id in seen_ids:
            continue
        seen_ids.add(entry_id)
        normalized.append(entry)
    return normalized


def _persist_garmin_calendar_entries(path: Path, entries: list[dict[str, str]]) -> None:
    if not set_plan_setting(path, PLAN_GARMIN_CALENDAR_SETTINGS_KEY, entries):
        raise RuntimeError("Failed to persist Garmin calendar entries.")


def schedule_garmin_workout_for_day(
    path: Path,
    *,
    date_local: str,
    garmin_workout_id: str,
    workout_code: str,
) -> tuple[dict[str, str], bool]:
    date_key = str(date_local or "").strip()
    workout_id = str(garmin_workout_id or "").strip()
    workout = str(workout_code or "").strip()
    if not date_key:
        raise ValueError("date_local is required.")
    if not workout_id:
        raise ValueError("garmin_workout_id is required.")
    if not workout:
        raise ValueError("workout_code is required.")

    entries = list_garmin_calendar_entries(path)
    existing = next(
        (
            entry
            for entry in entries
            if str(entry.get("date_local") or "") == date_key
            and str(entry.get("garmin_workout_id") or "") == workout_id
        ),
        None,
    )
    if existing is not None:
        return dict(existing), False

    now_iso = _utc_now_iso()
    created = {
        "calendar_entry_id": f"gcal-{uuid4().hex}",
        "date_local": date_key,
        "garmin_workout_id": workout_id,
        "workout_code": workout,
        "scheduled_at_utc": now_iso,
        "updated_at_utc": now_iso,
    }
    entries.append(created)
    _persist_garmin_calendar_entries(path, entries)
    return dict(created), True


def _latest_matching_sync_request(
    records: list[dict[str, Any]],
    *,
    date_local: str,
    workout_code: str | None = None,
) -> dict[str, Any] | None:
    matches: list[dict[str, Any]] = []
    for record in records:
        if str(record.get("date_local") or "") != date_local:
            continue
        if workout_code and str(record.get("workout_code") or "").lower() != workout_code.lower():
            continue
        matches.append(record)
    if not matches:
        return None
    matches.sort(key=_record_sort_key, reverse=True)
    return matches[0]


def initiate_garmin_sync_request(path: Path, *, date_local: str, workout_code: str) -> dict[str, Any]:
    date_key = str(date_local or "").strip()
    workout = str(workout_code or "").strip()
    if not date_key:
        raise ValueError("date_local is required.")
    if not workout:
        raise ValueError("workout_code is required.")

    records = list_garmin_sync_requests(path)
    latest = _latest_matching_sync_request(records, date_local=date_key, workout_code=workout)
    if latest is not None and str(latest.get("status") or "") in ACTIVE_GARMIN_SYNC_STATUSES:
        return dict(latest)

    now_iso = _utc_now_iso()
    record = {
        "request_id": f"sync-{uuid4().hex}",
        "date_local": date_key,
        "workout_code": workout,
        "status": "pending",
        "status_code": "queued",
        "queued_at_utc": now_iso,
        "updated_at_utc": now_iso,
    }
    records.append(record)
    _persist_sync_requests(path, records)
    return dict(record)


def run_garmin_sync_request(
    path: Path,
    *,
    date_local: str,
    workout_code: str | None = None,
) -> tuple[dict[str, Any], dict[str, str]]:
    date_key = str(date_local or "").strip()
    if not date_key:
        raise ValueError("date_local is required.")
    requested_workout = str(workout_code or "").strip() or None

    records = list_garmin_sync_requests(path)
    latest = _latest_matching_sync_request(
        records,
        date_local=date_key,
        workout_code=requested_workout,
    )
    if latest is None:
        raise ValueError("No Garmin sync request exists for this day. Send to Garmin first.")

    selected_workout = str(latest.get("workout_code") or "").strip()
    if not selected_workout:
        raise ValueError("workout_code is required.")

    existing_workout_id = str(latest.get("garmin_workout_id") or "").strip()
    existing_status_code = str(latest.get("status_code") or "").strip()
    if existing_workout_id and (
        existing_status_code in GARMIN_SYNC_CREATE_PHASE_CODES
        or existing_status_code in GARMIN_SYNC_SCHEDULE_PHASE_CODES
    ):
        workouts = list_garmin_workouts(path)
        existing_workout = next(
            (
                workout
                for workout in workouts
                if str(workout.get("garmin_workout_id") or "") == existing_workout_id
            ),
            None,
        )
        if existing_workout is not None:
            return dict(latest), dict(existing_workout)

    garmin_workout, created = ensure_garmin_workout(path, workout_code=selected_workout)

    now_iso = _utc_now_iso()
    latest["status"] = "in-progress"
    latest["status_code"] = "workout_created" if created else "workout_exists"
    latest["garmin_workout_id"] = str(garmin_workout.get("garmin_workout_id") or "")
    latest["garmin_workout_created"] = bool(created)
    latest["next_step"] = "schedule_workout_on_calendar"
    latest["updated_at_utc"] = now_iso
    _persist_sync_requests(path, records)
    return dict(latest), dict(garmin_workout)


def schedule_garmin_sync_request(
    path: Path,
    *,
    date_local: str,
    workout_code: str | None = None,
) -> tuple[dict[str, Any], dict[str, str], dict[str, str]]:
    date_key = str(date_local or "").strip()
    if not date_key:
        raise ValueError("date_local is required.")
    requested_workout = str(workout_code or "").strip() or None

    records = list_garmin_sync_requests(path)
    latest = _latest_matching_sync_request(
        records,
        date_local=date_key,
        workout_code=requested_workout,
    )
    if latest is None:
        raise ValueError("No Garmin sync request exists for this day. Send to Garmin first.")

    garmin_workout_id = str(latest.get("garmin_workout_id") or "").strip()
    if not garmin_workout_id:
        raise ValueError("No Garmin workout exists yet for this request. Run Garmin sync first.")
    selected_workout = str(latest.get("workout_code") or "").strip()
    if not selected_workout:
        raise ValueError("workout_code is required.")

    workouts = list_garmin_workouts(path)
    garmin_workout = next(
        (
            workout
            for workout in workouts
            if str(workout.get("garmin_workout_id") or "") == garmin_workout_id
        ),
        None,
    )
    if garmin_workout is None:
        raise ValueError("Garmin workout record is missing for this request.")

    existing_entry_id = str(latest.get("calendar_entry_id") or "").strip()
    existing_status_code = str(latest.get("status_code") or "").strip()
    if existing_entry_id and existing_status_code in GARMIN_SYNC_SCHEDULE_PHASE_CODES:
        entries = list_garmin_calendar_entries(path)
        existing_entry = next(
            (
                entry
                for entry in entries
                if str(entry.get("calendar_entry_id") or "") == existing_entry_id
            ),
            None,
        )
        if existing_entry is not None:
            return dict(latest), dict(garmin_workout), dict(existing_entry)

    calendar_entry, created = schedule_garmin_workout_for_day(
        path,
        date_local=date_key,
        garmin_workout_id=garmin_workout_id,
        workout_code=selected_workout,
    )

    now_iso = _utc_now_iso()
    latest["status"] = "succeeded"
    latest["status_code"] = "calendar_scheduled" if created else "calendar_exists"
    latest["calendar_entry_id"] = str(calendar_entry.get("calendar_entry_id") or "")
    latest["next_step"] = "report_sync_result"
    latest["updated_at_utc"] = now_iso
    _persist_sync_requests(path, records)
    return dict(latest), dict(garmin_workout), dict(calendar_entry)


def mark_garmin_sync_request_failed(
    path: Path,
    *,
    date_local: str,
    workout_code: str | None = None,
    status_code: str,
    error_message: str,
    retry_guidance: str,
) -> dict[str, Any]:
    date_key = str(date_local or "").strip()
    if not date_key:
        raise ValueError("date_local is required.")
    requested_workout = str(workout_code or "").strip() or None

    records = list_garmin_sync_requests(path)
    latest = _latest_matching_sync_request(
        records,
        date_local=date_key,
        workout_code=requested_workout,
    )
    if latest is None:
        raise ValueError("No Garmin sync request exists for this day. Send to Garmin first.")

    now_iso = _utc_now_iso()
    latest["status"] = "failed"
    latest["status_code"] = str(status_code or "").strip() or "failed"
    latest["error_message"] = str(error_message or "").strip() or "Garmin sync failed."
    latest["retry_guidance"] = (
        str(retry_guidance or "").strip()
        or "Retry Garmin sync from the Plan page after verifying Garmin connection and workout attachment."
    )
    latest["next_step"] = "retry_sync"
    latest["updated_at_utc"] = now_iso
    _persist_sync_requests(path, records)
    return dict(latest)
