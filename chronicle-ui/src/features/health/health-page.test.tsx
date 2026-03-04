import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HealthPage } from "./health-page";

const getHealthStatusSnapshot = vi.fn();

vi.mock("../../api/health-status-api", () => ({
  getHealthStatusSnapshot: (...args: unknown[]) => getHealthStatusSnapshot(...args)
}));

function renderHealthPage() {
  return render(
    <MemoryRouter>
      <HealthPage />
    </MemoryRouter>
  );
}

describe("health page", () => {
  beforeEach(() => {
    getHealthStatusSnapshot.mockResolvedValue({
      health: {
        status: "ok",
        time_utc: "2026-03-04T21:10:00+00:00",
        latest_payload_exists: true,
        worker_last_heartbeat_utc: "2026-03-04T21:09:50+00:00"
      },
      readiness: {
        status: "ready",
        time_utc: "2026-03-04T21:10:00+00:00",
        checks: {
          state_path_writable: true,
          template_accessible: true,
          worker_heartbeat_healthy: true
        },
        cycle_last_status: "ok",
        cycle_last_error: null
      },
      serviceMetrics: {
        status: "ok",
        time_utc: "2026-03-04T21:10:00+00:00",
        cycle_service_calls: {
          strava: 1
        }
      },
      stravaStatus: {
        status: "ok",
        strava: {
          client_configured: true,
          connected: true,
          has_refresh_token: true,
          has_access_token: true
        }
      },
      activityDetection: {
        status: "ok",
        time_utc: "2026-03-04T21:10:00+00:00",
        worker_last_heartbeat_utc: "2026-03-04T21:09:50+00:00",
        worker_heartbeat_healthy: true,
        activity_detection: {
          status: "no_new_activity",
          new_activity_available: false,
          last_activity_id: null,
          last_checked_at_utc: "2026-03-04T21:10:00+00:00",
          last_detected_at_utc: null
        }
      },
      warnings: []
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("renders healthy statuses and no-action guidance when services are healthy", async () => {
    renderHealthPage();

    expect(screen.getByRole("heading", { name: "Health" })).toBeInTheDocument();
    expect(await screen.findByTestId("health-panel-readiness")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open troubleshooting guide" })).toHaveAttribute("href", "/troubleshooting");
    expect(screen.getByTestId("health-panel-status-readiness")).toHaveTextContent("Status: Healthy");
    expect(screen.getByTestId("health-panel-status-payload")).toHaveTextContent("Status: Healthy");
    expect(screen.getByTestId("health-panel-status-worker")).toHaveTextContent("Status: Healthy");
    expect(screen.getByTestId("health-panel-status-strava")).toHaveTextContent("Status: Healthy");
    expect(screen.getByTestId("health-panel-status-metrics")).toHaveTextContent("Status: Healthy");
    expect(screen.getAllByText("Next action: No action required.").length).toBeGreaterThan(0);
  });

  it("renders warning and error states with recommended actions", async () => {
    getHealthStatusSnapshot.mockResolvedValueOnce({
      health: {
        status: "ok",
        time_utc: "2026-03-04T21:10:00+00:00",
        latest_payload_exists: false,
        worker_last_heartbeat_utc: null
      },
      readiness: {
        status: "not_ready",
        time_utc: "2026-03-04T21:10:00+00:00",
        checks: {
          state_path_writable: true,
          template_accessible: false,
          worker_heartbeat_healthy: false
        },
        cycle_last_status: "error",
        cycle_last_error: "template missing"
      },
      serviceMetrics: {
        status: "ok",
        time_utc: "2026-03-04T21:10:00+00:00",
        cycle_service_calls: {}
      },
      stravaStatus: {
        status: "ok",
        strava: {
          client_configured: false,
          connected: false,
          has_refresh_token: false,
          has_access_token: false
        }
      },
      activityDetection: {
        status: "ok",
        time_utc: "2026-03-04T21:10:00+00:00",
        worker_last_heartbeat_utc: null,
        worker_heartbeat_healthy: false,
        activity_detection: {
          status: "unknown",
          new_activity_available: false,
          last_activity_id: null,
          last_checked_at_utc: null,
          last_detected_at_utc: null
        }
      },
      warnings: []
    });

    renderHealthPage();

    expect(await screen.findByTestId("health-panel-status-readiness")).toHaveTextContent("Status: Warning");
    expect(screen.getByTestId("health-panel-status-payload")).toHaveTextContent("Status: Error");
    expect(screen.getByTestId("health-panel-status-worker")).toHaveTextContent("Status: Error");
    expect(screen.getByTestId("health-panel-status-strava")).toHaveTextContent("Status: Error");
    expect(screen.getByText("Next action: Open Build and configure/validate the active template.")).toBeInTheDocument();
    expect(screen.getByText("Next action: Open Sources and provide Strava client ID and secret.")).toBeInTheDocument();
  });

  it("shows endpoint warnings when partial snapshot data is unavailable", async () => {
    getHealthStatusSnapshot.mockResolvedValueOnce({
      health: null,
      readiness: {
        status: "ready",
        time_utc: "2026-03-04T21:10:00+00:00",
        checks: {
          state_path_writable: true,
          template_accessible: true,
          worker_heartbeat_healthy: true
        }
      },
      serviceMetrics: null,
      stravaStatus: null,
      activityDetection: null,
      warnings: [
        "Health endpoint unavailable: timeout",
        "Service metrics endpoint unavailable: timeout"
      ]
    });

    renderHealthPage();

    expect(await screen.findByText("Health endpoint unavailable: timeout")).toBeInTheDocument();
    expect(screen.getByText("Service metrics endpoint unavailable: timeout")).toBeInTheDocument();
    expect(screen.getByTestId("health-panel-status-payload")).toHaveTextContent("Status: Error");
    expect(screen.getByTestId("health-panel-status-worker")).toHaveTextContent("Status: Error");
  });

  it("refreshes health snapshot when refresh button is clicked", async () => {
    renderHealthPage();

    await screen.findByTestId("health-panel-readiness");
    fireEvent.click(screen.getByRole("button", { name: "Refresh health" }));

    await waitFor(() => {
      expect(getHealthStatusSnapshot).toHaveBeenCalledTimes(2);
    });
  });

  it("shows page error when snapshot load throws", async () => {
    getHealthStatusSnapshot.mockRejectedValueOnce(new Error("health unavailable"));

    renderHealthPage();

    expect(await screen.findByText("health unavailable")).toBeInTheDocument();
  });
});
