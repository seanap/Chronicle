from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from hashlib import sha1
from pathlib import Path
import re
from typing import Any

import yaml

from .pace_workshop import resolve_pace_reference
from .storage import get_plan_setting, set_plan_setting

LEGACY_WORKOUT_SETTINGS_KEY = "workout_workshop.definitions"
DEFAULT_LIBRARY = "Run Type"
DEFAULT_WORKOUT_TYPE = "run"
DEFAULT_RUN_TYPE = "SOS"
WORKOUT_TYPE_LABELS = {
    "run": "Run",
    "bike": "Bike",
    "pool_swim": "Pool Swim",
    "multisport": "Multisport",
    "strength": "Strength Training",
    "cardio": "Cardio",
    "hiit": "HIIT",
    "yoga": "Yoga",
    "pilates": "Pilates",
    "mobility": "Mobility",
    "custom": "Custom",
}
WORKOUT_LIBRARY_ORDER = [
    "Hansons",
    "Pfitz",
    "Higdon",
    "JD",
    "Galloway",
    "Strength",
    "Stretching",
    "Run Type",
    "Other",
]
_WORKOUT_TOP_LEVEL_KEYS = {
    "workout_id",
    "label",
    "library",
    "workout_type",
    "run_type_default",
    "shorthand",
    "tags",
    "notes",
    "source_workout_id",
}
_GARMIN_WORKOUT_TOP_LEVEL_KEYS = {
    "workout",
    "workout_id",
    "library",
    "run_type_default",
    "tags",
    "notes",
    "source_workout_id",
}
_GARMIN_WORKOUT_RESERVED_KEYS = {
    "type",
    "name",
    "steps",
}
_REPEAT_BLOCK_RE = re.compile(
    r"^(?P<count>\d+)x(?P<work>.+?)(?:\s+(?:w/(?:ith)?|/)\s+(?P<recovery>.+))?$",
    re.IGNORECASE,
)
_REPEAT_KEY_RE = re.compile(r"^repeat\((?P<count>\d+)\)$", re.IGNORECASE)
_PACE_TARGET_RE = re.compile(r"^P\((?P<token>.+)\)$", re.IGNORECASE)
_HR_TARGET_RE = re.compile(r"^H\((?P<zone>[^)]+)\)$", re.IGNORECASE)
_SAMPLE_WORKOUTS = [
    {
        "workout_id": "hansons-strength-8mi",
        "label": "Hansons Strength 8 mi",
        "library": "Hansons",
        "workout_type": "run",
        "run_type_default": "SOS",
        "structured_steps": [
            {"kind": "step", "step_type": "warmup", "duration": "2mi", "target": "H(z2)"},
            {
                "kind": "repeat",
                "count": 3,
                "steps": [
                    {"kind": "step", "step_type": "run", "duration": "2mi", "target": "P($strength)"},
                    {"kind": "step", "step_type": "recovery", "duration": "800m", "target": ""},
                ],
            },
            {"kind": "step", "step_type": "cooldown", "duration": "2mi", "target": "H(z2)"},
        ],
        "shorthand": "WU 2mi @H(z2) + 3x2mi @P($strength) w/ 800m rec + 2mi CD @H(z2)",
        "tags": ["threshold"],
        "notes": "Sample Hansons-style strength workout.",
        "source_workout_id": "",
    },
    {
        "workout_id": "pfitz-lt-5mi",
        "label": "Pfitz LT 5 mi",
        "library": "Pfitz",
        "workout_type": "run",
        "run_type_default": "SOS",
        "structured_steps": [
            {"kind": "step", "step_type": "warmup", "duration": "2mi", "target": "H(z2)"},
            {"kind": "step", "step_type": "run", "duration": "5mi", "target": "P($threshold)"},
            {"kind": "step", "step_type": "cooldown", "duration": "2mi", "target": "H(z2)"},
        ],
        "shorthand": "WU 2mi @H(z2) + 5mi @P($threshold) + 2mi CD @H(z2)",
        "tags": ["threshold"],
        "notes": "Sample Pfitz lactate threshold session.",
        "source_workout_id": "",
    },
    {
        "workout_id": "higdon-progressive-long",
        "label": "Higdon Progressive Long",
        "library": "Higdon",
        "workout_type": "run",
        "run_type_default": "SOS",
        "structured_steps": [
            {"kind": "step", "step_type": "warmup", "duration": "4mi", "target": "H(z2)"},
            {"kind": "step", "step_type": "run", "duration": "6mi", "target": "P($moderate)"},
            {"kind": "step", "step_type": "cooldown", "duration": "2mi", "target": "H(z2)"},
        ],
        "shorthand": "WU 4mi @H(z2) + 6mi @P($moderate) + 2mi CD @H(z2)",
        "tags": ["long-run"],
        "notes": "Sample Higdon long run with progression finish.",
        "source_workout_id": "",
    },
    {
        "workout_id": "jd-5x1k-threshold",
        "label": "JD 5 x 1k Threshold",
        "library": "JD",
        "workout_type": "run",
        "run_type_default": "SOS",
        "structured_steps": [
            {"kind": "step", "step_type": "warmup", "duration": "2mi", "target": "H(z2)"},
            {
                "kind": "repeat",
                "count": 5,
                "steps": [
                    {"kind": "step", "step_type": "run", "duration": "1km", "target": "P($threshold)"},
                    {"kind": "step", "step_type": "recovery", "duration": "90sec", "target": ""},
                ],
            },
            {"kind": "step", "step_type": "cooldown", "duration": "2mi", "target": "H(z2)"},
        ],
        "shorthand": "WU 2mi @H(z2) + 5x1km @P($threshold) w/ 90sec rec + 2mi CD @H(z2)",
        "tags": ["threshold"],
        "notes": "Sample Daniels threshold repeat session.",
        "source_workout_id": "",
    },
    {
        "workout_id": "galloway-run-walk-12mi",
        "label": "Galloway Run-Walk 12 mi",
        "library": "Galloway",
        "workout_type": "run",
        "run_type_default": "SOS",
        "structured_steps": [
            {"kind": "step", "step_type": "warmup", "duration": "lap", "target": "H(z2)"},
            {
                "kind": "repeat",
                "count": 12,
                "steps": [
                    {"kind": "step", "step_type": "run", "duration": "4min", "target": "P($easy)"},
                    {"kind": "step", "step_type": "recovery", "duration": "1min", "target": ""},
                ],
            },
            {"kind": "step", "step_type": "cooldown", "duration": "lap", "target": "H(z2)"},
        ],
        "shorthand": "WU lap @H(z2) + 12x4min @P($easy) w/ 1min rec + lap CD @H(z2)",
        "tags": ["run-walk"],
        "notes": "Sample Galloway long aerobic run.",
        "source_workout_id": "",
    },
    {
        "workout_id": "run-type-tempo-20",
        "label": "Run Type Tempo 20",
        "library": "Run Type",
        "workout_type": "run",
        "run_type_default": "SOS",
        "structured_steps": [
            {"kind": "step", "step_type": "warmup", "duration": "2mi", "target": "H(z2)"},
            {"kind": "step", "step_type": "run", "duration": "20min", "target": "P($tempo)"},
            {"kind": "step", "step_type": "cooldown", "duration": "2mi", "target": "H(z2)"},
        ],
        "shorthand": "WU 2mi @H(z2) + 20min @P($tempo) + 2mi CD @H(z2)",
        "tags": ["tempo"],
        "notes": "Sample generic tempo workout.",
        "source_workout_id": "",
    },
    {
        "workout_id": "strength-general-circuit",
        "label": "Strength General Circuit",
        "library": "Strength",
        "workout_type": "strength",
        "run_type_default": "SOS",
        "structured_steps": [
            {"kind": "step", "step_type": "other", "duration": "10min mobility", "target": ""},
            {
                "kind": "repeat",
                "count": 3,
                "steps": [
                    {"kind": "step", "step_type": "other", "duration": "8 split squat", "target": ""},
                    {"kind": "step", "step_type": "other", "duration": "10 deadlift", "target": ""},
                    {"kind": "step", "step_type": "other", "duration": "30sec plank", "target": ""},
                ],
            },
        ],
        "shorthand": "10min mobility + 3x[8 split squat / 10 deadlift / 30sec plank]",
        "tags": ["strength"],
        "notes": "Sample strength circuit.",
        "source_workout_id": "",
    },
    {
        "workout_id": "stretching-reset-15",
        "label": "Stretching Reset 15",
        "library": "Stretching",
        "workout_type": "mobility",
        "run_type_default": "SOS",
        "structured_steps": [
            {"kind": "step", "step_type": "other", "duration": "15min mobility flow", "target": ""},
        ],
        "shorthand": "15min mobility flow",
        "tags": ["mobility"],
        "notes": "Sample stretching reset.",
        "source_workout_id": "",
    },
]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _workout_definitions_dir(path: Path) -> Path:
    return path.parent / "workout_definitions"


