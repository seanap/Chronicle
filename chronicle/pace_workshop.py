from __future__ import annotations

from typing import Any

DEFAULT_MARATHON_GOAL = "5:00:00"


_RACE_DISTANCE_OPTIONS = [
    ("1mi", "1mi", "mile"),
    ("2mi", "2mi", "2mi"),
    ("5k", "5k", "5k"),
    ("10k", "10k", "10k"),
    ("15k", "15k", "15k"),
    ("10mi", "10mi", "10mi"),
    ("hm", "HM", "hm"),
    ("marathon", "Marathon", "marathon"),
]

_DISTANCE_TO_COLUMN = {key: column for key, _label, column in _RACE_DISTANCE_OPTIONS}
_DISTANCE_LABELS = {key: label for key, label, _column in _RACE_DISTANCE_OPTIONS}

_DISTANCE_ALIASES = {
    "1mi": "1mi",
    "1mile": "1mi",
    "mile": "1mi",
    "mi": "1mi",
    "2mi": "2mi",
    "2mile": "2mi",
    "2miles": "2mi",
    "2-mile": "2mi",
    "5k": "5k",
    "10k": "10k",
    "15k": "15k",
    "10mi": "10mi",
    "10mile": "10mi",
    "10-mile": "10mi",
    "hm": "hm",
    "halfmarathon": "hm",
    "half-marathon": "hm",
    "half": "hm",
    "marathon": "marathon",
}

_RACE_EQUIVALENCY_RAW = [
    ("7:13", "15:24", "25:00", "51:56", "1:20:29", "1:27:01", "1:55:34", "2:19:07", "4:03:43"),
    ("7:04", "15:05", "24:30", "50:54", "1:18:52", "1:25:17", "1:53:15", "2:16:20", "3:58:51"),
    ("6:55", "14:47", "24:00", "49:51", "1:17:15", "1:23:32", "1:50:56", "2:13:33", "3:53:58"),
    ("6:47", "14:28", "23:30", "48:49", "1:15:39", "1:21:48", "1:48:38", "2:10:46", "3:49:06"),
    ("6:38", "14:10", "23:00", "47:47", "1:14:02", "1:20:03", "1:46:19", "2:07:59", "3:44:13"),
    ("6:29", "13:51", "22:30", "46:44", "1:12:26", "1:18:19", "1:44:00", "2:05:12", "3:39:21"),
    ("6:21", "13:33", "22:00", "45:42", "1:10:49", "1:16:34", "1:41:42", "2:02:25", "3:34:28"),
    ("6:12", "13:14", "21:30", "44:40", "1:09:13", "1:14:50", "1:39:23", "1:59:38", "3:29:36"),
    ("6:03", "12:56", "21:00", "43:37", "1:07:36", "1:13:06", "1:37:04", "1:56:51", "3:24:43"),
    ("5:55", "12:37", "20:30", "42:35", "1:05:59", "1:11:21", "1:34:46", "1:54:04", "3:19:51"),
    ("5:46", "12:19", "20:00", "41:33", "1:04:23", "1:09:37", "1:32:27", "1:51:17", "3:14:58"),
    ("5:37", "12:00", "19:30", "40:30", "1:02:46", "1:07:52", "1:30:08", "1:48:30", "3:10:06"),
    ("5:29", "11:42", "19:00", "39:28", "1:01:10", "1:06:08", "1:27:50", "1:45:43", "3:05:14"),
    ("5:20", "11:23", "18:30", "38:26", "59:33", "1:04:24", "1:25:31", "1:42:57", "3:00:21"),
    ("5:11", "11:05", "18:00", "37:24", "57:57", "1:02:39", "1:23:12", "1:40:10", "2:55:29"),
    ("5:03", "10:46", "17:30", "36:21", "56:20", "1:00:55", "1:20:54", "1:37:23", "2:50:36"),
    ("4:58", "10:37", "17:15", "35:50", "55:32", "1:00:02", "1:19:44", "1:35:59", "2:48:10"),
    ("4:54", "10:28", "17:00", "35:19", "54:43", "59:10", "1:18:35", "1:34:36", "2:45:44"),
    ("4:50", "10:19", "16:45", "34:48", "53:55", "58:18", "1:17:26", "1:33:12", "2:43:17"),
    ("4:45", "10:09", "16:30", "34:17", "53:07", "57:26", "1:16:16", "1:31:49", "2:40:51"),
    ("4:41", "10:00", "16:15", "33:45", "52:19", "56:34", "1:15:07", "1:30:25", "2:38:25"),
    ("4:37", "9:51", "16:00", "33:14", "51:30", "55:41", "1:13:58", "1:29:02", "2:35:59"),
    ("4:32", "9:42", "15:45", "32:43", "50:42", "54:49", "1:12:48", "1:27:38", "2:33:33"),
    ("4:28", "9:32", "15:30", "32:12", "49:54", "53:57", "1:11:39", "1:26:15", "2:31:06"),
    ("4:24", "9:23", "15:15", "31:41", "49:05", "53:05", "1:10:30", "1:24:51", "2:28:40"),
    ("4:19", "9:14", "15:00", "31:10", "48:17", "52:13", "1:09:20", "1:23:18", "2:26:14"),
    ("4:15", "9:05", "14:45", "30:38", "47:29", "51:20", "1:08:11", "1:22:05", "2:23:48"),
    ("4:11", "8:55", "14:30", "30:07", "46:41", "50:28", "1:07:02", "1:20:41", "2:21:21"),
    ("4:06", "8:46", "14:15", "29:36", "45:52", "49:36", "1:05:52", "1:19:18", "2:18:55"),
    ("4:02", "8:37", "14:00", "29:05", "45:04", "48:44", "1:04:43", "1:17:54", "2:16:29"),
    ("3:58", "8:28", "13:45", "28:34", "44:16", "47:52", "1:03:33", "1:16:31", "2:14:03"),
    ("3:53", "8:18", "13:30", "28:03", "43:27", "46:59", "1:02:24", "1:15:07", "2:11:36"),
]

