from __future__ import annotations

import hashlib
import json
import os
import secrets
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests
from flask import Flask, redirect, render_template, request
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .activity_pipeline import (
    build_profile_preview_training,
    preview_profile_match,
    preview_specific_profile_against_activity,
    preview_specific_profile_match,
    run_once,
)
from .agent_runner import (
    COMPANION_PROTOCOL_VERSION,
    generate_bundle_create,
    generate_plan_next_week_draft,
)
from .agent_store import (
    append_audit_event,
    create_draft as create_agent_draft,
    create_job as create_agent_job,
    get_draft as get_agent_draft,
    get_job as get_agent_job,
    list_audit_events,
    list_drafts as list_agent_drafts,
    list_jobs as list_agent_jobs,
    update_draft as update_agent_draft,
    update_job as update_agent_job,
)
from .config import Settings
from .dashboard_data import get_dashboard_payload
from .editor_ai import EditorAssistantRequest, editor_assistant_status, generate_editor_customization
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
    create_template_profile_from_yaml,
    export_template_profiles_bundle,
    get_template_profile,
    get_template_profile_document,
    get_working_template_profile,
    import_template_profiles_bundle,
    list_template_profiles,
    parse_template_profile_yaml_document,
    save_template_profile_yaml,
    set_working_template_profile,
    update_template_profile,
    validate_template_profile_criteria,
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
from .strava_client import StravaClient
from .workout_workshop import (
    collect_workout_target_references,
    create_workout_definition_from_yaml,
    get_workout_definition,
    get_workout_definition_document,
    list_workout_definitions,
    resolve_session_workout,
    save_workout_definition_yaml,
    upsert_workout_definition,
)


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
CORE_UI_FLOW_LEGACY_PATHS = {
    "sources": "/setup",
    "build": "/editor",
    "plan": "/plan",
    "view": "/dashboard",
    "control": "/control",
}
CORE_UI_FLOW_LABELS = {
    "sources": "Sources",
    "build": "Build",
    "plan": "Plan",
    "view": "View",
    "control": "Control",
}
CORE_UI_FLOW_DESCRIPTIONS = {
    "sources": "Provider credentials and OAuth state.",
    "build": "Template authoring with profile and template workshops.",
    "plan": "Spreadsheet-style weekly planning with pace calculations.",
    "view": "Training history heatmaps and long-range trend storytelling.",
    "control": "One-click API operations and service command feedback.",
}


def _normalize_ui_flow(value: object) -> str | None:
    flow = str(value or "").strip().lower()
    if flow in CORE_UI_FLOW_LEGACY_PATHS:
        return flow
    return None


def _normalize_review_variant_token(value: object) -> str:
    token = "".join(ch for ch in str(value or "").strip().lower() if ch.isalnum() or ch in {"-", "_"})
    return token[:64]


def _design_review_preview_assets(flow_name: str, variant: str) -> dict[str, str | None]:
    normalized_variant = _normalize_review_variant_token(variant)
    if not normalized_variant:
        return {"review_variant_css_url": None, "review_variant_js_url": None}

    variant_root = PROJECT_ROOT / "static" / "review-variants" / flow_name
    css_file = variant_root / f"{normalized_variant}.css"
    js_file = variant_root / f"{normalized_variant}.js"
    return {
        "review_variant_css_url": f"/static/review-variants/{flow_name}/{normalized_variant}.css"
        if css_file.is_file()
        else None,
        "review_variant_js_url": f"/static/review-variants/{flow_name}/{normalized_variant}.js"
        if js_file.is_file()
        else None,
    }


def _render_legacy_core_flow(flow_name: str, **template_context: object) -> str:
    if flow_name == "sources":
        return render_template("setup.html", **template_context)
    if flow_name == "build":
        return render_template("editor.html", **template_context)
    if flow_name == "plan":
        return render_template("plan.html", **template_context)
    if flow_name == "view":
        return render_template("dashboard.html", **template_context)
    if flow_name == "control":
        return render_template("control.html", **template_context)
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

    return _render_legacy_core_flow(normalized_flow)


