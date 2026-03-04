# Development Guide (Android)

**Part:** android

## Prerequisites
- Android Studio (or Gradle + JDK)
- Android SDK

## Build / Run
- Open `android/` in Android Studio.
- Build the `app` module.
- Configure base URL in the app (settings screen).

## Widgets
- Widgets read `/plan/today.json` from the configured base URL.
- WorkManager sync handles periodic refresh.

## Release
- GitHub Actions workflow: `.github/workflows/android-widget-release.yml`.
- APK artifacts published via GitHub Releases.

---
_Source: android module + docs_ 
