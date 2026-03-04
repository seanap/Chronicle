from __future__ import annotations

import os
import secrets
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode

import requests
from flask import Flask, redirect, render_template, request, send_from_directory
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .activity_pipeline import preview_profile_match, run_once
from .config import Settings
from .dashboard_data import get_dashboard_payload
from .garmin_sync_queue import (
    initiate_garmin_sync_request,
    mark_garmin_sync_request_failed,
    run_garmin_sync_request,
    schedule_garmin_sync_request,
)
from .plan_data import RUN_TYPE_OPTIONS, get_plan_payload
from .pace_workshop import (
    DEFAULT_MARATHON_GOAL,
    calculate_race_equivalency,
    normalize_marathon_goal_time,
    supported_race_distances,
    training_paces_for_goal,
)
from .setup_config import (
    PROVIDER_FIELDS,
    PROVIDER_LINKS,
    SETUP_ALLOWED_KEYS,
    SETUP_SECRET_KEYS,
    mask_setup_values,
    merge_setup_overrides,
    render_env_snippet,
    setup_env_file_path,
    update_setup_env_file,
)
from .storage import (
    get_plan_setting,
    delete_runtime_value,
    get_plan_day,
    get_runtime_value,
    get_runtime_values,
    get_worker_heartbeat,
    is_worker_healthy,
    list_plan_sessions,
    read_json,
    replace_plan_sessions_for_day,
    set_plan_setting,
    set_runtime_value,
    upsert_plan_days_bulk,
    upsert_plan_day,
    write_json,
)
from .template_profiles import (
    create_template_profile,
    export_template_profiles_bundle,
    get_template_profile,
    get_working_template_profile,
    import_template_profiles_bundle,
    list_template_profiles,
    set_working_template_profile,
    update_template_profile,
)
from .template_repository import (
    create_template_repository_template,
    duplicate_template_repository_template,
    export_template_repository_bundle,
    get_active_template,
    get_default_template,
    get_editor_snippets,
    get_sample_template_context,
    get_starter_templates,
    get_template_repository_template,
    get_template_version,
    import_template_repository_bundle,
    list_sample_template_fixtures,
    list_template_repository_templates,
    list_template_versions,
    rollback_template_version,
    save_active_template,
    update_template_repository_template,
)
from .template_rendering import normalize_template_context, render_template_text, validate_template_text
from .template_schema import build_context_schema
from .workout_workshop import list_workout_definitions, upsert_workout_definition


PROJECT_ROOT = Path(__file__).resolve().parent.parent

app = Flask(
    __name__,
    template_folder=str(PROJECT_ROOT / "templates"),
    static_folder=str(PROJECT_ROOT / "static"),
    static_url_path="/static",
)

_PLAN_RUN_TYPE_OPTIONS = [str(item).strip() for item in RUN_TYPE_OPTIONS if str(item).strip()]
_PLAN_RUN_TYPE_OPTIONS_BY_KEY = {
    "".join(ch for ch in option.lower() if ch.isalnum()): option
    for option in _PLAN_RUN_TYPE_OPTIONS
}


def _normalize_plan_run_type_key(value: object) -> str:
    return "".join(ch for ch in str(value or "").strip().lower() if ch.isalnum())


def _coerce_plan_run_type(raw_value: object) -> str | None:
    text = str(raw_value or "").strip()
    if not text:
        return None
    normalized_key = _normalize_plan_run_type_key(text)
    canonical = _PLAN_RUN_TYPE_OPTIONS_BY_KEY.get(normalized_key)
    if canonical is None:
        allowed = ", ".join(_PLAN_RUN_TYPE_OPTIONS)
        raise ValueError(f"run_type must be one of: {allowed}.")
    return canonical
settings = Settings.from_env()
settings.ensure_state_paths()

STRAVA_OAUTH_SCOPE = "read,activity:read_all,activity:write"
STRAVA_OAUTH_RUNTIME_KEY = "setup.strava.oauth"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize"
METERS_PER_MILE = 1609.34
PLAN_PACE_WORKSHOP_GOAL_KEY = "pace_workshop.marathon_goal"
UI_ROLLOUT_RUNTIME_KEY = "ui.rollout.mode"
UI_ROLLOUT_LAST_MODE_CHANGE_KEY = "ui.rollout.last_mode_change"
UI_ROLLOUT_LAST_ROLLBACK_KEY = "ui.rollout.last_rollback"
UI_ROLLOUT_ALLOWED_MODES = {"mpa", "spa"}
UI_ROLLBACK_TARGET_MINUTES = 15
CORE_UI_FLOW_LEGACY_PATHS = {
    "sources": "/setup",
    "build": "/editor",
    "plan": "/plan",
    "view": "/dashboard",
    "control": "/control",
}


def _normalize_ui_flow(value: object) -> str | None:
    flow = str(value or "").strip().lower()
    if flow in CORE_UI_FLOW_LEGACY_PATHS:
        return flow
    return None


def _normalize_ui_rollout_mode(value: object) -> str | None:
    mode = str(value or "").strip().lower()
    if mode in UI_ROLLOUT_ALLOWED_MODES:
        return mode
    return None


def _ui_rollout_default_mode() -> str:
    configured = _normalize_ui_rollout_mode(os.getenv("UI_ROLLOUT_DEFAULT_MODE", "mpa"))
    return configured or "mpa"


def _ui_rollout_spa_base_path() -> str:
    configured = str(os.getenv("UI_SPA_BASE_PATH", "/app") or "").strip()
    if not configured:
        return "/app"
    if not configured.startswith("/"):
        configured = f"/{configured}"
    return configured.rstrip("/") or "/app"


def _legacy_flow_path(flow_name: str) -> str:
    return f"/legacy/{flow_name}"


def _spa_flow_path(flow_name: str) -> str:
    return f"{_ui_rollout_spa_base_path()}/{flow_name}"


def _ui_rollout_targets(mode: str) -> dict[str, str]:
    normalized_mode = _normalize_ui_rollout_mode(mode) or "mpa"
    if normalized_mode == "spa":
        return {flow_name: _spa_flow_path(flow_name) for flow_name in CORE_UI_FLOW_LEGACY_PATHS}
    return {flow_name: _legacy_flow_path(flow_name) for flow_name in CORE_UI_FLOW_LEGACY_PATHS}


def _current_ui_rollout_mode(current: Settings | None = None) -> str:
    effective = current or _effective_settings()
    runtime_mode = _normalize_ui_rollout_mode(get_runtime_value(effective.processed_log_file, UI_ROLLOUT_RUNTIME_KEY))
    if runtime_mode is not None:
        return runtime_mode
    return _ui_rollout_default_mode()


def _set_ui_rollout_mode(
    current: Settings,
    mode: str,
    *,
    source: str,
    reason: str | None = None,
) -> str:
    normalized_mode = _normalize_ui_rollout_mode(mode)
    if normalized_mode is None:
        raise ValueError("mode must be one of: mpa, spa.")

    timestamp_utc = datetime.now(timezone.utc).isoformat()
    set_runtime_value(current.processed_log_file, UI_ROLLOUT_RUNTIME_KEY, normalized_mode)
    set_runtime_value(
        current.processed_log_file,
        UI_ROLLOUT_LAST_MODE_CHANGE_KEY,
        {
            "mode": normalized_mode,
            "source": source,
            "reason": reason or "",
            "changed_at_utc": timestamp_utc,
        },
    )
    return timestamp_utc


def _render_legacy_core_flow(flow_name: str) -> str:
    if flow_name == "sources":
        return render_template("setup.html")
    if flow_name == "build":
        return render_template("editor.html")
    if flow_name == "plan":
        return render_template("plan.html")
    if flow_name == "view":
        return render_template("dashboard.html")
    if flow_name == "control":
        return render_template("control.html")
    raise ValueError(f"Unsupported core flow '{flow_name}'.")


def _core_flow_entrypoint(flow_name: str):
    normalized_flow = _normalize_ui_flow(flow_name)
    if normalized_flow is None:
        return {
            "status": "error",
            "error": {
                "code": "CORE_FLOW_NOT_FOUND",
                "message": "Unknown core flow.",
                "details": {"flow": flow_name},
            },
        }, 404

    current = _effective_settings()
    mode = _current_ui_rollout_mode(current)
    if mode == "spa":
        return redirect(_spa_flow_path(normalized_flow), code=302)
    return _render_legacy_core_flow(normalized_flow)


def _effective_settings() -> Settings:
    current = Settings.from_env()
    current.ensure_state_paths()
    return current


def _setup_effective_values() -> dict[str, object]:
    current = _effective_settings()
    values: dict[str, object] = {
        "STRAVA_CLIENT_ID": current.strava_client_id,
        "STRAVA_CLIENT_SECRET": current.strava_client_secret,
        "STRAVA_REFRESH_TOKEN": current.strava_refresh_token,
        "STRAVA_ACCESS_TOKEN": current.strava_access_token or "",
        "ENABLE_GARMIN": current.enable_garmin,
        "GARMIN_EMAIL": current.garmin_email or "",
        "GARMIN_PASSWORD": current.garmin_password or "",
        "ENABLE_INTERVALS": current.enable_intervals,
        "INTERVALS_API_KEY": current.intervals_api_key or "",
        "INTERVALS_USER_ID": current.intervals_user_id or "",
        "ENABLE_WEATHER": current.enable_weather,
        "WEATHER_API_KEY": current.weather_api_key or "",
        "ENABLE_SMASHRUN": current.enable_smashrun,
        "SMASHRUN_ACCESS_TOKEN": current.smashrun_access_token or "",
        "ENABLE_CRONO_API": current.enable_crono_api,
        "CRONO_API_BASE_URL": current.crono_api_base_url or "",
        "CRONO_API_KEY": current.crono_api_key or "",
        "TIMEZONE": current.timezone,
    }

    cached_tokens = read_json(current.strava_token_file) or {}
    cached_refresh = cached_tokens.get("refresh_token")
    if (
        isinstance(cached_refresh, str)
        and cached_refresh.strip()
        and not str(values.get("STRAVA_REFRESH_TOKEN") or "").strip()
    ):
        values["STRAVA_REFRESH_TOKEN"] = cached_refresh.strip()
    cached_access = cached_tokens.get("access_token")
    if (
        isinstance(cached_access, str)
        and cached_access.strip()
        and not str(values.get("STRAVA_ACCESS_TOKEN") or "").strip()
    ):
        values["STRAVA_ACCESS_TOKEN"] = cached_access.strip()

    return values


