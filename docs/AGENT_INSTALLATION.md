# Chronicle Agent Installation Guide

This guide covers two supported deployment models for Chronicle's Codex-backed agent features:

1. `Dev VM Codex`  
   Recommended for your environment. Chronicle stays on the Docker server, and the Codex companion runs directly on the VM where Codex is already installed and logged in.
2. `Companion Container`  
   Use this when you want containerized companion operations and do not want to install or run Codex directly on the companion host.

## Recommended Choice

For your setup, the best path is:

- Chronicle on the Docker server
- Codex Companion on the dev VM
- Companion runs directly on the dev VM and reuses your existing Codex OAuth

Why this is the lowest-friction option:

- no Codex install on the Chronicle Docker host
- no containerized Codex login ceremony
- no SSH or `tmux` automation
- easiest to debug
- easiest to keep aligned with the repo checkout you already use for development

Use the companion-container option only if you want a cleaner helper-host runtime boundary than a direct Python service.

## What Gets Installed Where

### Chronicle Docker server

Runs:

- `chronicle-api`
- `chronicle-worker`

Configured to:

- call the remote Codex companion
- expose the Chronicle control API to that companion

### Codex companion machine

Runs:

- a small Flask service from [`ai/chronicle_companion/service.py`](/home/shipyard/src/Auto-Stat-Description/ai/chronicle_companion/service.py)

That service:

- receives requests from Chronicle
- runs `codex exec`
- returns structured drafts/suggestions

## Network Requirements

Allow these paths on your LAN:

- Chronicle server -> Companion: TCP `8788` by default
- Companion -> Chronicle server: TCP `1609` by default

If you firewall by source IP, allow:

- Chronicle host IP to reach companion port `8788`
- Companion host IP to reach Chronicle port `1609`

## Chronicle-Side Configuration

Do this on the Docker server that runs Chronicle.

### 1. Prepare `.env`

From the repo root:

```bash
cp .env.example .env
```

Add your normal Chronicle source credentials first.

Then add the agent settings:

```dotenv
AGENT_PROVIDER=remote_codex_exec
AGENT_REMOTE_URL=http://YOUR_CODEX_VM_OR_HELPER_HOST:8788
AGENT_REMOTE_API_KEY=replace-with-a-long-random-secret

ENABLE_AGENT_CONTROL_API=true
AGENT_CONTROL_BASE_URL=http://YOUR_CHRONICLE_HOST:1609
AGENT_CONTROL_READ_API_KEY=replace-with-a-second-random-secret
AGENT_CONTROL_WRITE_API_KEY=replace-with-a-third-random-secret
```

Notes:

- `AGENT_REMOTE_API_KEY` must match `CHRONICLE_COMPANION_API_KEY` on the companion side.
- `AGENT_CONTROL_BASE_URL` must be reachable from the companion machine.
- Keep read and write keys different.

### 2. Start or restart Chronicle

```bash
docker compose up -d --build
```

### 3. Verify Chronicle is live

```bash
curl http://YOUR_CHRONICLE_HOST:1609/ready
curl -H "X-Chronicle-Agent-Key: $AGENT_CONTROL_READ_API_KEY" \
  http://YOUR_CHRONICLE_HOST:1609/agent-control/handshake
```

Expected:

- `/ready` returns `200` when the worker and API are healthy
- `/agent-control/handshake` returns `status=ok`

## Option A: Dev VM Codex

This is the recommended path.

### Prerequisites

On the dev VM:

- Codex CLI already installed
- Codex already logged in, or you are willing to do a one-time login
- Python 3.12 available
- access to clone this repo

### 1. Clone the repo on the dev VM

Use the same branch or commit as the Chronicle server whenever possible.

```bash
mkdir -p ~/services
cd ~/services
git clone https://github.com/seanap/Chronicle.git
cd Chronicle
git rev-parse HEAD
```

Optimization:

- pin the dev VM checkout to the same commit as the Docker server image when debugging version-sensitive behavior

### 2. Create a virtualenv

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Verify Codex on the dev VM

```bash
codex --version
codex login status
```

If login is not established yet:

```bash
codex login
```

If you prefer API-key auth instead of OAuth:

```bash
printenv OPENAI_API_KEY | codex login --with-api-key
```

### 4. Create the companion env file

Copy the example:

```bash
cp ai/chronicle_companion/.env.example ai/chronicle_companion/.env
```

Edit it:

```dotenv
CHRONICLE_COMPANION_HOST=0.0.0.0
CHRONICLE_COMPANION_PORT=8788
CHRONICLE_COMPANION_API_KEY=replace-with-the-same-value-as-AGENT_REMOTE_API_KEY
CHRONICLE_COMPANION_HTTP_TIMEOUT_SECONDS=30

EDITOR_AI_CODEX_CLI_PATH=
EDITOR_AI_WORKSPACE_DIR=/home/YOUR_USER/services/Chronicle/ai/chronicle_companion
EDITOR_AI_TIMEOUT_SECONDS=120
EDITOR_AI_CODEX_MODEL=
```

