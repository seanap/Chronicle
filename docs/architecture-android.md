# Architecture - Android

## Executive Summary
The Android companion app provides home-screen widgets that display the current day’s plan. It fetches `/plan/today.json` from the backend, caches the response, and renders it via `RemoteViews`.

## Technology Stack
- Kotlin
- Android SDK
- WorkManager
- OkHttp

## Architecture Pattern
- Native Android app with widget providers and a small config activity.

## Data Architecture
- No local database.
- Caches JSON payloads and settings in SharedPreferences.

## API Design
- Consumes backend endpoint: `GET /plan/today.json`.
- Opens `/plan` in browser when widgets are tapped.

## Component Overview
- `MainActivity` — config screen
- `PlanTodayRepository` — network + cache
- `PlanTodaySyncWorker` — background refresh
- `WidgetRenderService` — widget rendering
- `MilesWidgetProvider` / `TodayDetailWidgetProvider` — widget entry points

## Source Tree
See `docs/source-tree-analysis.md`.

## Development Workflow
- Open `android/` in Android Studio and run the `app` module.
- Set backend base URL in the app’s settings.

## Deployment Architecture
- Built with Gradle; release artifacts produced by GitHub Actions and published to Releases.

## Testing Strategy
- No explicit Android test suite found in repo.

---
_Source: android/app/src/main/java/com/chronicle/widget/*, android/app/src/main/res/*