_TRAINING_INTENSITY_RAW = [
    ("5:00:00", "2:24:00", "14:22", "13:32", "12:41", "12:16", "11:27", "11:17", "10:30", "10:04"),
    ("4:45:00", "2:17:00", "13:43", "12:55", "12:05", "11:41", "10:52", "10:42", "9:58", "9:34"),
    ("4:30:00", "2:10:00", "13:02", "12:16", "11:28", "11:05", "10:18", "10:08", "9:27", "9:04"),
    ("4:15:00", "2:02:00", "12:22", "11:38", "10:52", "10:29", "9:44", "9:34", "8:55", "8:33"),
    ("4:00:00", "1:55:00", "11:42", "11:00", "10:15", "9:53", "9:09", "8:59", "8:24", "8:03"),
    ("3:55:00", "1:53:00", "11:28", "10:40", "10:00", "9:38", "8:58", "8:48", "8:13", "7:53"),
    ("3:50:00", "1:50:00", "11:15", "10:34", "9:51", "9:29", "8:46", "8:36", "8:03", "7:43"),
    ("3:45:00", "1:48:00", "11:01", "10:21", "9:39", "9:18", "8:35", "8:25", "7:52", "7:33"),
    ("3:40:00", "1:45:00", "10:48", "10:08", "9:27", "9:06", "8:23", "8:13", "7:42", "7:23"),
    ("3:35:00", "1:43:00", "10:34", "9:55", "9:14", "8:53", "8:12", "8:02", "7:31", "7:13"),
    ("3:30:00", "1:41:00", "10:19", "9:41", "9:02", "8:42", "8:01", "7:51", "7:21", "7:03"),
    ("3:25:00", "1:38:00", "10:06", "9:28", "8:49", "8:29", "7:49", "7:39", "7:10", "6:53"),
    ("3:20:00", "1:36:00", "9:53", "9:16", "8:38", "8:18", "7:38", "7:28", "7:00", "6:43"),
    ("3:15:00", "1:33:30", "9:38", "9:02", "8:25", "8:05", "7:26", "7:16", "6:49", "6:33"),
    ("3:10:00", "1:31:00", "9:25", "8:49", "8:13", "7:54", "7:15", "7:05", "6:39", "6:23"),
    ("3:05:00", "1:29:00", "9:11", "8:36", "8:01", "7:42", "7:03", "6:53", "6:28", "6:12"),
    ("3:00:00", "1:26:00", "8:57", "8:23", "7:48", "7:29", "6:52", "6:42", "6:18", "6:02"),
    ("2:55:00", "1:24:00", "8:43", "8:10", "7:36", "7:17", "6:40", "6:30", "6:07", "5:52"),
    ("2:50:00", "1:21:30", "8:28", "7:56", "7:23", "7:05", "6:29", "6:19", "5:57", "5:42"),
    ("2:45:00", "1:19:00", "8:15", "7:43", "7:11", "6:53", "6:18", "6:08", "5:46", "5:32"),
    ("2:40:00", "1:17:00", "8:00", "7:30", "6:58", "6:41", "6:06", "5:56", "5:36", "5:22"),
    ("2:35:00", "1:14:00", "7:46", "7:17", "6:46", "6:29", "5:55", "5:45", "5:25", "5:12"),
    ("2:30:00", "1:12:00", "7:32", "7:03", "6:34", "6:17", "5:43", "5:33", "5:15", "5:02"),
    ("2:25:00", "1:09:30", "7:18", "6:50", "6:21", "6:05", "5:32", "5:22", "5:04", "4:52"),
    ("2:20:00", "1:07:00", "7:03", "6:36", "6:08", "5:52", "5:20", "5:10", "4:54", "4:42"),
    ("2:15:00", "1:04:45", "6:49", "6:23", "5:56", "5:40", "5:09", "4:59", "4:43", "4:32"),
    ("2:10:00", "1:02:30", "6:35", "6:09", "5:43", "5:28", "4:57", "4:47", "4:33", "4:22"),
]