Notes:

- Leave `EDITOR_AI_CODEX_CLI_PATH` blank if `codex` is already on `PATH`.
- `EDITOR_AI_WORKSPACE_DIR` should point at the repo checkout on the dev VM.

### 5. Start the companion manually

```bash
set -a
source ai/chronicle_companion/.env
set +a
. .venv/bin/activate
python ai/chronicle_companion/service.py
```

### 6. Verify the companion from the dev VM

```bash
curl http://127.0.0.1:8788/health
curl http://127.0.0.1:8788/v1/handshake
```

### 7. Verify Chronicle can reach it

From the Chronicle host:

```bash
curl -H "X-Chronicle-Agent-Key: $AGENT_REMOTE_API_KEY" \
  http://YOUR_CODEX_VM_OR_HELPER_HOST:8788/v1/handshake
```

### 8. Verify the full Chronicle path

From any machine that can reach Chronicle:

```bash
curl http://YOUR_CHRONICLE_HOST:1609/editor/assistant/status
```

Expected:

- `enabled=true`
- `provider=remote_codex_exec`
- `available=true`

Then test a real request:

```bash
curl -X POST http://YOUR_CHRONICLE_HOST:1609/editor/assistant/customize \
  -H "Content-Type: application/json" \
  -d '{
    "request": "Make the readiness line shorter.",
    "template": "🌤️🚦 Training Readiness: {{ training.readiness_score }}",
    "context_mode": "sample",
    "profile_id": "default"
  }'
```

## Option A Hardening: systemd Service

If the dev VM approach works, move it from a manual shell to `systemd`.

Example unit file:

- [`ai/chronicle_companion/chronicle-codex-companion.service.example`](/home/shipyard/src/Auto-Stat-Description/ai/chronicle_companion/chronicle-codex-companion.service.example)

Install flow:

```bash
sudo cp ai/chronicle_companion/chronicle-codex-companion.service.example \
  /etc/systemd/system/chronicle-codex-companion.service
```

Edit:

- `User=`
- `WorkingDirectory=`
- `EnvironmentFile=`
- `ExecStart=`

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chronicle-codex-companion
sudo systemctl status chronicle-codex-companion
```

This is the best balance of simplicity and reliability.

## Option B: Companion Container

Use this if you want the companion runtime containerized.

### When this makes sense

- you do not want a long-running Python service directly on the companion VM
- you are fine doing a one-time Codex login inside a persistent container volume
- you want a copy-paste Docker deployment artifact

### Tradeoffs vs Dev VM Codex

Pros:

- cleaner service lifecycle
- easier restart policy
- clearer dependency boundary

Cons:

- one more image to build
- Codex auth must live in a mounted container volume
- first login is more awkward than reusing an existing host login

### Files added for this path

- companion Dockerfile: [`ai/chronicle_companion/Dockerfile`](/home/shipyard/src/Auto-Stat-Description/ai/chronicle_companion/Dockerfile)
- companion env example: [`ai/chronicle_companion/.env.example`](/home/shipyard/src/Auto-Stat-Description/ai/chronicle_companion/.env.example)
- companion compose example: [`ai/chronicle_companion/docker-compose.example.yml`](/home/shipyard/src/Auto-Stat-Description/ai/chronicle_companion/docker-compose.example.yml)

### 1. Clone the repo on the helper host

```bash
mkdir -p ~/services
cd ~/services
git clone https://github.com/seanap/Chronicle.git
cd Chronicle
```

### 2. Create the companion env file

```bash
cp ai/chronicle_companion/.env.example ai/chronicle_companion/.env
```

Edit:

```dotenv
CHRONICLE_COMPANION_HOST=0.0.0.0
CHRONICLE_COMPANION_PORT=8788
CHRONICLE_COMPANION_API_KEY=replace-with-the-same-value-as-AGENT_REMOTE_API_KEY
CHRONICLE_COMPANION_HTTP_TIMEOUT_SECONDS=30

EDITOR_AI_CODEX_CLI_PATH=/usr/local/bin/codex
EDITOR_AI_WORKSPACE_DIR=/app/ai/chronicle_companion
EDITOR_AI_TIMEOUT_SECONDS=120
EDITOR_AI_CODEX_MODEL=
```

### 3. Build and start the companion container

```bash
docker compose -f ai/chronicle_companion/docker-compose.example.yml up -d --build
```

### 4. Perform one-time Codex login inside the container

OAuth/device login:

```bash
docker compose -f ai/chronicle_companion/docker-compose.example.yml exec chronicle-codex-companion codex login
```

API-key login:

```bash
printenv OPENAI_API_KEY | \
docker compose -f ai/chronicle_companion/docker-compose.example.yml exec -T chronicle-codex-companion \
  codex login --with-api-key