def _setup_strava_status(values: dict[str, object]) -> dict[str, object]:
    client_id = str(values.get("STRAVA_CLIENT_ID") or "").strip()
    client_secret = str(values.get("STRAVA_CLIENT_SECRET") or "").strip()
    refresh_token = str(values.get("STRAVA_REFRESH_TOKEN") or "").strip()
    access_token = str(values.get("STRAVA_ACCESS_TOKEN") or "").strip()
    return {
        "client_configured": bool(client_id and client_secret),
        "connected": bool(refresh_token),
        "has_refresh_token": bool(refresh_token),
        "has_access_token": bool(access_token),
    }


def _public_setup_values(values: dict[str, object]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key in SETUP_ALLOWED_KEYS:
        value = values.get(key)
        if key in SETUP_SECRET_KEYS:
            result[key] = ""
            continue
        if value is None:
            result[key] = ""
            continue
        result[key] = value
    return result


def _setup_payload() -> dict[str, object]:
    values = _setup_effective_values()
    masked_values = mask_setup_values(values)
    secret_presence = {
        key: bool(str(values.get(key) or "").strip())
        for key in sorted(SETUP_SECRET_KEYS)
    }
    provider_fields = {
        provider: fields
        for provider, fields in PROVIDER_FIELDS.items()
    }
    env_path = setup_env_file_path()
    env_writable = os.access(env_path, os.W_OK) if env_path.exists() else os.access(env_path.parent, os.W_OK)
    return {
        "status": "ok",
        "values": _public_setup_values(values),
        "masked_values": masked_values,
        "secret_presence": secret_presence,
        "provider_links": PROVIDER_LINKS,
        "provider_fields": provider_fields,
        "allowed_keys": sorted(SETUP_ALLOWED_KEYS),
        "secret_keys": sorted(SETUP_SECRET_KEYS),
        "strava": _setup_strava_status(values),
        "env_file": {
            "path": str(env_path),
            "exists": env_path.exists(),
            "writable": bool(env_writable),
        },
    }


def _default_setup_callback_url() -> str:
    return request.url_root.rstrip("/") + "/setup/strava/callback"


def _redirect_setup_with_status(status: str, reason: str = ""):
    params = {"strava_oauth": status}
    if reason:
        params["reason"] = reason
    return app.redirect_class(f"/setup?{urlencode(params)}", 302)


def _latest_payload() -> dict | None:
    return read_json(settings.latest_json_file)


def _state_path_writable(state_dir: Path) -> bool:
    probe = state_dir / ".ready_probe"
    try:
        state_dir.mkdir(parents=True, exist_ok=True)
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True
    except OSError:
        return False


def _latest_template_context() -> dict | None:
    payload = _latest_payload()
    if not payload:
        return None
    context = payload.get("template_context")
    if isinstance(context, dict):
        return normalize_template_context(context)
    return None


def _resolve_context_mode(raw_mode: str | None) -> str:
    mode = (raw_mode or "sample").strip().lower()
    if mode not in {"latest", "sample", "latest_or_sample", "fixture"}:
        raise ValueError("context_mode must be one of: latest, sample, latest_or_sample, fixture.")
    return mode


def _resolve_fixture_name(raw_name: str | None) -> str:
    value = (raw_name or "default").strip().lower()
    return value or "default"


def _context_for_mode(mode: str, fixture_name: str | None = None) -> tuple[dict | None, str]:
    fixture = _resolve_fixture_name(fixture_name)
    if mode == "latest":
        return _latest_template_context(), "latest"
    if mode in {"sample", "fixture"}:
        return get_sample_template_context(fixture), f"sample:{fixture}"

    latest = _latest_template_context()
    if latest is not None:
        return latest, "latest"
    return get_sample_template_context(fixture), f"sample:{fixture}"


def _resolve_profile_id(raw_profile_id: str | None) -> str:
    candidate = str(raw_profile_id or "").strip().lower()
    if candidate:
        profile = get_template_profile(settings, candidate)
        if not profile:
            raise ValueError(f"Unknown profile_id: {candidate}")
        return candidate
    return str(get_working_template_profile(settings).get("profile_id") or "default")


def _resolve_profile_id_filters() -> list[str] | None:
    raw_values: list[str] = []
    raw_values.extend(request.args.getlist("profile_id"))
    csv_ids = str(request.args.get("profile_ids") or "").strip()
    if csv_ids:
        raw_values.extend(csv_ids.split(","))

    filtered: list[str] = []
    seen: set[str] = set()
    for raw_value in raw_values:
        normalized = str(raw_value or "").strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        filtered.append(normalized)
    return filtered or None


def _parse_enabled_value(raw_value: object) -> bool:
    if isinstance(raw_value, bool):
        return raw_value
    if isinstance(raw_value, (int, float)):
        if int(raw_value) in {0, 1}:
            return bool(int(raw_value))
    if isinstance(raw_value, str):
        normalized = raw_value.strip().lower()
        if normalized in {"1", "true", "yes", "y", "on"}:
            return True
        if normalized in {"0", "false", "no", "n", "off"}:
            return False
    raise ValueError("enabled must be a boolean (true/false).")


def _parse_profile_label(raw_value: object) -> str:
    if not isinstance(raw_value, str) or not raw_value.strip():
        raise ValueError("label is required.")
    return raw_value.strip()


def _parse_profile_criteria(raw_value: object) -> dict:
    if not isinstance(raw_value, dict):
        raise ValueError("criteria must be an object.")
    return raw_value


def _resolve_plan_date(raw_date: str) -> str:
    text = str(raw_date or "").strip()
    if not text:
        raise ValueError("date_local is required.")
    try:
        parsed = date.fromisoformat(text)
    except ValueError as exc:
        raise ValueError("date_local must be YYYY-MM-DD.") from exc
    return parsed.isoformat()


def _load_plan_marathon_goal(path: Path) -> str:
    saved = get_plan_setting(path, PLAN_PACE_WORKSHOP_GOAL_KEY, DEFAULT_MARATHON_GOAL)
    try:
        return normalize_marathon_goal_time(saved)
    except ValueError:
        return DEFAULT_MARATHON_GOAL


def _plan_pace_workshop_payload(marathon_goal: str) -> dict[str, object]:
    training = training_paces_for_goal(marathon_goal)
    return {
        "status": "ok",
        "marathon_goal": normalize_marathon_goal_time(marathon_goal),
        "default_marathon_goal": DEFAULT_MARATHON_GOAL,
        "supported_distances": supported_race_distances(),
        "goal_training": training,
    }


def _format_plan_miles_value(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _parse_plan_distance_input(raw_value: object) -> tuple[list[dict[str, object]], float]:
    text = str(raw_value or "").strip()
    if not text:
        return [], 0.0
    normalized = text.replace(" ", "")
    parts = normalized.split("+")
    if any(part == "" for part in parts):
        raise ValueError("distance supports numbers separated by '+', for example '6+4'.")

    values: list[float] = []
    for part in parts:
        try:
            parsed = float(part)
        except ValueError as exc:
            raise ValueError("distance must be numeric or '+' separated numeric values.") from exc
        if parsed < 0:
            raise ValueError("distance values must be >= 0.")
        values.append(parsed)

    non_zero = [value for value in values if value > 0]
    sessions = [
        {
            "ordinal": idx + 1,
            "planned_miles": value,
        }
        for idx, value in enumerate(non_zero)
    ]
    total = float(sum(non_zero))
    return sessions, total


def _parse_plan_sessions_input(raw_value: object) -> tuple[list[dict[str, object]], float]:
    if not isinstance(raw_value, list):
        raise ValueError("sessions must be an array of numeric values or objects with planned_miles.")
    sessions: list[dict[str, object]] = []
    total = 0.0
    for idx, item in enumerate(raw_value):
        run_type: str | None = None
        workout_code: str | None = None
        if isinstance(item, dict):
            planned_raw = item.get("planned_miles")
            run_type = _coerce_plan_run_type(item.get("run_type"))
            workout_code = str(item.get("planned_workout") or item.get("workout_code") or "").strip() or None
        else:
            planned_raw = item
        try:
            planned = float(planned_raw)
        except (TypeError, ValueError) as exc:
            raise ValueError("sessions entries must be numeric planned mileage values.") from exc
        if planned < 0:
            raise ValueError("sessions planned_miles must be >= 0.")
        if planned == 0:
            continue
        sessions.append(
            {
                "ordinal": idx + 1,
                "planned_miles": planned,
                "run_type": run_type,
                "workout_code": workout_code,
            }
        )
        total += planned
    return sessions, total


def _normalize_plan_session_response(sessions: object) -> list[dict[str, object]]:
    if not isinstance(sessions, list):
        return []
    payload: list[dict[str, object]] = []
    for item in sessions:
        if not isinstance(item, dict):
            continue
        workout_text = str(item.get("planned_workout") or item.get("workout_code") or "").strip()
        normalized = dict(item)
        normalized["planned_workout"] = workout_text
        normalized["workout_code"] = workout_text
        payload.append(normalized)
    return payload


def _coerce_plan_day_payload(
    body: dict[str, object],
    *,
    existing_day: dict[str, object],
) -> tuple[str | None, str | None, bool | None, float | int | str | None, list[dict[str, object]] | None]:
    if "run_type" in body:
        run_type = _coerce_plan_run_type(body.get("run_type"))
    else:
        run_type = str(existing_day.get("run_type") or "").strip() or None
    raw_notes = body.get("notes", existing_day.get("notes"))
    notes = str(raw_notes or "").strip() or None

    existing_is_complete = existing_day.get("is_complete")
    is_complete: bool | None = existing_is_complete if isinstance(existing_is_complete, bool) else None
    if "is_complete" in body:
        raw_complete = body.get("is_complete")
        if raw_complete is None:
            is_complete = None
        elif isinstance(raw_complete, bool):
            is_complete = raw_complete
        elif isinstance(raw_complete, str):
            normalized = raw_complete.strip().lower()
            if normalized in {"true", "1", "yes", "on"}:
                is_complete = True
            elif normalized in {"false", "0", "no", "off"}:
                is_complete = False
            elif normalized in {"auto", "reset", "none", "null"}:
                is_complete = None
            else:
                raise ValueError("is_complete must be boolean or null.")
        else:
            raise ValueError("is_complete must be boolean or null.")

    sessions: list[dict[str, object]] | None = None
    run_type_from_sessions: str | None = None
    if "sessions" in body:
        sessions, planned_total_miles = _parse_plan_sessions_input(body.get("sessions"))
        for item in sessions:
            if not isinstance(item, dict):
                continue
            candidate = str(item.get("run_type") or "").strip()
            if candidate:
                run_type_from_sessions = candidate
                break
    elif "distance" in body:
        sessions, planned_total_miles = _parse_plan_distance_input(body.get("distance"))
    elif "planned_total_miles" in body:
        sessions, planned_total_miles = _parse_plan_distance_input(body.get("planned_total_miles"))
    else:
        planned_total_miles = existing_day.get("planned_total_miles")

    if "run_type" not in body and run_type_from_sessions:
        run_type = run_type_from_sessions

    return run_type, notes, is_complete, planned_total_miles, sessions


def _save_plan_day_record(
    current: Settings,
    *,
    date_key: str,
    body: dict[str, object],
) -> tuple[dict[str, object], int]:
    existing_day = get_plan_day(current.processed_log_file, date_local=date_key) or {}
    try:
        run_type, notes, is_complete, planned_total_miles, sessions = _coerce_plan_day_payload(
            body,
            existing_day=existing_day,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    saved = upsert_plan_day(
        current.processed_log_file,
        date_local=date_key,
        timezone_name=current.timezone,
        run_type=run_type,
        planned_total_miles=planned_total_miles,
        actual_total_miles=existing_day.get("actual_total_miles"),
        is_complete=is_complete,
        notes=notes,
    )
    if not saved:
        return {"status": "error", "error": "Failed to persist plan day."}, 500

    if sessions is not None:
        replaced = replace_plan_sessions_for_day(
            current.processed_log_file,
            date_local=date_key,
            sessions=sessions,
        )
        if not replaced:
            return {"status": "error", "error": "Failed to persist plan sessions."}, 500
    else:
        existing_sessions = list_plan_sessions(
            current.processed_log_file,
            start_date=date_key,
            end_date=date_key,
        ).get(date_key, [])
        sessions = existing_sessions if isinstance(existing_sessions, list) else []

    return _plan_day_success_payload(
        date_key=date_key,
        planned_total_miles=planned_total_miles,
        sessions=sessions or [],
        run_type=run_type,
        notes=notes,
        is_complete=is_complete,
    ), 200


def _plan_day_success_payload(
    *,
    date_key: str,
    planned_total_miles: float | int | str | None,
    sessions: list[dict[str, object]],
    run_type: str | None,
    notes: str | None,
    is_complete: bool | None,
) -> dict[str, object]:
    distance_saved = ""
    if sessions:
        distance_saved = "+".join(
            _format_plan_miles_value(float(item.get("planned_miles") or 0.0))
            for item in sessions
            if isinstance(item, dict) and float(item.get("planned_miles") or 0.0) > 0
        )
    elif isinstance(planned_total_miles, (int, float)) and float(planned_total_miles) > 0:
        distance_saved = _format_plan_miles_value(float(planned_total_miles))

    normalized_sessions = _normalize_plan_session_response(sessions or [])
    return {
        "status": "ok",
        "date_local": date_key,
        "planned_total_miles": float(planned_total_miles or 0.0),
        "distance_saved": distance_saved,
        "session_count": len(normalized_sessions),
        "sessions": normalized_sessions,
        "run_type": run_type or "",
        "notes": notes or "",
        "is_complete": is_complete,
    }


def _dashboard_min_plan_date(today: date) -> date:
    start_date_raw = str(os.getenv("DASHBOARD_START_DATE", "")).strip()
    if start_date_raw:
        try:
            parsed = date.fromisoformat(start_date_raw)
            return parsed
        except ValueError:
            pass

    lookback_raw = str(os.getenv("DASHBOARD_LOOKBACK_YEARS", "")).strip()
    if lookback_raw:
        try:
            lookback_years = max(1, int(lookback_raw))
            target_year = max(1970, today.year - lookback_years + 1)
            return date(target_year, 1, 1)
        except ValueError:
            pass

    return today - timedelta(days=365)


def _parse_activity_local_date(activity: dict[str, object], *, local_tz: ZoneInfo | timezone) -> date | None:
    if not isinstance(activity, dict):
        return None

    start_local = activity.get("start_date_local")
    if isinstance(start_local, str) and start_local.strip():
        try:
            return date.fromisoformat(start_local.strip()[:10])
        except ValueError:
            pass

    start_utc = activity.get("start_date")
    if isinstance(start_utc, str) and start_utc.strip():
        try:
            parsed = datetime.fromisoformat(start_utc.strip().replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(local_tz).date()
        except ValueError:
            return None
    return None


def _actual_miles_from_activities(
    activities: list[dict[str, object]],
    *,
    local_tz: ZoneInfo | timezone,
) -> dict[str, float]:
    payload: dict[str, float] = {}
    for activity in activities:
        if not isinstance(activity, dict):
            continue
        local_day = _parse_activity_local_date(activity, local_tz=local_tz)
        if local_day is None:
            continue
        raw_distance = activity.get("distance")
        try:
            meters = float(raw_distance)
        except (TypeError, ValueError):
            continue
        if meters <= 0:
            continue
        payload[local_day.isoformat()] = payload.get(local_day.isoformat(), 0.0) + (meters / METERS_PER_MILE)
    return payload


@app.get("/health")
def health() -> tuple[dict, int]:
    payload = _latest_payload()
    heartbeat = get_worker_heartbeat(settings.processed_log_file)
    return (
        {
            "status": "ok",
            "time_utc": datetime.now(timezone.utc).isoformat(),
            "latest_payload_exists": payload is not None,
            "worker_last_heartbeat_utc": heartbeat.isoformat() if heartbeat else None,
        },
        200,
    )


@app.get("/ready")
def ready() -> tuple[dict, int]:
    checks = {
        "state_path_writable": _state_path_writable(settings.state_dir),
        "template_accessible": bool(get_active_template(settings).get("template")),
    }
    worker_healthy = is_worker_healthy(
        settings.processed_log_file,
        max_age_seconds=settings.worker_health_max_age_seconds,
    )
    checks["worker_heartbeat_healthy"] = worker_healthy

    ready_ok = (
        checks["state_path_writable"]
        and checks["template_accessible"]
        and checks["worker_heartbeat_healthy"]
    )
    status_code = 200 if ready_ok else 503
    return (
        {
            "status": "ready" if ready_ok else "not_ready",
            "time_utc": datetime.now(timezone.utc).isoformat(),
            "checks": checks,
            "cycle_last_status": get_runtime_value(settings.processed_log_file, "cycle.last_status"),
            "cycle_last_error": get_runtime_value(settings.processed_log_file, "cycle.last_error"),
        },
        status_code,
    )


@app.get("/latest")
def latest() -> tuple[dict, int]:
    payload = _latest_payload()
    if payload is None:
        return {"error": "No activity payload has been written yet."}, 404
    return payload, 200


@app.get("/service-metrics")
def service_metrics() -> tuple[dict, int]:
    cycle_metrics = get_runtime_value(settings.processed_log_file, "cycle.service_calls")
    return {
        "status": "ok",
        "time_utc": datetime.now(timezone.utc).isoformat(),
        "cycle_service_calls": cycle_metrics if isinstance(cycle_metrics, dict) else {},
    }, 200


@app.get("/setup")
def setup_page() -> str:
    return render_template("setup.html")


@app.get("/sources")
def sources_page():
    return _core_flow_entrypoint("sources")


@app.get("/")
def landing_page():
    return redirect("/dashboard", code=302)


@app.get("/dashboard")
def dashboard_page() -> str:
    return render_template("dashboard.html")


@app.get("/view")
def view_page():
    return _core_flow_entrypoint("view")


@app.get("/build")
def build_page():
    return _core_flow_entrypoint("build")


@app.get("/plan")
def plan_page():
    return _core_flow_entrypoint("plan")


@app.get("/control")
def control_page():
    return _core_flow_entrypoint("control")


@app.get("/legacy/<string:flow_name>")
def legacy_core_flow_page(flow_name: str):
    normalized_flow = _normalize_ui_flow(flow_name)
    if normalized_flow is None:
        return {
            "status": "error",
            "error": {
                "code": "LEGACY_FLOW_NOT_FOUND",
                "message": "Unknown legacy core flow.",
                "details": {"flow": flow_name},
            },
        }, 404
    return _render_legacy_core_flow(normalized_flow)


@app.get("/app")
@app.get("/app/")
@app.get("/app/<path:spa_path>")
def spa_app_entry(spa_path: str = ""):
    dist_dir = PROJECT_ROOT / "chronicle-ui" / "dist"
    index_file = dist_dir / "index.html"
    if index_file.exists():
        return send_from_directory(str(dist_dir), "index.html")

    first_segment = str(spa_path or "").strip("/").split("/", 1)[0]
    normalized_flow = _normalize_ui_flow(first_segment)
    if normalized_flow is None:
        return redirect(_legacy_flow_path("view"), code=302)
    return redirect(_legacy_flow_path(normalized_flow), code=302)


@app.get("/ops/ui-rollout/status")
def ui_rollout_status_get() -> tuple[dict, int]:
    current = _effective_settings()
    mode = _current_ui_rollout_mode(current)
    targets = _ui_rollout_targets(mode)
    last_mode_change = get_runtime_value(current.processed_log_file, UI_ROLLOUT_LAST_MODE_CHANGE_KEY)
    last_rollback = get_runtime_value(current.processed_log_file, UI_ROLLOUT_LAST_ROLLBACK_KEY)

    return {
        "status": "ok",
        "mode": mode,
        "default_mode": _ui_rollout_default_mode(),
        "spa_base_path": _ui_rollout_spa_base_path(),
        "rollback_target_minutes": UI_ROLLBACK_TARGET_MINUTES,
        "flows": [
            {
                "flow": flow_name,
                "canonical_path": f"/{flow_name}",
                "target_path": targets[flow_name],
                "legacy_path": _legacy_flow_path(flow_name),
            }
            for flow_name in CORE_UI_FLOW_LEGACY_PATHS
        ],
        "last_mode_change": last_mode_change if isinstance(last_mode_change, dict) else None,
        "last_rollback": last_rollback if isinstance(last_rollback, dict) else None,
    }, 200


@app.post("/ops/ui-rollout/mode")
def ui_rollout_mode_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    requested_mode = _normalize_ui_rollout_mode(body.get("mode"))
    if requested_mode is None:
        return {
            "status": "error",
            "error": {
                "code": "UI_ROLLOUT_MODE_INVALID",
                "message": "mode must be one of: mpa, spa.",
                "details": {
                    "provided": body.get("mode"),
                    "allowed_modes": sorted(UI_ROLLOUT_ALLOWED_MODES),
                },
            },
        }, 400

    source = str(body.get("source") or "ui-rollout-mode-api").strip() or "ui-rollout-mode-api"
    reason = str(body.get("reason") or "").strip() or None
    current = _effective_settings()
    try:
        changed_at_utc = _set_ui_rollout_mode(current, requested_mode, source=source, reason=reason)
    except OSError as exc:
        return {
            "status": "error",
            "error": {
                "code": "UI_ROLLOUT_STATE_WRITE_FAILED",
                "message": "Failed to persist rollout mode.",
                "details": {"reason": str(exc)},
            },
        }, 500
    targets = _ui_rollout_targets(requested_mode)

    return {
        "status": "ok",
        "mode": requested_mode,
        "changed_at_utc": changed_at_utc,
        "source": source,
        "reason": reason,
        "targets": targets,
    }, 200


@app.post("/ops/ui-rollout/rollback")
def ui_rollout_rollback_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    source = str(body.get("source") or "ui-rollout-rollback-api").strip() or "ui-rollout-rollback-api"
    reason = str(body.get("reason") or "regression-detected").strip() or "regression-detected"
    started = time.monotonic()
    current = _effective_settings()
    try:
        rolled_back_at_utc = _set_ui_rollout_mode(current, "mpa", source=source, reason=reason)
    except OSError as exc:
        return {
            "status": "error",
            "error": {
                "code": "UI_ROLLBACK_FAILED",
                "message": "Failed to trigger UI rollback.",
                "details": {"reason": str(exc)},
            },
        }, 500
    elapsed_ms = int((time.monotonic() - started) * 1000)
    rollback_deadline_utc = (datetime.now(timezone.utc) + timedelta(minutes=UI_ROLLBACK_TARGET_MINUTES)).isoformat()
    targets = _ui_rollout_targets("mpa")
    verification_checklist = [
        {
            "flow": flow_name,
            "canonical_path": f"/{flow_name}",
            "expected_target": targets[flow_name],
            "fallback_path": _legacy_flow_path(flow_name),
        }
        for flow_name in CORE_UI_FLOW_LEGACY_PATHS
    ]
    rollback_record = {
        "rolled_back_to_mode": "mpa",
        "source": source,
        "reason": reason,
        "rolled_back_at_utc": rolled_back_at_utc,
        "elapsed_ms": elapsed_ms,
        "rollback_target_minutes": UI_ROLLBACK_TARGET_MINUTES,
    }
    set_runtime_value(current.processed_log_file, UI_ROLLOUT_LAST_ROLLBACK_KEY, rollback_record)

    return {
        "status": "ok",
        "mode": "mpa",
        "rolled_back_at_utc": rolled_back_at_utc,
        "rollback_deadline_utc": rollback_deadline_utc,
        "rollback_target_minutes": UI_ROLLBACK_TARGET_MINUTES,
        "elapsed_ms": elapsed_ms,
        "verification_checklist": verification_checklist,
    }, 200


@app.get("/control/activity-detection")
def control_activity_detection_get() -> tuple[dict, int]:
    current = _effective_settings()
    heartbeat = get_worker_heartbeat(current.processed_log_file)
    heartbeat_healthy = is_worker_healthy(
        current.processed_log_file,
        max_age_seconds=current.worker_health_max_age_seconds,
    )
    runtime_values = get_runtime_values(
        current.processed_log_file,
        [
            "worker.activity_detection.status",
            "worker.activity_detection.new_activity_available",
            "worker.activity_detection.last_activity_id",
            "worker.activity_detection.last_checked_at_utc",
            "worker.activity_detection.last_detected_at_utc",
        ],
    )

    raw_available = runtime_values.get("worker.activity_detection.new_activity_available")
    if isinstance(raw_available, bool):
        new_activity_available = raw_available
    elif isinstance(raw_available, str):
        new_activity_available = raw_available.strip().lower() in {"1", "true", "yes", "on"}
    else:
        new_activity_available = bool(raw_available)

    status = str(runtime_values.get("worker.activity_detection.status") or "").strip() or "unknown"
    last_activity_id_raw = runtime_values.get("worker.activity_detection.last_activity_id")
    last_activity_id = str(last_activity_id_raw).strip() if last_activity_id_raw is not None else ""
    last_checked_raw = runtime_values.get("worker.activity_detection.last_checked_at_utc")
    last_checked_at_utc = str(last_checked_raw).strip() if last_checked_raw is not None else ""
    last_detected_raw = runtime_values.get("worker.activity_detection.last_detected_at_utc")
    last_detected_at_utc = str(last_detected_raw).strip() if last_detected_raw is not None else ""

    return (
        {
            "status": "ok",
            "time_utc": datetime.now(timezone.utc).isoformat(),
            "worker_last_heartbeat_utc": heartbeat.isoformat() if heartbeat else None,
            "worker_heartbeat_healthy": bool(heartbeat_healthy),
            "activity_detection": {
                "status": status,
                "new_activity_available": new_activity_available,
                "last_activity_id": last_activity_id or None,
                "last_checked_at_utc": last_checked_at_utc or None,
                "last_detected_at_utc": last_detected_at_utc or None,
            },
        },
        200,
    )


@app.get("/dashboard/data.json")
def dashboard_data_get() -> tuple[dict, int]:
    force_refresh = str(request.args.get("force") or "").strip().lower() in {"1", "true", "yes", "on"}
    response_mode = str(request.args.get("mode") or "").strip()
    response_year_raw = request.args.get("year")
    response_year = str(response_year_raw).strip() if response_year_raw is not None else None
    if response_year == "":
        response_year = None
    current = _effective_settings()
    try:
        payload = get_dashboard_payload(
            current,
            force_refresh=force_refresh,
            response_mode=response_mode or "full",
            response_year=response_year,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    except Exception as exc:
        return {"status": "error", "error": f"Failed to build dashboard payload: {exc}"}, 500
    return payload, 200


@app.get("/plan/data.json")
def plan_data_get() -> tuple[dict, int]:
    center_date = str(request.args.get("center_date") or "").strip() or None
    window_days = str(request.args.get("window_days") or "").strip() or str(14)
    start_date = str(request.args.get("start_date") or "").strip() or None
    end_date = str(request.args.get("end_date") or "").strip() or None
    include_meta_raw = str(request.args.get("include_meta") or "1").strip().lower()
    include_meta = include_meta_raw not in {"0", "false", "no", "off"}
    current = _effective_settings()
    try:
        payload = get_plan_payload(
            current,
            center_date=center_date,
            window_days=window_days,
            start_date=start_date,
            end_date=end_date,
            include_meta=include_meta,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    except Exception as exc:
        return {"status": "error", "error": f"Failed to build plan payload: {exc}"}, 500
    return payload, 200


@app.get("/plan/today.json")
def plan_today_get() -> tuple[dict, int]:
    current = _effective_settings()
    try:
        local_tz: ZoneInfo | timezone = ZoneInfo(current.timezone)
    except ZoneInfoNotFoundError:
        local_tz = timezone.utc
    today_key = datetime.now(local_tz).date().isoformat()

    day = get_plan_day(current.processed_log_file, date_local=today_key) or {}
    sessions_by_day = list_plan_sessions(
        current.processed_log_file,
        start_date=today_key,
        end_date=today_key,
    )
    sessions = sessions_by_day.get(today_key, []) if isinstance(sessions_by_day, dict) else []

    planned_total = 0.0
    run_type_from_sessions = ""
    workout_shorthand = ""
    for session in sessions:
        if not isinstance(session, dict):
            continue
        try:
            planned_piece = float(session.get("planned_miles") or 0.0)
        except (TypeError, ValueError):
            planned_piece = 0.0
        if planned_piece > 0:
            planned_total += planned_piece
        if not run_type_from_sessions:
            run_candidate = str(session.get("run_type") or "").strip()
            if run_candidate:
                run_type_from_sessions = run_candidate
        if not workout_shorthand:
            run_type_key = str(session.get("run_type") or "").strip().lower()
            workout_candidate = str(session.get("workout_code") or "").strip()
            if run_type_key == "sos" and workout_candidate:
                workout_shorthand = workout_candidate

    if planned_total <= 0:
        try:
            planned_total = float(day.get("planned_total_miles") or 0.0)
        except (TypeError, ValueError):
            planned_total = 0.0

    run_type = str(day.get("run_type") or "").strip() or run_type_from_sessions
    if not workout_shorthand and run_type.strip().lower() == "sos":
        for session in sessions:
            if not isinstance(session, dict):
                continue
            workout_candidate = str(session.get("workout_code") or "").strip()
            if workout_candidate:
                workout_shorthand = workout_candidate
                break

    payload: dict[str, object] = {
        "date_local": today_key,
        "run_type": run_type,
        "miles": float(round(planned_total, 3)),
    }
    if workout_shorthand:
        payload["workout_shorthand"] = workout_shorthand
    return payload, 200


@app.get("/plan/pace-workshop.json")
def plan_pace_workshop_get() -> tuple[dict, int]:
    current = _effective_settings()
    goal = _load_plan_marathon_goal(current.processed_log_file)
    return _plan_pace_workshop_payload(goal), 200


@app.put("/plan/pace-workshop/goal")
def plan_pace_workshop_goal_put() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400
    goal_input = body.get("marathon_goal", body.get("goal_time"))
    try:
        goal_time = normalize_marathon_goal_time(goal_input)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    current = _effective_settings()
    saved = set_plan_setting(current.processed_log_file, PLAN_PACE_WORKSHOP_GOAL_KEY, goal_time)
    if not saved:
        return {"status": "error", "error": "Failed to persist marathon goal."}, 500
    return _plan_pace_workshop_payload(goal_time), 200


@app.post("/plan/pace-workshop/calculate")
def plan_pace_workshop_calculate_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400

    distance_input = body.get("distance", body.get("race_distance"))
    race_time_input = body.get("time", body.get("race_time"))
    try:
        calculation = calculate_race_equivalency(distance_input, race_time_input)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    current = _effective_settings()
    current_goal = _load_plan_marathon_goal(current.processed_log_file)
    return {
        "status": "ok",
        "current_marathon_goal": current_goal,
        **calculation,
    }, 200


@app.get("/plan/workouts")
def plan_workouts_get() -> tuple[dict, int]:
    current = _effective_settings()
    workouts = list_workout_definitions(current.processed_log_file)
    return {"status": "ok", "workouts": workouts}, 200


@app.put("/plan/workouts/<string:workout_code>")
def plan_workouts_put(workout_code: str) -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400

    path_code = str(workout_code or "").strip()
    if not path_code:
        return {"status": "error", "error": "workout_code is required."}, 400
    body_code = str(body.get("workout_code") or path_code).strip()
    if body_code and body_code.lower() != path_code.lower():
        return {"status": "error", "error": "workout_code in body must match path."}, 400

    current = _effective_settings()
    payload = dict(body)
    payload["workout_code"] = path_code
    try:
        workout = upsert_workout_definition(current.processed_log_file, payload)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    except RuntimeError as exc:
        return {"status": "error", "error": str(exc)}, 500

    workouts = list_workout_definitions(current.processed_log_file)
    return {"status": "ok", "workout": workout, "workouts": workouts}, 200


@app.put("/plan/day/<string:date_local>")
def plan_day_put(date_local: str) -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400

    current = _effective_settings()
    try:
        date_key = _resolve_plan_date(date_local)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return _save_plan_day_record(current, date_key=date_key, body=body)


@app.post("/plan/day/<string:date_local>/garmin-sync")
def plan_day_garmin_sync_post(date_local: str) -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400

    current = _effective_settings()
    try:
        date_key = _resolve_plan_date(date_local)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    day_sessions_map = list_plan_sessions(
        current.processed_log_file,
        start_date=date_key,
        end_date=date_key,
    )
    raw_sessions = day_sessions_map.get(date_key, []) if isinstance(day_sessions_map, dict) else []

    attached_workouts: list[str] = []
    for session in raw_sessions:
        if not isinstance(session, dict):
            continue
        workout_code = str(session.get("planned_workout") or session.get("workout_code") or "").strip()
        if not workout_code:
            continue
        attached_workouts.append(workout_code)

    if not attached_workouts:
        return {
            "status": "error",
            "error": "No workout is attached to this plan day. Attach a workout before sending to Garmin.",
        }, 400

    requested_workout = str(body.get("workout_code") or "").strip()
    selected_workout = attached_workouts[0]
    if requested_workout:
        selected_match = next(
            (
                candidate
                for candidate in attached_workouts
                if candidate.lower() == requested_workout.lower()
            ),
            None,
        )
        if selected_match is None:
            return {
                "status": "error",
                "error": "workout_code is not attached to the requested plan day.",
            }, 400
        selected_workout = selected_match

    try:
        sync_record = initiate_garmin_sync_request(
            current.processed_log_file,
            date_local=date_key,
            workout_code=selected_workout,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    except RuntimeError as exc:
        return {"status": "error", "error": str(exc)}, 500

    return {
        "status": "ok",
        "date_local": date_key,
        "sync": sync_record,
    }, 200


@app.post("/plan/day/<string:date_local>/garmin-sync/run")
def plan_day_garmin_sync_run_post(date_local: str) -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400

    current = _effective_settings()
    try:
        date_key = _resolve_plan_date(date_local)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    requested_workout = str(body.get("workout_code") or "").strip() or None
    try:
        sync_record, garmin_workout = run_garmin_sync_request(
            current.processed_log_file,
            date_local=date_key,
            workout_code=requested_workout,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    except RuntimeError as exc:
        return {"status": "error", "error": str(exc)}, 500

    return {
        "status": "ok",
        "date_local": date_key,
        "sync": sync_record,
        "garmin_workout": garmin_workout,
    }, 200


@app.post("/plan/day/<string:date_local>/garmin-sync/schedule")
def plan_day_garmin_sync_schedule_post(date_local: str) -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400

    current = _effective_settings()
    try:
        date_key = _resolve_plan_date(date_local)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    requested_workout = str(body.get("workout_code") or "").strip() or None
    try:
        sync_record, garmin_workout, calendar_entry = schedule_garmin_sync_request(
            current.processed_log_file,
            date_local=date_key,
            workout_code=requested_workout,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    except RuntimeError as exc:
        return {"status": "error", "error": str(exc)}, 500

    return {
        "status": "ok",
        "date_local": date_key,
        "sync": sync_record,
        "garmin_workout": garmin_workout,
        "calendar_entry": calendar_entry,
    }, 200


@app.post("/plan/day/<string:date_local>/garmin-sync/result")
def plan_day_garmin_sync_result_post(date_local: str) -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400

    current = _effective_settings()
    try:
        date_key = _resolve_plan_date(date_local)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    requested_workout = str(body.get("workout_code") or "").strip() or None
    attempt_count = 0
    max_attempts = 2
    run_phase_completed = False
    last_error: ValueError | RuntimeError | None = None

    for attempt in range(1, max_attempts + 1):
        attempt_count = attempt
        try:
            run_garmin_sync_request(
                current.processed_log_file,
                date_local=date_key,
                workout_code=requested_workout,
            )
            run_phase_completed = True
            sync_record, garmin_workout, calendar_entry = schedule_garmin_sync_request(
                current.processed_log_file,
                date_local=date_key,
                workout_code=requested_workout,
            )
            timestamp_utc = str(sync_record.get("updated_at_utc") or "").strip() or datetime.now(timezone.utc).replace(
                microsecond=0
            ).isoformat()
            status_code = str(sync_record.get("status_code") or "").strip() or "calendar_scheduled"
            return {
                "status": "ok",
                "date_local": date_key,
                "sync": sync_record,
                "garmin_workout": garmin_workout,
                "calendar_entry": calendar_entry,
                "result": {
                    "outcome": "scheduled",
                    "status_code": status_code,
                    "timestamp_utc": timestamp_utc,
                    "message": "Workout scheduled on Garmin calendar.",
                    "attempt_count": attempt_count,
                },
            }, 200
        except (ValueError, RuntimeError) as exc:
            last_error = exc
            if "Send to Garmin first" in str(exc):
                return {"status": "error", "error": str(exc)}, 400
            if attempt < max_attempts:
                time.sleep(0.2 * attempt)

    if last_error is None:
        return {"status": "error", "error": "Garmin sync result could not be resolved."}, 500

    failure_code = "schedule_failed" if run_phase_completed else "run_failed"
    retry_guidance = (
        "Retry Garmin sync from Plan. If this keeps failing, verify Garmin connection settings and that the workout is attached to the day."
    )
    try:
        failed_sync = mark_garmin_sync_request_failed(
            current.processed_log_file,
            date_local=date_key,
            workout_code=requested_workout,
            status_code=failure_code,
            error_message=str(last_error),
            retry_guidance=retry_guidance,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    except RuntimeError as exc:
        return {"status": "error", "error": str(exc)}, 500

    timestamp_utc = str(failed_sync.get("updated_at_utc") or "").strip() or datetime.now(timezone.utc).replace(
        microsecond=0
    ).isoformat()
    return {
        "status": "error",
        "date_local": date_key,
        "sync": failed_sync,
        "result": {
            "outcome": "failed",
            "status_code": str(failed_sync.get("status_code") or failure_code),
            "timestamp_utc": timestamp_utc,
            "message": str(last_error),
            "retry_guidance": retry_guidance,
            "attempt_count": attempt_count,
        },
    }, 200


@app.post("/plan/days/bulk")
def plan_days_bulk_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400
    raw_days = body.get("days")
    if not isinstance(raw_days, list) or not raw_days:
        return {"status": "error", "error": "days must be a non-empty array."}, 400

    current = _effective_settings()
    pending_days: list[dict[str, object]] = []
    result_seed: list[dict[str, object]] = []
    for item in raw_days:
        if not isinstance(item, dict):
            return {"status": "error", "error": "each days entry must be an object."}, 400
        try:
            date_key = _resolve_plan_date(str(item.get("date_local") or ""))
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400
        day_payload = {key: value for key, value in item.items() if key != "date_local"}
        existing_day = get_plan_day(current.processed_log_file, date_local=date_key) or {}
        try:
            run_type, notes, is_complete, planned_total_miles, sessions = _coerce_plan_day_payload(
                day_payload,
                existing_day=existing_day,
            )
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400

        pending_days.append(
            {
                "date_local": date_key,
                "timezone_name": current.timezone,
                "run_type": run_type,
                "planned_total_miles": planned_total_miles,
                "actual_total_miles": existing_day.get("actual_total_miles"),
                "is_complete": is_complete,
                "notes": notes,
                **({"sessions": sessions} if sessions is not None else {}),
            }
        )

        if sessions is None:
            existing_sessions = list_plan_sessions(
                current.processed_log_file,
                start_date=date_key,
                end_date=date_key,
            ).get(date_key, [])
            response_sessions = existing_sessions if isinstance(existing_sessions, list) else []
        else:
            response_sessions = sessions
        result_seed.append(
            _plan_day_success_payload(
                date_key=date_key,
                planned_total_miles=planned_total_miles,
                sessions=response_sessions,
                run_type=run_type,
                notes=notes,
                is_complete=is_complete,
            )
        )

    saved = upsert_plan_days_bulk(current.processed_log_file, days=pending_days)
    if not saved:
        return {"status": "error", "error": "Failed to persist plan days."}, 500

    return {
        "status": "ok",
        "saved_count": len(result_seed),
        "days": result_seed,
    }, 200


@app.get("/plan/day/<string:date_local>/metrics")
def plan_day_metrics_get(date_local: str) -> tuple[dict, int]:
    current = _effective_settings()
    try:
        date_key = _resolve_plan_date(date_local)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    try:
        payload = get_plan_payload(
            current,
            center_date=date_key,
            start_date=date_key,
            end_date=date_key,
            include_meta=False,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    except Exception as exc:
        return {"status": "error", "error": f"Failed to build day metrics payload: {exc}"}, 500

    rows = payload.get("rows") if isinstance(payload, dict) else []
    row = rows[0] if isinstance(rows, list) and rows else None
    return {
        "status": "ok",
        "date_local": date_key,
        "summary": payload.get("summary") if isinstance(payload, dict) else {},
        "row": row if isinstance(row, dict) else {},
    }, 200


@app.post("/plan/seed/from-actuals")
def plan_seed_from_actuals_post() -> tuple[dict, int]:
    current = _effective_settings()
    try:
        local_tz: ZoneInfo | timezone = ZoneInfo(current.timezone)
    except ZoneInfoNotFoundError:
        local_tz = timezone.utc
    today = datetime.now(local_tz).date()
    seed_start = _dashboard_min_plan_date(today)
    if seed_start > today:
        seed_start = today

    try:
        dashboard_payload = get_dashboard_payload(
            current,
            force_refresh=False,
            response_mode="full",
        )
    except Exception as exc:
        return {"status": "error", "error": f"Failed to load dashboard activities: {exc}"}, 500

    activities_raw = dashboard_payload.get("activities") if isinstance(dashboard_payload, dict) else []
    activities = [item for item in activities_raw if isinstance(item, dict)] if isinstance(activities_raw, list) else []
    actual_by_day = _actual_miles_from_activities(activities, local_tz=local_tz)

    scanned_days = 0
    seeded_days = 0
    days_with_actual = 0
    seeded_total_miles = 0.0
    cursor = seed_start
    while cursor <= today:
        scanned_days += 1
        day_key = cursor.isoformat()
        planned = float(actual_by_day.get(day_key, 0.0))
        if planned > 0:
            days_with_actual += 1

        existing = get_plan_day(current.processed_log_file, date_local=day_key) or {}
        run_type = str(existing.get("run_type") or "").strip() or None
        notes = str(existing.get("notes") or "").strip() or None
        saved = upsert_plan_day(
            current.processed_log_file,
            date_local=day_key,
            timezone_name=current.timezone,
            run_type=run_type,
            planned_total_miles=planned,
            actual_total_miles=existing.get("actual_total_miles"),
            is_complete=None,
            notes=notes,
        )
        if not saved:
            cursor += timedelta(days=1)
            continue

        sessions_payload: list[dict[str, object]] = []
        if planned > 0:
            sessions_payload.append({"ordinal": 1, "planned_miles": planned, "run_type": run_type or ""})
        replace_plan_sessions_for_day(
            current.processed_log_file,
            date_local=day_key,
            sessions=sessions_payload,
        )
        seeded_days += 1
        seeded_total_miles += planned
        cursor += timedelta(days=1)

    return {
        "status": "ok",
        "seed_start_date": seed_start.isoformat(),
        "seed_end_date": today.isoformat(),
        "scanned_days": scanned_days,
        "seeded_days": seeded_days,
        "days_with_actual": days_with_actual,
        "seeded_total_miles": round(seeded_total_miles, 3),
    }, 200


@app.get("/setup/api/config")
def setup_config_get() -> tuple[dict, int]:
    return _setup_payload(), 200


@app.put("/setup/api/config")
def setup_config_put() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    values = body.get("values", body)
    if not isinstance(values, dict):
        return {"status": "error", "error": "values must be a JSON object."}, 400

    updates: dict[str, object] = {}
    for key, value in values.items():
        if key not in SETUP_ALLOWED_KEYS:
            continue
        if key in SETUP_SECRET_KEYS and isinstance(value, str) and not value.strip():
            # Empty secret input means "keep existing secret".
            continue
        updates[key] = value

    try:
        env_path = update_setup_env_file(updates)
    except OSError as exc:
        return {
            "status": "error",
            "error": f"Failed to write env file at {setup_env_file_path()}: {exc}",
        }, 500

    merge_setup_overrides(settings.state_dir, updates)
    payload = _setup_payload()
    payload["env_write_path"] = str(env_path)
    return payload, 200


@app.get("/setup/api/env")
def setup_env_get() -> tuple[dict, int]:
    values = _setup_effective_values()
    filtered: dict[str, object] = {}
    for key in sorted(SETUP_ALLOWED_KEYS):
        value = values.get(key)
        if isinstance(value, bool):
            filtered[key] = value
        elif isinstance(value, str):
            text = value.strip()
            if text:
                filtered[key] = text
    return {
        "status": "ok",
        "env": render_env_snippet(filtered),
    }, 200


@app.get("/setup/api/strava/status")
def setup_strava_status_get() -> tuple[dict, int]:
    values = _setup_effective_values()
    return {
        "status": "ok",
        "strava": _setup_strava_status(values),
    }, 200


@app.post("/setup/api/strava/oauth/start")
def setup_strava_oauth_start_post() -> tuple[dict, int]:
    values = _setup_effective_values()
    client_id = str(values.get("STRAVA_CLIENT_ID") or "").strip()
    client_secret = str(values.get("STRAVA_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        return {
            "status": "error",
            "error": "Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET before starting OAuth.",
        }, 400

    body = request.get_json(silent=True) or {}
    redirect_uri = body.get("redirect_uri")
    if not isinstance(redirect_uri, str) or not redirect_uri.strip():
        redirect_uri = _default_setup_callback_url()
    redirect_uri = redirect_uri.strip()

    state_token = secrets.token_urlsafe(24)
    set_runtime_value(
        settings.processed_log_file,
        STRAVA_OAUTH_RUNTIME_KEY,
        {
            "state": state_token,
            "redirect_uri": redirect_uri,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
        },
    )

    authorize_url = (
        f"{STRAVA_AUTHORIZE_URL}?"
        f"{urlencode({'client_id': client_id, 'response_type': 'code', 'redirect_uri': redirect_uri, 'approval_prompt': 'force', 'scope': STRAVA_OAUTH_SCOPE, 'state': state_token})}"
    )
    return {
        "status": "ok",
        "authorize_url": authorize_url,
        "state": state_token,
        "redirect_uri": redirect_uri,
    }, 200


@app.get("/setup/strava/callback")
def setup_strava_oauth_callback_get():
    error = str(request.args.get("error") or "").strip()
    if error:
        return _redirect_setup_with_status("error", error)

    code = str(request.args.get("code") or "").strip()
    state_token = str(request.args.get("state") or "").strip()
    runtime_state = get_runtime_value(settings.processed_log_file, STRAVA_OAUTH_RUNTIME_KEY, {})
    saved_state = str(runtime_state.get("state") or "").strip() if isinstance(runtime_state, dict) else ""
    redirect_uri = (
        str(runtime_state.get("redirect_uri") or "").strip()
        if isinstance(runtime_state, dict)
        else ""
    )
    if not redirect_uri:
        redirect_uri = _default_setup_callback_url()

    if not code:
        return _redirect_setup_with_status("error", "missing_code")
    if not state_token or state_token != saved_state:
        return _redirect_setup_with_status("error", "state_mismatch")

    values = _setup_effective_values()
    client_id = str(values.get("STRAVA_CLIENT_ID") or "").strip()
    client_secret = str(values.get("STRAVA_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        return _redirect_setup_with_status("error", "missing_client_credentials")

    try:
        response = requests.post(
            STRAVA_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
            },
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException:
        return _redirect_setup_with_status("error", "token_exchange_failed")

    refresh_token = payload.get("refresh_token")
    access_token = payload.get("access_token")
    if not isinstance(refresh_token, str) or not refresh_token.strip():
        return _redirect_setup_with_status("error", "missing_refresh_token")
    if not isinstance(access_token, str) or not access_token.strip():
        return _redirect_setup_with_status("error", "missing_access_token")

    try:
        update_setup_env_file(
            {
                "STRAVA_REFRESH_TOKEN": refresh_token.strip(),
                "STRAVA_ACCESS_TOKEN": access_token.strip(),
            }
        )
    except OSError:
        return _redirect_setup_with_status("error", "env_write_failed")

    merge_setup_overrides(
        settings.state_dir,
        {
            "STRAVA_REFRESH_TOKEN": refresh_token.strip(),
            "STRAVA_ACCESS_TOKEN": access_token.strip(),
        },
    )

    current = _effective_settings()
    write_json(
        current.strava_token_file,
        {
            "access_token": access_token.strip(),
            "refresh_token": refresh_token.strip(),
        },
    )
    delete_runtime_value(settings.processed_log_file, STRAVA_OAUTH_RUNTIME_KEY)
    return _redirect_setup_with_status("connected")


@app.post("/setup/api/strava/disconnect")
def setup_strava_disconnect_post() -> tuple[dict, int]:
    try:
        update_setup_env_file(
            {
                "STRAVA_REFRESH_TOKEN": None,
                "STRAVA_ACCESS_TOKEN": None,
            }
        )
    except OSError as exc:
        return {
            "status": "error",
            "error": f"Failed to update env file at {setup_env_file_path()}: {exc}",
        }, 500

    merge_setup_overrides(
        settings.state_dir,
        {
            "STRAVA_REFRESH_TOKEN": None,
            "STRAVA_ACCESS_TOKEN": None,
        },
    )
    current = _effective_settings()
    current.strava_token_file.unlink(missing_ok=True)

    return {
        "status": "ok",
        "strava": _setup_strava_status(_setup_effective_values()),
        "env_write_path": str(setup_env_file_path()),
    }, 200


@app.get("/editor")
def editor_page() -> str:
    return render_template("editor.html")


@app.get("/editor/profiles")
def editor_profiles_get() -> tuple[dict, int]:
    working = get_working_template_profile(settings)
    return {
        "status": "ok",
        "working_profile_id": working.get("profile_id"),
        "profiles": list_template_profiles(settings),
    }, 200


@app.post("/editor/profiles")
def editor_profiles_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    profile_id = body.get("profile_id")
    if not isinstance(profile_id, str) or not profile_id.strip():
        return {"status": "error", "error": "profile_id is required."}, 400

    label = body.get("label")
    parsed_label: str | None = None
    if label is not None:
        try:
            parsed_label = _parse_profile_label(label)
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400

    criteria = body.get("criteria")
    parsed_criteria: dict | None = None
    if criteria is not None:
        try:
            parsed_criteria = _parse_profile_criteria(criteria)
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400

    try:
        created = create_template_profile(
            settings,
            profile_id,
            label=parsed_label,
            criteria=parsed_criteria,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    return {
        "status": "ok",
        "profile": created,
        "working_profile_id": get_working_template_profile(settings).get("profile_id"),
        "profiles": list_template_profiles(settings),
    }, 200


@app.put("/editor/profiles/<string:profile_id>")
def editor_profile_put(profile_id: str) -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    enabled = body.get("enabled")
    parsed_enabled: bool | None = None
    if enabled is not None:
        try:
            parsed_enabled = _parse_enabled_value(enabled)
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400
    priority = body.get("priority")
    parsed_priority: int | None = None
    if priority is not None:
        try:
            parsed_priority = int(priority)
        except (TypeError, ValueError):
            return {"status": "error", "error": "priority must be an integer."}, 400
    label = body.get("label")
    parsed_label: str | None = None
    if label is not None:
        try:
            parsed_label = _parse_profile_label(label)
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400
    criteria = body.get("criteria")
    parsed_criteria: dict | None = None
    if criteria is not None:
        try:
            parsed_criteria = _parse_profile_criteria(criteria)
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400
    if parsed_enabled is None and parsed_priority is None and parsed_label is None and parsed_criteria is None:
        return {"status": "error", "error": "Provide enabled, priority, label, and/or criteria."}, 400
    try:
        updated = update_template_profile(
            settings,
            profile_id,
            enabled=parsed_enabled,
            priority=parsed_priority,
            label=parsed_label,
            criteria=parsed_criteria,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return {
        "status": "ok",
        "profile": updated,
        "working_profile_id": get_working_template_profile(settings).get("profile_id"),
    }, 200


@app.post("/editor/profiles/working")
def editor_working_profile_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    profile_id = body.get("profile_id")
    if not isinstance(profile_id, str) or not profile_id.strip():
        return {"status": "error", "error": "profile_id is required."}, 400
    try:
        profile = set_working_template_profile(settings, profile_id)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return {
        "status": "ok",
        "working_profile_id": profile.get("profile_id"),
        "profile": profile,
    }, 200


@app.post("/editor/profiles/preview")
def editor_profile_preview_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    try:
        context_mode = _resolve_context_mode(body.get("context_mode"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    context, context_source = _context_for_mode(
        context_mode,
        fixture_name=body.get("fixture_name"),
    )
    if context is None:
        return {
            "status": "error",
            "error": "No template context is available yet. Run one update cycle first.",
        }, 404

    try:
        match = preview_profile_match(settings, context)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    return {
        "status": "ok",
        "context_source": context_source,
        "profile_match": match,
    }, 200


@app.get("/editor/profiles/export")
def editor_profiles_export_get() -> tuple[dict, int]:
    selected_profile_ids = _resolve_profile_id_filters()
    try:
        payload = export_template_profiles_bundle(
            settings,
            profile_ids=selected_profile_ids,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return {"status": "ok", **payload}, 200


@app.post("/editor/profiles/import")
def editor_profiles_import_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400

    bundle = body.get("bundle")
    if bundle is None:
        bundle = body
    if not isinstance(bundle, dict):
        return {"status": "error", "error": "bundle must be a JSON object."}, 400

    try:
        result = import_template_profiles_bundle(settings, bundle=bundle)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    return {
        "status": "ok",
        "imported_count": len(result["imported_profile_ids"]),
        "imported_profile_ids": result["imported_profile_ids"],
        "errors": result["errors"],
        "working_profile_id": result["working_profile_id"],
        "profiles": list_template_profiles(settings),
    }, 200


@app.get("/editor/template")
def editor_template_get() -> tuple[dict, int]:
    try:
        profile_id = _resolve_profile_id(request.args.get("profile_id"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    active = get_active_template(settings, profile_id=profile_id)
    return {
        "status": "ok",
        "template": active["template"],
        "is_custom": active["is_custom"],
        "template_path": active["path"],
        "profile_id": active.get("profile_id"),
        "profile_label": active.get("profile_label"),
        "name": active.get("name"),
        "current_version": active.get("current_version"),
        "updated_at_utc": active.get("updated_at_utc"),
        "updated_by": active.get("updated_by"),
        "source": active.get("source"),
        "metadata": active.get("metadata"),
    }, 200


@app.get("/editor/template/default")
def editor_template_default_get() -> tuple[dict, int]:
    return {
        "status": "ok",
        "template": get_default_template(),
    }, 200


@app.get("/editor/fixtures")
def editor_fixtures_get() -> tuple[dict, int]:
    return {
        "status": "ok",
        "fixtures": list_sample_template_fixtures(),
    }, 200


@app.get("/editor/template/versions")
def editor_template_versions_get() -> tuple[dict, int]:
    limit_raw = request.args.get("limit", "30")
    try:
        limit = max(1, min(200, int(limit_raw)))
    except ValueError:
        limit = 30
    try:
        profile_id = _resolve_profile_id(request.args.get("profile_id"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    versions = list_template_versions(settings, limit=limit, profile_id=profile_id)
    return {
        "status": "ok",
        "profile_id": profile_id,
        "versions": versions,
    }, 200


@app.get("/editor/template/export")
def editor_template_export_get() -> tuple[dict, int]:
    template_id = str(request.args.get("template_id") or "").strip()
    try:
        profile_id = _resolve_profile_id(request.args.get("profile_id"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    include_versions_raw = str(request.args.get("include_versions", "false")).strip().lower()
    include_versions = include_versions_raw in {"1", "true", "yes", "on"}
    limit_raw = request.args.get("limit", "30")
    try:
        limit = max(1, min(200, int(limit_raw)))
    except ValueError:
        limit = 30

    if template_id:
        try:
            payload = export_template_repository_bundle(
                settings,
                template_id=template_id,
                include_versions=include_versions,
                versions_limit=limit,
            )
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 404
        payload["status"] = "ok"
        return payload, 200

    active = get_active_template(settings, profile_id=profile_id)
    payload = {
        "status": "ok",
        "bundle_version": 1,
        "exported_at_utc": datetime.now(timezone.utc).isoformat(),
        "profile_id": profile_id,
        "template": active.get("template"),
        "name": active.get("name"),
        "is_custom": bool(active.get("is_custom")),
        "metadata": active.get("metadata"),
        "current_version": active.get("current_version"),
    }
    if include_versions:
        payload["versions"] = list_template_versions(settings, limit=limit, profile_id=profile_id)
    return payload, 200


@app.get("/editor/repository/templates")
def editor_repository_templates_get() -> tuple[dict, int]:
    templates = list_template_repository_templates(settings)
    return {
        "status": "ok",
        "templates": templates,
        "count": len(templates),
    }, 200


@app.get("/editor/repository/template/<string:template_id>")
def editor_repository_template_get(template_id: str) -> tuple[dict, int]:
    template = get_template_repository_template(settings, template_id)
    if not template:
        return {"status": "error", "error": "Unknown template_id."}, 404
    return {
        "status": "ok",
        "template_record": template,
    }, 200


@app.post("/editor/repository/template/<string:template_id>/load")
def editor_repository_template_load_post(template_id: str) -> tuple[dict, int]:
    template = get_template_repository_template(settings, template_id)
    if not template:
        return {"status": "error", "error": "Unknown template_id."}, 404
    return {
        "status": "ok",
        "template_record": template,
    }, 200


@app.post("/editor/repository/save_as")
def editor_repository_save_as_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    template_text = body.get("template")
    if not isinstance(template_text, str) or not template_text.strip():
        return {"status": "error", "error": "template must be a non-empty string."}, 400

    context_mode = body.get("context_mode", "sample")
    fixture_name = body.get("fixture_name")
    try:
        mode = _resolve_context_mode(context_mode)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    context, context_source = _context_for_mode(mode, fixture_name=fixture_name)
    validation = validate_template_text(template_text, context)
    if not validation["valid"]:
        return {
            "status": "error",
            "context_source": context_source if context is not None else None,
            "validation": validation,
        }, 400

    try:
        created = create_template_repository_template(
            settings,
            template_text=template_text,
            name=str(body.get("name") or "Untitled Template"),
            author=str(body.get("author") or "editor-user"),
            description=str(body.get("description") or ""),
            source=str(body.get("source") or "editor-repository-save-as"),
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return {
        "status": "ok",
        "context_source": context_source if context is not None else None,
        "template_record": created,
        "validation": validation,
    }, 200


@app.put("/editor/repository/template/<string:template_id>")
def editor_repository_template_put(template_id: str) -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    template_text = body.get("template")
    if template_text is not None and (not isinstance(template_text, str) or not template_text.strip()):
        return {"status": "error", "error": "template must be a non-empty string when provided."}, 400

    context_mode = body.get("context_mode", "sample")
    fixture_name = body.get("fixture_name")
    try:
        mode = _resolve_context_mode(context_mode)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    context, context_source = _context_for_mode(mode, fixture_name=fixture_name)
    if isinstance(template_text, str) and template_text.strip():
        validation = validate_template_text(template_text, context)
        if not validation["valid"]:
            return {
                "status": "error",
                "context_source": context_source if context is not None else None,
                "validation": validation,
            }, 400
    else:
        validation = {"valid": True, "warnings": [], "errors": [], "undeclared_variables": []}

    try:
        updated = update_template_repository_template(
            settings,
            template_id=template_id,
            template_text=template_text,
            name=str(body.get("name")) if body.get("name") is not None else None,
            author=str(body.get("author")) if body.get("author") is not None else None,
            description=str(body.get("description")) if body.get("description") is not None else None,
            source=str(body.get("source") or "editor-repository-save"),
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return {
        "status": "ok",
        "context_source": context_source if context is not None else None,
        "template_record": updated,
        "validation": validation,
    }, 200


@app.post("/editor/repository/template/<string:template_id>/duplicate")
def editor_repository_template_duplicate_post(template_id: str) -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    try:
        duplicated = duplicate_template_repository_template(
            settings,
            template_id=template_id,
            name=str(body.get("name")) if body.get("name") is not None else None,
            author=str(body.get("author")) if body.get("author") is not None else None,
            source=str(body.get("source") or "editor-repository-duplicate"),
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return {"status": "ok", "template_record": duplicated}, 200


@app.get("/editor/repository/template/<string:template_id>/export")
def editor_repository_template_export_get(template_id: str) -> tuple[dict, int]:
    include_versions_raw = str(request.args.get("include_versions", "false")).strip().lower()
    include_versions = include_versions_raw in {"1", "true", "yes", "on"}
    limit_raw = request.args.get("limit", "30")
    try:
        limit = max(1, min(200, int(limit_raw)))
    except ValueError:
        limit = 30

    try:
        payload = export_template_repository_bundle(
            settings,
            template_id=template_id,
            include_versions=include_versions,
            versions_limit=limit,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 404
    payload["status"] = "ok"
    return payload, 200


@app.post("/editor/repository/import")
def editor_repository_import_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    bundle = body.get("bundle")
    if not isinstance(bundle, dict):
        return {"status": "error", "error": "bundle must be a JSON object."}, 400

    template_text = bundle.get("template")
    if not isinstance(template_text, str) or not template_text.strip():
        return {"status": "error", "error": "bundle.template must be a non-empty string."}, 400

    context_mode = body.get("context_mode", "sample")
    fixture_name = body.get("fixture_name")
    try:
        mode = _resolve_context_mode(context_mode)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    context, context_source = _context_for_mode(mode, fixture_name=fixture_name)
    validation = validate_template_text(template_text, context)
    if not validation["valid"]:
        return {
            "status": "error",
            "context_source": context_source if context is not None else None,
            "validation": validation,
        }, 400

    try:
        imported = import_template_repository_bundle(
            settings,
            bundle=bundle,
            author=str(body.get("author")) if body.get("author") is not None else None,
            source=str(body.get("source") or "editor-repository-import"),
            name=str(body.get("name")) if body.get("name") is not None else None,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return {
        "status": "ok",
        "context_source": context_source if context is not None else None,
        "template_record": imported,
        "validation": validation,
    }, 200


@app.get("/editor/template/version/<string:version_id>")
def editor_template_version_get(version_id: str) -> tuple[dict, int]:
    try:
        profile_id = _resolve_profile_id(request.args.get("profile_id"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    record = get_template_version(settings, version_id, profile_id=profile_id)
    if not record:
        return {"status": "error", "error": "Unknown template version."}, 404
    return {"status": "ok", "profile_id": profile_id, "version": record}, 200


@app.post("/editor/template/import")
def editor_template_import_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    bundle = body.get("bundle")
    source_payload = bundle if isinstance(bundle, dict) else body

    template_text = source_payload.get("template")
    if not isinstance(template_text, str) or not template_text.strip():
        return {"status": "error", "error": "template must be a non-empty string."}, 400

    try:
        context_mode = _resolve_context_mode(body.get("context_mode"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    context, context_source = _context_for_mode(
        context_mode,
        fixture_name=body.get("fixture_name"),
    )
    validation = validate_template_text(template_text, context)
    if not validation["valid"]:
        return {
            "status": "error",
            "context_source": context_source if context is not None else None,
            "validation": validation,
        }, 400

    author = str(body.get("author") or "editor-user")
    source = str(body.get("source") or "editor-import")
    try:
        profile_id = _resolve_profile_id(body.get("profile_id"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    name = body.get("name")
    if name is None:
        name = source_payload.get("name")
    notes = body.get("notes")
    if notes is None:
        exported_at = source_payload.get("exported_at_utc")
        if isinstance(exported_at, str) and exported_at.strip():
            notes = f"Imported from bundle exported at {exported_at.strip()}"
    saved = save_active_template(
        settings,
        template_text,
        name=str(name) if name is not None else None,
        author=author,
        source=source,
        notes=str(notes) if notes is not None else None,
        profile_id=profile_id,
    )
    return {
        "status": "ok",
        "profile_id": profile_id,
        "context_source": context_source if context is not None else None,
        "template_path": str(saved.get("path")),
        "saved_version": saved.get("saved_version"),
        "active": saved,
        "validation": validation,
    }, 200


@app.post("/editor/template/rollback")
def editor_template_rollback_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    version_id = body.get("version_id")
    if not isinstance(version_id, str) or not version_id.strip():
        return {"status": "error", "error": "version_id is required."}, 400
    author = str(body.get("author") or "editor-user")
    source = str(body.get("source") or "editor-rollback")
    notes = body.get("notes")
    try:
        profile_id = _resolve_profile_id(body.get("profile_id"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    try:
        saved = rollback_template_version(
            settings,
            version_id=version_id.strip(),
            author=author,
            source=source,
            notes=str(notes) if notes is not None else None,
            profile_id=profile_id,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return {
        "status": "ok",
        "profile_id": profile_id,
        "template_path": saved.get("path"),
        "saved_version": saved.get("saved_version"),
        "active": saved,
    }, 200


@app.get("/editor/snippets")
def editor_snippets_get() -> tuple[dict, int]:
    return {
        "status": "ok",
        "snippets": get_editor_snippets(),
        "context_modes": ["latest", "sample", "latest_or_sample", "fixture"],
    }, 200


@app.get("/editor/starter-templates")
def editor_starter_templates_get() -> tuple[dict, int]:
    templates = get_starter_templates()
    return {
        "status": "ok",
        "starter_templates": templates,
        "count": len(templates),
    }, 200


@app.get("/editor/context/sample")
def editor_sample_context_get() -> tuple[dict, int]:
    context = get_sample_template_context(request.args.get("fixture"))
    return {
        "status": "ok",
        "context": context,
        "schema": build_context_schema(context),
    }, 200


@app.put("/editor/template")
def editor_template_put() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    template_text = body.get("template")
    if not isinstance(template_text, str) or not template_text.strip():
        return {"status": "error", "error": "template must be a non-empty string."}, 400

    try:
        context_mode = _resolve_context_mode(body.get("context_mode", "latest_or_sample"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    context, context_source = _context_for_mode(
        context_mode,
        fixture_name=body.get("fixture_name"),
    )
    validation = validate_template_text(template_text, context)
    if not validation["valid"]:
        return {
            "status": "error",
            "context_source": context_source if context is not None else None,
            "validation": validation,
        }, 400

    author = str(body.get("author") or "editor-user")
    source = str(body.get("source") or "editor-ui")
    try:
        profile_id = _resolve_profile_id(body.get("profile_id"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    name = body.get("name")
    notes = body.get("notes")
    saved = save_active_template(
        settings,
        template_text,
        name=str(name) if name is not None else None,
        author=author,
        source=source,
        notes=str(notes) if notes is not None else None,
        profile_id=profile_id,
    )
    return {
        "status": "ok",
        "profile_id": profile_id,
        "context_source": context_source if context is not None else None,
        "template_path": str(saved.get("path")),
        "saved_version": saved.get("saved_version"),
        "active": saved,
        "validation": validation,
    }, 200


@app.post("/editor/validate")
def editor_validate() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    template_text = body.get("template")
    try:
        profile_id = _resolve_profile_id(body.get("profile_id"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    if template_text is None:
        template_text = get_active_template(settings, profile_id=profile_id)["template"]
    if not isinstance(template_text, str):
        return {"status": "error", "error": "template must be a string."}, 400

    try:
        context_mode = _resolve_context_mode(body.get("context_mode"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    context, context_source = _context_for_mode(
        context_mode,
        fixture_name=body.get("fixture_name"),
    )
    validation = validate_template_text(template_text, context)
    return {
        "status": "ok" if validation["valid"] else "error",
        "profile_id": profile_id,
        "has_context": context is not None,
        "context_source": context_source if context is not None else None,
        "validation": validation,
    }, 200 if validation["valid"] else 400


@app.post("/editor/preview")
def editor_preview() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    template_text = body.get("template")
    try:
        profile_id = _resolve_profile_id(body.get("profile_id"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    if template_text is None:
        template_text = get_active_template(settings, profile_id=profile_id)["template"]
    if not isinstance(template_text, str):
        return {"status": "error", "error": "template must be a string."}, 400

    try:
        context_mode = _resolve_context_mode(body.get("context_mode"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    context, context_source = _context_for_mode(
        context_mode,
        fixture_name=body.get("fixture_name"),
    )
    if context is None:
        return {
            "status": "error",
            "error": "No template context is available yet. Run one update cycle first.",
        }, 404

    result = render_template_text(template_text, context)
    if not result["ok"]:
        return {"status": "error", "error": result["error"]}, 400
    return {
        "status": "ok",
        "profile_id": profile_id,
        "context_source": context_source,
        "preview": result["description"],
        "length": len(result["description"]),
    }, 200


@app.get("/editor/schema")
def editor_schema() -> tuple[dict, int]:
    raw_mode = request.args.get("context_mode")
    try:
        context_mode = _resolve_context_mode(raw_mode)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    context, context_source = _context_for_mode(
        context_mode,
        fixture_name=request.args.get("fixture_name"),
    )
    if context is None:
        return {
            "status": "ok",
            "has_context": False,
            "context_source": None,
            "schema": build_context_schema({}),
        }, 200
    return {
        "status": "ok",
        "has_context": True,
        "context_source": context_source,
        "schema": build_context_schema(context),
    }, 200


@app.get("/editor/catalog")
def editor_catalog() -> tuple[dict, int]:
    raw_mode = request.args.get("context_mode")
    try:
        context_mode = _resolve_context_mode(raw_mode)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    fixture_name = request.args.get("fixture_name")
    context, context_source = _context_for_mode(
        context_mode,
        fixture_name=fixture_name,
    )
    if context is None:
        schema = build_context_schema({})
        return {
            "status": "ok",
            "has_context": False,
            "context_source": None,
            "catalog": schema,
            "fixtures": list_sample_template_fixtures(),
            "context_modes": ["latest", "sample", "latest_or_sample", "fixture"],
        }, 200

    schema = build_context_schema(context)
    return {
        "status": "ok",
        "has_context": True,
        "context_source": context_source,
        "catalog": schema,
        "fixtures": list_sample_template_fixtures(),
        "context_modes": ["latest", "sample", "latest_or_sample", "fixture"],
    }, 200


def _rerun_status_code(result: object) -> str:
    if isinstance(result, dict):
        code = str(result.get("status") or "").strip().lower()
        if code:
            return code
    return "unknown"


def _rerun_retry_guidance(status_code: str, result: object) -> str | None:
    if status_code != "locked":
        return None
    owner = ""
    if isinstance(result, dict):
        owner = str(result.get("lock_owner") or "").strip()
    base = (
        "Another rerun is already in progress. Wait a few seconds, then retry "
        "'Rerun latest activity'."
    )
    if owner:
        return f"{base} Active lock owner: {owner}."
    return base


def _run_rerun(force_update: bool, activity_id: int | None = None) -> tuple[dict, int]:
    try:
        if activity_id is None:
            result = run_once(force_update=force_update)
        else:
            result = run_once(force_update=force_update, activity_id=activity_id)

        status_code = _rerun_status_code(result)
        response: dict[str, object] = {
            "status": "ok",
            "result": result,
            "status_code": status_code,
            "timestamp_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        }
        retry_guidance = _rerun_retry_guidance(status_code, result)
        if retry_guidance:
            response["retry_guidance"] = retry_guidance
        if status_code == "updated":
            try:
                get_dashboard_payload(_effective_settings(), force_refresh=True)
                response["dashboard_refresh"] = "updated"
            except Exception as exc:
                response["dashboard_refresh"] = f"error: {exc}"
        return response, 200
    except Exception as exc:
        return {
            "status": "error",
            "error": str(exc),
            "status_code": "error",
            "timestamp_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        }, 500


@app.post("/rerun/latest")
def rerun_latest() -> tuple[dict, int]:
    return _run_rerun(force_update=True)


@app.post("/rerun/activity/<int:activity_id>")
def rerun_activity(activity_id: int) -> tuple[dict, int]:
    return _run_rerun(force_update=True, activity_id=activity_id)


@app.post("/rerun")
def rerun() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    activity_id = body.get("activity_id")
    if activity_id is None:
        return _run_rerun(force_update=True)

    try:
        activity_id_int = int(activity_id)
    except (TypeError, ValueError):
        return {"status": "error", "error": "activity_id must be an integer."}, 400

    return _run_rerun(force_update=True, activity_id=activity_id_int)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=settings.api_port)