_TRAINING_PACE_FIELDS = [
    ("recovery", "Recovery"),
    ("easy_a", "Easy A"),
    ("easy_b", "Easy B"),
    ("long_run", "Long Run"),
    ("marathon_pace", "Marathon Pace"),
    ("strength", "Strength"),
    ("10k", "10k"),
    ("5k", "5k"),
]

_RACE_DISTANCE_MILES = {
    "1mi": 1.0,
    "2mi": 2.0,
    "5k": 3.10686,
    "10k": 6.21371,
    "15k": 9.32057,
    "10mi": 10.0,
    "hm": 13.1094,
    "marathon": 26.21875,
}

_CANONICAL_PACE_TARGETS = [
    {
        "key": "recovery",
        "label": "Recovery",
        "kind": "exact",
        "source": "training",
        "field": "recovery",
        "aliases": ["recovery", "recover", "rec"],
    },
    {
        "key": "easy_a",
        "label": "Easy A",
        "kind": "exact",
        "source": "training",
        "field": "easy_a",
        "aliases": ["easy_a", "easya"],
    },
    {
        "key": "easy_b",
        "label": "Easy B",
        "kind": "exact",
        "source": "training",
        "field": "easy_b",
        "aliases": ["easy_b", "easyb", "steady"],
    },
    {
        "key": "easy",
        "label": "Easy",
        "kind": "range",
        "source": "training",
        "fields": ["easy_a", "easy_b"],
        "display_fields": ["easy_a", "easy_b"],
        "default_field": "easy_a",
        "aliases": ["easy", "e"],
    },
    {
        "key": "long_run",
        "label": "Long Run",
        "kind": "exact",
        "source": "training",
        "field": "long_run",
        "aliases": ["long_run", "longrun", "lr"],
    },
    {
        "key": "moderate",
        "label": "Moderate / Steady",
        "kind": "range",
        "source": "training",
        "fields": ["easy_b", "long_run"],
        "display_fields": ["easy_b", "long_run"],
        "default_field": "long_run",
        "aliases": ["moderate", "steady_plus", "ga", "general_aerobic", "aerobic", "lt1"],
    },
    {
        "key": "marathon_pace",
        "label": "Marathon Pace",
        "kind": "exact",
        "source": "training",
        "field": "marathon_pace",
        "aliases": ["marathon_pace", "marathon", "mp", "m", "goal_pace"],
    },
    {
        "key": "half_marathon_pace",
        "label": "Half Marathon Pace",
        "kind": "exact",
        "source": "race",
        "field": "hm",
        "aliases": ["half_marathon_pace", "half_marathon", "half", "hm", "hmp"],
    },
    {
        "key": "strength",
        "label": "Strength / LT",
        "kind": "exact",
        "source": "training",
        "field": "strength",
        "aliases": ["strength", "threshold", "tempo", "lt", "lt2", "t"],
    },
    {
        "key": "10k",
        "label": "10K Pace",
        "kind": "exact",
        "source": "training",
        "field": "10k",
        "aliases": ["10k", "10k_pace"],
    },
    {
        "key": "5k",
        "label": "5K Pace",
        "kind": "exact",
        "source": "training",
        "field": "5k",
        "aliases": ["5k", "5k_pace"],
    },
    {
        "key": "interval",
        "label": "Interval / VO2max",
        "kind": "range",
        "source": "training",
        "fields": ["10k", "5k"],
        "display_fields": ["10k", "5k"],
        "default_field": "10k",
        "aliases": ["interval", "vo2", "vo2max", "i"],
    },
    {
        "key": "mile",
        "label": "Mile / Repetition",
        "kind": "exact",
        "source": "race",
        "field": "1mi",
        "aliases": ["mile", "1mi", "repetition", "rep", "r"],
    },
]