```

This login persists in the mounted `codex-home` volume.

### 5. Verify the companion container

```bash
curl http://YOUR_HELPER_HOST:8788/health
curl http://YOUR_HELPER_HOST:8788/v1/handshake
```

### 6. Point Chronicle at the helper host

On the Chronicle Docker server `.env`:

```dotenv
AGENT_PROVIDER=remote_codex_exec
AGENT_REMOTE_URL=http://YOUR_HELPER_HOST:8788
AGENT_REMOTE_API_KEY=replace-with-the-same-value-as-CHRONICLE_COMPANION_API_KEY
ENABLE_AGENT_CONTROL_API=true
AGENT_CONTROL_BASE_URL=http://YOUR_CHRONICLE_HOST:1609
AGENT_CONTROL_READ_API_KEY=replace-with-a-second-random-secret
AGENT_CONTROL_WRITE_API_KEY=replace-with-a-third-random-secret
```

Then restart Chronicle:

```bash
docker compose up -d --build
```

## Verification Checklist

### Chronicle API

```bash
curl http://YOUR_CHRONICLE_HOST:1609/editor/assistant/status
curl -H "X-Chronicle-Agent-Key: $AGENT_CONTROL_READ_API_KEY" \
  http://YOUR_CHRONICLE_HOST:1609/agent-control/capabilities
```

### Companion

```bash
curl -H "X-Chronicle-Agent-Key: $AGENT_REMOTE_API_KEY" \
  http://YOUR_COMPANION_HOST:8788/v1/handshake
```

### End-to-end template suggestion

```bash
curl -X POST http://YOUR_CHRONICLE_HOST:1609/editor/assistant/customize \
  -H "Content-Type: application/json" \
  -d '{
    "request": "Make the weather line shorter.",
    "template": "🌤️🌡️ Misery Index: {{ weather.misery_index }}",
    "context_mode": "sample",
    "profile_id": "default"
  }'
```

### End-to-end planning draft

```bash
curl -X POST http://YOUR_CHRONICLE_HOST:1609/agent/tasks/plan-next-week \
  -H "Content-Type: application/json" \
  -H "X-Chronicle-Agent-Key: $AGENT_CONTROL_READ_API_KEY" \
  -d '{
    "request": "Create next week with one long run, one workout, and two recovery days.",
    "week_start_local": "2026-04-20"
  }'
```

That should return:

- a durable `job`
- a `plan_week` draft
- `status=awaiting_approval`

## Recommended Optimizations

### Best operational setup

If your goal is minimum friction with good reliability:

- run Chronicle on the Docker server
- run the companion directly on the dev VM
- manage the companion with `systemd`

That avoids the container-auth overhead and still keeps Codex off the Docker host.

### Version alignment

Keep the companion checkout and Chronicle deployment on the same commit when diagnosing issues.

Practical rule:

- update Chronicle
- update the companion checkout to the same commit
- restart both sides

### Keys

Use three different secrets:

- one for Chronicle -> companion
- one for companion read access to Chronicle
- one for companion write/apply access to Chronicle

Do not reuse one secret for all three roles.

### Container path optimization

If you choose the companion container, run it on the dev VM or helper host, not the Chronicle Docker host. That keeps your original host philosophy intact and avoids coupling Chronicle and Codex failure domains.

### Workspace path

Keep `EDITOR_AI_WORKSPACE_DIR` pointed at the repo checkout or `/app/ai/chronicle_companion` in the container. That keeps prompts and skill assets local and stable.

## Troubleshooting

### `editor/assistant/status` says unavailable

Check:

- `AGENT_PROVIDER=remote_codex_exec`
- `AGENT_REMOTE_URL` is correct
- companion is reachable on port `8788`
- companion API key matches

### Companion returns `Unauthorized`

Check:

- Chronicle `AGENT_REMOTE_API_KEY`
- companion `CHRONICLE_COMPANION_API_KEY`

They must match.

### Chronicle control API returns `Read access denied` or `Write access denied`

Check:

- `ENABLE_AGENT_CONTROL_API=true`
- `AGENT_CONTROL_READ_API_KEY`
- `AGENT_CONTROL_WRITE_API_KEY`
- the header `X-Chronicle-Agent-Key`

### Container companion lost login state

Check that the `codex-home` volume is present and persistent.

### Plan/task creation works but apply fails

Check:

- you are using the write key, not the read key
- the draft `base_version` is not stale
- the underlying Chronicle save path accepts the proposed payload

## Related Files

- architecture: [`docs/AGENT_ARCHITECTURE.md`](/home/shipyard/src/Auto-Stat-Description/docs/AGENT_ARCHITECTURE.md)
- roadmap: [`docs/TILLDONE_AGENT_ROADMAP.md`](/home/shipyard/src/Auto-Stat-Description/docs/TILLDONE_AGENT_ROADMAP.md)
- API reference: [`docs/API_DOCUMENTATION.md`](/home/shipyard/src/Auto-Stat-Description/docs/API_DOCUMENTATION.md)
