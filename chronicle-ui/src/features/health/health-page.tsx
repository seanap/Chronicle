import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { ApiRequestError } from "../../api/http-client";
import { getHealthStatusSnapshot, type HealthStatusSnapshot } from "../../api/health-status-api";

type HealthState = "healthy" | "warning" | "error";

interface HealthPanel {
  id: string;
  title: string;
  state: HealthState;
  summary: string;
  nextAction: string;
  details: string[];
}

function statusLabel(state: HealthState): string {
  if (state === "healthy") {
    return "Healthy";
  }
  if (state === "warning") {
    return "Warning";
  }
  return "Error";
}

function statusColor(state: HealthState): "success" | "warning" | "error" {
  if (state === "healthy") {
    return "success";
  }
  if (state === "warning") {
    return "warning";
  }
  return "error";
}

function statusSeverity(state: HealthState): "success" | "warning" | "error" {
  if (state === "healthy") {
    return "success";
  }
  if (state === "warning") {
    return "warning";
  }
  return "error";
}

function formatTimestamp(value: string | null | undefined): string {
  const text = String(value || "").trim();
  return text || "Unavailable";
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) {
    return "Yes";
  }
  if (value === false) {
    return "No";
  }
  return "Unavailable";
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unable to load health status.";
}

function buildReadinessPanel(snapshot: HealthStatusSnapshot): HealthPanel {
  const readiness = snapshot.readiness;
  if (!readiness) {
    return {
      id: "readiness",
      title: "System readiness",
      state: "error",
      summary: "Readiness status is unavailable.",
      nextAction: "Retry refresh. If it persists, verify the /ready endpoint is reachable.",
      details: []
    };
  }

  const checks = readiness.checks;
  const checksHealthy =
    Boolean(checks.state_path_writable) &&
    Boolean(checks.template_accessible) &&
    Boolean(checks.worker_heartbeat_healthy);
  if (readiness.status === "ready" && checksHealthy) {
    return {
      id: "readiness",
      title: "System readiness",
      state: "healthy",
      summary: "Core readiness checks are healthy.",
      nextAction: "No action required.",
      details: [
        `State path writable: ${yesNo(checks.state_path_writable)}`,
        `Template accessible: ${yesNo(checks.template_accessible)}`,
        `Worker heartbeat healthy: ${yesNo(checks.worker_heartbeat_healthy)}`
      ]
    };
  }

  if (!checks.state_path_writable) {
    return {
      id: "readiness",
      title: "System readiness",
      state: "error",
      summary: "State storage path is not writable.",
      nextAction: "Check STATE_DIR permissions and available disk space, then retry.",
      details: [
        `Template accessible: ${yesNo(checks.template_accessible)}`,
        `Worker heartbeat healthy: ${yesNo(checks.worker_heartbeat_healthy)}`
      ]
    };
  }

  if (!checks.template_accessible) {
    return {
      id: "readiness",
      title: "System readiness",
      state: "warning",
      summary: "Active template is not accessible.",
      nextAction: "Open Build and configure/validate the active template.",
      details: [
        `State path writable: ${yesNo(checks.state_path_writable)}`,
        `Worker heartbeat healthy: ${yesNo(checks.worker_heartbeat_healthy)}`
      ]
    };
  }

  return {
    id: "readiness",
    title: "System readiness",
    state: "warning",
    summary: "Worker heartbeat check is not healthy.",
    nextAction: "Start or restart the worker and confirm heartbeat updates in Control.",
    details: [
      `State path writable: ${yesNo(checks.state_path_writable)}`,
      `Template accessible: ${yesNo(checks.template_accessible)}`
    ]
  };
}

