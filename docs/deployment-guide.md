# Deployment Guide

## Docker (recommended)
- Build/run: `docker compose up -d --build`
- Exposes service on `http://localhost:1609`
- The Docker image is built from the repo checkout.
- The MPA routes are the product routes and should be the primary deployment target.

## Deploying Updates

When frontend or backend code changes, rebuild the image from the repo checkout:

```bash
git pull
docker compose up -d --build
```

Then verify the product routes:

```bash
curl -I http://127.0.0.1:1609/dashboard
curl -I http://127.0.0.1:1609/plan
curl -I http://127.0.0.1:1609/editor
curl -I http://127.0.0.1:1609/setup
curl -I http://127.0.0.1:1609/control
```

All five should return `200`.

## Dockge Deployment

### Recommended mode: build from the server checkout
Use this when your Dockge stack directory contains the Chronicle repo.

1. Keep the stack pointed at this repo directory so Docker has the full build context.
2. Copy `.env.example` to `.env` and fill in your real values.
3. Leave `DOCKER_IMAGE` blank unless you intentionally want a specific local or registry tag.
4. In Dockge, deploy or redeploy the stack with a build so Docker rebuilds the image from the current repo checkout.
5. Do not rely on "pull latest image" alone when you need current code from this repo.
6. After redeploy, hard refresh the browser and check:
   - `http://your-host:1609/dashboard`
   - `http://your-host:1609/plan`
   - `http://your-host:1609/editor`
   - `http://your-host:1609/setup`
   - `http://your-host:1609/control`

### Alternate mode: push an image and redeploy by tag
Use this when the Dockge server does not have the repo checkout.

1. Build and push the image from a machine that has this repo:
```bash
docker build -t ghcr.io/your-org/chronicle:mpa-2026-03-07 .
docker push ghcr.io/your-org/chronicle:mpa-2026-03-07
```
2. Set `DOCKER_IMAGE=ghcr.io/your-org/chronicle:mpa-2026-03-07`
3. Redeploy the stack in Dockge.

## How To Confirm You Are Seeing The New Pages

### Visual checks
- `View` should render the current multi-page heatmap UI.
- `Plan` should render the current spreadsheet-style planning UI.
- `Build` should render the editor with workshop drawers.
- `Sources` should render provider configuration cards.
- `Control` should render the operations table.

### Route checks
- `GET /dashboard`, `/plan`, `/editor`, `/setup`, and `/control` should all return HTML.
- `GET /design-review` should return the in-browser comparison tool used for styling approval.

### Browser checks
- Hard refresh with cache bypass after deploy.
- If you use a reverse proxy, confirm it is forwarding the product routes above without caching stale HTML aggressively.

## Environment Configuration
- `.env` is the primary config file.
- `/setup` UI can update `.env` values and runtime overrides.

## CI/CD
- `.github/workflows/ci-cd.yml` runs the Python CI checks.
- `.github/workflows/android-widget-release.yml` produces Android widget releases.

For current product direction, see [`docs/UI_DIRECTION.md`](UI_DIRECTION.md).

---
_Source: Dockerfile, docker-compose.yml, GitHub workflows_ 