_PACE_PLAN_FAMILIES = [
    {
        "key": "hansons",
        "label": "Hansons",
        "items": [
            {"label": "Recovery", "canonical_key": "recovery"},
            {"label": "Easy A", "canonical_key": "easy_a"},
            {"label": "Easy B", "canonical_key": "easy_b"},
            {"label": "LR", "canonical_key": "long_run"},
            {"label": "MP", "canonical_key": "marathon_pace"},
            {"label": "Strength", "canonical_key": "strength"},
            {"label": "HMP", "canonical_key": "half_marathon_pace"},
            {"label": "10k", "canonical_key": "10k"},
            {"label": "5k", "canonical_key": "5k"},
        ],
    },
    {
        "key": "pfitz",
        "label": "Pfitz",
        "items": [
            {"label": "Recovery", "canonical_key": "recovery"},
            {"label": "General Aerobic", "canonical_key": "easy"},
            {"label": "Endurance / Med-Long", "canonical_key": "long_run"},
            {"label": "Marathon Pace", "canonical_key": "marathon_pace"},
            {"label": "LT", "canonical_key": "strength"},
            {"label": "VO2max", "canonical_key": "interval"},
        ],
    },
    {
        "key": "jd",
        "label": "JD",
        "items": [
            {"label": "E", "canonical_key": "easy"},
            {"label": "M", "canonical_key": "marathon_pace"},
            {"label": "T", "canonical_key": "strength"},
            {"label": "I", "canonical_key": "interval"},
            {"label": "R", "canonical_key": "mile"},
        ],
    },
    {
        "key": "higdon",
        "label": "Higdon",
        "items": [
            {"label": "Easy / Conversation", "canonical_key": "easy"},
            {"label": "Pace", "canonical_key": "marathon_pace"},
            {
                "label": "Tempo",
                "canonical_key": "strength",
                "note": "Higdon often describes tempo near 10K effort. Chronicle defaults it onto Hansons strength/LT for consistency.",
            },
            {"label": "Intervals", "canonical_key": "mile"},
            {"label": "Long Run", "canonical_key": "long_run"},
        ],
    },
    {
        "key": "galloway",
        "label": "Galloway",
        "items": [
            {"label": "Easy Run-Walk", "canonical_key": "easy"},
            {"label": "Long Run", "canonical_key": "long_run"},
            {"label": "Race Rehearsal / Goal Pace", "canonical_key": "marathon_pace"},
            {"label": "Magic Mile 10K", "canonical_key": "10k"},
            {"label": "Magic Mile HM", "canonical_key": "half_marathon_pace"},
            {"label": "Magic Mile Marathon", "canonical_key": "marathon_pace"},
        ],
    },
    {
        "key": "run_type",
        "label": "Run Type",
        "items": [
            {"label": "Easy", "canonical_key": "easy"},
            {"label": "Tempo", "canonical_key": "strength"},
            {"label": "Threshold", "canonical_key": "strength"},
            {"label": "Speed", "canonical_key": "interval"},
            {"label": "Race Pace", "canonical_key": "marathon_pace"},
            {"label": "Long Run", "canonical_key": "long_run"},
        ],
    },
]


