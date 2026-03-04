FROM node:22-alpine AS ui-builder

WORKDIR /ui

COPY chronicle-ui/package.json chronicle-ui/package-lock.json ./
RUN npm ci

COPY chronicle-ui/ ./
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app
COPY --from=ui-builder /ui/dist /app/chronicle-ui/dist
RUN mkdir -p /app/state

CMD ["python", "-m", "chronicle.worker"]
