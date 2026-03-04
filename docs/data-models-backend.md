# Data Models (Backend)

**Part:** backend
**Storage:** SQLite runtime DB + JSON files (state dir)
**Primary schema source:** `chronicle/storage.py`

## SQLite Runtime Database
The backend maintains a SQLite runtime database (default `state/runtime_state.db`) with the following tables:

### processed_activities
- **PK:** `activity_id` (text)
- Tracks processed Strava activity IDs with `processed_at_utc`

### runtime_kv
- **PK:** `key` (text)
- Key/value JSON store for runtime state
- Fields: `value_json`, `updated_at_utc`

### runtime_locks
- **PK:** `lock_name` (text)
- Used for distributed locking
- Fields: `owner`, `acquired_at_utc`, `expires_at_utc`

### activities
- **PK:** `activity_id` (text)
- Strava activity registry
- Fields: `first_seen_at_utc`, `last_seen_at_utc`, `sport_type`, `start_date_utc`, `updated_at_utc`

### jobs
- **PK:** `job_id` (text)
- Foreign key: `activity_id` → `activities.activity_id`
- Tracks processing requests, priority, retries, and status

### runs
- **PK:** `run_id` (text)
- Foreign keys: `job_id` → `jobs.job_id`, `activity_id` → `activities.activity_id`
- Tracks individual execution attempts

### activity_state
- **PK:** `activity_id` (text)
- Foreign key: `activity_id` → `activities.activity_id`
- Last known description/template state, last job/run, error info

### config_snapshots
- **PK:** `snapshot_id` (text)
- Stores configuration payload snapshots with `created_at_utc`

### plan_days
- **PK:** `date_local` (text)
- Daily plan entries (run type, planned/actual miles, notes, completion)

### plan_sessions
- **PK:** `session_id` (text)
- Foreign key: `date_local` → `plan_days.date_local`
- Multi-session breakdown per day, planned/actual miles, workout code

### plan_settings
- **PK:** `key` (text)
- Stores plan configuration such as `pace_workshop.marathon_goal`

## JSON/Filesystem Data
- **Processed log file:** `state/processed_activities.log` fallback log
- **Latest payload:** `state/latest_activity.json`
- **Strava tokens:** `state/strava_tokens.json`
- **Description template:** `state/description_template.j2`

## Relationships Summary
- `activities` 1→many `jobs` and `runs`
- `plan_days` 1→many `plan_sessions`
- `activity_state` references `activities`

---
_Source: `chronicle/storage.py`, `chronicle/config.py`_ 