def _normalize_text(value: Any) -> str:
    return "".join(ch for ch in str(value or "").strip().lower() if ch.isalnum())


def parse_duration_to_seconds(value: Any) -> int:
    text = str(value or "").strip()
    if not text:
        raise ValueError("time is required.")
    parts = text.split(":")
    if len(parts) not in {2, 3}:
        raise ValueError("time must be MM:SS or H:MM:SS.")

    values: list[int] = []
    for part in parts:
        if not part.isdigit():
            raise ValueError("time must contain only numeric clock segments.")
        values.append(int(part, 10))

    if len(values) == 2:
        minutes, seconds = values
        hours = 0
        if seconds >= 60:
            raise ValueError("time seconds must be < 60.")
    else:
        hours, minutes, seconds = values
        if minutes >= 60 or seconds >= 60:
            raise ValueError("time minutes/seconds must be < 60 for H:MM:SS.")

    total = (hours * 3600) + (minutes * 60) + seconds
    if total <= 0:
        raise ValueError("time must be greater than zero.")
    return total


def format_duration(seconds: int, *, force_hours: bool = False) -> str:
    total = int(seconds)
    if total < 0:
        total = 0
    hours = total // 3600
    rem = total % 3600
    minutes = rem // 60
    secs = rem % 60
    if force_hours or hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def normalize_marathon_goal_time(value: Any) -> str:
    return format_duration(parse_duration_to_seconds(value), force_hours=True)


def normalize_race_distance(value: Any) -> str:
    key = _DISTANCE_ALIASES.get(_normalize_text(value))
    if not key:
        supported = ", ".join(item[0] for item in _RACE_DISTANCE_OPTIONS)
        raise ValueError(f"distance must be one of: {supported}.")
    return key


def supported_race_distances() -> list[dict[str, str]]:
    return [{"value": key, "label": label} for key, label, _column in _RACE_DISTANCE_OPTIONS]


def _build_race_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in _RACE_EQUIVALENCY_RAW:
        mile, two_mile, five_k, ten_k, fifteen_k, ten_mile, half_marathon, twenty_five_k, marathon = row
        row_obj = {
            "mile": mile,
            "2mi": two_mile,
            "5k": five_k,
            "10k": ten_k,
            "15k": fifteen_k,
            "10mi": ten_mile,
            "hm": half_marathon,
            "25k": twenty_five_k,
            "marathon": marathon,
        }
        row_obj["_seconds"] = {field: parse_duration_to_seconds(text) for field, text in row_obj.items()}
        rows.append(row_obj)
    rows.sort(key=lambda item: int(item["_seconds"]["marathon"]))
    return rows


