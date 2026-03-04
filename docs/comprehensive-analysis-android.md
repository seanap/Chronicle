# Comprehensive Analysis (Android)

**Part:** android

## Configuration Management
- Base URL stored in `SharedPreferences` via `ConfigStore`.
- Defaults to `Constants.DEFAULT_BASE_URL` if not set.

## Authentication / Security
- No client-side auth; consumes local backend endpoints.

## Entry Points
- `MainActivity` is the app entry.
- App widgets registered via `AndroidManifest.xml`.

## Shared Code / Utilities
- `PlanTodayRepository` handles network fetch + cache.
- `WidgetRenderService` renders `RemoteViews` updates.
- `ConfigStore` centralizes preferences.

## Async / Event Patterns
- `PlanTodaySyncWorker` uses WorkManager for periodic background refresh.
- `WidgetActionReceiver` handles manual refresh intent.
- `BootCompletedReceiver` reinitializes schedules on device boot.

## CI/CD
- Android release workflow in `.github/workflows/android-widget-release.yml`.

## Deployment
- Build via Gradle (`build.gradle.kts`). APKs released through GitHub Releases.

## Localization
- No i18n/locales directories detected (only default `strings.xml`).

---
_Source: `android/app/src/main/java/com/chronicle/widget/*`, `.github/workflows/android-widget-release.yml`, `AndroidManifest.xml`_ 