def _workout_definition_path(path: Path, workout_id: str) -> Path:
    safe = _normalize_workout_id(workout_id)
    if not safe:
        raise ValueError("workout_id is required.")
    return _workout_definitions_dir(path) / f"{safe}.yaml"


def _normalize_workout_id(raw_value: Any) -> str:
    text = str(raw_value or "").strip().lower()
    text = re.sub(r"[^a-z0-9_-]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:80]


def _normalize_workout_label(raw_value: Any, *, fallback: str) -> str:
    label = str(raw_value or "").strip()
    return (label or fallback)[:160]


def _normalize_workout_library(raw_value: Any) -> str:
    text = str(raw_value or "").strip()
    if not text:
        return DEFAULT_LIBRARY
    normalized = " ".join(part for part in text.replace("_", " ").split() if part)
    lowered = normalized.lower()
    aliases = {
        "jack daniels": "JD",
        "daniels": "JD",
        "pfitzinger": "Pfitz",
        "run type": "Run Type",
        "runtype": "Run Type",
    }
    if lowered in aliases:
        return aliases[lowered]
    for option in WORKOUT_LIBRARY_ORDER:
        if lowered == option.lower():
            return option
    return normalized.title() if normalized else DEFAULT_LIBRARY


def _normalize_workout_type(raw_value: Any) -> str:
    text = " ".join(part for part in str(raw_value or DEFAULT_WORKOUT_TYPE).strip().lower().replace("_", " ").split() if part)
    aliases = {
        "run": "run",
        "bike": "bike",
        "pool swim": "pool_swim",
        "poolswim": "pool_swim",
        "multisport": "multisport",
        "strength": "strength",
        "strength training": "strength",
        "cardio": "cardio",
        "hiit": "hiit",
        "yoga": "yoga",
        "pilates": "pilates",
        "mobility": "mobility",
        "stretching": "mobility",
        "custom": "custom",
    }
    return aliases.get(text, DEFAULT_WORKOUT_TYPE)


def _display_workout_type(workout_type: Any) -> str:
    normalized = _normalize_workout_type(workout_type)
    return WORKOUT_TYPE_LABELS.get(normalized, WORKOUT_TYPE_LABELS[DEFAULT_WORKOUT_TYPE])


def _normalize_run_type_default(raw_value: Any) -> str:
    text = str(raw_value or DEFAULT_RUN_TYPE).strip().upper()
    return text or DEFAULT_RUN_TYPE


def _normalize_tags(raw_value: Any) -> list[str]:
    if raw_value is None:
        return []
    values = raw_value if isinstance(raw_value, list) else [raw_value]
    normalized: list[str] = []
    seen: set[str] = set()
    for item in values:
        text = str(item or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(text[:60])
    return normalized


def _collapse_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip())


def _normalize_step_type(raw_value: Any) -> str:
    text = " ".join(part for part in str(raw_value or "").strip().lower().replace("_", " ").split() if part)
    aliases = {
        "warmup": "warmup",
        "warm up": "warmup",
        "run": "run",
        "recovery": "recovery",
        "recover": "recovery",
        "rest": "rest",
        "cooldown": "cooldown",
        "cool down": "cooldown",
        "other": "other",
    }
    normalized = aliases.get(text)
    if not normalized:
        raise ValueError(f"Unsupported workout step type: {raw_value}")
    return normalized


def _canonicalize_shorthand(raw_value: Any) -> str:
    text = _collapse_spaces(raw_value)
    if not text:
        raise ValueError("shorthand is required.")
    blocks = [part.strip() for part in text.split("+") if part.strip()]
    if not blocks:
        raise ValueError("shorthand must include at least one workout block.")
    normalized_blocks: list[str] = []
    for block in blocks:
        cleaned = _collapse_spaces(block)
        cleaned = re.sub(r"\s*@\s*", " @", cleaned)
        cleaned = re.sub(r"\s*w/\s*", " w/ ", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        normalized_blocks.append(cleaned)
    return " + ".join(normalized_blocks)


def _parse_shorthand_piece(piece: str) -> dict[str, Any]:
    raw = _collapse_spaces(piece)
    if not raw:
        raise ValueError("Workout piece cannot be empty.")

    target = ""
    base = raw
    if "@" in raw:
        left, right = raw.split("@", 1)
        base = _collapse_spaces(left)
        target = _collapse_spaces(right)

    compact_match = re.match(
        r"^(?P<amount>\d+(?:\.\d+)?)(?P<intensity>LT1|LT2|WU|CD|HMP|MP|RP|CV|E|T|M|I|R|S)$",
        base,
        re.IGNORECASE,
    )
    if compact_match:
        return {
            "raw": raw,
            "amount": compact_match.group("amount"),
            "unit": "auto",
            "intensity": compact_match.group("intensity").upper(),
            "target": target,
            "kind": "piece",
        }

    generic_match = re.match(
        r"^(?P<amount>\d+(?:\.\d+)?(?::\d{2})?)(?P<unit>km|mi|m|min|sec|s)?(?:\s+(?P<intensity>.+))?$",
        base,
        re.IGNORECASE,
    )
    if generic_match:
        amount = generic_match.group("amount") or ""
        unit = str(generic_match.group("unit") or "").lower()
        intensity = _collapse_spaces(generic_match.group("intensity") or "")
        if ":" in amount and not unit:
            unit = "time"
        elif not unit:
            unit = "auto"
        return {
            "raw": raw,
            "amount": amount,
            "unit": unit,
            "intensity": intensity,
            "target": target,
            "kind": "piece",
        }

    return {
        "raw": raw,
        "amount": "",
        "unit": "literal",
        "intensity": "",
        "target": target,
        "kind": "literal",
    }


def parse_workout_shorthand(raw_value: Any) -> dict[str, Any]:
    shorthand = _canonicalize_shorthand(raw_value)
    blocks: list[dict[str, Any]] = []
    for block_text in [part.strip() for part in shorthand.split("+") if part.strip()]:
        repeat_match = _REPEAT_BLOCK_RE.match(block_text)
        if repeat_match:
            blocks.append(
                {
                    "kind": "repeat",
                    "raw": block_text,
                    "count": int(repeat_match.group("count")),
                    "work": _parse_shorthand_piece(repeat_match.group("work") or ""),
                    "recovery": (
                        _parse_shorthand_piece(repeat_match.group("recovery"))
                        if repeat_match.group("recovery")
                        else None
                    ),
                }
            )
            continue
        blocks.append(
            {
                "kind": "step",
                "raw": block_text,
                "piece": _parse_shorthand_piece(block_text),
            }
        )
    return {
        "shorthand": shorthand,
        "blocks": blocks,
    }


def _split_step_expression(raw_value: Any) -> tuple[str, str]:
    raw = _collapse_spaces(raw_value)
    if not raw:
        raise ValueError("Workout step expression cannot be empty.")
    duration = raw
    target = ""
    if "@" in raw:
        duration_text, target_text = raw.split("@", 1)
        duration = _collapse_spaces(duration_text)
        target = _collapse_spaces(target_text)
    if not duration:
        raise ValueError("Workout step duration is required.")
    return duration, target


def _parse_structured_steps(raw_steps: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_steps, list) or not raw_steps:
        raise ValueError("Workout steps must be a non-empty array.")
    steps: list[dict[str, Any]] = []
    for item in raw_steps:
        if not isinstance(item, dict) or len(item) != 1:
            raise ValueError("Each workout step must be a single-key object.")
        step_key, step_value = next(iter(item.items()))
        repeat_match = _REPEAT_KEY_RE.match(str(step_key or "").strip())
        if repeat_match:
            if not isinstance(step_value, list):
                raise ValueError(f"{step_key} must contain a list of nested steps.")
            steps.append(
                {
                    "kind": "repeat",
                    "count": int(repeat_match.group("count")),
                    "steps": _parse_structured_steps(step_value),
                }
            )
            continue
        step_type = _normalize_step_type(step_key)
        duration, target = _split_step_expression(step_value)
        steps.append(
            {
                "kind": "step",
                "step_type": step_type,
                "duration": duration,
                "target": target,
            }
        )
    return steps


def _structured_step_to_yaml_item(step: dict[str, Any]) -> dict[str, Any]:
    if str(step.get("kind") or "") == "repeat":
        return {
            f"repeat({int(step.get('count') or 0)})": [
                _structured_step_to_yaml_item(item)
                for item in (step.get("steps") or [])
                if isinstance(item, dict)
            ]
        }
    step_type = str(step.get("step_type") or "other")
    duration = _collapse_spaces(step.get("duration") or "")
    target = _collapse_spaces(step.get("target") or "")
    expression = duration
    if target:
        expression = f"{duration} @{target}".strip()
    return {step_type: expression}


def _structured_steps_to_yaml_list(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_structured_step_to_yaml_item(step) for step in steps if isinstance(step, dict)]


def _structured_step_to_shorthand(step: dict[str, Any]) -> str:
    kind = str(step.get("kind") or "step")
    if kind == "repeat":
        count = int(step.get("count") or 0)
        children = [item for item in (step.get("steps") or []) if isinstance(item, dict)]
        if len(children) == 2 and str(children[1].get("step_type") or "") in {"recovery", "rest"}:
            work_text = _structured_step_to_shorthand(children[0])
            recovery_text = _structured_step_to_shorthand(children[1])
            return f"{count}x{work_text} w/ {recovery_text}".strip()
        child_text = " / ".join(_structured_step_to_shorthand(item) for item in children)
        return f"{count}x[{child_text}]".strip()

    step_type = str(step.get("step_type") or "other")
    duration = _collapse_spaces(step.get("duration") or "")
    target = _collapse_spaces(step.get("target") or "")
    suffix = f" @{target}" if target else ""
    if step_type == "warmup":
        return f"WU {duration}{suffix}".strip()
    if step_type == "cooldown":
        return f"{duration} CD{suffix}".strip()
    if step_type == "recovery":
        duration_lower = duration.lower()
        if any(token in duration_lower for token in ["rec", "jog", "easy"]) or duration.endswith(" E"):
            return f"{duration}{suffix}".strip()
        return f"{duration} rec{suffix}".strip()
    if step_type == "rest":
        return f"{duration} rest{suffix}".strip()
    return f"{duration}{suffix}".strip()


def _structured_steps_to_shorthand(steps: list[dict[str, Any]]) -> str:
    blocks = [_structured_step_to_shorthand(step) for step in steps if isinstance(step, dict)]
    return " + ".join(block for block in blocks if block)


def resolve_workout_target_reference(raw_target: Any, marathon_goal: Any) -> dict[str, Any] | None:
    text = _collapse_spaces(raw_target)
    if not text:
        return None
    pace_match = _PACE_TARGET_RE.match(text)
    if pace_match:
        token = _collapse_spaces(pace_match.group("token") or "")
        try:
            resolved = resolve_pace_reference(marathon_goal, token)
            return {
                "raw": text,
                "kind": "pace",
                "token": token,
                "display": str(resolved.get("display") or resolved.get("pace") or "--"),
                "canonical_key": str(resolved.get("canonical_key") or ""),
                "canonical_label": str(resolved.get("canonical_label") or ""),
                "garmin_target": dict(resolved.get("garmin_target") or {}),
                "error": "",
            }
        except ValueError as exc:
            return {
                "raw": text,
                "kind": "pace",
                "token": token,
                "display": "",
                "canonical_key": "",
                "canonical_label": "",
                "garmin_target": {},
                "error": str(exc),
            }
    hr_match = _HR_TARGET_RE.match(text)
    if hr_match:
        zone = _collapse_spaces(hr_match.group("zone") or "").upper()
        return {
            "raw": text,
            "kind": "heart_rate_zone",
            "token": zone,
            "display": f"HR {zone}",
            "canonical_key": "",
            "canonical_label": "",
            "garmin_target": {
                "target_type": "heart_rate_zone",
                "zone": zone,
            },
            "error": "",
        }
    return {
        "raw": text,
        "kind": "custom",
        "token": text,
        "display": text,
        "canonical_key": "",
        "canonical_label": "",
        "garmin_target": {},
        "error": "",
    }


def collect_workout_target_references(record: dict[str, Any], marathon_goal: Any) -> list[dict[str, Any]]:
    steps = record.get("structured_steps")
    if not isinstance(steps, list):
        return []
    results: list[dict[str, Any]] = []
    seen: set[str] = set()

    def walk(items: list[dict[str, Any]]) -> None:
        for item in items:
            if not isinstance(item, dict):
                continue
            if str(item.get("kind") or "") == "repeat":
                nested = item.get("steps")
                if isinstance(nested, list):
                    walk(nested)
                continue
            target = _collapse_spaces(item.get("target") or "")
            if not target or target in seen:
                continue
            seen.add(target)
            resolved = resolve_workout_target_reference(target, marathon_goal)
            if resolved is not None:
                results.append(resolved)

    walk(steps)
    return results


def _split_target_from_raw(raw: str) -> tuple[str, str]:
    text = _collapse_spaces(raw)
    if "@" not in text:
        return text, ""
    left, right = text.split("@", 1)
    return _collapse_spaces(left), _collapse_spaces(right)


def _step_from_text(raw: str, *, default_step_type: str = "run") -> dict[str, Any]:
    base, target = _split_target_from_raw(raw)
    base_upper = base.upper()
    if base_upper.startswith("WU "):
        return {"kind": "step", "step_type": "warmup", "duration": _collapse_spaces(base[3:]), "target": target}
    cooldown_match = re.match(r"^(?P<duration>.+?)\s+CD$", base, re.IGNORECASE)
    if cooldown_match:
        return {"kind": "step", "step_type": "cooldown", "duration": _collapse_spaces(cooldown_match.group("duration")), "target": target}
    recovery_match = re.match(r"^(?P<duration>.+?)\s+rec$", base, re.IGNORECASE)
    if recovery_match:
        return {"kind": "step", "step_type": "recovery", "duration": _collapse_spaces(recovery_match.group("duration")), "target": target}
    rest_match = re.match(r"^(?P<duration>.+?)\s+rest$", base, re.IGNORECASE)
    if rest_match:
        return {"kind": "step", "step_type": "rest", "duration": _collapse_spaces(rest_match.group("duration")), "target": target}
    duration = base or "lap"
    return {"kind": "step", "step_type": default_step_type, "duration": duration, "target": target}


def _structured_steps_from_shorthand(raw_value: Any) -> list[dict[str, Any]]:
    parsed = parse_workout_shorthand(raw_value)
    steps: list[dict[str, Any]] = []
    for block in parsed["blocks"]:
        if str(block.get("kind") or "") == "repeat":
            work = block.get("work") or {}
            recovery = block.get("recovery")
            repeat_steps = [_step_from_text(str(work.get("raw") or ""), default_step_type="run")]
            if isinstance(recovery, dict):
                repeat_steps.append(_step_from_text(str(recovery.get("raw") or ""), default_step_type="recovery"))
            steps.append(
                {
                    "kind": "repeat",
                    "count": int(block.get("count") or 0),
                    "steps": repeat_steps,
                }
            )
            continue
        steps.append(_step_from_text(str(block.get("raw") or ""), default_step_type="run"))
    return steps


def _parse_garmin_workout_payload(
    payload: dict[str, Any],
    *,
    workout_id: str | None = None,
    workout_name: str | None = None,
) -> dict[str, Any]:
    extra_keys = sorted(key for key in payload.keys() if key not in _GARMIN_WORKOUT_TOP_LEVEL_KEYS)
    if extra_keys:
        raise ValueError(f"Unsupported top-level workout keys: {', '.join(extra_keys)}")
    workout_payload = payload.get("workout")
    if not isinstance(workout_payload, dict):
        raise ValueError("Workout YAML must include a workout object.")
    workout_type = _normalize_workout_type(workout_payload.get("type"))
    if not workout_payload.get("type"):
        raise ValueError("workout.type is required.")

    step_name = ""
    raw_steps = workout_payload.get("steps")
    if isinstance(raw_steps, list):
        step_name = str(workout_payload.get("name") or workout_name or "").strip()
    else:
        dynamic_keys = [
            key
            for key in workout_payload.keys()
            if key not in _GARMIN_WORKOUT_RESERVED_KEYS
        ]
        if len(dynamic_keys) != 1:
            raise ValueError("Workout YAML must define steps under workout.steps or a single named workout key.")
        step_name = str(dynamic_keys[0] or "").strip()
        raw_steps = workout_payload.get(dynamic_keys[0])
    steps = _parse_structured_steps(raw_steps)
    label = _normalize_workout_label(step_name, fallback=str(workout_name or workout_id or "Workout"))
    target_id = _normalize_workout_id(payload.get("workout_id") or workout_id or label)
    if not target_id:
        raise ValueError("Unable to determine workout_id.")
    shorthand = _structured_steps_to_shorthand(steps)
    return {
        "workout_id": target_id,
        "workout_code": target_id,
        "label": label,
        "title": label,
        "library": _normalize_workout_library(payload.get("library")),
        "workout_type": workout_type,
        "run_type_default": _normalize_run_type_default(payload.get("run_type_default")),
        "shorthand": shorthand,
        "structure": shorthand,
        "parsed_shorthand": deepcopy(parse_workout_shorthand(shorthand)),
        "structured_steps": deepcopy(steps),
        "tags": _normalize_tags(payload.get("tags")),
        "notes": str(payload.get("notes") or "").strip(),
        "source_workout_id": _normalize_workout_id(payload.get("source_workout_id")),
    }


def _workout_record_for_yaml(record: dict[str, Any]) -> dict[str, Any]:
    structured_steps = record.get("structured_steps")
    if not isinstance(structured_steps, list) or not structured_steps:
        shorthand = str(record.get("shorthand") or "").strip()
        structured_steps = _structured_steps_from_shorthand(shorthand) if shorthand else []
    payload: dict[str, Any] = {
        "library": str(record.get("library") or DEFAULT_LIBRARY),
        "run_type_default": str(record.get("run_type_default") or DEFAULT_RUN_TYPE),
        "workout": {
            "type": _display_workout_type(record.get("workout_type")),
            str(record.get("label") or record.get("workout_id") or "Workout"): _structured_steps_to_yaml_list(structured_steps),
        },
    }
    tags = _normalize_tags(record.get("tags"))
    if tags:
        payload["tags"] = tags
    notes = str(record.get("notes") or "").strip()
    if notes:
        payload["notes"] = notes
    source_workout_id = str(record.get("source_workout_id") or "").strip()
    if source_workout_id:
        payload["source_workout_id"] = source_workout_id
    return payload


def _workout_sort_key(record: dict[str, Any]) -> tuple[int, str, str]:
    library = str(record.get("library") or DEFAULT_LIBRARY)
    try:
        index = WORKOUT_LIBRARY_ORDER.index(library)
    except ValueError:
        index = len(WORKOUT_LIBRARY_ORDER)
    return (
        index,
        str(record.get("label") or record.get("workout_id") or "").lower(),
        str(record.get("workout_id") or "").lower(),
    )


def _read_yaml_file(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError):
        return None
    if isinstance(payload, dict):
        return payload
    return None


def _write_yaml_file(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(yaml.safe_dump(payload, sort_keys=False, allow_unicode=True), encoding="utf-8")
    tmp.replace(path)


def _parse_workout_yaml_text(yaml_text: str) -> dict[str, Any]:
    text = str(yaml_text or "").strip()
    if not text:
        raise ValueError("yaml_text is required.")
    try:
        payload = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise ValueError(f"Invalid YAML: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError("Workout YAML must be an object.")
    return payload


def parse_workout_yaml_document(
    yaml_text: str,
    *,
    workout_id: str | None = None,
    workout_name: str | None = None,
) -> dict[str, Any]:
    payload = _parse_workout_yaml_text(yaml_text)
    if "workout" in payload:
        return _parse_garmin_workout_payload(payload, workout_id=workout_id, workout_name=workout_name)
    extra_keys = sorted(key for key in payload.keys() if key not in _WORKOUT_TOP_LEVEL_KEYS)
    if extra_keys:
        raise ValueError(f"Unsupported top-level workout keys: {', '.join(extra_keys)}")
    target_id = _normalize_workout_id(payload.get("workout_id") or workout_id or workout_name)
    if not target_id:
        raise ValueError("workout_id is required in YAML or workout_name.")
    shorthand_data = parse_workout_shorthand(payload.get("shorthand"))
    label = _normalize_workout_label(payload.get("label"), fallback=target_id.replace("-", " ").title())
    return {
        "workout_id": target_id,
        "workout_code": target_id,
        "label": label,
        "title": label,
        "library": _normalize_workout_library(payload.get("library")),
        "workout_type": _normalize_workout_type(payload.get("workout_type")),
        "run_type_default": _normalize_run_type_default(payload.get("run_type_default")),
        "shorthand": shorthand_data["shorthand"],
        "structure": shorthand_data["shorthand"],
        "parsed_shorthand": deepcopy(shorthand_data),
        "structured_steps": _structured_steps_from_shorthand(shorthand_data["shorthand"]),
        "tags": _normalize_tags(payload.get("tags")),
        "notes": str(payload.get("notes") or "").strip(),
        "source_workout_id": _normalize_workout_id(payload.get("source_workout_id")),
    }


def _legacy_records(path: Path) -> list[dict[str, Any]]:
    raw = get_plan_setting(path, LEGACY_WORKOUT_SETTINGS_KEY, [])
    if not isinstance(raw, list):
        return []
    legacy: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        shorthand = str(item.get("structure") or item.get("shorthand") or "").strip()
        workout_code = _normalize_workout_id(item.get("workout_code"))
        if not workout_code or not shorthand:
            continue
        legacy.append(
            {
                "workout_id": workout_code,
                "label": _normalize_workout_label(item.get("title"), fallback=workout_code.replace("-", " ").title()),
                "library": DEFAULT_LIBRARY,
                "workout_type": DEFAULT_WORKOUT_TYPE,
                "run_type_default": DEFAULT_RUN_TYPE,
                "shorthand": _canonicalize_shorthand(shorthand),
                "tags": [],
                "notes": "",
                "source_workout_id": "",
            }
        )
    return legacy


def _migrate_legacy_definitions(path: Path) -> None:
    root = _workout_definitions_dir(path)
    existing_yaml = list(root.glob("*.yaml")) if root.exists() else []
    if existing_yaml:
        return
    for record in _legacy_records(path):
        target = _workout_definition_path(path, record["workout_id"])
        if target.exists():
            continue
        _write_yaml_file(target, _workout_record_for_yaml(record))


def _seed_sample_workouts(path: Path) -> None:
    root = _workout_definitions_dir(path)
    existing_yaml = list(root.glob("*.yaml")) if root.exists() else []
    sample_ids = {_normalize_workout_id(record.get("workout_id")) for record in _SAMPLE_WORKOUTS}
    if any(_normalize_workout_id(item.stem) not in sample_ids for item in existing_yaml):
        return
    for record in _SAMPLE_WORKOUTS:
        target = _workout_definition_path(path, str(record.get("workout_id") or ""))
        _write_yaml_file(target, _workout_record_for_yaml(record))


def list_workout_definitions(path: Path) -> list[dict[str, Any]]:
    _migrate_legacy_definitions(path)
    _seed_sample_workouts(path)
    root = _workout_definitions_dir(path)
    if not root.exists():
        return []
    records: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for workout_path in sorted(root.glob("*.yaml")):
        workout_id = _normalize_workout_id(workout_path.stem)
        if not workout_id:
            continue
        try:
            parsed = parse_workout_yaml_document(workout_path.read_text(encoding="utf-8"), workout_id=workout_id)
            parsed["created_at_utc"] = _utc_now_iso()
            parsed["updated_at_utc"] = datetime.fromtimestamp(workout_path.stat().st_mtime, tz=timezone.utc).replace(microsecond=0).isoformat()
            parsed["source_path"] = str(workout_path)
            parsed["read_only"] = False
            parsed["invalid"] = False
            parsed["load_error"] = ""
        except (OSError, ValueError) as exc:
            parsed = {
                "workout_id": workout_id,
                "workout_code": workout_id,
                "label": workout_id.replace("-", " ").title(),
                "title": workout_id.replace("-", " ").title(),
                "library": "Other",
                "workout_type": DEFAULT_WORKOUT_TYPE,
                "run_type_default": DEFAULT_RUN_TYPE,
                "shorthand": "",
                "structure": "",
                "parsed_shorthand": {"shorthand": "", "blocks": []},
                "tags": [],
                "notes": "",
                "source_workout_id": "",
                "created_at_utc": _utc_now_iso(),
                "updated_at_utc": _utc_now_iso(),
                "source_path": str(workout_path),
                "read_only": False,
                "invalid": True,
                "load_error": str(exc),
            }
        if workout_id in seen_ids:
            continue
        seen_ids.add(workout_id)
        records.append(parsed)
    records.sort(key=_workout_sort_key)
    return records


def get_workout_definition(path: Path, workout_id: str) -> dict[str, Any] | None:
    target = _normalize_workout_id(workout_id)
    if not target:
        return None
    for workout in list_workout_definitions(path):
        if str(workout.get("workout_id") or "") == target:
            return workout
    return None


def get_workout_definition_document(path: Path, workout_id: str) -> dict[str, Any]:
    record = get_workout_definition(path, workout_id)
    if record is None:
        raise ValueError(f"Unknown workout_id: {workout_id}")
    workout_path = _workout_definition_path(path, str(record.get("workout_id") or workout_id))
    if bool(record.get("invalid")):
        yaml_text = workout_path.read_text(encoding="utf-8") if workout_path.exists() else ""
    else:
        normalized_payload = _workout_record_for_yaml(record)
        yaml_text = yaml.safe_dump(normalized_payload, sort_keys=False, allow_unicode=True)
        if not workout_path.exists() or workout_path.read_text(encoding="utf-8") != yaml_text:
            _write_yaml_file(workout_path, normalized_payload)
    return {
        "workout": record,
        "yaml_text": yaml_text,
        "source_path": str(workout_path),
        "read_only": False,
        "storage_format": "yaml",
        "invalid": bool(record.get("invalid")),
        "load_error": str(record.get("load_error") or ""),
    }


def create_workout_definition_from_yaml(
    path: Path,
    *,
    yaml_text: str,
    workout_name: str | None = None,
) -> dict[str, Any]:
    payload = parse_workout_yaml_document(yaml_text, workout_name=workout_name)
    existing = get_workout_definition(path, payload["workout_id"])
    if existing is not None:
        raise ValueError(f"Workout already exists: {payload['workout_id']}")
    _write_yaml_file(_workout_definition_path(path, payload["workout_id"]), _workout_record_for_yaml(payload))
    return get_workout_definition_document(path, payload["workout_id"])


def save_workout_definition_yaml(path: Path, workout_id: str, *, yaml_text: str) -> dict[str, Any]:
    existing = get_workout_definition(path, workout_id)
    if existing is None:
        raise ValueError(f"Unknown workout_id: {workout_id}")
    payload = parse_workout_yaml_document(yaml_text, workout_id=workout_id)
    target = _normalize_workout_id(payload.get("workout_id") or workout_id)
    if target != _normalize_workout_id(workout_id):
        raise ValueError("workout_id in YAML must match the selected workout.")
    _write_yaml_file(_workout_definition_path(path, target), _workout_record_for_yaml(payload))
    return get_workout_definition_document(path, target)


def upsert_workout_definition(path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")
    shorthand = str(payload.get("shorthand") or payload.get("structure") or "").strip()
    workout_id = _normalize_workout_id(payload.get("workout_id") or payload.get("workout_code"))
    if not workout_id:
        raise ValueError("workout_id is required.")
    record = {
        "workout_id": workout_id,
        "label": _normalize_workout_label(payload.get("label") or payload.get("title"), fallback=workout_id.replace("-", " ").title()),
        "library": _normalize_workout_library(payload.get("library")),
        "workout_type": _normalize_workout_type(payload.get("workout_type")),
        "run_type_default": _normalize_run_type_default(payload.get("run_type_default")),
        "shorthand": _canonicalize_shorthand(shorthand),
        "structured_steps": _structured_steps_from_shorthand(shorthand),
        "tags": _normalize_tags(payload.get("tags")),
        "notes": str(payload.get("notes") or "").strip(),
        "source_workout_id": _normalize_workout_id(payload.get("source_workout_id")),
    }
    _write_yaml_file(_workout_definition_path(path, workout_id), _workout_record_for_yaml(record))
    return get_workout_definition(path, workout_id) or record


def _find_workout_by_shorthand(path: Path, shorthand: str) -> dict[str, Any] | None:
    canonical = _canonicalize_shorthand(shorthand)
    for workout in list_workout_definitions(path):
        if bool(workout.get("invalid")):
            continue
        if str(workout.get("shorthand") or "") == canonical:
            return workout
    return None


def _derived_workout_id(path: Path, *, shorthand: str, base_workout: dict[str, Any] | None) -> str:
    canonical = _canonicalize_shorthand(shorthand)
    if base_workout is not None:
        base = _normalize_workout_id(base_workout.get("workout_id") or base_workout.get("label"))
    else:
        base = _normalize_workout_id(canonical[:48]) or "workout"
    digest = sha1(canonical.encode("utf-8")).hexdigest()[:8]
    candidate = f"{base}-var-{digest}" if not base.endswith(f"-var-{digest}") else base
    if get_workout_definition(path, candidate) is None:
        return candidate
    return candidate


def _derived_workout_record(
    path: Path,
    *,
    shorthand: str,
    base_workout: dict[str, Any] | None = None,
) -> dict[str, Any]:
    canonical = _canonicalize_shorthand(shorthand)
    existing = _find_workout_by_shorthand(path, canonical)
    if existing is not None:
        return existing

    base_label = str(base_workout.get("label") or "") if isinstance(base_workout, dict) else ""
    label = f"{base_label} Variant".strip() if base_label else canonical[:100]
    if not label:
        label = "Derived Workout"
    record = {
        "workout_id": _derived_workout_id(path, shorthand=canonical, base_workout=base_workout),
        "label": label[:160],
        "library": _normalize_workout_library(base_workout.get("library") if isinstance(base_workout, dict) else DEFAULT_LIBRARY),
        "workout_type": _normalize_workout_type(base_workout.get("workout_type") if isinstance(base_workout, dict) else DEFAULT_WORKOUT_TYPE),
        "run_type_default": _normalize_run_type_default(base_workout.get("run_type_default") if isinstance(base_workout, dict) else DEFAULT_RUN_TYPE),
        "shorthand": canonical,
        "structured_steps": _structured_steps_from_shorthand(canonical),
        "tags": _normalize_tags(base_workout.get("tags") if isinstance(base_workout, dict) else []),
        "notes": str(base_workout.get("notes") or "").strip() if isinstance(base_workout, dict) else "",
        "source_workout_id": str(base_workout.get("workout_id") or "").strip() if isinstance(base_workout, dict) else "",
    }
    _write_yaml_file(_workout_definition_path(path, record["workout_id"]), _workout_record_for_yaml(record))
    return get_workout_definition(path, record["workout_id"]) or record


def resolve_session_workout(
    path: Path,
    *,
    workout_code: str | None = None,
    planned_workout: str | None = None,
    run_type: str | None = None,
) -> dict[str, Any]:
    run_type_value = str(run_type or "").strip().upper()
    shorthand = str(planned_workout or "").strip()
    current_id = _normalize_workout_id(workout_code)

    if run_type_value != DEFAULT_RUN_TYPE:
        return {
            "workout_code": "",
            "planned_workout": "",
            "workout": None,
        }

    if not shorthand and current_id:
        existing = get_workout_definition(path, current_id)
        if existing is not None and not bool(existing.get("invalid")):
            return {
                "workout_code": str(existing.get("workout_id") or ""),
                "planned_workout": str(existing.get("shorthand") or ""),
                "workout": existing,
            }

    if not shorthand:
        return {
            "workout_code": "",
            "planned_workout": "",
            "workout": None,
        }

    canonical = _canonicalize_shorthand(shorthand)
    if current_id:
        existing = get_workout_definition(path, current_id)
        if existing is not None and str(existing.get("shorthand") or "") == canonical:
            return {
                "workout_code": str(existing.get("workout_id") or ""),
                "planned_workout": str(existing.get("shorthand") or ""),
                "workout": existing,
            }
    else:
        existing = _find_workout_by_shorthand(path, canonical)
        if existing is not None:
            return {
                "workout_code": str(existing.get("workout_id") or ""),
                "planned_workout": str(existing.get("shorthand") or ""),
                "workout": existing,
            }

    base_workout = get_workout_definition(path, current_id) if current_id else None
    derived = _derived_workout_record(path, shorthand=canonical, base_workout=base_workout)
    return {
        "workout_code": str(derived.get("workout_id") or ""),
        "planned_workout": str(derived.get("shorthand") or ""),
        "workout": derived,
    }