def _build_training_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in _TRAINING_INTENSITY_RAW:
        (
            marathon_goal,
            half_marathon_goal,
            recovery,
            easy_a,
            easy_b,
            long_run,
            marathon_pace,
            strength,
            ten_k,
            five_k,
        ) = row
        row_obj = {
            "marathon_goal": marathon_goal,
            "half_marathon_goal": half_marathon_goal,
            "recovery": recovery,
            "easy_a": easy_a,
            "easy_b": easy_b,
            "long_run": long_run,
            "marathon_pace": marathon_pace,
            "strength": strength,
            "10k": ten_k,
            "5k": five_k,
        }
        row_obj["_seconds"] = {
            "marathon_goal": parse_duration_to_seconds(marathon_goal),
            "half_marathon_goal": parse_duration_to_seconds(half_marathon_goal),
            "recovery": parse_duration_to_seconds(recovery),
            "easy_a": parse_duration_to_seconds(easy_a),
            "easy_b": parse_duration_to_seconds(easy_b),
            "long_run": parse_duration_to_seconds(long_run),
            "marathon_pace": parse_duration_to_seconds(marathon_pace),
            "strength": parse_duration_to_seconds(strength),
            "10k": parse_duration_to_seconds(ten_k),
            "5k": parse_duration_to_seconds(five_k),
        }
        rows.append(row_obj)
    rows.sort(key=lambda item: int(item["_seconds"]["marathon_goal"]))
    return rows


_RACE_ROWS = _build_race_rows()
_TRAINING_ROWS = _build_training_rows()
_PACE_TARGET_SPECS_BY_KEY = {str(item["key"]): item for item in _CANONICAL_PACE_TARGETS}


def _normalize_pace_alias(value: Any) -> str:
    text = str(value or "").strip().lower()
    if text.startswith("$"):
        text = text[1:]
    if text.startswith("p(") and text.endswith(")"):
        text = text[2:-1].strip()
        if text.startswith("$"):
            text = text[1:]
    return "".join(ch for ch in text if ch.isalnum())


_PACE_ALIAS_INDEX = {}
for _spec in _CANONICAL_PACE_TARGETS:
    for _alias in _spec.get("aliases") or []:
        normalized_alias = _normalize_pace_alias(_alias)
        if normalized_alias:
            _PACE_ALIAS_INDEX[normalized_alias] = str(_spec["key"])
    _PACE_ALIAS_INDEX[_normalize_pace_alias(_spec["key"])] = str(_spec["key"])


def _nearest_row(rows: list[dict[str, Any]], *, field: str, target_seconds: int) -> dict[str, Any]:
    return min(rows, key=lambda item: abs(int(item["_seconds"][field]) - int(target_seconds)))


def _format_pace_seconds(seconds: int) -> str:
    return format_duration(int(round(seconds)))


def _seconds_for_race_pace(row: dict[str, Any], field: str) -> int:
    column = _DISTANCE_TO_COLUMN.get(field, field)
    race_time = int(row["_seconds"][column])
    miles = float(_RACE_DISTANCE_MILES[field])
    return int(round(race_time / miles))


def _race_row_for_goal(goal_seconds: int) -> dict[str, Any]:
    return _nearest_row(_RACE_ROWS, field="marathon", target_seconds=goal_seconds)


def _seconds_from_source(
    *,
    spec: dict[str, Any],
    training_row: dict[str, Any],
    race_row: dict[str, Any],
    field: str,
) -> int:
    if spec.get("source") == "race":
        return _seconds_for_race_pace(race_row, field)
    return int(training_row["_seconds"][field])


