import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../api/http-client";
import { ControlPage } from "./control-page";

const getControlActivityDetection = vi.fn();
const rerunLatestDescription = vi.fn();
const rerunSpecificActivityDescription = vi.fn();

vi.mock("../../api/control-api", () => ({
  getControlActivityDetection: (...args: unknown[]) => getControlActivityDetection(...args),
  rerunLatestDescription: (...args: unknown[]) => rerunLatestDescription(...args),
  rerunSpecificActivityDescription: (...args: unknown[]) => rerunSpecificActivityDescription(...args)
}));

describe("control page", () => {
  beforeEach(() => {
    getControlActivityDetection.mockResolvedValue({
      status: "ok",
      time_utc: "2026-03-04T20:00:00+00:00",
      worker_last_heartbeat_utc: "2026-03-04T19:59:59+00:00",
      worker_heartbeat_healthy: true,
      activity_detection: {
        status: "new_activity_detected",
        new_activity_available: true,
        last_activity_id: "17455368360",
        last_checked_at_utc: "2026-03-04T20:00:00+00:00",
        last_detected_at_utc: "2026-03-04T20:00:00+00:00",
      }
    });
    rerunLatestDescription.mockResolvedValue({
      status: "ok",
      result: {
        status: "updated",
        activity_id: 17455368360,
      },
      status_code: "updated",
      timestamp_utc: "2026-03-04T20:00:01+00:00",
      dashboard_refresh: "updated",
    });
    rerunSpecificActivityDescription.mockResolvedValue({
      status: "ok",
      result: {
        status: "updated",
        activity_id: 17455368360,
      },
      status_code: "updated",
      timestamp_utc: "2026-03-04T20:00:02+00:00",
      dashboard_refresh: "updated",
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("surfaces new activity availability from worker detection state", async () => {
    render(<ControlPage />);

    expect(screen.getByRole("heading", { name: "Control" })).toBeInTheDocument();
    expect(await screen.findByText("Health: Healthy")).toBeInTheDocument();
    expect(await screen.findByText("Status: new_activity_detected")).toBeInTheDocument();
    expect(await screen.findByText("New activity available for processing.")).toBeInTheDocument();
    expect(await screen.findByText("Last detected activity id: 17455368360")).toBeInTheDocument();
  });

  it("shows no-new-activity guidance when detection flag is false", async () => {
    getControlActivityDetection.mockResolvedValueOnce({
      status: "ok",
      time_utc: "2026-03-04T20:00:00+00:00",
      worker_last_heartbeat_utc: null,
      worker_heartbeat_healthy: false,
      activity_detection: {
        status: "no_new_activity",
        new_activity_available: false,
        last_activity_id: null,
        last_checked_at_utc: "2026-03-04T20:00:00+00:00",
        last_detected_at_utc: null,
      }
    });

    render(<ControlPage />);

    expect(await screen.findByText("Health: Unhealthy")).toBeInTheDocument();
    expect(await screen.findByText("Status: no_new_activity")).toBeInTheDocument();
    expect(await screen.findByText("No new activity currently detected.")).toBeInTheDocument();
    expect(await screen.findByText("Last detected activity id: Unavailable")).toBeInTheDocument();
  });

  it("shows error feedback when detection endpoint fails and retries on refresh", async () => {
    getControlActivityDetection
      .mockRejectedValueOnce(
        new ApiRequestError({
          message: "control status unavailable",
          status: 500,
        })
      )
      .mockResolvedValueOnce({
        status: "ok",
        time_utc: "2026-03-04T20:00:00+00:00",
        worker_last_heartbeat_utc: "2026-03-04T19:59:59+00:00",
        worker_heartbeat_healthy: true,
        activity_detection: {
          status: "new_activity_detected",
          new_activity_available: true,
          last_activity_id: "17455368360",
          last_checked_at_utc: "2026-03-04T20:00:00+00:00",
          last_detected_at_utc: "2026-03-04T20:00:00+00:00",
        }
      });

    render(<ControlPage />);

    expect(await screen.findByText("control status unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
    await waitFor(() => {
      expect(getControlActivityDetection).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("New activity available for processing.")).toBeInTheDocument();
  });

  it("surfaces rerun latest status code and timestamp", async () => {
    render(<ControlPage />);

    await screen.findByText("Health: Healthy");
    fireEvent.click(screen.getByRole("button", { name: "Rerun latest activity" }));

    expect(await screen.findByText("Rerun latest completed. Status: updated. Timestamp: 2026-03-04T20:00:01+00:00.")).toBeInTheDocument();
    expect(rerunLatestDescription).toHaveBeenCalledTimes(1);
  });

  it("shows lock retry guidance when rerun latest is already in progress", async () => {
    rerunLatestDescription.mockResolvedValueOnce({
      status: "ok",
      result: {
        status: "locked",
        lock_owner: "run_once:abc",
      },
      status_code: "locked",
      timestamp_utc: "2026-03-04T20:00:05+00:00",
      retry_guidance: "Another rerun is already in progress. Wait a few seconds, then retry.",
    });

    render(<ControlPage />);

    await screen.findByText("Health: Healthy");
    fireEvent.click(screen.getByRole("button", { name: "Rerun latest activity" }));

    expect(await screen.findByText(/Rerun latest did not start\. Status: locked\./)).toBeInTheDocument();
    expect(await screen.findByText(/Another rerun is already in progress/)).toBeInTheDocument();
  });

  it("surfaces status code and timestamp when rerun request fails", async () => {
    rerunLatestDescription.mockRejectedValueOnce(
      new ApiRequestError({
        message: "pipeline failed",
        status: 500,
        details: {
          status_code: "error",
          timestamp_utc: "2026-03-04T20:00:07+00:00",
        },
      })
    );

    render(<ControlPage />);

    await screen.findByText("Health: Healthy");
    fireEvent.click(screen.getByRole("button", { name: "Rerun latest activity" }));

    expect(
      await screen.findByText(
        "Rerun latest failed. Status: error. Timestamp: 2026-03-04T20:00:07+00:00. pipeline failed"
      )
    ).toBeInTheDocument();
  });

  it("prevents duplicate rerun clicks while request is in flight", async () => {
    let resolveRerun!: (value: {
      status: string;
      result: { status: string };
      status_code: string;
      timestamp_utc: string;
    }) => void;
    const pendingRerun = new Promise<{
      status: string;
      result: { status: string };
      status_code: string;
      timestamp_utc: string;
    }>((resolve) => {
      resolveRerun = resolve;
    });
    rerunLatestDescription.mockReturnValueOnce(pendingRerun);

    render(<ControlPage />);

    await screen.findByText("Health: Healthy");
    const rerunButton = screen.getByRole("button", { name: "Rerun latest activity" });
    fireEvent.click(rerunButton);
    fireEvent.click(rerunButton);

    expect(rerunLatestDescription).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Rerunning latest..." })).toBeDisabled();

    resolveRerun({
      status: "ok",
      result: { status: "updated" },
      status_code: "updated",
      timestamp_utc: "2026-03-04T20:00:11+00:00",
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Rerun latest activity" })).toBeEnabled();
    });
  });

  it("requires a valid numeric selected activity id before rerun", async () => {
    render(<ControlPage />);

    await screen.findByText("Health: Healthy");
    fireEvent.change(screen.getByLabelText("Specific activity ID"), { target: { value: "abc123" } });
    fireEvent.click(screen.getByRole("button", { name: "Rerun selected activity" }));

    expect(
      await screen.findByText("Enter a valid numeric activity ID before rerunning a specific activity.")
    ).toBeInTheDocument();
    expect(rerunSpecificActivityDescription).not.toHaveBeenCalled();
  });

  it("reruns a selected activity and surfaces status code and timestamp", async () => {
    rerunSpecificActivityDescription.mockResolvedValueOnce({
      status: "ok",
      result: {
        status: "updated",
        activity_id: 123456,
      },
      status_code: "updated",
      timestamp_utc: "2026-03-04T20:00:22+00:00",
      dashboard_refresh: "updated",
    });

    render(<ControlPage />);

    await screen.findByText("Health: Healthy");
    fireEvent.change(screen.getByLabelText("Specific activity ID"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Rerun selected activity" }));

    expect(
      await screen.findByText("Rerun activity 123456 completed. Status: updated. Timestamp: 2026-03-04T20:00:22+00:00.")
    ).toBeInTheDocument();
    expect(rerunSpecificActivityDescription).toHaveBeenCalledWith(123456);
  });

  it("shows lock retry guidance for selected activity rerun", async () => {
    rerunSpecificActivityDescription.mockResolvedValueOnce({
      status: "ok",
      result: {
        status: "locked",
        lock_owner: "run_once:def",
      },
      status_code: "locked",
      timestamp_utc: "2026-03-04T20:00:24+00:00",
      retry_guidance: "Another rerun is already in progress. Wait a few seconds, then retry.",
    });

    render(<ControlPage />);

    await screen.findByText("Health: Healthy");
    fireEvent.change(screen.getByLabelText("Specific activity ID"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Rerun selected activity" }));

    expect(await screen.findByText(/Rerun activity 123456 did not start\. Status: locked\./)).toBeInTheDocument();
    expect(await screen.findByText(/Another rerun is already in progress/)).toBeInTheDocument();
  });

  it("surfaces status code and timestamp when selected rerun request fails", async () => {
    rerunSpecificActivityDescription.mockRejectedValueOnce(
      new ApiRequestError({
        message: "specific pipeline failed",
        status: 500,
        details: {
          status_code: "error",
          timestamp_utc: "2026-03-04T20:00:27+00:00",
        },
      })
    );

    render(<ControlPage />);

    await screen.findByText("Health: Healthy");
    fireEvent.change(screen.getByLabelText("Specific activity ID"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Rerun selected activity" }));

    expect(
      await screen.findByText(
        "Rerun activity 123456 failed. Status: error. Timestamp: 2026-03-04T20:00:27+00:00. specific pipeline failed"
      )
    ).toBeInTheDocument();
  });

  it("prevents duplicate selected-rerun clicks while request is in flight", async () => {
    let resolveSpecificRerun!: (value: {
      status: string;
      result: { status: string };
      status_code: string;
      timestamp_utc: string;
    }) => void;
    const pendingSpecific = new Promise<{
      status: string;
      result: { status: string };
      status_code: string;
      timestamp_utc: string;
    }>((resolve) => {
      resolveSpecificRerun = resolve;
    });
    rerunSpecificActivityDescription.mockReturnValueOnce(pendingSpecific);

    render(<ControlPage />);

    await screen.findByText("Health: Healthy");
    fireEvent.change(screen.getByLabelText("Specific activity ID"), { target: { value: "123456" } });
    const selectedButton = screen.getByRole("button", { name: "Rerun selected activity" });
    fireEvent.click(selectedButton);
    fireEvent.click(selectedButton);

    expect(rerunSpecificActivityDescription).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Rerunning selected..." })).toBeDisabled();

    resolveSpecificRerun({
      status: "ok",
      result: { status: "updated" },
      status_code: "updated",
      timestamp_utc: "2026-03-04T20:00:30+00:00",
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Rerun selected activity" })).toBeEnabled();
    });
  });
});
