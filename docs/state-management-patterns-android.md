# State Management Patterns (Android)

**Part:** android

## Local State
- **SharedPreferences** is the main persistence mechanism for configuration and cache:
  - Base URL (`Constants.KEY_BASE_URL`)
  - Cached `/plan/today.json` payload (`Constants.KEY_LAST_JSON`)
  - Last sync timestamp (`Constants.KEY_LAST_SYNC_MS`)

## Data Flow
- `PlanTodayRepository` fetches and caches remote JSON payloads.
- `WidgetRenderService` renders widgets using current cached/remote model.
- `PlanTodaySyncWorker` runs periodic background refreshes (WorkManager).

## Scheduling / Background Work
- Work scheduled via WorkManager (`PlanTodaySyncWorker`).
- Boot receiver and widget action receiver coordinate refresh triggers.

---
_Source: `ConfigStore.kt`, `PlanTodayRepository.kt`, `PlanTodaySyncWorker.kt`, `WidgetRenderService.kt`_ 