def _build_exact_resolution(
    spec: dict[str, Any],
    *,
    training_row: dict[str, Any],
    race_row: dict[str, Any],
) -> dict[str, Any]:
    field = str(spec["field"])
    seconds = _seconds_from_source(spec=spec, training_row=training_row, race_row=race_row, field=field)
    pace = _format_pace_seconds(seconds)
    return {
        "key": str(spec["key"]),
        "label": str(spec["label"]),
        "kind": "exact",
        "source": str(spec.get("source") or "training"),
        "pace": pace,
        "pace_seconds": seconds,
        "display": pace,
        "fast_pace": pace,
        "fast_pace_seconds": seconds,
        "slow_pace": pace,
        "slow_pace_seconds": seconds,
        "default_pace": pace,
        "default_pace_seconds": seconds,
        "aliases": list(spec.get("aliases") or []),
        "preferred_token": str((spec.get("aliases") or [spec["key"]])[0]),
        "garmin_target": {
            "target_type": "pace",
            "pace_kind": "exact",
            "fast_seconds_per_mile": seconds,
            "slow_seconds_per_mile": seconds,
            "fast_pace": pace,
            "slow_pace": pace,
        },
    }


def _build_range_resolution(
    spec: dict[str, Any],
    *,
    training_row: dict[str, Any],
    race_row: dict[str, Any],
) -> dict[str, Any]:
    fields = [str(item) for item in spec.get("fields") or [] if str(item or "").strip()]
    if not fields:
        raise ValueError(f"Range pace target missing fields: {spec.get('key')}")
    values = [
        _seconds_from_source(spec=spec, training_row=training_row, race_row=race_row, field=field)
        for field in fields
    ]
    slow_seconds = max(values)
    fast_seconds = min(values)
    default_field = str(spec.get("default_field") or fields[0])
    default_seconds = _seconds_from_source(spec=spec, training_row=training_row, race_row=race_row, field=default_field)
    display_fields = [str(item) for item in spec.get("display_fields") or fields]
    display_values = [
        _seconds_from_source(spec=spec, training_row=training_row, race_row=race_row, field=field)
        for field in display_fields
    ]
    display = " to ".join(_format_pace_seconds(value) for value in display_values)
    return {
        "key": str(spec["key"]),
        "label": str(spec["label"]),
        "kind": "range",
        "source": str(spec.get("source") or "training"),
        "pace": _format_pace_seconds(default_seconds),
        "pace_seconds": default_seconds,
        "display": display,
        "fast_pace": _format_pace_seconds(fast_seconds),
        "fast_pace_seconds": fast_seconds,
        "slow_pace": _format_pace_seconds(slow_seconds),
        "slow_pace_seconds": slow_seconds,
        "default_pace": _format_pace_seconds(default_seconds),
        "default_pace_seconds": default_seconds,
        "aliases": list(spec.get("aliases") or []),
        "preferred_token": str((spec.get("aliases") or [spec["key"]])[0]),
        "garmin_target": {
            "target_type": "pace",
            "pace_kind": "range",
            "fast_seconds_per_mile": fast_seconds,
            "slow_seconds_per_mile": slow_seconds,
            "fast_pace": _format_pace_seconds(fast_seconds),
            "slow_pace": _format_pace_seconds(slow_seconds),
        },
    }


def _build_canonical_pace_catalog(training_row: dict[str, Any], race_row: dict[str, Any]) -> list[dict[str, Any]]:
    catalog: list[dict[str, Any]] = []
    for spec in _CANONICAL_PACE_TARGETS:
        if str(spec.get("kind") or "exact") == "range":
            catalog.append(_build_range_resolution(spec, training_row=training_row, race_row=race_row))
            continue
        catalog.append(_build_exact_resolution(spec, training_row=training_row, race_row=race_row))
    return catalog


