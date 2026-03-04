# Development Instructions

## Backend
- **Prerequisites:** Python 3.x, Docker (optional)
- **Install:** `pip install -r requirements.txt`
- **Run API:** `python -m chronicle.api_server`
- **Run Worker:** `python -m chronicle.worker`
- **Tests:** `pytest`
- **Env:** copy `.env.example` → `.env`, then configure via `/setup` UI

## Android
- **Prerequisites:** Android Studio, Android SDK
- **Build/Run:** Open `android/` in Android Studio and run the `app` module
- **Config:** set base URL in app settings to reach backend

## References
- `docs/development-guide-backend.md`
- `docs/development-guide-android.md`