function buildPayloadPanel(snapshot: HealthStatusSnapshot): HealthPanel {
  const health = snapshot.health;
  if (!health) {
    return {
      id: "payload",
      title: "Dashboard payload freshness",
      state: "error",
      summary: "Health endpoint is unavailable.",
      nextAction: "Retry refresh. If it persists, verify /health endpoint health.",
      details: []
    };
  }

  if (health.latest_payload_exists) {
    return {
      id: "payload",
      title: "Dashboard payload freshness",
      state: "healthy",
      summary: "Latest activity payload is available.",
      nextAction: "No action required.",
      details: [`Worker last heartbeat (UTC): ${formatTimestamp(health.worker_last_heartbeat_utc)}`]
    };
  }

  const heartbeatPresent = String(health.worker_last_heartbeat_utc || "").trim().length > 0;
  return {
    id: "payload",
    title: "Dashboard payload freshness",
    state: heartbeatPresent ? "warning" : "error",
    summary: heartbeatPresent
      ? "No dashboard payload has been written yet."
      : "No dashboard payload and no recent worker heartbeat were detected.",
    nextAction: heartbeatPresent
      ? "Wait for the next worker cycle or trigger rerun latest in Control."
      : "Start or restart the worker, then trigger rerun latest in Control.",
    details: [`Worker last heartbeat (UTC): ${formatTimestamp(health.worker_last_heartbeat_utc)}`]
  };
}

function buildWorkerPanel(snapshot: HealthStatusSnapshot): HealthPanel {
  const detection = snapshot.activityDetection;
  if (!detection) {
    return {
      id: "worker",
      title: "Worker and activity detection",
      state: "error",
      summary: "Activity detection status is unavailable.",
      nextAction: "Retry refresh. If it persists, verify /control/activity-detection endpoint health.",
      details: []
    };
  }

  const heartbeatHealthy = Boolean(detection.worker_heartbeat_healthy);
  const detectionStatus = String(detection.activity_detection.status || "").trim() || "unknown";
  const knownDetectionState = detectionStatus === "new_activity_detected" || detectionStatus === "no_new_activity";
  if (heartbeatHealthy && knownDetectionState) {
    return {
      id: "worker",
      title: "Worker and activity detection",
      state: "healthy",
      summary: `Worker heartbeat is healthy; detection state is ${detectionStatus}.`,
      nextAction: "No action required.",
      details: [
        `Last heartbeat (UTC): ${formatTimestamp(detection.worker_last_heartbeat_utc)}`,
        `Last checked (UTC): ${formatTimestamp(detection.activity_detection.last_checked_at_utc)}`,
        `Last detected activity id: ${String(detection.activity_detection.last_activity_id || "Unavailable")}`
      ]
    };
  }

  const hasHeartbeatTimestamp = String(detection.worker_last_heartbeat_utc || "").trim().length > 0;
  return {
    id: "worker",
    title: "Worker and activity detection",
    state: hasHeartbeatTimestamp ? "warning" : "error",
    summary: hasHeartbeatTimestamp
      ? `Worker heartbeat is not healthy; detection state is ${detectionStatus}.`
      : "Worker heartbeat timestamp is unavailable.",
    nextAction: "Start or restart the worker and confirm heartbeat updates in Control.",
    details: [
      `Last heartbeat (UTC): ${formatTimestamp(detection.worker_last_heartbeat_utc)}`,
      `Last checked (UTC): ${formatTimestamp(detection.activity_detection.last_checked_at_utc)}`
    ]
  };
}

function buildStravaPanel(snapshot: HealthStatusSnapshot): HealthPanel {
  const strava = snapshot.stravaStatus?.strava;
  if (!strava) {
    return {
      id: "strava",
      title: "Strava connectivity",
      state: "error",
      summary: "Strava status is unavailable.",
      nextAction: "Retry refresh. If it persists, verify /setup/api/strava/status endpoint health.",
      details: []
    };
  }

  if (strava.connected) {
    return {
      id: "strava",
      title: "Strava connectivity",
      state: "healthy",
      summary: "Strava is connected and ready.",
      nextAction: "No action required.",
      details: [`Client configured: ${yesNo(strava.client_configured)}`]
    };
  }

  if (strava.client_configured) {
    return {
      id: "strava",
      title: "Strava connectivity",
      state: "warning",
      summary: "Strava client is configured but OAuth is not connected.",
      nextAction: "Open Sources and complete Strava OAuth connection.",
      details: [
        `Refresh token present: ${yesNo(strava.has_refresh_token)}`,
        `Access token present: ${yesNo(strava.has_access_token)}`
      ]
    };
  }

  return {
    id: "strava",
    title: "Strava connectivity",
    state: "error",
    summary: "Strava client configuration is missing.",
    nextAction: "Open Sources and provide Strava client ID and secret.",
    details: [
      `Refresh token present: ${yesNo(strava.has_refresh_token)}`,
      `Access token present: ${yesNo(strava.has_access_token)}`
    ]
  };
}

