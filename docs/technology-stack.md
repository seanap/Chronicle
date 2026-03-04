# Technology Stack

## Part: backend

| Category | Technology | Version | Justification |
| --- | --- | --- | --- |
| Language | Python | 3.x (inferred) | `requirements.txt` present, Python runtime implied |
| Web Framework | Flask | 3.1.0 | `requirements.txt` includes `Flask==3.1.0` |
| WSGI Server | Gunicorn | 22.0.0 | `requirements.txt` includes `gunicorn==22.0.0` |
| HTTP Client | requests | 2.32.3 | `requirements.txt` includes `requests==2.32.3` |
| Config | python-dotenv | 1.0.1 | `requirements.txt` includes `python-dotenv==1.0.1` |
| External API Client | garminconnect | 0.2.28 | `requirements.txt` includes `garminconnect==0.2.28` |
| Containerization | Docker | N/A | `Dockerfile` present |
| Orchestration | Docker Compose | N/A | `docker-compose.yml` present |

## Part: android

| Category | Technology | Version | Justification |
| --- | --- | --- | --- |
| Language | Kotlin | N/A | `build.gradle.kts` / `settings.gradle.kts` present |
| Build System | Gradle | N/A | Gradle Kotlin DSL files present |
| Platform | Android SDK | N/A | `AndroidManifest.xml` present |
| App Module | Android app | N/A | `android/app` module detected |
