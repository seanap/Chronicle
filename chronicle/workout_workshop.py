from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .storage import get_plan_setting, set_plan_setting

WORKOUT_WORKSHOP_SETTINGS_KEY = "workout_workshop.definitions"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _normalize_workout_code(raw_value: Any) -> str:
    code = str(raw_value or "").strip()
    if not code:
        raise ValueError("workout_code is required.")
    if len(code) > 120:
        raise ValueError("workout_code must be <= 120 characters.")
    if "/" in code or "\\" in code:
        raise ValueError("workout_code cannot contain '/' or '\\'.")
    return code


def _normalize_workout_title(raw_value: Any, *, fallback: str) -> str:
    title = str(raw_value or "").strip()
    if title:
        return title[:160]
    return fallback


def _normalize_workout_structure(raw_value: Any) -> str:
    structure = str(raw_value or "").strip()
    if not structure:
        raise ValueError("structure is required.")
    return structure


def _normalize_saved_workout(item: Any) -> dict[str, str] | None:
    if not isinstance(item, dict):
        return None
    try:
        workout_code = _normalize_workout_code(item.get("workout_code"))
        title = _normalize_workout_title(item.get("title"), fallback=workout_code)
        structure = _normalize_workout_structure(item.get("structure"))
    except ValueError:
        return None
    created_at = str(item.get("created_at_utc") or "").strip() or _utc_now_iso()
    updated_at = str(item.get("updated_at_utc") or "").strip() or created_at
    return {
        "workout_code": workout_code,
        "title": title,
        "structure": structure,
        "created_at_utc": created_at,
        "updated_at_utc": updated_at,
    }


def list_workout_definitions(path: Path) -> list[dict[str, str]]:
    raw_value = get_plan_setting(path, WORKOUT_WORKSHOP_SETTINGS_KEY, [])
    if not isinstance(raw_value, list):
        return []
    normalized: list[dict[str, str]] = []
    seen_codes: set[str] = set()
    for item in raw_value:
        parsed = _normalize_saved_workout(item)
        if not parsed:
            continue
        code_key = parsed["workout_code"].lower()
        if code_key in seen_codes:
            continue
        seen_codes.add(code_key)
        normalized.append(parsed)
    normalized.sort(key=lambda item: (str(item.get("title") or "").lower(), str(item.get("workout_code") or "").lower()))
    return normalized


def upsert_workout_definition(path: Path, payload: dict[str, Any]) -> dict[str, str]:
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")
    workout_code = _normalize_workout_code(payload.get("workout_code"))
    title = _normalize_workout_title(payload.get("title"), fallback=workout_code)
    structure = _normalize_workout_structure(payload.get("structure"))
    now_iso = _utc_now_iso()

    definitions = list_workout_definitions(path)
    saved_item: dict[str, str] | None = None
    for item in definitions:
        if str(item.get("workout_code") or "").lower() != workout_code.lower():
            continue
        item["workout_code"] = workout_code
        item["title"] = title
        item["structure"] = structure
        item["updated_at_utc"] = now_iso
        saved_item = item
        break
    if saved_item is None:
        saved_item = {
            "workout_code": workout_code,
            "title": title,
            "structure": structure,
            "created_at_utc": now_iso,
            "updated_at_utc": now_iso,
        }
        definitions.append(saved_item)

    definitions.sort(key=lambda item: (str(item.get("title") or "").lower(), str(item.get("workout_code") or "").lower()))
    if not set_plan_setting(path, WORKOUT_WORKSHOP_SETTINGS_KEY, definitions):
        raise RuntimeError("Failed to persist workout definitions.")
    return dict(saved_item)
