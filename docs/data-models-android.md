# Data Models (Android)

**Part:** android
**Primary data:** `/plan/today.json` payload from backend

## PlanToday
`PlanToday` is the core model used by widgets:

- `dateLocal: String`
- `runType: String`
- `miles: Double`
- `workoutShorthand: String?`

Parsed in `PlanTodayRepository.parse()` from JSON returned by `/plan/today.json`.

## Local Persistence
- Cached raw JSON stored in `SharedPreferences` (`Constants.KEY_LAST_JSON`).
- Last sync timestamp stored as `KEY_LAST_SYNC_MS`.
- Base URL stored via `ConfigStore` (`Constants.KEY_BASE_URL`).

No local database is used; caching is preference-based.

---
_Source: `PlanToday.kt`, `PlanTodayRepository.kt`, `ConfigStore.kt`_ 
