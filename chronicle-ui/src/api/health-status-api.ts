import { getJson } from "./http-client";
import type { ControlActivityDetectionResponse } from "./control-api";

export interface HealthEndpointResponse {
  status: string;
  time_utc: string;
  latest_payload_exists: boolean;
  worker_last_heartbeat_utc: string | null;
}

export interface ReadyChecks {
  state_path_writable: boolean;
  template_accessible: boolean;
  worker_heartbeat_healthy: boolean;
}

export interface ReadyEndpointResponse {
  status: string;
  time_utc: string;
  checks: ReadyChecks;
  cycle_last_status?: string | null;
  cycle_last_error?: string | null;
}

export interface ServiceMetricsResponse {
  status: string;
  time_utc: string;
  cycle_service_calls: Record<string, unknown>;
}

export interface SetupStravaStatusResponse {
  status: string;
  strava: {
    client_configured?: boolean;
    connected?: boolean;
    has_refresh_token?: boolean;
    has_access_token?: boolean;
  };
}

export interface HealthStatusSnapshot {
  health: HealthEndpointResponse | null;
  readiness: ReadyEndpointResponse | null;
  serviceMetrics: ServiceMetricsResponse | null;
  stravaStatus: SetupStravaStatusResponse | null;
  activityDetection: ControlActivityDetectionResponse | null;
  warnings: string[];
}

function toWarningMessage(label: string, reason: unknown): string {
  if (reason instanceof Error && reason.message.trim().length > 0) {
    return `${label} unavailable: ${reason.message}`;
  }
  return `${label} unavailable.`;
}

export async function getHealthEndpoint(): Promise<HealthEndpointResponse> {
  return getJson<HealthEndpointResponse>("/health");
}

export async function getReadyEndpoint(): Promise<ReadyEndpointResponse> {
  return getJson<ReadyEndpointResponse>("/ready");
}

export async function getServiceMetricsEndpoint(): Promise<ServiceMetricsResponse> {
  return getJson<ServiceMetricsResponse>("/service-metrics");
}

export async function getStravaStatusEndpoint(): Promise<SetupStravaStatusResponse> {
  return getJson<SetupStravaStatusResponse>("/setup/api/strava/status");
}

export async function getControlActivityDetectionEndpoint(): Promise<ControlActivityDetectionResponse> {
  return getJson<ControlActivityDetectionResponse>("/control/activity-detection");
}

export async function getHealthStatusSnapshot(): Promise<HealthStatusSnapshot> {
  const results = await Promise.allSettled([
    getHealthEndpoint(),
    getReadyEndpoint(),
    getServiceMetricsEndpoint(),
    getStravaStatusEndpoint(),
    getControlActivityDetectionEndpoint()
  ]);

  const warnings: string[] = [];
  const [
    healthResult,
    readinessResult,
    serviceMetricsResult,
    stravaStatusResult,
    activityDetectionResult
  ] = results;

  if (healthResult.status === "rejected") {
    warnings.push(toWarningMessage("Health endpoint", healthResult.reason));
  }
  if (readinessResult.status === "rejected") {
    warnings.push(toWarningMessage("Readiness endpoint", readinessResult.reason));
  }
  if (serviceMetricsResult.status === "rejected") {
    warnings.push(toWarningMessage("Service metrics endpoint", serviceMetricsResult.reason));
  }
  if (stravaStatusResult.status === "rejected") {
    warnings.push(toWarningMessage("Strava status endpoint", stravaStatusResult.reason));
  }
  if (activityDetectionResult.status === "rejected") {
    warnings.push(toWarningMessage("Activity detection endpoint", activityDetectionResult.reason));
  }

  return {
    health: healthResult.status === "fulfilled" ? healthResult.value : null,
    readiness: readinessResult.status === "fulfilled" ? readinessResult.value : null,
    serviceMetrics: serviceMetricsResult.status === "fulfilled" ? serviceMetricsResult.value : null,
    stravaStatus: stravaStatusResult.status === "fulfilled" ? stravaStatusResult.value : null,
    activityDetection: activityDetectionResult.status === "fulfilled" ? activityDetectionResult.value : null,
    warnings
  };
}