function buildMetricsPanel(snapshot: HealthStatusSnapshot): HealthPanel {
  const metrics = snapshot.serviceMetrics;
  if (!metrics) {
    return {
      id: "metrics",
      title: "Service metrics",
      state: "warning",
      summary: "Service metrics are unavailable.",
      nextAction: "Retry refresh and verify /service-metrics endpoint availability.",
      details: []
    };
  }

  const entries = Object.entries(metrics.cycle_service_calls || {});
  if (entries.length === 0) {
    return {
      id: "metrics",
      title: "Service metrics",
      state: "warning",
      summary: "No service call metrics have been recorded yet.",
      nextAction: "Run one worker cycle, then refresh to confirm metrics.",
      details: []
    };
  }

  const detail = entries.map(([key, value]) => `${key}: ${String(value)}`);
  return {
    id: "metrics",
    title: "Service metrics",
    state: "healthy",
    summary: "Service call metrics are being recorded.",
    nextAction: "No action required.",
    details: detail
  };
}

function buildPanels(snapshot: HealthStatusSnapshot | null): HealthPanel[] {
  if (!snapshot) {
    return [];
  }
  return [
    buildReadinessPanel(snapshot),
    buildPayloadPanel(snapshot),
    buildWorkerPanel(snapshot),
    buildStravaPanel(snapshot),
    buildMetricsPanel(snapshot)
  ];
}

export function HealthPage() {
  const [snapshot, setSnapshot] = useState<HealthStatusSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getHealthStatusSnapshot();
      const hasAnyPayload =
        loaded.health !== null ||
        loaded.readiness !== null ||
        loaded.serviceMetrics !== null ||
        loaded.stravaStatus !== null ||
        loaded.activityDetection !== null;
      if (!hasAnyPayload) {
        setError("Unable to load health status data.");
      }
      setSnapshot(loaded);
    } catch (loadError) {
      setSnapshot(null);
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const panels = useMemo(() => buildPanels(snapshot), [snapshot]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">Health</Typography>
        <Typography variant="body2" color="text.secondary">
          Review operational system health and the next action for each status.
        </Typography>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant="contained" onClick={() => void loadStatus()} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh health"}
        </Button>
        <Button variant="outlined" component={RouterLink} to="/troubleshooting">
          Open troubleshooting guide
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {isLoading && !snapshot ? <Typography>Loading health status...</Typography> : null}

      {(snapshot?.warnings ?? []).map((warning) => (
        <Alert key={warning} severity="warning">
          {warning}
        </Alert>
      ))}

      {panels.map((panel) => (
        <Card key={panel.id} variant="outlined" data-testid={`health-panel-${panel.id}`}>
          <CardContent sx={{ display: "grid", gap: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
              <Typography variant="subtitle1">{panel.title}</Typography>
              <Chip
                size="small"
                color={statusColor(panel.state)}
                label={`Status: ${statusLabel(panel.state)}`}
                data-testid={`health-panel-status-${panel.id}`}
              />
            </Stack>
            <Alert severity={statusSeverity(panel.state)}>{panel.summary}</Alert>
            <Typography variant="body2">Next action: {panel.nextAction}</Typography>
            {panel.details.map((detail) => (
              <Typography key={detail} variant="caption" color="text.secondary">
                {detail}
              </Typography>
            ))}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