def _build_plan_family_equivalencies(catalog: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    families: list[dict[str, Any]] = []
    for family in _PACE_PLAN_FAMILIES:
        items: list[dict[str, Any]] = []
        for item in family.get("items") or []:
            canonical_key = str(item.get("canonical_key") or "")
            resolved = catalog.get(canonical_key)
            if not resolved:
                continue
            items.append(
                {
                    "label": str(item.get("label") or canonical_key),
                    "canonical_key": canonical_key,
                    "canonical_label": str(resolved.get("label") or canonical_key),
                    "display": str(resolved.get("display") or resolved.get("pace") or "--"),
                    "default_pace": str(resolved.get("default_pace") or resolved.get("pace") or "--"),
                    "kind": str(resolved.get("kind") or "exact"),
                    "preferred_token": str(resolved.get("preferred_token") or canonical_key),
                    "note": str(item.get("note") or ""),
                }
            )
        families.append(
            {
                "key": str(family.get("key") or ""),
                "label": str(family.get("label") or ""),
                "items": items,
            }
        )
    return families


def resolve_pace_reference(goal_time: Any, reference: Any) -> dict[str, Any]:
    normalized_goal = normalize_marathon_goal_time(goal_time)
    target_seconds = parse_duration_to_seconds(normalized_goal)
    training_row = _nearest_row(_TRAINING_ROWS, field="marathon_goal", target_seconds=target_seconds)
    matched_goal_seconds = int(training_row["_seconds"]["marathon_goal"])
    race_row = _race_row_for_goal(matched_goal_seconds)
    catalog = {item["key"]: item for item in _build_canonical_pace_catalog(training_row, race_row)}
    alias = _normalize_pace_alias(reference)
    canonical_key = _PACE_ALIAS_INDEX.get(alias)
    if not canonical_key:
        supported = ", ".join(sorted({alias for spec in _CANONICAL_PACE_TARGETS for alias in spec.get("aliases") or []}))
        raise ValueError(f"Unsupported pace token: {reference}. Supported tokens include: {supported}.")
    resolved = catalog[canonical_key]
    return {
        "input": str(reference or "").strip(),
        "canonical_key": canonical_key,
        "canonical_label": str(resolved.get("label") or canonical_key),
        **resolved,
        "matched_marathon_goal": str(training_row["marathon_goal"]),
    }


def training_paces_for_goal(goal_time: Any) -> dict[str, Any]:
    target = parse_duration_to_seconds(goal_time)
    row = _nearest_row(_TRAINING_ROWS, field="marathon_goal", target_seconds=target)
    race_row = _race_row_for_goal(int(row["_seconds"]["marathon_goal"]))
    paces = [
        {
            "key": key,
            "label": label,
            "pace": str(row[key]),
        }
        for key, label in _TRAINING_PACE_FIELDS
    ]
    canonical_paces = _build_canonical_pace_catalog(row, race_row)
    canonical_lookup = {item["key"]: item for item in canonical_paces}
    return {
        "input_marathon_goal": normalize_marathon_goal_time(goal_time),
        "matched_marathon_goal": str(row["marathon_goal"]),
        "matched_half_marathon_goal": str(row["half_marathon_goal"]),
        "paces": paces,
        "canonical_paces": canonical_paces,
        "plan_families": _build_plan_family_equivalencies(canonical_lookup),
    }


def calculate_race_equivalency(distance: Any, race_time: Any) -> dict[str, Any]:
    normalized_distance = normalize_race_distance(distance)
    distance_column = _DISTANCE_TO_COLUMN[normalized_distance]
    input_seconds = parse_duration_to_seconds(race_time)
    race_row = _nearest_row(_RACE_ROWS, field=distance_column, target_seconds=input_seconds)

    derived_marathon = str(race_row["marathon"])
    training = training_paces_for_goal(derived_marathon)

    race_equivalency = [
        {"distance": key, "label": _DISTANCE_LABELS[key], "time": str(race_row[column])}
        for key, _label, column in _RACE_DISTANCE_OPTIONS
    ]

    return {
        "input": {
            "distance": normalized_distance,
            "distance_label": _DISTANCE_LABELS[normalized_distance],
            "time": format_duration(input_seconds, force_hours=(input_seconds >= 3600)),
        },
        "matched_distance_time": str(race_row[distance_column]),
        "matched_distance_delta_seconds": abs(int(race_row["_seconds"][distance_column]) - int(input_seconds)),
        "derived_marathon_goal": derived_marathon,
        "race_equivalency": race_equivalency,
        "training": training,
    }
