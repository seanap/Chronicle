import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getControlActivityDetection,
  rerunLatestDescription,
  rerunSpecificActivityDescription,
  type ControlActivityDetectionResponse,
  type ControlRerunLatestResponse
} from "../../api/control-api";
import { ApiRequestError } from "../../api/http-client";

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unable to load control status.";
}

function formatTimestamp(value: string | null | undefined): string {
  const text = String(value || "").trim();
  return text || "Unavailable";
}

function parseSelectedActivityId(value: string): number | null {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const parsed = Number.parseInt(text, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function rerunErrorMessage(operationLabel: string, error: unknown): string {
  if (error instanceof ApiRequestError) {
    const details = error.details;
    if (details && typeof details === "object") {
      const detailRecord = details as { status_code?: unknown; timestamp_utc?: unknown };
      const statusCode = String(detailRecord.status_code || "error").trim() || "error";
      const timestamp = formatTimestamp(
        detailRecord.timestamp_utc != null ? String(detailRecord.timestamp_utc) : null
      );
      return `${operationLabel} failed. Status: ${statusCode}. Timestamp: ${timestamp}. ${error.message}`;
    }
    return `${operationLabel} failed. Status: http_${error.status}. Timestamp: Unavailable. ${error.message}`;
  }
  return `${operationLabel} failed. ${errorMessage(error)}`;
}

function rerunGuidance(response: ControlRerunLatestResponse): string {
  const statusCode = String(response.status_code || "").trim().toLowerCase();
  if (statusCode === "locked") {
    return (
      String(response.retry_guidance || "").trim() ||
      "Another rerun is already in progress. Wait a few seconds, then retry."
    );
  }
  return "";
}

interface ControlRerunMessage {
  severity: "success" | "info" | "warning" | "error";
  text: string;
}

export function ControlPage() {
  const [payload, setPayload] = useState<ControlActivityDetectionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);
  const [rerunMode, setRerunMode] = useState<"latest" | "specific" | null>(null);
  const [specificActivityIdInput, setSpecificActivityIdInput] = useState("");
  const [rerunMessage, setRerunMessage] = useState<ControlRerunMessage | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getControlActivityDetection();
      setPayload(response);
    } catch (loadError) {
      setPayload(null);
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasNewActivity = Boolean(payload?.activity_detection?.new_activity_available);
  const detectionStatus = useMemo(() => {
    const value = String(payload?.activity_detection?.status || "").trim();
    return value || "unknown";
  }, [payload]);

  useEffect(() => {
    const lastDetectedId = String(payload?.activity_detection?.last_activity_id || "").trim();
    if (lastDetectedId && specificActivityIdInput.trim().length === 0) {
      setSpecificActivityIdInput(lastDetectedId);
    }
  }, [payload?.activity_detection?.last_activity_id, specificActivityIdInput]);

  const handleRerunLatest = useCallback(async () => {
    if (isRerunning) {
      return;
    }
    setIsRerunning(true);
    setRerunMode("latest");
    setRerunMessage(null);
    try {
      const response = await rerunLatestDescription();
      const statusCode = String(response.status_code || "unknown").trim() || "unknown";
      const timestamp = formatTimestamp(response.timestamp_utc);
      const guidance = rerunGuidance(response);
      if (statusCode.toLowerCase() === "updated") {
        setRerunMessage({
          severity: "success",
          text: `Rerun latest completed. Status: ${statusCode}. Timestamp: ${timestamp}.`
        });
      } else if (statusCode.toLowerCase() === "locked") {
        setRerunMessage({
          severity: "warning",
          text: `Rerun latest did not start. Status: ${statusCode}. Timestamp: ${timestamp}. ${guidance}`
        });
      } else {
        setRerunMessage({
          severity: "info",
          text: `Rerun latest returned status ${statusCode} at ${timestamp}.${guidance ? ` ${guidance}` : ""}`
        });
      }
    } catch (rerunError) {
      setRerunMessage({
        severity: "error",
        text: rerunErrorMessage("Rerun latest", rerunError)
      });
    } finally {
      setIsRerunning(false);
      setRerunMode(null);
    }
  }, [isRerunning]);

  const handleRerunSelectedActivity = useCallback(async () => {
    if (isRerunning) {
      return;
    }
    const selectedActivityId = parseSelectedActivityId(specificActivityIdInput);
    if (selectedActivityId === null) {
      setRerunMessage({
        severity: "warning",
        text: "Enter a valid numeric activity ID before rerunning a specific activity."
      });
      return;
    }

    setIsRerunning(true);
    setRerunMode("specific");
    setRerunMessage(null);
    try {
      const response = await rerunSpecificActivityDescription(selectedActivityId);
      const statusCode = String(response.status_code || "unknown").trim() || "unknown";
      const timestamp = formatTimestamp(response.timestamp_utc);
      const guidance = rerunGuidance(response);
      if (statusCode.toLowerCase() === "updated") {
        setRerunMessage({
          severity: "success",
          text: `Rerun activity ${selectedActivityId} completed. Status: ${statusCode}. Timestamp: ${timestamp}.`
        });
      } else if (statusCode.toLowerCase() === "locked") {
        setRerunMessage({
          severity: "warning",
          text: `Rerun activity ${selectedActivityId} did not start. Status: ${statusCode}. Timestamp: ${timestamp}. ${guidance}`
        });
      } else {
        setRerunMessage({
          severity: "info",
          text: `Rerun activity ${selectedActivityId} returned status ${statusCode} at ${timestamp}.${guidance ? ` ${guidance}` : ""}`
        });
      }
    } catch (rerunError) {
      setRerunMessage({
        severity: "error",
        text: rerunErrorMessage(`Rerun activity ${selectedActivityId}`, rerunError)
      });
    } finally {
      setIsRerunning(false);
      setRerunMode(null);
    }
  }, [isRerunning, specificActivityIdInput]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">Control</Typography>
        <Typography variant="body2" color="text.secondary">
          Monitor worker heartbeat and activity detection state.
        </Typography>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant="contained" onClick={() => void refresh()} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh status"}
        </Button>
        <Button variant="contained" color="secondary" onClick={() => void handleRerunLatest()} disabled={isRerunning}>
          {isRerunning && rerunMode === "latest" ? "Rerunning latest..." : "Rerun latest activity"}
        </Button>
        <TextField
          size="small"
          label="Specific activity ID"
          value={specificActivityIdInput}
          onChange={(event) => setSpecificActivityIdInput(event.target.value)}
          inputProps={{ inputMode: "numeric", "aria-label": "Specific activity ID" }}
          sx={{ minWidth: { sm: 220 } }}
        />
        <Button
          variant="outlined"
          onClick={() => void handleRerunSelectedActivity()}
          disabled={isRerunning}
        >
          {isRerunning && rerunMode === "specific" ? "Rerunning selected..." : "Rerun selected activity"}
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {rerunMessage ? <Alert severity={rerunMessage.severity}>{rerunMessage.text}</Alert> : null}
      {isLoading && !payload ? <Typography>Loading control status...</Typography> : null}

      {payload ? (
        <Card variant="outlined">
          <CardContent sx={{ display: "grid", gap: 1 }}>
            <Typography variant="subtitle1">Worker heartbeat</Typography>
            <Typography variant="body2">
              Health: {payload.worker_heartbeat_healthy ? "Healthy" : "Unhealthy"}
            </Typography>
            <Typography variant="body2">
              Last heartbeat (UTC): {formatTimestamp(payload.worker_last_heartbeat_utc)}
            </Typography>
            <Typography variant="subtitle1" sx={{ mt: 1 }}>
              Activity detection
            </Typography>
            <Typography variant="body2">Status: {detectionStatus}</Typography>
            <Typography variant="body2">
              Last detected activity id: {String(payload.activity_detection.last_activity_id || "Unavailable")}
            </Typography>
            <Typography variant="body2">
              Last checked (UTC): {formatTimestamp(payload.activity_detection.last_checked_at_utc)}
            </Typography>
            <Typography variant="body2">
              Last detected (UTC): {formatTimestamp(payload.activity_detection.last_detected_at_utc)}
            </Typography>
            {hasNewActivity ? (
              <Alert severity="success">
                New activity available for processing.
              </Alert>
            ) : (
              <Alert severity="info">
                No new activity currently detected.
              </Alert>
            )}
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
