import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getControlActivityDetection,
  rerunLatestDescription,
  rerunSpecificActivityDescription
} from "./control-api";

const getJson = vi.fn();

vi.mock("./http-client", () => ({
  getJson: (...args: unknown[]) => getJson(...args)
}));

describe("control api", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("loads activity detection status for control page", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      time_utc: "2026-03-04T00:00:00+00:00",
      worker_last_heartbeat_utc: "2026-03-04T00:00:00+00:00",
      worker_heartbeat_healthy: true,
      activity_detection: {
        status: "new_activity_detected",
        new_activity_available: true,
        last_activity_id: "17455368360",
        last_checked_at_utc: "2026-03-04T00:00:00+00:00",
        last_detected_at_utc: "2026-03-04T00:00:00+00:00",
      }
    });

    await getControlActivityDetection();

    expect(getJson).toHaveBeenCalledWith("/control/activity-detection");
  });

  it("posts rerun latest request for control page action", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      result: {
        status: "updated",
        activity_id: 17455368360
      },
      status_code: "updated",
      timestamp_utc: "2026-03-04T00:00:01+00:00",
      dashboard_refresh: "updated"
    });

    await rerunLatestDescription();

    expect(getJson).toHaveBeenCalledWith("/rerun/latest", { method: "POST" });
  });

  it("posts rerun specific-activity request for control page action", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      result: {
        status: "updated",
        activity_id: 123456
      },
      status_code: "updated",
      timestamp_utc: "2026-03-04T00:00:02+00:00"
    });

    await rerunSpecificActivityDescription(123456);

    expect(getJson).toHaveBeenCalledWith("/rerun/activity/123456", { method: "POST" });
  });

  it("rejects invalid specific activity ids before calling API", async () => {
    await expect(rerunSpecificActivityDescription(0)).rejects.toThrow("activityId must be greater than zero.");
    expect(getJson).not.toHaveBeenCalled();
  });
});
