import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getControlActivityDetectionEndpoint,
  getHealthEndpoint,
  getHealthStatusSnapshot,
  getReadyEndpoint,
  getServiceMetricsEndpoint,
  getStravaStatusEndpoint
} from "./health-status-api";

const getJson = vi.fn();

vi.mock("./http-client", () => ({
  getJson: (...args: unknown[]) => getJson(...args)
}));

describe("health status api", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("calls each health endpoint with expected paths", async () => {
    getJson
      .mockResolvedValueOnce({
        status: "ok",
        time_utc: "2026-03-04T21:00:00+00:00",
        latest_payload_exists: true,
        worker_last_heartbeat_utc: "2026-03-04T20:59:50+00:00"
      })
      .mockResolvedValueOnce({
        status: "ready",
        time_utc: "2026-03-04T21:00:00+00:00",
        checks: {
          state_path_writable: true,
          template_accessible: true,
          worker_heartbeat_healthy: true
        }
      })
      .mockResolvedValueOnce({
        status: "ok",
        time_utc: "2026-03-04T21:00:00+00:00",
        cycle_service_calls: {}
      })
      .mockResolvedValueOnce({
        status: "ok",
        strava: {
          client_configured: true,
          connected: true
        }
      })
      .mockResolvedValueOnce({
        status: "ok",
        time_utc: "2026-03-04T21:00:00+00:00",
        worker_last_heartbeat_utc: "2026-03-04T20:59:50+00:00",
        worker_heartbeat_healthy: true,
        activity_detection: {
          status: "no_new_activity",
          new_activity_available: false,
          last_activity_id: null,
          last_checked_at_utc: "2026-03-04T21:00:00+00:00",
          last_detected_at_utc: null
        }
      });

    await getHealthEndpoint();
    await getReadyEndpoint();
    await getServiceMetricsEndpoint();
    await getStravaStatusEndpoint();
    await getControlActivityDetectionEndpoint();

    expect(getJson).toHaveBeenNthCalledWith(1, "/health");
    expect(getJson).toHaveBeenNthCalledWith(2, "/ready");
    expect(getJson).toHaveBeenNthCalledWith(3, "/service-metrics");
    expect(getJson).toHaveBeenNthCalledWith(4, "/setup/api/strava/status");
    expect(getJson).toHaveBeenNthCalledWith(5, "/control/activity-detection");
  });

  it("builds health snapshot when all endpoint calls succeed", async () => {
    getJson
      .mockResolvedValueOnce({
        status: "ok",
        time_utc: "2026-03-04T21:00:00+00:00",
        latest_payload_exists: true,
        worker_last_heartbeat_utc: "2026-03-04T20:59:50+00:00"
      })
      .mockResolvedValueOnce({
        status: "ready",
        time_utc: "2026-03-04T21:00:00+00:00",
        checks: {
          state_path_writable: true,
          template_accessible: true,
          worker_heartbeat_healthy: true
        }
      })
      .mockResolvedValueOnce({
        status: "ok",
        time_utc: "2026-03-04T21:00:00+00:00",
        cycle_service_calls: {
          strava: 1
        }
      })
      .mockResolvedValueOnce({
        status: "ok",
        strava: {
          client_configured: true,
          connected: true
        }
      })
      .mockResolvedValueOnce({
        status: "ok",
        time_utc: "2026-03-04T21:00:00+00:00",
        worker_last_heartbeat_utc: "2026-03-04T20:59:50+00:00",
        worker_heartbeat_healthy: true,
        activity_detection: {
          status: "new_activity_detected",
          new_activity_available: true,
          last_activity_id: "123",
          last_checked_at_utc: "2026-03-04T21:00:00+00:00",
          last_detected_at_utc: "2026-03-04T20:59:59+00:00"
        }
      });

    const snapshot = await getHealthStatusSnapshot();

    expect(snapshot.health?.status).toBe("ok");
    expect(snapshot.readiness?.status).toBe("ready");
    expect(snapshot.serviceMetrics?.status).toBe("ok");
    expect(snapshot.stravaStatus?.strava.connected).toBe(true);
    expect(snapshot.activityDetection?.worker_heartbeat_healthy).toBe(true);
    expect(snapshot.warnings).toEqual([]);
  });

  it("returns warnings and null values for failed snapshot endpoint calls", async () => {
    getJson
      .mockRejectedValueOnce(new Error("health fetch failed"))
      .mockResolvedValueOnce({
        status: "not_ready",
        time_utc: "2026-03-04T21:00:00+00:00",
        checks: {
          state_path_writable: true,
          template_accessible: false,
          worker_heartbeat_healthy: false
        }
      })
      .mockRejectedValueOnce(new Error("service metrics fetch failed"))
      .mockResolvedValueOnce({
        status: "ok",
        strava: {
          client_configured: true,
          connected: false
        }
      })
      .mockRejectedValueOnce(new Error("activity detection fetch failed"));

    const snapshot = await getHealthStatusSnapshot();

    expect(snapshot.health).toBeNull();
    expect(snapshot.serviceMetrics).toBeNull();
    expect(snapshot.activityDetection).toBeNull();
    expect(snapshot.readiness?.status).toBe("not_ready");
    expect(snapshot.stravaStatus?.strava.connected).toBe(false);
    expect(snapshot.warnings).toEqual([
      "Health endpoint unavailable: health fetch failed",
      "Service metrics endpoint unavailable: service metrics fetch failed",
      "Activity detection endpoint unavailable: activity detection fetch failed"
    ]);
  });
});
