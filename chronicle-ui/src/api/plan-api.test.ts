import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPlanData,
  getPlanWorkouts,
  resolvePlanDayGarminSyncResult,
  runPlanDayGarminSync,
  schedulePlanDayGarminSync,
  sendPlanDayWorkoutToGarmin,
  updatePlanDay,
  updatePlanDaysBulk,
  upsertPlanWorkout
} from "./plan-api";

const getJson = vi.fn();

vi.mock("./http-client", () => ({
  getJson: (...args: unknown[]) => getJson(...args)
}));

describe("plan api", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("loads plan data without query params by default", async () => {
    getJson.mockResolvedValueOnce({ status: "ok", rows: [] });

    await getPlanData();

    expect(getJson).toHaveBeenCalledWith("/plan/data.json");
  });

  it("encodes plan data query params", async () => {
    getJson.mockResolvedValueOnce({ status: "ok", rows: [] });

    await getPlanData({
      center_date: "2026-03-04",
      window_days: 21,
      include_meta: false
    });

    expect(getJson).toHaveBeenCalledWith("/plan/data.json?center_date=2026-03-04&window_days=21&include_meta=0");
  });

  it("saves single-day plan updates using encoded date", async () => {
    getJson.mockResolvedValueOnce({ status: "ok", date_local: "2026-03-01" });

    await updatePlanDay("2026-03-01", { distance: "7.5" });

    expect(getJson).toHaveBeenCalledWith("/plan/day/2026-03-01", {
      method: "PUT",
      body: {
        distance: "7.5"
      }
    });
  });

  it("throws when updatePlanDay receives empty date", async () => {
    await expect(updatePlanDay("  ", { distance: "6" })).rejects.toThrow("dateLocal is required.");
  });

  it("posts bulk day updates to the existing endpoint", async () => {
    getJson.mockResolvedValueOnce({ status: "ok", saved_count: 2, days: [] });

    await updatePlanDaysBulk({
      days: [
        { date_local: "2026-03-01", distance: "6", run_type: "Easy" },
        { date_local: "2026-03-02", distance: "7", run_type: "SOS" }
      ]
    });

    expect(getJson).toHaveBeenCalledWith("/plan/days/bulk", {
      method: "POST",
      body: {
        days: [
          { date_local: "2026-03-01", distance: "6", run_type: "Easy" },
          { date_local: "2026-03-02", distance: "7", run_type: "SOS" }
        ]
      }
    });
  });

  it("preserves workout session payloads for bulk day updates", async () => {
    getJson.mockResolvedValueOnce({ status: "ok", saved_count: 1, days: [] });

    await updatePlanDaysBulk({
      days: [
        {
          date_local: "2026-03-03",
          sessions: [
            {
              planned_miles: 7,
              workout_code: "2E + 20T + 2E (Jack Daniels tempo)"
            }
          ]
        }
      ]
    });

    expect(getJson).toHaveBeenCalledWith("/plan/days/bulk", {
      method: "POST",
      body: {
        days: [
          {
            date_local: "2026-03-03",
            sessions: [
              {
                planned_miles: 7,
                workout_code: "2E + 20T + 2E (Jack Daniels tempo)"
              }
            ]
          }
        ]
      }
    });
  });

  it("loads workout workshop definitions", async () => {
    getJson.mockResolvedValueOnce({ status: "ok", workouts: [] });

    await getPlanWorkouts();

    expect(getJson).toHaveBeenCalledWith("/plan/workouts");
  });

  it("upserts workout workshop definitions by code path", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      workout: {
        workout_code: "2E-5x1k-I",
        title: "2E + 5x1k @I + 2E",
        structure: "warmup: 2E\nmain: 5x1k @I w/3:00 jog\ncooldown: 2E",
      },
      workouts: [],
    });

    await upsertPlanWorkout("2E-5x1k-I", {
      workout_code: "2E-5x1k-I",
      title: "2E + 5x1k @I + 2E",
      structure: "warmup: 2E\nmain: 5x1k @I w/3:00 jog\ncooldown: 2E",
    });

    expect(getJson).toHaveBeenCalledWith("/plan/workouts/2E-5x1k-I", {
      method: "PUT",
      body: {
        workout_code: "2E-5x1k-I",
        title: "2E + 5x1k @I + 2E",
        structure: "warmup: 2E\nmain: 5x1k @I w/3:00 jog\ncooldown: 2E",
      }
    });
  });

  it("throws when upsertPlanWorkout receives empty workout code", async () => {
    await expect(
      upsertPlanWorkout("  ", {
        structure: "warmup: 2E",
      })
    ).rejects.toThrow("workoutCode is required.");
  });

  it("sends plan-day workout to garmin sync endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      date_local: "2026-03-01",
      sync: {
        request_id: "req-1",
        date_local: "2026-03-01",
        workout_code: "Tempo-6x1k",
        status: "pending",
        status_code: "queued",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:00+00:00",
      }
    });

    await sendPlanDayWorkoutToGarmin("2026-03-01");

    expect(getJson).toHaveBeenCalledWith("/plan/day/2026-03-01/garmin-sync", {
      method: "POST",
      body: {}
    });
  });

  it("sends explicit workout_code payload when provided for garmin sync initiation", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      date_local: "2026-03-01",
      sync: {
        request_id: "req-2",
        date_local: "2026-03-01",
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
        status: "pending",
        status_code: "queued",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:00+00:00",
      }
    });

    await sendPlanDayWorkoutToGarmin("2026-03-01", {
      workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
    });

    expect(getJson).toHaveBeenCalledWith("/plan/day/2026-03-01/garmin-sync", {
      method: "POST",
      body: {
        workout_code: "2E + 20T + 2E (Jack Daniels tempo)",
      }
    });
  });

  it("throws when sendPlanDayWorkoutToGarmin receives empty date", async () => {
    await expect(sendPlanDayWorkoutToGarmin("  ")).rejects.toThrow("dateLocal is required.");
  });

  it("runs plan-day garmin sync and returns workout creation payload", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      date_local: "2026-03-01",
      sync: {
        request_id: "req-3",
        date_local: "2026-03-01",
        workout_code: "Tempo-6x1k",
        status: "in-progress",
        status_code: "workout_created",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:01+00:00",
        garmin_workout_id: "gw-1",
        garmin_workout_created: true,
        next_step: "schedule_workout_on_calendar",
      },
      garmin_workout: {
        garmin_workout_id: "gw-1",
        workout_code: "Tempo-6x1k",
        title: "Tempo-6x1k",
        created_at_utc: "2026-03-04T00:00:01+00:00",
        updated_at_utc: "2026-03-04T00:00:01+00:00",
      }
    });

    await runPlanDayGarminSync("2026-03-01");

    expect(getJson).toHaveBeenCalledWith("/plan/day/2026-03-01/garmin-sync/run", {
      method: "POST",
      body: {}
    });
  });

  it("runs plan-day garmin sync with explicit workout_code payload", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      date_local: "2026-03-02",
      sync: {
        request_id: "req-4",
        date_local: "2026-03-02",
        workout_code: "Tempo-6x1k",
        status: "in-progress",
        status_code: "workout_exists",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:01+00:00",
      },
      garmin_workout: {
        garmin_workout_id: "gw-1",
        workout_code: "Tempo-6x1k",
        title: "Tempo-6x1k",
        created_at_utc: "2026-03-04T00:00:01+00:00",
        updated_at_utc: "2026-03-04T00:00:01+00:00",
      }
    });

    await runPlanDayGarminSync("2026-03-02", { workout_code: "Tempo-6x1k" });

    expect(getJson).toHaveBeenCalledWith("/plan/day/2026-03-02/garmin-sync/run", {
      method: "POST",
      body: {
        workout_code: "Tempo-6x1k",
      }
    });
  });

  it("throws when runPlanDayGarminSync receives empty date", async () => {
    await expect(runPlanDayGarminSync("  ")).rejects.toThrow("dateLocal is required.");
  });

  it("schedules plan-day garmin sync calendar entry", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      date_local: "2026-03-02",
      sync: {
        request_id: "req-5",
        date_local: "2026-03-02",
        workout_code: "Tempo-6x1k",
        status: "succeeded",
        status_code: "calendar_scheduled",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:02+00:00",
        garmin_workout_id: "gw-1",
        next_step: "report_sync_result",
        calendar_entry_id: "gcal-1",
      },
      garmin_workout: {
        garmin_workout_id: "gw-1",
        workout_code: "Tempo-6x1k",
        title: "Tempo-6x1k",
        created_at_utc: "2026-03-04T00:00:01+00:00",
        updated_at_utc: "2026-03-04T00:00:01+00:00",
      },
      calendar_entry: {
        calendar_entry_id: "gcal-1",
        date_local: "2026-03-02",
        garmin_workout_id: "gw-1",
        workout_code: "Tempo-6x1k",
        scheduled_at_utc: "2026-03-04T00:00:02+00:00",
        updated_at_utc: "2026-03-04T00:00:02+00:00",
      }
    });

    await schedulePlanDayGarminSync("2026-03-02");

    expect(getJson).toHaveBeenCalledWith("/plan/day/2026-03-02/garmin-sync/schedule", {
      method: "POST",
      body: {}
    });
  });

  it("schedules plan-day garmin sync with explicit workout_code payload", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      date_local: "2026-03-03",
      sync: {
        request_id: "req-6",
        date_local: "2026-03-03",
        workout_code: "Tempo-6x1k",
        status: "succeeded",
        status_code: "calendar_exists",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:03+00:00",
      },
      garmin_workout: {
        garmin_workout_id: "gw-1",
        workout_code: "Tempo-6x1k",
        title: "Tempo-6x1k",
        created_at_utc: "2026-03-04T00:00:01+00:00",
        updated_at_utc: "2026-03-04T00:00:01+00:00",
      },
      calendar_entry: {
        calendar_entry_id: "gcal-1",
        date_local: "2026-03-03",
        garmin_workout_id: "gw-1",
        workout_code: "Tempo-6x1k",
        scheduled_at_utc: "2026-03-04T00:00:03+00:00",
        updated_at_utc: "2026-03-04T00:00:03+00:00",
      }
    });

    await schedulePlanDayGarminSync("2026-03-03", { workout_code: "Tempo-6x1k" });

    expect(getJson).toHaveBeenCalledWith("/plan/day/2026-03-03/garmin-sync/schedule", {
      method: "POST",
      body: {
        workout_code: "Tempo-6x1k",
      }
    });
  });

  it("throws when schedulePlanDayGarminSync receives empty date", async () => {
    await expect(schedulePlanDayGarminSync("  ")).rejects.toThrow("dateLocal is required.");
  });

  it("resolves plan-day garmin sync result with success envelope", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      date_local: "2026-03-03",
      sync: {
        request_id: "req-7",
        date_local: "2026-03-03",
        workout_code: "Tempo-6x1k",
        status: "succeeded",
        status_code: "calendar_scheduled",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:04+00:00",
      },
      result: {
        outcome: "scheduled",
        status_code: "calendar_scheduled",
        timestamp_utc: "2026-03-04T00:00:04+00:00",
        message: "Workout scheduled on Garmin calendar.",
        attempt_count: 1,
      }
    });

    await resolvePlanDayGarminSyncResult("2026-03-03");

    expect(getJson).toHaveBeenCalledWith("/plan/day/2026-03-03/garmin-sync/result", {
      method: "POST",
      body: {}
    });
  });

  it("resolves plan-day garmin sync result with explicit workout_code payload", async () => {
    getJson.mockResolvedValueOnce({
      status: "error",
      date_local: "2026-03-03",
      sync: {
        request_id: "req-8",
        date_local: "2026-03-03",
        workout_code: "Tempo-6x1k",
        status: "failed",
        status_code: "schedule_failed",
        queued_at_utc: "2026-03-04T00:00:00+00:00",
        updated_at_utc: "2026-03-04T00:00:05+00:00",
        retry_guidance: "Retry from Plan.",
      },
      result: {
        outcome: "failed",
        status_code: "schedule_failed",
        timestamp_utc: "2026-03-04T00:00:05+00:00",
        message: "Garmin schedule failed.",
        retry_guidance: "Retry from Plan.",
        attempt_count: 2,
      }
    });

    await resolvePlanDayGarminSyncResult("2026-03-03", { workout_code: "Tempo-6x1k" });

    expect(getJson).toHaveBeenCalledWith("/plan/day/2026-03-03/garmin-sync/result", {
      method: "POST",
      body: {
        workout_code: "Tempo-6x1k",
      }
    });
  });

  it("throws when resolvePlanDayGarminSyncResult receives empty date", async () => {
    await expect(resolvePlanDayGarminSyncResult("  ")).rejects.toThrow("dateLocal is required.");
  });
});