def _effective_settings() -> Settings:
    current = Settings.from_env()
    current.ensure_state_paths()
    return current


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def _resource_version(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()[:16]


def _agent_control_is_local_request() -> bool:
    remote = str(request.remote_addr or "").strip().lower()
    return remote in {"", "127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"}


def _agent_control_actor() -> str:
    explicit = str(request.headers.get("X-Chronicle-Agent-Actor") or "").strip()
    if explicit:
        return explicit
    remote = str(request.remote_addr or "").strip() or "unknown"
    return f"remote:{remote}"


def _require_agent_control_access(current: Settings, scope: str = "read") -> tuple[dict[str, Any], int] | None:
    if not current.enable_agent_control_api and not _agent_control_is_local_request():
        return {"status": "error", "error": "Agent control API is disabled."}, 404

    read_key = str(current.agent_control_read_api_key or "").strip()
    write_key = str(current.agent_control_write_api_key or "").strip()
    if not read_key and not write_key:
        return None if _agent_control_is_local_request() else (
            {"status": "error", "error": "Agent control API keys are not configured."},
            503,
        )

    presented = str(request.headers.get("X-Chronicle-Agent-Key") or "").strip()
    if scope == "write":
        if write_key and presented == write_key:
            return None
        return {"status": "error", "error": "Write access denied."}, 401

    if presented and presented in {read_key, write_key}:
        return None
    return {"status": "error", "error": "Read access denied."}, 401


def _agent_control_base_url(current: Settings) -> str:
    configured = str(current.agent_control_base_url or "").strip()
    if configured:
        return configured.rstrip("/")
    return str(request.url_root or "").rstrip("/")


def _current_template_base_version(current: Settings, profile_id: str) -> str:
    active = get_active_template(current, profile_id=profile_id)
    version = str(active.get("current_version") or "").strip()
    if version:
        return version
    return _resource_version(
        {
            "template": active.get("template"),
            "name": active.get("name"),
            "profile_id": profile_id,
        }
    )


def _current_profile_base_version(current: Settings, profile_id: str) -> str:
    document = get_template_profile_document(current, profile_id)
    return _resource_version(
        {
            "profile_id": document.get("profile", {}).get("profile_id"),
            "yaml_text": document.get("yaml_text"),
        }
    )


def _current_workout_base_version(current: Settings, workout_id: str) -> str:
    document = get_workout_definition_document(current.processed_log_file, workout_id)
    return _resource_version(
        {
            "workout_id": document.get("workout", {}).get("workout_id"),
            "yaml_text": document.get("yaml_text"),
            "workout": document.get("workout"),
        }
    )


def _resolve_week_start_local(raw_value: str | None, *, current: Settings) -> str:
    if raw_value and raw_value.strip():
        return _resolve_plan_date(raw_value)
    try:
        local_tz = ZoneInfo(current.timezone)
    except ZoneInfoNotFoundError:
        local_tz = timezone.utc
    today_local = datetime.now(local_tz).date()
    week_start = today_local - timedelta(days=today_local.weekday()) + timedelta(days=7)
    return week_start.isoformat()


def _week_date_span(week_start_local: str) -> tuple[str, str]:
    start = date.fromisoformat(week_start_local)
    end = start + timedelta(days=6)
    return start.isoformat(), end.isoformat()


def _current_plan_week_base_version(current: Settings, week_start_local: str) -> str:
    start_date, end_date = _week_date_span(week_start_local)
    payload = get_plan_payload(
        current,
        center_date=week_start_local,
        start_date=start_date,
        end_date=end_date,
        include_meta=False,
    )
    return _resource_version({"week_start_local": week_start_local, "rows": payload.get("rows") or []})


def _agent_control_capabilities(current: Settings) -> dict[str, Any]:
    return {
        "protocol_version": COMPANION_PROTOCOL_VERSION,
        "base_url": _agent_control_base_url(current),
        "resources": ["templates", "profiles", "workouts", "plans", "drafts", "jobs", "audit"],
        "tasks": ["template_customize", "plan_next_week", "bundle_create"],
        "apply_requires_write_key": True,
    }


def _validate_template_draft_payload(current: Settings, payload: dict[str, Any]) -> dict[str, Any]:
    requested_profile_id = str(payload.get("profile_id") or "").strip().lower()
    allow_missing_profile = bool(payload.get("allow_missing_profile"))
    profile_exists = True
    if requested_profile_id:
        profile = get_template_profile(current, requested_profile_id)
        if profile is None:
            if not allow_missing_profile:
                raise ValueError(f"Unknown profile_id: {requested_profile_id}")
            profile_id = requested_profile_id
            profile_exists = False
        else:
            profile_id = requested_profile_id
    else:
        profile_id = _resolve_profile_id(None)
    template_text = str(payload.get("template") or "").strip()
    if not template_text:
        raise ValueError("template must be a non-empty string.")
    context_mode = _resolve_context_mode(payload.get("context_mode", "sample"))
    context, context_source = _context_for_mode(context_mode, fixture_name=payload.get("fixture_name"))
    validation = validate_template_text(template_text, context)
    if not profile_exists:
        validation = {
            **validation,
            "warnings": list(validation.get("warnings") or [])
            + [f"Profile '{profile_id}' does not exist yet. Apply the profile draft before publishing this template."],
        }
    return {
        "valid": bool(validation.get("valid")),
        "context_source": context_source if context is not None else None,
        "validation": validation,
        "profile_id": profile_id,
        "profile_exists": profile_exists,
        "base_version": _current_template_base_version(current, profile_id) if profile_exists else None,
    }


def _validate_profile_draft_payload(payload: dict[str, Any]) -> dict[str, Any]:
    profile_id = str(payload.get("profile_id") or payload.get("profile_name") or "").strip()
    yaml_text = str(payload.get("yaml_text") or "").strip()
    if not profile_id:
        raise ValueError("profile_id or profile_name is required.")
    if not yaml_text:
        raise ValueError("yaml_text must be a non-empty string.")
    profile = parse_template_profile_yaml_document(yaml_text, profile_id=profile_id)
    return {
        "valid": True,
        "profile_id": str(profile.get("profile_id") or profile_id),
        "profile": profile,
    }


def _validate_workout_draft_payload(payload: dict[str, Any]) -> dict[str, Any]:
    yaml_text = str(payload.get("yaml_text") or "").strip()
    workout_id = str(payload.get("workout_id") or payload.get("workout_code") or "").strip()
    if yaml_text:
        from tempfile import TemporaryDirectory

        with TemporaryDirectory() as temp_dir:
            runtime_path = Path(temp_dir) / "processed_activities.log"
            runtime_path.touch()
            document = create_workout_definition_from_yaml(
                runtime_path,
                yaml_text=yaml_text,
                workout_name=workout_id or None,
            )
        workout = dict(document.get("workout") or {})
    else:
        raw_workout = payload.get("workout")
        if not isinstance(raw_workout, dict):
            raw_workout = payload if any(payload.get(key) is not None for key in ("workout_id", "workout_code", "label", "shorthand")) else None
        if not isinstance(raw_workout, dict):
            raise ValueError("workout or yaml_text is required.")
        from tempfile import TemporaryDirectory

        with TemporaryDirectory() as temp_dir:
            runtime_path = Path(temp_dir) / "processed_activities.log"
            runtime_path.touch()
            workout = upsert_workout_definition(runtime_path, raw_workout)
    return {"valid": True, "workout": workout}


def _normalize_plan_week_draft(current: Settings, payload: dict[str, Any]) -> dict[str, Any]:
    raw_days = payload.get("days")
    if not isinstance(raw_days, list) or not raw_days:
        raise ValueError("days must be a non-empty array.")
    pending_days: list[dict[str, object]] = []
    response_days: list[dict[str, object]] = []
    for item in raw_days:
        if not isinstance(item, dict):
            raise ValueError("each day entry must be an object.")
        date_key = _resolve_plan_date(str(item.get("date_local") or ""))
        day_payload = {key: value for key, value in item.items() if key != "date_local"}
        existing_day = get_plan_day(current.processed_log_file, date_local=date_key) or {}
        run_type, notes, is_complete, planned_total_miles, sessions = _coerce_plan_day_payload(
            current.processed_log_file,
            day_payload,
            existing_day=existing_day,
        )
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
        response_days.append(
            _plan_day_success_payload(
                current.processed_log_file,
                date_key=date_key,
                planned_total_miles=planned_total_miles,
                sessions=sessions if sessions is not None else [],
                run_type=run_type,
                notes=notes,
                is_complete=is_complete,
            )
        )
    week_start_local = _resolve_plan_date(str(payload.get("week_start_local") or response_days[0]["date_local"]))
    return {
        "valid": True,
        "week_start_local": week_start_local,
        "pending_days": pending_days,
        "days": response_days,
        "base_version": _current_plan_week_base_version(current, week_start_local),
    }


def _validate_agent_draft(current: Settings, draft: dict[str, Any]) -> dict[str, Any]:
    resource_kind = str(draft.get("resource_kind") or "").strip()
    payload = draft.get("payload")
    if not isinstance(payload, dict):
        raise ValueError("Draft payload must be an object.")
    if resource_kind == "template":
        return _validate_template_draft_payload(current, payload)
    if resource_kind == "profile":
        return _validate_profile_draft_payload(payload)
    if resource_kind == "workout":
        return _validate_workout_draft_payload(payload)
    if resource_kind == "plan_week":
        return _normalize_plan_week_draft(current, payload)
    raise ValueError(f"Unsupported resource_kind '{resource_kind}'.")


def _ensure_expected_version(current_version: str, expected_version: str | None) -> None:
    expected = str(expected_version or "").strip()
    if expected and expected != current_version:
        raise ValueError(
            f"Version conflict. expected_version={expected} current_version={current_version}."
        )


def _apply_agent_draft(current: Settings, draft: dict[str, Any], *, actor: str) -> dict[str, Any]:
    resource_kind = str(draft.get("resource_kind") or "").strip()
    payload = draft.get("payload")
    if not isinstance(payload, dict):
        raise ValueError("Draft payload must be an object.")
    validation = _validate_agent_draft(current, draft)
    if not bool(validation.get("valid", True)):
        raise ValueError("Draft validation failed. Resolve validation errors before applying.")

    if resource_kind == "template":
        validation_profile = dict(validation).get("profile_id")
        profile_id = str(validation_profile or payload.get("profile_id") or "").strip().lower()
        if not profile_id:
            profile_id = _resolve_profile_id(None)
        if not bool(validation.get("profile_exists", True)):
            raise ValueError(
                f"Profile '{profile_id}' does not exist yet. Apply the profile draft before publishing this template."
            )
        _ensure_expected_version(
            _current_template_base_version(current, profile_id),
            draft.get("base_version"),
        )
        saved = save_active_template(
            current,
            str(payload.get("template") or ""),
            name=str(payload.get("name")) if payload.get("name") is not None else None,
            author=actor,
            source=str(payload.get("source") or "agent-control-apply"),
            notes=str(payload.get("notes")) if payload.get("notes") is not None else None,
            profile_id=profile_id,
        )
        return {"resource_kind": resource_kind, "active": saved}

    if resource_kind == "profile":
        profile_id = str(payload.get("profile_id") or payload.get("profile_name") or "").strip()
        yaml_text = str(payload.get("yaml_text") or "")
        try:
            _ensure_expected_version(
                _current_profile_base_version(current, profile_id),
                draft.get("base_version"),
            )
            document = save_template_profile_yaml(
                current,
                profile_id,
                yaml_text=yaml_text,
            )
        except ValueError:
            document = create_template_profile_from_yaml(
                current,
                yaml_text=yaml_text,
                profile_name=profile_id or None,
            )
        return {"resource_kind": resource_kind, "profile": document.get("profile"), "document": document}

    if resource_kind == "workout":
        yaml_text = str(payload.get("yaml_text") or "").strip()
        workout_id = str(payload.get("workout_id") or payload.get("workout_code") or "").strip()
        if workout_id:
            try:
                _ensure_expected_version(
                    _current_workout_base_version(current, workout_id),
                    draft.get("base_version"),
                )
            except ValueError:
                if workout_id and str(draft.get("base_version") or "").strip():
                    raise
        if yaml_text:
            try:
                document = save_workout_definition_yaml(
                    current.processed_log_file,
                    workout_id,
                    yaml_text,
                )
            except ValueError:
                document = create_workout_definition_from_yaml(
                    current.processed_log_file,
                    yaml_text,
                    workout_name=workout_id or None,
                )
            return {"resource_kind": resource_kind, "workout": document.get("workout"), "document": document}
        raw_workout = payload.get("workout")
        if not isinstance(raw_workout, dict):
            raw_workout = payload
        workout = upsert_workout_definition(current.processed_log_file, raw_workout)
        return {"resource_kind": resource_kind, "workout": workout}

    if resource_kind == "plan_week":
        week_start_local = str(validation.get("week_start_local") or "").strip()
        _ensure_expected_version(
            _current_plan_week_base_version(current, week_start_local),
            draft.get("base_version"),
        )
        saved = upsert_plan_days_bulk(
            current.processed_log_file,
            days=list(validation.get("pending_days") or []),
        )
        if not saved:
            raise RuntimeError("Failed to persist plan week draft.")
        return {
            "resource_kind": resource_kind,
            "week_start_local": week_start_local,
            "days": validation.get("days") or [],
            "saved_count": len(validation.get("days") or []),
        }

    raise ValueError(f"Unsupported resource_kind '{resource_kind}'.")


def _build_next_week_context(current: Settings, week_start_local: str) -> dict[str, Any]:
    week_start = date.fromisoformat(week_start_local)
    prior_start = (week_start - timedelta(days=28)).isoformat()
    prior_end = (week_start - timedelta(days=1)).isoformat()
    week_end = (week_start + timedelta(days=6)).isoformat()
    prior_payload = get_plan_payload(
        current,
        center_date=prior_end,
        start_date=prior_start,
        end_date=prior_end,
        include_meta=False,
    )
    next_payload = get_plan_payload(
        current,
        center_date=week_start_local,
        start_date=week_start_local,
        end_date=week_end,
        include_meta=False,
    )
    workouts = list_workout_definitions(current.processed_log_file)
    return {
        "week_start_local": week_start_local,
        "week_end_local": week_end,
        "prior_window": {
            "start_date": prior_start,
            "end_date": prior_end,
            "summary": prior_payload.get("summary") or {},
            "rows": prior_payload.get("rows") or [],
        },
        "target_week": {
            "start_date": week_start_local,
            "end_date": week_end,
            "rows": next_payload.get("rows") or [],
        },
        "workouts": workouts,
        "run_type_options": list(RUN_TYPE_OPTIONS),
        "version": _current_plan_week_base_version(current, week_start_local),
    }


def _build_bundle_context(current: Settings) -> dict[str, Any]:
    working_profile_id = str(get_working_template_profile(current).get("profile_id") or "default")
    active_template = get_active_template(current, profile_id=working_profile_id)
    workouts = list_workout_definitions(current.processed_log_file)
    return {
        "working_profile_id": working_profile_id,
        "profiles": list_template_profiles(current),
        "active_template": {
            "profile_id": active_template.get("profile_id"),
            "name": active_template.get("name"),
            "template": active_template.get("template"),
            "current_version": active_template.get("current_version"),
        },
        "workouts": workouts,
        "run_type_options": list(RUN_TYPE_OPTIONS),
    }


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
    return validate_template_profile_criteria(raw_value, require_executable=True, field="criteria")


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


def _decorate_workout_with_target_resolution(workout: dict[str, object], marathon_goal: str) -> dict[str, object]:
    if not isinstance(workout, dict):
        return workout
    decorated = dict(workout)
    decorated["resolved_targets"] = collect_workout_target_references(decorated, marathon_goal)
    decorated["pace_goal"] = normalize_marathon_goal_time(marathon_goal)
    return decorated


def _attached_workout_codes_for_day(path: Path, *, date_key: str) -> list[str]:
    day_sessions_map = list_plan_sessions(
        path,
        start_date=date_key,
        end_date=date_key,
    )
    raw_sessions = day_sessions_map.get(date_key, []) if isinstance(day_sessions_map, dict) else []
    attached_workouts: list[str] = []
    seen_codes: set[str] = set()
    for session in raw_sessions:
        if not isinstance(session, dict):
            continue
        workout_code = str(session.get("workout_code") or session.get("planned_workout") or "").strip()
        if not workout_code:
            continue
        lowered = workout_code.lower()
        if lowered in seen_codes:
            continue
        seen_codes.add(lowered)
        attached_workouts.append(workout_code)
    return attached_workouts


def _run_garmin_sync_result_for_day(
    path: Path,
    *,
    date_key: str,
    requested_workout: str | None = None,
) -> tuple[dict[str, object], int]:
    workout_code = str(requested_workout or "").strip() or None
    attempt_count = 0
    max_attempts = 2
    run_phase_completed = False
    last_error: ValueError | RuntimeError | None = None

    for attempt in range(1, max_attempts + 1):
        attempt_count = attempt
        try:
            run_garmin_sync_request(
                path,
                date_local=date_key,
                workout_code=workout_code,
            )
            run_phase_completed = True
            sync_record, garmin_workout, calendar_entry = schedule_garmin_sync_request(
                path,
                date_local=date_key,
                workout_code=workout_code,
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
            path,
            date_local=date_key,
            workout_code=workout_code,
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


def _parse_plan_sessions_input(path: Path, raw_value: object) -> tuple[list[dict[str, object]], float]:
    if not isinstance(raw_value, list):
        raise ValueError("sessions must be an array of numeric values or objects with planned_miles.")
    sessions: list[dict[str, object]] = []
    total = 0.0
    for idx, item in enumerate(raw_value):
        run_type: str | None = None
        workout_code: str | None = None
        planned_workout: str | None = None
        if isinstance(item, dict):
            planned_raw = item.get("planned_miles")
            run_type = _coerce_plan_run_type(item.get("run_type"))
            workout_code = str(item.get("workout_code") or "").strip() or None
            planned_workout = str(item.get("planned_workout") or "").strip() or None
            if "planned_workout" in item and not planned_workout:
                workout_code = None
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
        resolved_workout = resolve_session_workout(
            path,
            workout_code=workout_code,
            planned_workout=planned_workout,
            run_type=run_type,
        )
        sessions.append(
            {
                "ordinal": idx + 1,
                "planned_miles": planned,
                "run_type": run_type,
                "workout_code": str(resolved_workout.get("workout_code") or "").strip() or None,
            }
        )
        total += planned
    return sessions, total


def _normalize_plan_session_response(path: Path, sessions: object) -> list[dict[str, object]]:
    if not isinstance(sessions, list):
        return []
    payload: list[dict[str, object]] = []
    workout_cache: dict[str, dict[str, Any] | None] = {}
    for item in sessions:
        if not isinstance(item, dict):
            continue
        workout_code = str(item.get("workout_code") or "").strip()
        workout_text = str(item.get("planned_workout") or "").strip()
        if workout_code:
            cached = workout_cache.get(workout_code)
            if workout_code not in workout_cache:
                cached = get_workout_definition(path, workout_code)
                workout_cache[workout_code] = cached
            if isinstance(cached, dict):
                workout_text = str(cached.get("shorthand") or workout_text or workout_code).strip()
        normalized = dict(item)
        normalized["planned_workout"] = workout_text
        normalized["workout_code"] = workout_code
        payload.append(normalized)
    return payload


def _coerce_plan_day_payload(
    path: Path,
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
        sessions, planned_total_miles = _parse_plan_sessions_input(path, body.get("sessions"))
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
            current.processed_log_file,
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
        current.processed_log_file,
        date_key=date_key,
        planned_total_miles=planned_total_miles,
        sessions=sessions or [],
        run_type=run_type,
        notes=notes,
        is_complete=is_complete,
    ), 200


def _plan_day_success_payload(
    path: Path,
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

    normalized_sessions = _normalize_plan_session_response(path, sessions or [])
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
    return redirect("/view", code=302)


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


@app.get("/design-review")
def design_review_page() -> str:
    review_pages = [
        {
            "key": flow_name,
            "label": CORE_UI_FLOW_LABELS.get(flow_name, flow_name.title()),
            "description": CORE_UI_FLOW_DESCRIPTIONS.get(flow_name, ""),
            "live_path": f"/{flow_name}",
            "preview_path": f"/design-review/preview/{flow_name}",
        }
        for flow_name in CORE_UI_FLOW_LEGACY_PATHS
    ]
    return render_template(
        "design_review.html",
        review_pages=review_pages,
        review_page_default="view",
        review_variant_default="a",
    )


@app.get("/design-review/preview/<string:flow_name>")
def design_review_preview_page(flow_name: str):
    normalized_flow = _normalize_ui_flow(flow_name)
    if normalized_flow is None:
        return {
            "status": "error",
            "error": {
                "code": "DESIGN_REVIEW_FLOW_NOT_FOUND",
                "message": "Unknown design review flow.",
                "details": {"flow": flow_name},
            },
        }, 404

    variant = _normalize_review_variant_token(request.args.get("variant"))
    preview_assets = _design_review_preview_assets(normalized_flow, variant)
    return _render_legacy_core_flow(
        normalized_flow,
        review_mode=True,
        review_variant=variant or "",
        **preview_assets,
    )


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
                workout_record = get_workout_definition(current.processed_log_file, workout_candidate)
                workout_shorthand = (
                    str(workout_record.get("shorthand") or "").strip()
                    if isinstance(workout_record, dict)
                    else workout_candidate
                )

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
                workout_record = get_workout_definition(current.processed_log_file, workout_candidate)
                workout_shorthand = (
                    str(workout_record.get("shorthand") or "").strip()
                    if isinstance(workout_record, dict)
                    else workout_candidate
                )
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
    marathon_goal = _load_plan_marathon_goal(current.processed_log_file)
    workouts = [
        _decorate_workout_with_target_resolution(workout, marathon_goal)
        for workout in list_workout_definitions(current.processed_log_file)
    ]
    return {"status": "ok", "workouts": workouts}, 200


@app.get("/plan/workouts/<string:workout_id>")
def plan_workout_get(workout_id: str) -> tuple[dict, int]:
    current = _effective_settings()
    marathon_goal = _load_plan_marathon_goal(current.processed_log_file)
    try:
        document = get_workout_definition_document(current.processed_log_file, workout_id)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return {
        "status": "ok",
        **document,
        "workout": _decorate_workout_with_target_resolution(dict(document["workout"]), marathon_goal),
        "pace_goal": normalize_marathon_goal_time(marathon_goal),
    }, 200


@app.post("/plan/workouts")
def plan_workouts_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400

    yaml_text = body.get("yaml_text")
    if yaml_text is not None:
        current = _effective_settings()
        marathon_goal = _load_plan_marathon_goal(current.processed_log_file)
        try:
            document = create_workout_definition_from_yaml(
                current.processed_log_file,
                yaml_text=str(yaml_text),
                workout_name=body.get("workout_name") if isinstance(body.get("workout_name"), str) else None,
            )
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400
        return {
            "status": "ok",
            "workout": _decorate_workout_with_target_resolution(dict(document["workout"]), marathon_goal),
            "yaml_text": document["yaml_text"],
            "source_path": document["source_path"],
            "read_only": document["read_only"],
            "invalid": document.get("invalid", False),
            "load_error": document.get("load_error", ""),
            "workouts": [
                _decorate_workout_with_target_resolution(workout, marathon_goal)
                for workout in list_workout_definitions(current.processed_log_file)
            ],
            "pace_goal": normalize_marathon_goal_time(marathon_goal),
        }, 200

    try:
        current = _effective_settings()
        workout = upsert_workout_definition(current.processed_log_file, body)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    except RuntimeError as exc:
        return {"status": "error", "error": str(exc)}, 500

    marathon_goal = _load_plan_marathon_goal(current.processed_log_file)
    return {
        "status": "ok",
        "workout": _decorate_workout_with_target_resolution(workout, marathon_goal),
        "workouts": [
            _decorate_workout_with_target_resolution(workout_item, marathon_goal)
            for workout_item in list_workout_definitions(current.processed_log_file)
        ],
        "pace_goal": normalize_marathon_goal_time(marathon_goal),
    }, 200


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
    yaml_text = body.get("yaml_text")
    if yaml_text is not None:
        marathon_goal = _load_plan_marathon_goal(current.processed_log_file)
        try:
            document = save_workout_definition_yaml(
                current.processed_log_file,
                path_code,
                yaml_text=str(yaml_text),
            )
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400
        return {
            "status": "ok",
            "workout": _decorate_workout_with_target_resolution(dict(document["workout"]), marathon_goal),
            "yaml_text": document["yaml_text"],
            "source_path": document["source_path"],
            "read_only": document["read_only"],
            "invalid": document.get("invalid", False),
            "load_error": document.get("load_error", ""),
            "workouts": [
                _decorate_workout_with_target_resolution(workout, marathon_goal)
                for workout in list_workout_definitions(current.processed_log_file)
            ],
            "pace_goal": normalize_marathon_goal_time(marathon_goal),
        }, 200

    payload = dict(body)
    payload["workout_id"] = path_code
    try:
        workout = upsert_workout_definition(current.processed_log_file, payload)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    except RuntimeError as exc:
        return {"status": "error", "error": str(exc)}, 500

    marathon_goal = _load_plan_marathon_goal(current.processed_log_file)
    workouts = [
        _decorate_workout_with_target_resolution(workout_item, marathon_goal)
        for workout_item in list_workout_definitions(current.processed_log_file)
    ]
    return {
        "status": "ok",
        "workout": _decorate_workout_with_target_resolution(workout, marathon_goal),
        "workouts": workouts,
        "pace_goal": normalize_marathon_goal_time(marathon_goal),
    }, 200


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

    attached_workouts = _attached_workout_codes_for_day(current.processed_log_file, date_key=date_key)

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


def _execute_garmin_sync_send_for_workout(
    path: Path,
    *,
    date_key: str,
    workout_code: str,
) -> dict[str, object]:
    sync_payload: dict[str, object] | None = None
    try:
        sync_payload = initiate_garmin_sync_request(
            path,
            date_local=date_key,
            workout_code=workout_code,
        )
        result_payload, _http_code = _run_garmin_sync_result_for_day(
            path,
            date_key=date_key,
            requested_workout=workout_code,
        )
        return {
            "workout_code": workout_code,
            "status": str(result_payload.get("status") or "error"),
            "sync": result_payload.get("sync") or sync_payload,
            "result": result_payload.get("result"),
            "garmin_workout": result_payload.get("garmin_workout"),
            "calendar_entry": result_payload.get("calendar_entry"),
            **({"error": result_payload.get("error")} if result_payload.get("error") else {}),
        }
    except (ValueError, RuntimeError) as exc:
        return {
            "workout_code": workout_code,
            "status": "error",
            "sync": sync_payload,
            "result": None,
            "garmin_workout": None,
            "calendar_entry": None,
            "error": str(exc),
        }


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
    return _run_garmin_sync_result_for_day(
        current.processed_log_file,
        date_key=date_key,
        requested_workout=requested_workout,
    )


@app.post("/plan/day/<string:date_local>/garmin-sync/send")
def plan_day_garmin_sync_send_post(date_local: str) -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400

    current = _effective_settings()
    try:
        date_key = _resolve_plan_date(date_local)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    attached_workouts = _attached_workout_codes_for_day(current.processed_log_file, date_key=date_key)
    if not attached_workouts:
        return {
            "status": "error",
            "error": "No workout is attached to this plan day. Attach a workout before sending to Garmin.",
        }, 400

    results: list[dict[str, object]] = []
    for workout_code in attached_workouts:
        result_payload = _execute_garmin_sync_send_for_workout(
            current.processed_log_file,
            date_key=date_key,
            workout_code=workout_code,
        )
        results.append(result_payload)

    succeeded = sum(1 for item in results if str(item.get("status") or "") == "ok")
    failed = len(results) - succeeded
    overall_status = "ok" if failed == 0 else ("partial" if succeeded > 0 else "error")
    return {
        "status": overall_status,
        "date_local": date_key,
        "results": results,
        "summary": {
            "requested_count": len(attached_workouts),
            "succeeded_count": succeeded,
            "failed_count": failed,
        },
    }, 200


@app.post("/plan/day/<string:date_local>/garmin-sync/send-window")
def plan_day_garmin_sync_send_window_post(date_local: str) -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400

    current = _effective_settings()
    try:
        start_date = date.fromisoformat(_resolve_plan_date(date_local))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    try:
        span_days = int(body.get("span_days") or 7)
    except (TypeError, ValueError):
        return {"status": "error", "error": "span_days must be an integer."}, 400
    span_days = max(1, min(span_days, 14))

    day_results: list[dict[str, object]] = []
    total_requested = 0
    total_succeeded = 0
    total_failed = 0
    total_skipped = 0

    for offset in range(span_days):
        day_key = (start_date + timedelta(days=offset)).isoformat()
        attached_workouts = _attached_workout_codes_for_day(current.processed_log_file, date_key=day_key)
        if not attached_workouts:
            day_results.append(
                {
                    "date_local": day_key,
                    "status": "skipped",
                    "reason": "no_attached_workouts",
                    "results": [],
                }
            )
            total_skipped += 1
            continue

        workout_results: list[dict[str, object]] = []
        for workout_code in attached_workouts:
            total_requested += 1
            result_payload = _execute_garmin_sync_send_for_workout(
                current.processed_log_file,
                date_key=day_key,
                workout_code=workout_code,
            )
            item_status = str(result_payload.get("status") or "error")
            if item_status == "ok":
                total_succeeded += 1
            else:
                total_failed += 1
            workout_results.append(result_payload)

        if all(str(item.get("status") or "") == "ok" for item in workout_results):
            day_status = "ok"
        elif any(str(item.get("status") or "") == "ok" for item in workout_results):
            day_status = "partial"
        else:
            day_status = "error"
        day_results.append(
            {
                "date_local": day_key,
                "status": day_status,
                "results": workout_results,
            }
        )

    overall_status = "ok" if total_failed == 0 else ("partial" if total_succeeded > 0 else "error")
    return {
        "status": overall_status,
        "start_date_local": start_date.isoformat(),
        "span_days": span_days,
        "days": day_results,
        "summary": {
            "requested_count": total_requested,
            "succeeded_count": total_succeeded,
            "failed_count": total_failed,
            "skipped_day_count": total_skipped,
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
                current.processed_log_file,
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
                current.processed_log_file,
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


@app.get("/editor/assistant/status")
def editor_assistant_status_get() -> tuple[dict, int]:
    return {"status": "ok", "assistant": editor_assistant_status(settings)}, 200


@app.get("/editor/profiles")
def editor_profiles_get() -> tuple[dict, int]:
    working = get_working_template_profile(settings)
    return {
        "status": "ok",
        "working_profile_id": working.get("profile_id"),
        "profiles": list_template_profiles(settings),
    }, 200


@app.get("/editor/profiles/<string:profile_id>")
def editor_profile_get(profile_id: str) -> tuple[dict, int]:
    try:
        document = get_template_profile_document(settings, profile_id)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return {
        "status": "ok",
        "working_profile_id": get_working_template_profile(settings).get("profile_id"),
        **document,
    }, 200


@app.post("/editor/profiles")
def editor_profiles_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    yaml_text = body.get("yaml_text")
    if yaml_text is not None:
        try:
            document = create_template_profile_from_yaml(
                settings,
                yaml_text=str(yaml_text),
                profile_name=body.get("profile_name") if isinstance(body.get("profile_name"), str) else None,
            )
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400
        return {
            "status": "ok",
            "profile": document["profile"],
            "yaml_text": document["yaml_text"],
            "source_path": document["source_path"],
            "read_only": document["read_only"],
            "invalid": document.get("invalid", False),
            "load_error": document.get("load_error", ""),
            "working_profile_id": get_working_template_profile(settings).get("profile_id"),
            "profiles": list_template_profiles(settings),
        }, 200

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
    yaml_text = body.get("yaml_text")
    if yaml_text is not None:
        try:
            document = save_template_profile_yaml(
                settings,
                profile_id,
                yaml_text=str(yaml_text),
            )
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400
        return {
            "status": "ok",
            "profile": document["profile"],
            "yaml_text": document["yaml_text"],
            "source_path": document["source_path"],
            "read_only": document["read_only"],
            "invalid": document.get("invalid", False),
            "load_error": document.get("load_error", ""),
            "working_profile_id": get_working_template_profile(settings).get("profile_id"),
        }, 200

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

    yaml_text = body.get("yaml_text")
    if yaml_text is not None:
        try:
            profile = parse_template_profile_yaml_document(
                str(yaml_text),
                profile_id=body.get("profile_id") if isinstance(body.get("profile_id"), str) else None,
                profile_name=body.get("profile_name") if isinstance(body.get("profile_name"), str) else None,
            )
            match = preview_specific_profile_match(settings, context, profile)
        except ValueError as exc:
            return {"status": "error", "error": str(exc)}, 400
        return {
            "status": "ok",
            "context_source": context_source,
            "profile_match": match,
        }, 200

    try:
        if isinstance(body.get("profile_id"), str) and body.get("profile_id"):
            profile = get_template_profile(settings, str(body.get("profile_id")))
            if profile is None:
                raise ValueError(f"Unknown profile_id: {body.get('profile_id')}")
            match = preview_specific_profile_match(settings, context, profile)
        else:
            match = preview_profile_match(settings, context)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    return {
        "status": "ok",
        "context_source": context_source,
        "profile_match": match,
    }, 200


@app.post("/editor/profiles/validate-activity")
def editor_profile_validate_activity_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    raw_activity_id = body.get("activity_id")
    try:
        activity_id = int(raw_activity_id)
    except (TypeError, ValueError):
        return {"status": "error", "error": "activity_id must be an integer."}, 400
    if activity_id <= 0:
        return {"status": "error", "error": "activity_id must be a positive integer."}, 400

    yaml_text = body.get("yaml_text")
    if not isinstance(yaml_text, str) or not yaml_text.strip():
        return {"status": "error", "error": "yaml_text is required."}, 400

    enabled_override: bool | None = None
    if "enabled" in body:
        raw_enabled = body.get("enabled")
        if not isinstance(raw_enabled, bool):
            return {"status": "error", "error": "enabled must be boolean when provided."}, 400
        enabled_override = raw_enabled

    try:
        profile = parse_template_profile_yaml_document(
            yaml_text,
            profile_id=body.get("profile_id") if isinstance(body.get("profile_id"), str) else None,
            profile_name=body.get("profile_name") if isinstance(body.get("profile_name"), str) else None,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    current = _effective_settings()
    try:
        activity = StravaClient(current).get_activity_details(activity_id)
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        if status_code == 404:
            return {
                "status": "error",
                "error": f"Strava activity {activity_id} was not found or is not accessible.",
            }, 404
        return {
            "status": "error",
            "error": f"Failed to load Strava activity {activity_id}.",
        }, 502
    except Exception as exc:
        return {
            "status": "error",
            "error": f"Failed to load Strava activity {activity_id}: {exc}",
        }, 502

    if not isinstance(activity, dict) or not activity:
        return {
            "status": "error",
            "error": f"Strava activity {activity_id} did not return a valid payload.",
        }, 502

    try:
        training = build_profile_preview_training(current, activity)
        match = preview_specific_profile_against_activity(
            current,
            activity,
            profile,
            training=training,
            enabled_override=enabled_override,
        )
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    response_activity_id = activity_id
    try:
        response_activity_id = int(activity.get("id") or activity_id)
    except (TypeError, ValueError):
        response_activity_id = activity_id

    return {
        "status": "ok",
        "activity": {
            "id": response_activity_id,
            "name": str(activity.get("name") or "").strip() or f"Activity {activity_id}",
            "sport_type": str(activity.get("sport_type") or activity.get("type") or "").strip() or "Unknown",
            "start_date_local": str(activity.get("start_date_local") or activity.get("start_date") or "").strip() or None,
        },
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


@app.post("/editor/assistant/customize")
def editor_assistant_customize_post() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    customization_request = str(body.get("request") or "").strip()
    if not customization_request:
        return {"status": "error", "error": "request must be a non-empty string."}, 400

    template_text = body.get("template")
    try:
        profile_id = _resolve_profile_id(body.get("profile_id"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    if template_text is None:
        template_text = get_active_template(settings, profile_id=profile_id)["template"]
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
    normalized_context = normalize_template_context(context or {})
    available_context_keys = tuple(
        sorted(str(key).strip() for key in normalized_context.keys() if str(key).strip())
    )
    assistant_request = EditorAssistantRequest(
        request_text=customization_request,
        template_text=template_text,
        profile_id=profile_id,
        context_mode=context_mode,
        fixture_name=str(body.get("fixture_name") or "").strip() or None,
        preview_text=str(body.get("preview_text") or "").strip() or None,
        selected_text=str(body.get("selected_text") or "").strip() or None,
        available_context_keys=available_context_keys,
    )
    try:
        suggestion = generate_editor_customization(settings, assistant_request)
    except RuntimeError as exc:
        return {"status": "error", "error": str(exc)}, 503

    return {
        "status": "ok",
        "assistant": editor_assistant_status(settings),
        "context_source": context_source if context is not None else None,
        "suggestion": suggestion,
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


@app.get("/agent-control/handshake")
def agent_control_handshake_get() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    return {
        "status": "ok",
        "protocol_version": COMPANION_PROTOCOL_VERSION,
        "capabilities": _agent_control_capabilities(current),
        "assistant": editor_assistant_status(current),
    }, 200


@app.get("/agent-control/capabilities")
def agent_control_capabilities_get() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    return {"status": "ok", "capabilities": _agent_control_capabilities(current)}, 200


@app.get("/agent-control/templates/active")
def agent_control_template_get() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    try:
        profile_id = _resolve_profile_id(request.args.get("profile_id"))
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    active = get_active_template(current, profile_id=profile_id)
    return {
        "status": "ok",
        "resource_kind": "template",
        "base_version": _current_template_base_version(current, profile_id),
        "active": active,
    }, 200


@app.get("/agent-control/profiles")
def agent_control_profiles_get() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    working = get_working_template_profile(current)
    profiles = list_template_profiles(current)
    return {
        "status": "ok",
        "resource_kind": "profiles",
        "working_profile_id": working.get("profile_id"),
        "profiles": profiles,
    }, 200


@app.get("/agent-control/profiles/<string:profile_id>")
def agent_control_profile_get(profile_id: str) -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    try:
        document = get_template_profile_document(current, profile_id)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 404
    return {
        "status": "ok",
        "resource_kind": "profile",
        "base_version": _current_profile_base_version(current, profile_id),
        **document,
    }, 200


@app.get("/agent-control/workouts")
def agent_control_workouts_get() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    workouts = list_workout_definitions(current.processed_log_file)
    return {
        "status": "ok",
        "resource_kind": "workouts",
        "workouts": workouts,
        "count": len(workouts),
    }, 200


@app.get("/agent-control/workouts/<string:workout_id>")
def agent_control_workout_get(workout_id: str) -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    try:
        document = get_workout_definition_document(current.processed_log_file, workout_id)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 404
    return {
        "status": "ok",
        "resource_kind": "workout",
        "base_version": _current_workout_base_version(current, workout_id),
        **document,
    }, 200


@app.get("/agent-control/plans/week")
def agent_control_plan_week_get() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    try:
        week_start_local = _resolve_week_start_local(request.args.get("week_start_local"), current=current)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    start_date, end_date = _week_date_span(week_start_local)
    payload = get_plan_payload(
        current,
        center_date=week_start_local,
        start_date=start_date,
        end_date=end_date,
        include_meta=False,
    )
    return {
        "status": "ok",
        "resource_kind": "plan_week",
        "week_start_local": week_start_local,
        "week_end_local": end_date,
        "base_version": _current_plan_week_base_version(current, week_start_local),
        "plan": payload,
    }, 200


@app.get("/agent-control/plans/next-week-context")
def agent_control_next_week_context_get() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    try:
        week_start_local = _resolve_week_start_local(request.args.get("week_start_local"), current=current)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400
    return {
        "status": "ok",
        "context": _build_next_week_context(current, week_start_local),
    }, 200


@app.get("/agent-control/drafts")
def agent_control_drafts_get() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    resource_kind = str(request.args.get("resource_kind") or "").strip() or None
    drafts = list_agent_drafts(current.state_dir, resource_kind=resource_kind)
    return {"status": "ok", "drafts": drafts, "count": len(drafts)}, 200


@app.post("/agent-control/drafts")
def agent_control_drafts_post() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400
    resource_kind = str(body.get("resource_kind") or "").strip()
    payload = body.get("payload")
    if resource_kind not in {"template", "profile", "workout", "plan_week"}:
        return {"status": "error", "error": "resource_kind must be one of: template, profile, workout, plan_week."}, 400
    if not isinstance(payload, dict):
        return {"status": "error", "error": "payload must be a JSON object."}, 400

    draft = create_agent_draft(
        current.state_dir,
        resource_kind=resource_kind,
        payload=payload,
        title=str(body.get("title") or resource_kind),
        base_version=str(body.get("base_version") or "").strip() or None,
        requested_by=str(body.get("requested_by") or _agent_control_actor()),
        source=str(body.get("source") or "agent-control"),
        metadata=body.get("metadata") if isinstance(body.get("metadata"), dict) else None,
    )

    validation_payload: dict[str, Any] | None = None
    if bool(body.get("validate", True)):
        try:
            validation_payload = _validate_agent_draft(current, draft)
        except ValueError as exc:
            validation_payload = {"valid": False, "error": str(exc)}
            draft = update_agent_draft(
                current.state_dir,
                draft["draft_id"],
                status="validation_failed",
                validation=validation_payload,
            )
        else:
            draft = update_agent_draft(
                current.state_dir,
                draft["draft_id"],
                status="validated" if bool(validation_payload.get("valid")) else "validation_failed",
                validation=validation_payload,
                base_version=draft.get("base_version") or validation_payload.get("base_version"),
            )

    append_audit_event(
        current.state_dir,
        event_type="draft.created",
        actor=_agent_control_actor(),
        resource_kind=resource_kind,
        resource_id=str(draft.get("draft_id") or ""),
        payload={"title": draft.get("title"), "validated": bool(validation_payload)},
    )
    return {"status": "ok", "draft": draft}, 201


@app.get("/agent-control/drafts/<string:draft_id>")
def agent_control_draft_get(draft_id: str) -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    draft = get_agent_draft(current.state_dir, draft_id)
    if draft is None:
        return {"status": "error", "error": "Unknown draft_id."}, 404
    return {"status": "ok", "draft": draft}, 200


@app.put("/agent-control/drafts/<string:draft_id>")
def agent_control_draft_put(draft_id: str) -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400
    draft = get_agent_draft(current.state_dir, draft_id)
    if draft is None:
        return {"status": "error", "error": "Unknown draft_id."}, 404

    updates: dict[str, Any] = {}
    if "title" in body:
        updates["title"] = str(body.get("title") or draft.get("title") or "draft")
    if "payload" in body:
        if not isinstance(body.get("payload"), dict):
            return {"status": "error", "error": "payload must be a JSON object."}, 400
        updates["payload"] = body.get("payload")
        updates["validation"] = None
        updates["status"] = "draft"
    if "metadata" in body:
        if body.get("metadata") is not None and not isinstance(body.get("metadata"), dict):
            return {"status": "error", "error": "metadata must be a JSON object when provided."}, 400
        updates["metadata"] = body.get("metadata") or {}
    if "base_version" in body:
        updates["base_version"] = str(body.get("base_version") or "").strip() or None
    if not updates:
        return {"status": "error", "error": "Provide title, payload, metadata, and/or base_version."}, 400

    draft = update_agent_draft(current.state_dir, draft_id, **updates)
    append_audit_event(
        current.state_dir,
        event_type="draft.updated",
        actor=_agent_control_actor(),
        resource_kind=str(draft.get("resource_kind") or ""),
        resource_id=draft_id,
        payload={"fields": sorted(updates.keys())},
    )
    return {"status": "ok", "draft": draft}, 200


@app.post("/agent-control/drafts/<string:draft_id>/validate")
def agent_control_draft_validate_post(draft_id: str) -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    draft = get_agent_draft(current.state_dir, draft_id)
    if draft is None:
        return {"status": "error", "error": "Unknown draft_id."}, 404
    try:
        validation = _validate_agent_draft(current, draft)
    except ValueError as exc:
        validation = {"valid": False, "error": str(exc)}
        draft = update_agent_draft(
            current.state_dir,
            draft_id,
            status="validation_failed",
            validation=validation,
        )
        http_code = 400
    else:
        draft = update_agent_draft(
            current.state_dir,
            draft_id,
            status="validated" if bool(validation.get("valid")) else "validation_failed",
            validation=validation,
            base_version=draft.get("base_version") or validation.get("base_version"),
        )
        http_code = 200 if bool(validation.get("valid")) else 400
    append_audit_event(
        current.state_dir,
        event_type="draft.validated",
        actor=_agent_control_actor(),
        resource_kind=str(draft.get("resource_kind") or ""),
        resource_id=draft_id,
        payload={"valid": bool(draft.get("validation", {}).get("valid"))},
    )
    return {"status": "ok" if http_code == 200 else "error", "draft": draft}, http_code


@app.post("/agent-control/drafts/<string:draft_id>/apply")
def agent_control_draft_apply_post(draft_id: str) -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="write")
    if access_error is not None:
        return access_error
    draft = get_agent_draft(current.state_dir, draft_id)
    if draft is None:
        return {"status": "error", "error": "Unknown draft_id."}, 404

    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400
    expected_version = str(body.get("expected_version") or "").strip() or None
    dry_run = bool(body.get("dry_run", False))
    draft_to_apply = dict(draft)
    if expected_version:
        draft_to_apply["base_version"] = expected_version

    try:
        validation = _validate_agent_draft(current, draft_to_apply)
        if dry_run:
            result = {"dry_run": True, "validation": validation}
        else:
            result = _apply_agent_draft(current, draft_to_apply, actor=_agent_control_actor())
    except ValueError as exc:
        status_code = 409 if "Version conflict" in str(exc) else 400
        updated = update_agent_draft(
            current.state_dir,
            draft_id,
            status="apply_failed",
            validation=draft.get("validation"),
            apply_result={"error": str(exc)},
        )
        return {"status": "error", "error": str(exc), "draft": updated}, status_code
    except RuntimeError as exc:
        updated = update_agent_draft(
            current.state_dir,
            draft_id,
            status="apply_failed",
            validation=draft.get("validation"),
            apply_result={"error": str(exc)},
        )
        return {"status": "error", "error": str(exc), "draft": updated}, 500

    updated = update_agent_draft(
        current.state_dir,
        draft_id,
        status="validated" if dry_run else "applied",
        validation=validation,
        apply_result=result if not dry_run else None,
        base_version=draft_to_apply.get("base_version") or draft.get("base_version") or validation.get("base_version"),
    )
    append_audit_event(
        current.state_dir,
        event_type="draft.applied" if not dry_run else "draft.dry_run",
        actor=_agent_control_actor(),
        resource_kind=str(updated.get("resource_kind") or ""),
        resource_id=draft_id,
        payload=result,
    )
    return {"status": "ok", "draft": updated, "result": result}, 200


@app.get("/agent-control/jobs")
def agent_control_jobs_get() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    task_kind = str(request.args.get("task_kind") or "").strip() or None
    jobs = list_agent_jobs(current.state_dir, task_kind=task_kind)
    return {"status": "ok", "jobs": jobs, "count": len(jobs)}, 200


@app.get("/agent-control/jobs/<string:job_id>")
def agent_control_job_get(job_id: str) -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    job = get_agent_job(current.state_dir, job_id)
    if job is None:
        return {"status": "error", "error": "Unknown job_id."}, 404
    return {"status": "ok", "job": job}, 200


@app.get("/agent-control/audit")
def agent_control_audit_get() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    try:
        limit = max(1, min(500, int(request.args.get("limit", "100"))))
    except ValueError:
        limit = 100
    events = list_audit_events(current.state_dir, limit=limit)
    return {"status": "ok", "events": events, "count": len(events)}, 200


@app.post("/agent/tasks/plan-next-week")
def agent_task_plan_next_week_post() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400
    user_request = str(body.get("request") or "").strip()
    if not user_request:
        return {"status": "error", "error": "request must be a non-empty string."}, 400
    try:
        week_start_local = _resolve_week_start_local(body.get("week_start_local"), current=current)
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}, 400

    actor = _agent_control_actor()
    job = create_agent_job(
        current.state_dir,
        task_kind="plan_next_week",
        request_payload={"request": user_request, "week_start_local": week_start_local},
        requested_by=actor,
        source=str(body.get("source") or "agent-task"),
    )
    append_audit_event(
        current.state_dir,
        event_type="job.created",
        actor=actor,
        resource_kind="job",
        resource_id=str(job.get("job_id") or ""),
        payload={"task_kind": "plan_next_week"},
    )
    try:
        update_agent_job(current.state_dir, job["job_id"], status="running")
        context_payload = _build_next_week_context(current, week_start_local)
        proposal = generate_plan_next_week_draft(
            current,
            user_request=user_request,
            week_start_local=week_start_local,
            context_payload=context_payload,
            chronicle_context={
                "base_url": _agent_control_base_url(current),
                "api_key": str(current.agent_control_read_api_key or current.agent_control_write_api_key or "").strip(),
                "protocol_version": COMPANION_PROTOCOL_VERSION,
            },
        )
        draft = create_agent_draft(
            current.state_dir,
            resource_kind="plan_week",
            payload={
                "week_start_local": week_start_local,
                "days": proposal.get("days") or [],
            },
            title=str(proposal.get("title") or f"Plan draft {week_start_local}"),
            base_version=str(context_payload.get("version") or "").strip() or None,
            requested_by=actor,
            source="agent-task-plan-next-week",
            metadata={
                "summary": str(proposal.get("summary") or ""),
                "warnings": list(proposal.get("warnings") or []),
            },
        )
        validation = _validate_agent_draft(current, draft)
        draft = update_agent_draft(
            current.state_dir,
            draft["draft_id"],
            status="validated" if bool(validation.get("valid")) else "validation_failed",
            validation=validation,
            base_version=draft.get("base_version") or validation.get("base_version"),
        )
        job = update_agent_job(
            current.state_dir,
            job["job_id"],
            status="awaiting_approval",
            result={
                "draft_id": draft["draft_id"],
                "summary": proposal.get("summary"),
                "warnings": proposal.get("warnings") or [],
                "week_start_local": week_start_local,
            },
        )
        append_audit_event(
            current.state_dir,
            event_type="task.plan_next_week.completed",
            actor=actor,
            resource_kind="job",
            resource_id=job["job_id"],
            payload={"draft_id": draft["draft_id"]},
        )
        return {"status": "ok", "job": job, "draft": draft, "proposal": proposal}, 200
    except ValueError as exc:
        job = update_agent_job(current.state_dir, job["job_id"], status="failed", error=str(exc))
        return {"status": "error", "error": str(exc), "job": job}, 400
    except RuntimeError as exc:
        job = update_agent_job(current.state_dir, job["job_id"], status="failed", error=str(exc))
        return {"status": "error", "error": str(exc), "job": job}, 503


@app.post("/agent/tasks/bundle-create")
def agent_task_bundle_create_post() -> tuple[dict, int]:
    current = _effective_settings()
    access_error = _require_agent_control_access(current, scope="read")
    if access_error is not None:
        return access_error
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return {"status": "error", "error": "Request body must be a JSON object."}, 400
    user_request = str(body.get("request") or "").strip()
    if not user_request:
        return {"status": "error", "error": "request must be a non-empty string."}, 400

    actor = _agent_control_actor()
    requested_profile_id = str(body.get("profile_id") or "").strip().lower() or None
    requested_workout_id = str(body.get("workout_id") or "").strip().lower() or None
    job = create_agent_job(
        current.state_dir,
        task_kind="bundle_create",
        request_payload={
            "request": user_request,
            "profile_id": requested_profile_id,
            "workout_id": requested_workout_id,
        },
        requested_by=actor,
        source=str(body.get("source") or "agent-task"),
    )
    append_audit_event(
        current.state_dir,
        event_type="job.created",
        actor=actor,
        resource_kind="job",
        resource_id=str(job.get("job_id") or ""),
        payload={"task_kind": "bundle_create"},
    )
    try:
        update_agent_job(current.state_dir, job["job_id"], status="running")
        bundle = generate_bundle_create(
            current,
            user_request=user_request,
            chronicle_context=_build_bundle_context(current),
        )

        created_drafts: list[dict[str, Any]] = []
        if isinstance(bundle.get("profile_yaml"), str) and str(bundle.get("profile_yaml")).strip():
            profile_draft = create_agent_draft(
                current.state_dir,
                resource_kind="profile",
                payload={
                    "profile_id": requested_profile_id or body.get("profile_name") or "agent-generated-profile",
                    "yaml_text": str(bundle.get("profile_yaml") or ""),
                },
                title=f"Profile draft for {requested_profile_id or 'agent-generated-profile'}",
                requested_by=actor,
                source="agent-task-bundle-create",
                metadata={"summary": str(bundle.get("summary") or ""), "warnings": list(bundle.get("warnings") or [])},
            )
            profile_validation = _validate_agent_draft(current, profile_draft)
            profile_draft = update_agent_draft(
                current.state_dir,
                profile_draft["draft_id"],
                status="validated",
                validation=profile_validation,
            )
            created_drafts.append(profile_draft)
            if requested_profile_id is None:
                requested_profile_id = str(profile_validation.get("profile_id") or "").strip().lower() or None

        if isinstance(bundle.get("template_text"), str) and str(bundle.get("template_text")).strip():
            template_profile_id = requested_profile_id or str(get_working_template_profile(current).get("profile_id") or "default")
            template_draft = create_agent_draft(
                current.state_dir,
                resource_kind="template",
                payload={
                    "profile_id": template_profile_id,
                    "template": str(bundle.get("template_text") or ""),
                    "context_mode": "sample",
                    "allow_missing_profile": requested_profile_id is not None,
                },
                title=f"Template draft for {template_profile_id}",
                requested_by=actor,
                source="agent-task-bundle-create",
                metadata={"summary": str(bundle.get("summary") or ""), "warnings": list(bundle.get("warnings") or [])},
            )
            template_validation = _validate_agent_draft(current, template_draft)
            template_draft = update_agent_draft(
                current.state_dir,
                template_draft["draft_id"],
                status="validated" if bool(template_validation.get("valid")) else "validation_failed",
                validation=template_validation,
                base_version=template_validation.get("base_version"),
            )
            created_drafts.append(template_draft)

        if isinstance(bundle.get("workout_payload"), dict):
            workout_payload = dict(bundle.get("workout_payload") or {})
            if requested_workout_id and not workout_payload.get("workout_id") and not workout_payload.get("workout_code"):
                workout_payload["workout_id"] = requested_workout_id
            workout_draft = create_agent_draft(
                current.state_dir,
                resource_kind="workout",
                payload=workout_payload,
                title=f"Workout draft for {requested_workout_id or workout_payload.get('workout_id') or 'agent-generated-workout'}",
                requested_by=actor,
                source="agent-task-bundle-create",
                metadata={"summary": str(bundle.get("summary") or ""), "warnings": list(bundle.get("warnings") or [])},
            )
            workout_validation = _validate_agent_draft(current, workout_draft)
            workout_draft = update_agent_draft(
                current.state_dir,
                workout_draft["draft_id"],
                status="validated",
                validation=workout_validation,
            )
            created_drafts.append(workout_draft)

        job = update_agent_job(
            current.state_dir,
            job["job_id"],
            status="awaiting_approval",
            result={
                "draft_ids": [str(item.get("draft_id") or "") for item in created_drafts],
                "summary": str(bundle.get("summary") or ""),
                "warnings": list(bundle.get("warnings") or []),
            },
        )
        append_audit_event(
            current.state_dir,
            event_type="task.bundle_create.completed",
            actor=actor,
            resource_kind="job",
            resource_id=job["job_id"],
            payload={"draft_count": len(created_drafts)},
        )
        return {"status": "ok", "job": job, "drafts": created_drafts, "bundle": bundle}, 200
    except ValueError as exc:
        job = update_agent_job(current.state_dir, job["job_id"], status="failed", error=str(exc))
        return {"status": "error", "error": str(exc), "job": job}, 400
    except RuntimeError as exc:
        job = update_agent_job(current.state_dir, job["job_id"], status="failed", error=str(exc))
        return {"status": "error", "error": str(exc), "job": job}, 503


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
