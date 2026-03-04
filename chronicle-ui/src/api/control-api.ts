import { getJson } from "./http-client";

export interface ControlActivityDetectionRecord {
  status: string;
  new_activity_available: boolean;
  last_activity_id: string | null;
  last_checked_at_utc: string | null;
  last_detected_at_utc: string | null;
}

export interface ControlActivityDetectionResponse {
  status: string;
  time_utc: string;
  worker_last_heartbeat_utc: string | null;
  worker_heartbeat_healthy: boolean;
  activity_detection: ControlActivityDetectionRecord;
}

export interface ControlRerunLatestResult {
  status: string;
  activity_id?: number;
  lock_owner?: string;
}

export interface ControlRerunLatestResponse {
  status: string;
  result: ControlRerunLatestResult;
  status_code: string;
  timestamp_utc: string;
  retry_guidance?: string;
  dashboard_refresh?: string;
}

export async function getControlActivityDetection(): Promise<ControlActivityDetectionResponse> {
  return getJson<ControlActivityDetectionResponse>("/control/activity-detection");
}

export async function rerunLatestDescription(): Promise<ControlRerunLatestResponse> {
  return getJson<ControlRerunLatestResponse>("/rerun/latest", { method: "POST" });
}

export async function rerunSpecificActivityDescription(activityId: number): Promise<ControlRerunLatestResponse> {
  if (!Number.isFinite(activityId)) {
    throw new Error("activityId must be a finite number.");
  }
  const normalizedId = Math.trunc(activityId);
  if (normalizedId <= 0) {
    throw new Error("activityId must be greater than zero.");
  }
  return getJson<ControlRerunLatestResponse>(`/rerun/activity/${encodeURIComponent(String(normalizedId))}`, {
    method: "POST"
  });
}
