import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../api/http-client";
import { PlanPage } from "./plan-page";

const getPlanData = vi.fn();
const updatePlanDaysBulk = vi.fn();
const getPlanWorkouts = vi.fn();
const upsertPlanWorkout = vi.fn();
const sendPlanDayWorkoutToGarmin = vi.fn();
const resolvePlanDayGarminSyncResult = vi.fn();

vi.mock("../../api/plan-api", () => ({
  getPlanData: (...args: unknown[]) => getPlanData(...args),
  updatePlanDaysBulk: (...args: unknown[]) => updatePlanDaysBulk(...args),
  getPlanWorkouts: (...args: unknown[]) => getPlanWorkouts(...args),
  upsertPlanWorkout: (...args: unknown[]) => upsertPlanWorkout(...args),
  sendPlanDayWorkoutToGarmin: (...args: unknown[]) => sendPlanDayWorkoutToGarmin(...args),
  resolvePlanDayGarminSyncResult: (...args: unknown[]) => resolvePlanDayGarminSyncResult(...args)
}));

function p95(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
}

function isoDate(offsetDays: number): string {
  const base = new Date(Date.UTC(2026, 2, 1));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  const year = String(base.getUTCFullYear());
  const month = String(base.getUTCMonth() + 1).padStart(2, "0");
  const day = String(base.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPlanPayload(days = 21): Record<string, unknown> {
  const rows = Array.from({ length: days }).map((_, index) => {
    const date = isoDate(index);
    return {
      date,
      is_today: index === 10,
      is_past_or_today: index <= 10,
      is_complete: false,
      run_type: "Easy",
      notes: "",
      planned_miles: 5,
      planned_input: "5",
      planned_sessions_detail: [
        {
          ordinal: 1,
          planned_miles: 5,
          run_type: "Easy",
          workout_code: "",
          planned_workout: ""
        }
      ],
      actual_miles: 0,
      day_delta: -5,
      weekly_total: 35,
      wow_change: 0.04,
      long_pct: 0.31,
      monthly_total: 140,
      mom_change: 0.02,
      t7_miles: 35,
      t7_p7_ratio: 1.02,
      t30_miles: 150,
      t30_p30_ratio: 1.03,
      avg30_miles_per_day: 5,
      mi_t30_ratio: 1.0,
      bands: {
        wow_change: "good",
        long_pct: "good",
        mi_t30_ratio: "good",
        t7_p7_ratio: "good",
        t30_p30_ratio: "good",
        session_spike_ratio: "good"
      }
    };
  });

  return {
    status: "ok",
    timezone: "UTC",
    today: isoDate(10),
    center_date: isoDate(10),
    min_center_date: isoDate(-45),
    max_center_date: isoDate(365),
    window_days: 14,
    start_date: isoDate(0),
    end_date: isoDate(days - 1),
    summary: {
      anchor_date: isoDate(10),
      week_planned: 35,
      week_actual: 0,
      week_delta: -35
    },
    run_type_options: ["", "Easy", "Recovery", "SOS", "Long Road", "Long Moderate", "Long Trail", "Race", "LT1", "LT2", "HIIT"],
    rows
  };
}

describe("plan page", () => {
  beforeEach(() => {
    getPlanData.mockResolvedValue(buildPlanPayload());
    getPlanWorkouts.mockResolvedValue({ status: "ok", workouts: [] });
    upsertPlanWorkout.mockResolvedValue({
      status: "ok",
      workout: {
        workout_code: "2E-5x1k-I",
        title: "2E + 5x1k @I + 2E",
        structure: "warmup: 2E\nmain: 5x1k @I w/3:00 jog\ncooldown: 2E"
      },
      workouts: []
    });
    updatePlanDaysBulk.mockResolvedValue({
      status: "ok",
      saved_count: 1,
      days: [{ date_local: isoDate(0), planned_total_miles: 7, run_type: "Easy" }]
    });
    sendPlanDayWorkoutToGarmin.mockResolvedValue({
      status: "ok",
      date_local: isoDate(0),
      sync: {
        request_id: "sync-req-1",
        date_local: isoDate(0),
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        status: "pending",
        status_code: "queued",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:00+00:00",
      }
    });
    resolvePlanDayGarminSyncResult.mockResolvedValue({
      status: "ok",
      date_local: isoDate(0),
      sync: {
        request_id: "sync-req-1",
        date_local: isoDate(0),
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        status: "succeeded",
        status_code: "calendar_scheduled",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:02+00:00",
        calendar_entry_id: "gcal-1",
        next_step: "report_sync_result",
      },
      result: {
        outcome: "scheduled",
        status_code: "calendar_scheduled",
        timestamp_utc: "2026-03-04T00:00:02+00:00",
        message: "Workout scheduled on Garmin calendar.",
        attempt_count: 1,
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("loads and renders a multi-week editable plan grid", async () => {
    render(<PlanPage />);

    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
    const firstInput = await screen.findByLabelText(`Planned miles for ${isoDate(0)}`);
    expect(firstInput).toHaveValue("5");
    expect(screen.getByText(isoDate(0))).toBeInTheDocument();

    const plannedInputs = screen.getAllByRole("textbox", { name: /planned miles for/i });
    expect(plannedInputs.length).toBeGreaterThanOrEqual(14);
    expect(screen.getByLabelText(`Workout for ${isoDate(0)}`)).toBeInTheDocument();
  });

  it("creates workout definitions in workshop and makes them selectable in day rows", async () => {
    getPlanWorkouts
      .mockResolvedValueOnce({ status: "ok", workouts: [] })
      .mockResolvedValueOnce({
        status: "ok",
        workouts: [
          {
            workout_code: "Tempo-6x1k",
            title: "Tempo 6x1k",
            structure: "warmup: 2E\nmain: 6x1k @I w/3:00 jog\ncooldown: 2E",
            updated_at_utc: "2026-03-04T00:00:00+00:00",
          }
        ],
      });
    upsertPlanWorkout.mockResolvedValueOnce({
      status: "ok",
      workout: {
        workout_code: "Tempo-6x1k",
        title: "Tempo 6x1k",
        structure: "warmup: 2E\nmain: 6x1k @I w/3:00 jog\ncooldown: 2E",
        updated_at_utc: "2026-03-04T00:00:00+00:00",
      },
      workouts: [],
    });

    render(<PlanPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open Workout Workshop" }));
    const codeInput = await screen.findByLabelText("Workout code");
    fireEvent.change(codeInput, { target: { value: "Tempo-6x1k" } });
    fireEvent.change(screen.getByLabelText("Workout title"), { target: { value: "Tempo 6x1k" } });
    fireEvent.change(screen.getByLabelText("Workout structure"), {
      target: { value: "warmup: 2E\nmain: 6x1k @I w/3:00 jog\ncooldown: 2E" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save workout" }));

    await waitFor(() => {
      expect(upsertPlanWorkout).toHaveBeenCalledWith("Tempo-6x1k", {
        workout_code: "Tempo-6x1k",
        title: "Tempo 6x1k",
        structure: "warmup: 2E\nmain: 6x1k @I w/3:00 jog\ncooldown: 2E"
      });
    });
    expect(await screen.findByText('Saved workout "Tempo-6x1k".')).toBeInTheDocument();

    const workoutSelect = await screen.findByLabelText(`Workout for ${isoDate(0)}`);
    await waitFor(() => {
      expect(workoutSelect.querySelector('option[value="Tempo-6x1k"]')).not.toBeNull();
    });
    fireEvent.change(workoutSelect, { target: { value: "Tempo-6x1k" } });
    expect(screen.getByLabelText(`Workout for ${isoDate(0)}`)).toHaveValue("Tempo-6x1k");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updatePlanDaysBulk).toHaveBeenCalledWith({
        days: [
          {
            date_local: isoDate(0),
            sessions: [
              {
                planned_miles: 5,
                workout_code: "Tempo-6x1k"
              }
            ]
          }
        ]
      });
    });
  });

  it("filters workout options by search text and allows attaching a matched workout", async () => {
    render(<PlanPage />);

    const workoutSelect = await screen.findByLabelText(`Workout for ${isoDate(0)}`);
    const searchInput = await screen.findByLabelText("Workout search");
    fireEvent.change(searchInput, { target: { value: "norwegian" } });

    expect(await screen.findByText('Showing 3 matching workouts for "norwegian".')).toBeInTheDocument();
    expect(
      workoutSelect.querySelector('option[value="15WU + 4x4min @LT2 w/3min easy + 10CD (Norwegian 4x4)"]')
    ).not.toBeNull();
    expect(
      workoutSelect.querySelector('option[value="2E + 20T + 2E (Jack Daniels tempo)"]')
    ).toBeNull();

    fireEvent.change(workoutSelect, {
      target: { value: "15WU + 4x4min @LT2 w/3min easy + 10CD (Norwegian 4x4)" }
    });
    expect(screen.getByLabelText(`Workout for ${isoDate(0)}`)).toHaveValue(
      "15WU + 4x4min @LT2 w/3min easy + 10CD (Norwegian 4x4)"
    );

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(updatePlanDaysBulk).toHaveBeenCalledWith({
        days: [
          {
            date_local: isoDate(0),
            sessions: [
              {
                planned_miles: 5,
                workout_code: "15WU + 4x4min @LT2 w/3min easy + 10CD (Norwegian 4x4)"
              }
            ]
          }
        ]
      });
    });
  });

  it("shows workshop validation errors for missing required workout fields", async () => {
    render(<PlanPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open Workout Workshop" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save workout" }));
    expect(await screen.findByText("Workout code is required.")).toBeInTheDocument();
    expect(upsertPlanWorkout).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Workout code"), { target: { value: "Tempo-Example" } });
    fireEvent.click(screen.getByRole("button", { name: "Save workout" }));
    expect(await screen.findByText("Workout structure is required.")).toBeInTheDocument();
    expect(upsertPlanWorkout).not.toHaveBeenCalled();
  });

  it("shows backend workout workshop validation guidance on save failure", async () => {
    upsertPlanWorkout.mockRejectedValueOnce(
      new ApiRequestError({
        message: "structure is required.",
        status: 400
      })
    );

    render(<PlanPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open Workout Workshop" }));
    fireEvent.change(await screen.findByLabelText("Workout code"), { target: { value: "Tempo-Error" } });
    fireEvent.change(screen.getByLabelText("Workout structure"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Save workout" }));

    expect(await screen.findByText("Workout structure is required.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Workout structure"), { target: { value: "main: tempo" } });
    fireEvent.click(screen.getByRole("button", { name: "Save workout" }));

    expect(await screen.findByText("structure is required.")).toBeInTheDocument();
  });

  it("blocks workshop save when workout code contains invalid path separators", async () => {
    render(<PlanPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open Workout Workshop" }));
    fireEvent.change(await screen.findByLabelText("Workout code"), { target: { value: "Tempo/Invalid" } });
    fireEvent.change(screen.getByLabelText("Workout structure"), { target: { value: "main: tempo" } });
    fireEvent.click(screen.getByRole("button", { name: "Save workout" }));

    expect(await screen.findByText("Workout code cannot contain '/' or '\\'.")).toBeInTheDocument();
    expect(upsertPlanWorkout).not.toHaveBeenCalled();
  });

  it("shows workshop reload warning when save succeeds but definitions refresh fails", async () => {
    getPlanWorkouts
      .mockResolvedValueOnce({ status: "ok", workouts: [] })
      .mockRejectedValueOnce(new Error("Workshop reload failed."));
    upsertPlanWorkout.mockResolvedValueOnce({
      status: "ok",
      workout: {
        workout_code: "Tempo-Warn",
        title: "Tempo Warn",
        structure: "main: tempo",
      },
      workouts: [],
    });

    render(<PlanPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open Workout Workshop" }));
    fireEvent.change(await screen.findByLabelText("Workout code"), { target: { value: "Tempo-Warn" } });
    fireEvent.change(screen.getByLabelText("Workout structure"), { target: { value: "main: tempo" } });
    fireEvent.click(screen.getByRole("button", { name: "Save workout" }));

    expect(
      await screen.findByText('Workout saved, but latest workshop list reload failed. Use "Reload" to retry.')
    ).toBeInTheDocument();
  });

  it("saves edited plan entries through the bulk endpoint", async () => {
    const savedPayload = buildPlanPayload();
    ((savedPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).planned_input = "7";
    ((savedPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).planned_miles = 7;
    getPlanData.mockResolvedValueOnce(buildPlanPayload()).mockResolvedValueOnce(savedPayload);

    render(<PlanPage />);

    const firstInput = await screen.findByLabelText(`Planned miles for ${isoDate(0)}`);
    fireEvent.change(firstInput, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updatePlanDaysBulk).toHaveBeenCalledWith({
        days: [{ date_local: isoDate(0), distance: "7" }]
      });
    });
    expect(await screen.findByText("Saved 1 day.")).toBeInTheDocument();
  });

  it("saves both run type and mileage and reflects persisted values after refresh", async () => {
    const savedPayload = buildPlanPayload();
    ((savedPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).planned_input = "8";
    ((savedPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).planned_miles = 8;
    ((savedPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).run_type = "SOS";
    getPlanData.mockResolvedValueOnce(buildPlanPayload()).mockResolvedValueOnce(savedPayload);

    render(<PlanPage />);

    const firstDistanceInput = await screen.findByLabelText(`Planned miles for ${isoDate(0)}`);
    const firstRunTypeSelect = await screen.findByLabelText(`Run type for ${isoDate(0)}`);
    fireEvent.change(firstDistanceInput, { target: { value: "8" } });
    fireEvent.change(firstRunTypeSelect, { target: { value: "SOS" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updatePlanDaysBulk).toHaveBeenCalledWith({
        days: [{ date_local: isoDate(0), distance: "8", run_type: "SOS" }]
      });
    });
    expect(await screen.findByText("Saved 1 day.")).toBeInTheDocument();
    expect(screen.getByLabelText(`Run type for ${isoDate(0)}`)).toHaveValue("SOS");
    expect(screen.getByLabelText(`Planned miles for ${isoDate(0)}`)).toHaveValue("8");
  });

  it("allows clearing run type to unspecified and persists that change", async () => {
    const savedPayload = buildPlanPayload();
    ((savedPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).run_type = "";
    getPlanData.mockResolvedValueOnce(buildPlanPayload()).mockResolvedValueOnce(savedPayload);

    render(<PlanPage />);

    const firstRunTypeSelect = await screen.findByLabelText(`Run type for ${isoDate(0)}`);
    fireEvent.change(firstRunTypeSelect, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updatePlanDaysBulk).toHaveBeenCalledWith({
        days: [{ date_local: isoDate(0), run_type: "" }]
      });
    });
    expect(await screen.findByText("Saved 1 day.")).toBeInTheDocument();
    expect(screen.getByLabelText(`Run type for ${isoDate(0)}`)).toHaveValue("");
  });

  it("attaches a workout to a day and keeps it visible after refresh", async () => {
    const savedPayload = buildPlanPayload();
    ((savedPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).planned_sessions_detail = [
      {
        ordinal: 1,
        planned_miles: 5,
        run_type: "Easy",
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        planned_workout: "2E + 20T + 2E (Jack Daniels tempo)"
      }
    ];
    getPlanData.mockResolvedValueOnce(buildPlanPayload()).mockResolvedValueOnce(savedPayload);

    render(<PlanPage />);

    const workoutSelect = await screen.findByLabelText(`Workout for ${isoDate(0)}`);
    fireEvent.change(workoutSelect, { target: { value: "2E + 20T + 2E (Jack Daniels tempo)" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updatePlanDaysBulk).toHaveBeenCalledWith({
        days: [
          {
            date_local: isoDate(0),
            sessions: [
              {
                planned_miles: 5,
                workout_code: "2E + 20T + 2E (Jack Daniels tempo)"
              }
            ]
          }
        ]
      });
    });
    expect(await screen.findByText("Saved 1 day.")).toBeInTheDocument();
    expect(screen.getByLabelText(`Workout for ${isoDate(0)}`)).toHaveValue("2E + 20T + 2E (Jack Daniels tempo)");
  });

  it("shows send-to-garmin action for days with attached workouts and displays completion result", async () => {
    const initialPayload = buildPlanPayload();
    ((initialPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).planned_sessions_detail = [
      {
        ordinal: 1,
        planned_miles: 5,
        run_type: "SOS",
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        planned_workout: "2E + 20T + 2E (Jack Daniels tempo)"
      }
    ];
    getPlanData.mockResolvedValueOnce(initialPayload);
    sendPlanDayWorkoutToGarmin.mockResolvedValueOnce({
      status: "ok",
      date_local: isoDate(0),
      sync: {
        request_id: "sync-req-5-1",
        date_local: isoDate(0),
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        status: "pending",
        status_code: "queued",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:00+00:00",
      }
    });
    resolvePlanDayGarminSyncResult.mockResolvedValueOnce({
      status: "ok",
      date_local: isoDate(0),
      sync: {
        request_id: "sync-req-5-1",
        date_local: isoDate(0),
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        status: "succeeded",
        status_code: "calendar_scheduled",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:02+00:00",
        calendar_entry_id: "gcal-1",
        next_step: "report_sync_result",
      },
      result: {
        outcome: "scheduled",
        status_code: "calendar_scheduled",
        timestamp_utc: "2026-03-04T00:00:02+00:00",
        message: "Workout scheduled on Garmin calendar.",
        attempt_count: 1,
      }
    });

    render(<PlanPage />);

    const sendButton = await screen.findByRole("button", {
      name: `Send to Garmin for ${isoDate(0)}`
    });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(sendPlanDayWorkoutToGarmin).toHaveBeenCalledWith(isoDate(0), {
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)"
      });
    });
    expect(resolvePlanDayGarminSyncResult).toHaveBeenCalledWith(isoDate(0), {
      workout_code: "2E + 20T + 2E (Jack Daniels tempo)"
    });
    expect(
      await screen.findByText(
        `Garmin sync completed for ${isoDate(0)}. Status: calendar_scheduled. Timestamp: 2026-03-04T00:00:02+00:00. Scheduling confirmed.`
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Garmin sync: succeeded (calendar_scheduled) at 2026-03-04T00:00:02+00:00")
    ).toBeInTheDocument();
  });

  it("shows actionable send-to-garmin error guidance when sync initiation fails", async () => {
    const initialPayload = buildPlanPayload();
    ((initialPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).planned_sessions_detail = [
      {
        ordinal: 1,
        planned_miles: 5,
        run_type: "SOS",
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        planned_workout: "2E + 20T + 2E (Jack Daniels tempo)"
      }
    ];
    getPlanData.mockResolvedValueOnce(initialPayload);
    sendPlanDayWorkoutToGarmin.mockRejectedValueOnce(
      new ApiRequestError({
        message: "No workout is attached to this plan day. Attach a workout before sending to Garmin.",
        status: 400
      })
    );

    render(<PlanPage />);

    const sendButton = await screen.findByRole("button", {
      name: `Send to Garmin for ${isoDate(0)}`
    });
    fireEvent.click(sendButton);

    expect(
      await screen.findByText("No workout is attached to this plan day. Attach a workout before sending to Garmin.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Garmin sync: pending (queued)")).not.toBeInTheDocument();
    expect(resolvePlanDayGarminSyncResult).not.toHaveBeenCalled();
  });

  it("shows retry guidance when sync result resolution fails", async () => {
    const initialPayload = buildPlanPayload();
    ((initialPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).planned_sessions_detail = [
      {
        ordinal: 1,
        planned_miles: 5,
        run_type: "SOS",
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        planned_workout: "2E + 20T + 2E (Jack Daniels tempo)"
      }
    ];
    getPlanData.mockResolvedValueOnce(initialPayload);
    sendPlanDayWorkoutToGarmin.mockResolvedValueOnce({
      status: "ok",
      date_local: isoDate(0),
      sync: {
        request_id: "sync-req-5-4",
        date_local: isoDate(0),
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        status: "pending",
        status_code: "queued",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:00+00:00",
      }
    });
    resolvePlanDayGarminSyncResult.mockResolvedValueOnce({
      status: "error",
      date_local: isoDate(0),
      sync: {
        request_id: "sync-req-5-4",
        date_local: isoDate(0),
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        status: "failed",
        status_code: "schedule_failed",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:03+00:00",
        retry_guidance: "Retry Garmin sync from Plan after checking Garmin connection settings.",
      },
      result: {
        outcome: "failed",
        status_code: "schedule_failed",
        timestamp_utc: "2026-03-04T00:00:03+00:00",
        message: "Garmin schedule failed.",
        retry_guidance: "Retry Garmin sync from Plan after checking Garmin connection settings.",
        attempt_count: 2,
      }
    });

    render(<PlanPage />);

    const sendButton = await screen.findByRole("button", {
      name: `Send to Garmin for ${isoDate(0)}`
    });
    fireEvent.click(sendButton);

    expect(
      await screen.findByText(
        `Garmin sync failed for ${isoDate(0)}. Status: schedule_failed. Timestamp: 2026-03-04T00:00:03+00:00. Retry Garmin sync from Plan after checking Garmin connection settings.`
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Retry Garmin sync from Plan after checking Garmin connection settings.")
    ).toBeInTheDocument();
  });

  it("requires saving day edits before allowing send-to-garmin action", async () => {
    const initialPayload = buildPlanPayload();
    ((initialPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).planned_sessions_detail = [
      {
        ordinal: 1,
        planned_miles: 5,
        run_type: "SOS",
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        planned_workout: "2E + 20T + 2E (Jack Daniels tempo)"
      }
    ];
    getPlanData.mockResolvedValueOnce(initialPayload);

    render(<PlanPage />);

    const runTypeSelect = await screen.findByLabelText(`Run type for ${isoDate(0)}`);
    fireEvent.change(runTypeSelect, { target: { value: "Recovery" } });

    const sendButton = screen.getByRole("button", {
      name: `Send to Garmin for ${isoDate(0)}`
    });
    expect(sendButton).toBeDisabled();
    expect(await screen.findByText("Save day changes before sending to Garmin.")).toBeInTheDocument();
    expect(sendPlanDayWorkoutToGarmin).not.toHaveBeenCalled();
  });

  it("hides send-to-garmin action when no workout is attached to a day", async () => {
    render(<PlanPage />);

    await screen.findByLabelText(`Workout for ${isoDate(0)}`);
    expect(
      screen.queryByRole("button", { name: `Send to Garmin for ${isoDate(0)}` })
    ).not.toBeInTheDocument();
  });

  it("updates run type on a day with workout without rewriting session payload", async () => {
    const initialPayload = buildPlanPayload();
    ((initialPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).planned_sessions_detail = [
      {
        ordinal: 1,
        planned_miles: 5,
        run_type: "Easy",
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        planned_workout: "2E + 20T + 2E (Jack Daniels tempo)"
      }
    ];
    const savedPayload = buildPlanPayload();
    ((savedPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).run_type = "SOS";
    ((savedPayload.rows as Array<Record<string, unknown>>)[0] ?? {}).planned_sessions_detail = [
      {
        ordinal: 1,
        planned_miles: 5,
        run_type: "SOS",
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        planned_workout: "2E + 20T + 2E (Jack Daniels tempo)"
      }
    ];
    getPlanData.mockResolvedValueOnce(initialPayload).mockResolvedValueOnce(savedPayload);

    render(<PlanPage />);

    const firstRunTypeSelect = await screen.findByLabelText(`Run type for ${isoDate(0)}`);
    fireEvent.change(firstRunTypeSelect, { target: { value: "SOS" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updatePlanDaysBulk).toHaveBeenCalledWith({
        days: [{ date_local: isoDate(0), run_type: "SOS" }]
      });
    });
    expect(await screen.findByText("Saved 1 day.")).toBeInTheDocument();
    expect(screen.getByLabelText(`Run type for ${isoDate(0)}`)).toHaveValue("SOS");
    expect(screen.getByLabelText(`Workout for ${isoDate(0)}`)).toHaveValue("2E + 20T + 2E (Jack Daniels tempo)");
  });

  it("shows client-side guidance for malformed distance syntax before save", async () => {
    render(<PlanPage />);

    const firstInput = await screen.findByLabelText(`Planned miles for ${isoDate(0)}`);
    fireEvent.change(firstInput, { target: { value: "6++4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/distance must be numeric or '\+' separated numeric values\./i)).toBeInTheDocument();
    expect(updatePlanDaysBulk).not.toHaveBeenCalled();
    expect(getPlanData).toHaveBeenCalledTimes(1);
  });

  it("shows clear corrective guidance and reloads authoritative state when save fails", async () => {
    getPlanData.mockResolvedValueOnce(buildPlanPayload()).mockResolvedValueOnce(buildPlanPayload());
    updatePlanDaysBulk.mockRejectedValueOnce(
      new ApiRequestError({
        message: "distance must be >= 0.",
        status: 400
      })
    );

    render(<PlanPage />);

    const firstInput = await screen.findByLabelText(`Planned miles for ${isoDate(0)}`);
    fireEvent.change(firstInput, { target: { value: "-3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/distance must be >= 0\./i)).toBeInTheDocument();
    await waitFor(() => {
      expect(getPlanData).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByLabelText(`Planned miles for ${isoDate(0)}`)).toHaveValue("5");
    });
  });

  it("shows backend run-type rejection guidance and reloads authoritative state", async () => {
    getPlanData.mockResolvedValueOnce(buildPlanPayload()).mockResolvedValueOnce(buildPlanPayload());
    updatePlanDaysBulk.mockRejectedValueOnce(
      new ApiRequestError({
        message: "run_type must be one of: Easy, Recovery, SOS, Long Road, Long Moderate, Long Trail, Race, LT1, LT2, HIIT.",
        status: 400
      })
    );

    render(<PlanPage />);

    const firstRunTypeSelect = await screen.findByLabelText(`Run type for ${isoDate(0)}`);
    fireEvent.change(firstRunTypeSelect, { target: { value: "SOS" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/run_type must be one of:/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(getPlanData).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByLabelText(`Run type for ${isoDate(0)}`)).toHaveValue("Easy");
    });
  });

  it("keeps existing grid data visible when a reload request fails", async () => {
    getPlanData
      .mockResolvedValueOnce(buildPlanPayload())
      .mockRejectedValueOnce(new Error("Latest plan reload failed."));

    render(<PlanPage />);

    expect(await screen.findByLabelText(`Planned miles for ${isoDate(0)}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));

    expect(await screen.findByText("Latest plan reload failed.")).toBeInTheDocument();
    expect(screen.getByLabelText(`Planned miles for ${isoDate(0)}`)).toBeInTheDocument();
  });

  it("shows a reload warning when save succeeds but follow-up grid refresh fails", async () => {
    getPlanData
      .mockResolvedValueOnce(buildPlanPayload())
      .mockRejectedValueOnce(new Error("Refresh after save failed."));
    updatePlanDaysBulk.mockResolvedValueOnce({
      status: "ok",
      saved_count: 1,
      days: [{ date_local: isoDate(0), planned_total_miles: 7, run_type: "Easy" }]
    });

    render(<PlanPage />);

    const firstInput = await screen.findByLabelText(`Planned miles for ${isoDate(0)}`);
    fireEvent.change(firstInput, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Plan changes were saved, but the latest grid reload failed. Use Reload to retry.")
    ).toBeInTheDocument();
    expect(updatePlanDaysBulk).toHaveBeenCalledTimes(1);
  });

  it("emits load and save timing telemetry with sub-second p95 in tests", async () => {
    const events: Array<{ source?: string; metric?: string; duration_ms?: number }> = [];
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ source?: string; metric?: string; duration_ms?: number }>;
      events.push(customEvent.detail ?? {});
    };
    window.addEventListener("chronicle:ui-timing", handler as EventListener);

    getPlanData.mockResolvedValueOnce(buildPlanPayload()).mockResolvedValueOnce(buildPlanPayload());
    updatePlanDaysBulk.mockResolvedValueOnce({
      status: "ok",
      saved_count: 1,
      days: [{ date_local: isoDate(0), planned_total_miles: 7 }]
    });

    try {
      render(<PlanPage />);

      const firstInput = await screen.findByLabelText(`Planned miles for ${isoDate(0)}`);
      fireEvent.change(firstInput, { target: { value: "7" } });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        const hasLoad = events.some((item) => item.source === "plan-grid" && item.metric === "plan-grid-load");
        const hasSave = events.some((item) => item.source === "plan-grid" && item.metric === "plan-grid-save");
        expect(hasLoad).toBe(true);
        expect(hasSave).toBe(true);
      });

      const loadDurations = events
        .filter((item) => item.source === "plan-grid" && item.metric === "plan-grid-load")
        .map((item) => Number(item.duration_ms ?? 0));
      const saveDurations = events
        .filter((item) => item.source === "plan-grid" && item.metric === "plan-grid-save")
        .map((item) => Number(item.duration_ms ?? 0));

      expect(loadDurations.length).toBeGreaterThan(0);
      expect(saveDurations.length).toBeGreaterThan(0);
      expect(p95(loadDurations)).toBeLessThan(1000);
      expect(p95(saveDurations)).toBeLessThan(1000);
    } finally {
      window.removeEventListener("chronicle:ui-timing", handler as EventListener);
    }
  });
});
