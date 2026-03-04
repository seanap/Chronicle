---
project_name: 'Auto-Stat-Description'
user_name: 'boss'
date: '2026-02-25'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 38
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- Current runtime: Python 3.x, Flask 3.1.0, Gunicorn 22.0.0
- Current deps: requests 2.32.3, python-dotenv 1.0.1, garminconnect 0.2.28
- Data/validation (per architecture): SQLAlchemy Core 2.0.46, Alembic 1.18.4, Pydantic 2.12.5
- Frontend SPA (planned per architecture): React 19.2, React Router 7.13.0, MUI 7.3.7, Vite 7.2.6
- Android module: Kotlin + Gradle (versions not specified)
- Infra: Docker, Docker Compose
- Version constraints: no additional hard pins beyond the versions listed above

## Critical Implementation Rules

### Language-Specific Rules (Python)

- Keep Python modules and functions in `snake_case`; keep tests named `test_*.py`.
- Use SQLAlchemy Core query style; do not introduce ORM patterns unless explicitly approved.
- Respect pinned dependency versions in `requirements.txt`; avoid upgrades unless requested.

### Framework-Specific Rules

- Backend is Flask with REST JSON.
- Error responses must use `{error: {code, message, details}}`.
- API JSON keys must use `snake_case`.
- Frontend SPA (planned) uses feature-first structure (`features/*`), shared UI in `components/`, hooks in `hooks/`, API in `api/`.
- Use React Context + hooks first; introduce heavier state libraries only if explicitly approved.

### Testing Rules

- Keep Python tests in `tests/` and name files `test_*.py`.
- Preserve contract-style tests for API/UI payloads (`*_contract.py`); update alongside API changes.
- Prefer fixtures and direct module tests; avoid heavy mocking.
- Do not make live network calls in unit tests.
- If tests are flaky, fix the flake rather than skipping.

### Code Quality & Style Rules

- Keep backend code in `chronicle/` and tests in `tests/`.
- Avoid adding new folders under `chronicle/` without a clear domain reason; match existing module patterns.
- If no formatter is configured, match surrounding style closely.

### Development Workflow Rules

- Source of truth: `docs/github-as-memory.md` (follow it for GitHub-as-memory workflows).
- Must ask permission before any `gh`, `git`, or Docker Hub commands.
- Branch naming: `type/<ISSUE>-short-kebab` (or `type/short-kebab` for tiny no-issue changes).
- PR title / squash commit: `type(scope): description` (conventional commits).
- Do not paste long logs into chat; store in GitHub and summarize.
- Use Recall Protocol on “resume/continue/pick up” requests.

### Critical Don't-Miss Rules

- Do not change existing endpoint paths or add `/api/v1` prefixes.
- Do not break response shapes without coordinating all consumers (SPA + Android widget).
- Backend is source of truth; do not compute authoritative metrics in the frontend.
- Do not log secrets/tokens or store secrets in repo; use `.env`/local state only.
- Do not introduce auth/CSRF unless explicitly requested (local-only assumption).
- Do not bypass `chronicle/services/` for domain logic; keep `api_server.py` thin.
- Keep worker/pipeline actions idempotent and retry-safe.
- Do not add expensive aggregates without cache invalidation tied to plan edits/reruns.
- Do not “relax” contract tests just to pass; fix code or update contracts when behavior changes.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow all rules exactly as documented.
- When in doubt, prefer the more restrictive option.
- Update this file if new patterns emerge.

**For Humans:**

- Keep this file lean and focused on agent needs.
- Update when the technology stack changes.
- Review quarterly for outdated rules.
- Remove rules that become obvious over time.

Last Updated: 2026-02-25
