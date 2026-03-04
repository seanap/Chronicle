import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../api/http-client";
import { ViewPage } from "./view-page";

const getDashboardData = vi.fn();

vi.mock("../../api/view-api", () => ({
  getDashboardData: (...args: unknown[]) => getDashboardData(...args)
}));

function p95(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[index];
}

function makeDashboardPayload(activityCount = 5, overrides: Record<string, unknown> = {}) {
  const baseActivities = [
    {
      id: "1001",
      date: "2026-03-01",
      year: 2026,
      type: "Run",
      raw_type: "Run",
      start_date_local: "2026-03-01T07:00:00+00:00",
      hour: 7,
      distance: 5,
      moving_time: 2400,
      elevation_gain: 120,
      url: "https://www.strava.com/activities/1001",
      name: "Easy Run",
      avg_efficiency_factor: 1.1,
      avg_fitness: 70,
      avg_fatigue: 76
    },
    {
      id: "1002",
      date: "2026-03-02",
      year: 2026,
      type: "Ride",
      raw_type: "Ride",
      start_date_local: "2026-03-02T07:00:00+00:00",
      hour: 7,
      distance: 20,
      moving_time: 3600,
      elevation_gain: 300,
      url: "https://www.strava.com/activities/1002",
      name: "Morning Ride",
      avg_efficiency_factor: 1.05,
      avg_fitness: 71,
      avg_fatigue: 77
    },
    {
      id: "1003",
      date: "2026-03-02",
      year: 2026,
      type: "Run",
      raw_type: "Run",
      start_date_local: "2026-03-02T19:00:00+00:00",
      hour: 19,
      distance: 7,
      moving_time: 3000,
      elevation_gain: 140,
      url: "https://www.strava.com/activities/1003",
      name: "Evening Run",
      avg_efficiency_factor: 1.15,
      avg_fitness: 72,
      avg_fatigue: 79
    },
    {
      id: "1004",
      date: "2026-03-05",
      year: 2026,
      type: "Run",
      raw_type: "Run",
      start_date_local: "2026-03-05T06:30:00+00:00",
      hour: 6,
      distance: 10,
      moving_time: 4200,
      elevation_gain: 200,
      url: "https://www.strava.com/activities/1004",
      name: "Tempo Run",
      avg_efficiency_factor: 1.2,
      avg_fitness: 74,
      avg_fatigue: 82
    },
    {
      id: "1005",
      date: "2026-03-06",
      year: 2026,
      type: "Walk",
      raw_type: "Walk",
      start_date_local: "2026-03-06T08:00:00+00:00",
      hour: 8,
      distance: 2,
      moving_time: 1500,
      elevation_gain: 40,
      url: "https://www.strava.com/activities/1005",
      name: "Recovery Walk",
    },
    {
      id: "1006",
      date: "2026-03-06",
      year: 2026,
      type: "Run",
      raw_type: "Run",
      start_date_local: "2026-03-06T16:00:00+00:00",
      hour: 16,
      distance: 6,
      moving_time: 2600,
      elevation_gain: 100,
      url: "https://www.strava.com/activities/1006",
      name: "Steady Run",
      avg_efficiency_factor: 1.08,
      avg_fitness: 69,
      avg_fatigue: 75
    },
  ];
  const activities = baseActivities.slice(0, activityCount);
  const aggregates: Record<string, Record<string, Record<string, any>>> = {};
  for (const activity of activities) {
    const yearKey = String(activity.year);
    const typeKey = String(activity.type);
    const dateKey = String(activity.date);
    const yearBucket = (aggregates[yearKey] ??= {});
    const typeBucket = (yearBucket[typeKey] ??= {});
    const entry =
      typeBucket[dateKey] ??
      (typeBucket[dateKey] = {
        count: 0,
        distance: 0,
        moving_time: 0,
        elevation_gain: 0,
        activity_ids: [] as string[],
        _efficiency_weighted_sum: 0,
        _efficiency_weight: 0,
        _fitness_sum: 0,
        _fitness_count: 0,
        _fatigue_sum: 0,
        _fatigue_count: 0
      });

    entry.count += 1;
    entry.distance += Number(activity.distance || 0);
    entry.moving_time += Number(activity.moving_time || 0);
    entry.elevation_gain += Number(activity.elevation_gain || 0);
    entry.activity_ids.push(String(activity.id));

    if (typeof activity.avg_efficiency_factor === "number" && activity.avg_efficiency_factor > 0) {
      const weight = Number(activity.moving_time || 0);
      if (weight > 0) {
        entry._efficiency_weighted_sum += activity.avg_efficiency_factor * weight;
        entry._efficiency_weight += weight;
      }
    }
    if (typeof activity.avg_fitness === "number") {
      entry._fitness_sum += activity.avg_fitness;
      entry._fitness_count += 1;
    }
    if (typeof activity.avg_fatigue === "number") {
      entry._fatigue_sum += activity.avg_fatigue;
      entry._fatigue_count += 1;
    }
  }
  for (const yearBucket of Object.values(aggregates)) {
    for (const typeBucket of Object.values(yearBucket)) {
      for (const entry of Object.values(typeBucket)) {
        if (entry.moving_time > 0 && entry.distance > 0) {
          entry.avg_pace_mps = entry.distance / entry.moving_time;
        }
        if (entry._efficiency_weight > 0) {
          entry.avg_efficiency_factor = entry._efficiency_weighted_sum / entry._efficiency_weight;
        }
        if (entry._fitness_count > 0) {
          entry.avg_fitness = entry._fitness_sum / entry._fitness_count;
        }
        if (entry._fatigue_count > 0) {
          entry.avg_fatigue = entry._fatigue_sum / entry._fatigue_count;
        }
        delete entry._efficiency_weighted_sum;
        delete entry._efficiency_weight;
        delete entry._fitness_sum;
        delete entry._fitness_count;
        delete entry._fatigue_sum;
        delete entry._fatigue_count;
      }
    }
  }
  return {
    source: "strava",
    generated_at: "2026-03-06T20:00:00+00:00",
    validated_at: "2026-03-06T20:00:00+00:00",
    years: [2025, 2026],
    types: ["Run", "Ride", "Walk"],
    type_meta: {
      Run: { label: "Run Profile", accent: "#3fa8ff" },
      Ride: { label: "Ride Profile", accent: "#39d98a" },
      Walk: { label: "Walk Profile", accent: "#ffd166" },
    },
    other_bucket: "OtherSports",
    aggregates,
    units: { distance: "mi", elevation: "ft" },
    week_start: "sunday" as const,
    activities,
    ...overrides
  };
}

describe("view page", () => {
  beforeEach(() => {
    getDashboardData.mockResolvedValue(makeDashboardPayload());
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("renders trend and heatmap sections from dashboard payload data", async () => {
    render(<ViewPage />);

    expect(screen.getByRole("heading", { name: "View" })).toBeInTheDocument();
    expect(await screen.findByText("Distance trend (last 8 weeks)")).toBeInTheDocument();
    expect(await screen.findByText("Activity heatmap (last 12 weeks)")).toBeInTheDocument();
    expect(await screen.findByText("Activities in scope: 5")).toBeInTheDocument();
    expect(await screen.findByText("Distance in scope: 44.0 mi")).toBeInTheDocument();
    expect(await screen.findByText("Active days: 4/84")).toBeInTheDocument();
    expect(await screen.findByLabelText("Heatmap 2026-03-02: 2 activities")).toBeInTheDocument();
  });

  it("filters dashboard visualizations by selected activity type", async () => {
    render(<ViewPage />);

    expect(await screen.findByText("Activities in scope: 5")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Activity type filter"), {
      target: { value: "Run" }
    });

    expect(await screen.findByText("Activities in scope: 3")).toBeInTheDocument();
    expect(await screen.findByText("Distance in scope: 22.0 mi")).toBeInTheDocument();
    expect(await screen.findByTestId("type-metric-Run")).toBeInTheDocument();
    expect(screen.queryByTestId("type-metric-Ride")).not.toBeInTheDocument();
  });

  it("shows activity-type labels and custom metrics from scoped payload", async () => {
    render(<ViewPage />);

    expect(await screen.findByText("Activity-type labels and custom metrics")).toBeInTheDocument();
    expect(await screen.findByText("Run Profile (Run)")).toBeInTheDocument();
    expect(await screen.findByText("Ride Profile (Ride)")).toBeInTheDocument();
    expect(await screen.findByText("Avg efficiency: 1.16")).toBeInTheDocument();
    expect(await screen.findByText("Avg fitness: 72.0")).toBeInTheDocument();
    expect(await screen.findByText("Avg fatigue: 79.0")).toBeInTheDocument();
  });

  it("refreshes dashboard data using force query behavior", async () => {
    getDashboardData.mockReset();
    getDashboardData
      .mockResolvedValueOnce(makeDashboardPayload(5))
      .mockResolvedValueOnce(makeDashboardPayload(6));

    render(<ViewPage />);

    expect(await screen.findByText("Activities in scope: 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh dashboard" }));

    await waitFor(() => {
      expect(getDashboardData).toHaveBeenCalledTimes(2);
    });
    expect(getDashboardData).toHaveBeenNthCalledWith(2, { force: true });
    expect(await screen.findByText("Activities in scope: 6")).toBeInTheDocument();
  });

  it("scopes dashboard by year mode and clearly shows selected scope", async () => {
    getDashboardData.mockReset();
    getDashboardData
      .mockResolvedValueOnce(makeDashboardPayload(5, { years: [2025, 2026] }))
      .mockResolvedValueOnce(
        makeDashboardPayload(3, {
          years: [2026],
          response_mode: "year",
          response_year: 2026
        })
      );

    render(<ViewPage />);

    expect(await screen.findByText("Activities in scope: 5")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Dashboard scope mode"), {
      target: { value: "year" }
    });

    await waitFor(() => {
      expect(getDashboardData).toHaveBeenNthCalledWith(2, { mode: "year", year: 2026 });
    });
    expect(await screen.findByText("Selected scope: Year 2026")).toBeInTheDocument();
    expect(await screen.findByText("Activities in scope: 3")).toBeInTheDocument();
  });

  it("scopes dashboard by summary mode and updates dashboard cards", async () => {
    getDashboardData.mockReset();
    getDashboardData
      .mockResolvedValueOnce(makeDashboardPayload(5, { years: [2025, 2026] }))
      .mockResolvedValueOnce(
        makeDashboardPayload(0, {
          activities: [],
          activity_count: 5,
          response_mode: "summary"
        })
      );

    render(<ViewPage />);

    expect(await screen.findByText("Activities in scope: 5")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Dashboard scope mode"), {
      target: { value: "summary" }
    });

    await waitFor(() => {
      expect(getDashboardData).toHaveBeenNthCalledWith(2, { mode: "summary" });
    });
    expect(await screen.findByText("Selected scope: Summary mode")).toBeInTheDocument();
    expect(await screen.findByText("No trend data available yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Activity type filter")).toBeDisabled();
    expect(await screen.findByText("No activity-type custom metrics available for selected scope.")).toBeInTheDocument();
  });

  it("shows error feedback when dashboard load fails", async () => {
    getDashboardData.mockRejectedValueOnce(
      new ApiRequestError({
        message: "dashboard data unavailable",
        status: 500,
      })
    );

    render(<ViewPage />);

    expect(await screen.findByText("dashboard data unavailable")).toBeInTheDocument();
  });

  it("emits dashboard load/refresh/scope timing telemetry with sub-second p95 in tests", async () => {
    getDashboardData.mockResolvedValue(makeDashboardPayload(5, { years: [2025, 2026] }));
    const events: Array<{ source?: string; metric?: string; duration_ms?: number }> = [];
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ source?: string; metric?: string; duration_ms?: number }>;
      events.push(customEvent.detail ?? {});
    };
    window.addEventListener("chronicle:ui-timing", listener);

    try {
      render(<ViewPage />);
      await screen.findByText("Activities in scope: 5");

      fireEvent.change(screen.getByLabelText("Dashboard scope mode"), {
        target: { value: "year" }
      });
      await waitFor(() => {
        expect(
          events.some((item) => item.source === "view-dashboard" && item.metric === "dashboard.scope_change_mode")
        ).toBe(true);
      });

      fireEvent.change(screen.getByLabelText("Dashboard scope year"), {
        target: { value: "2025" }
      });
      await waitFor(() => {
        expect(
          events.some((item) => item.source === "view-dashboard" && item.metric === "dashboard.scope_change_year")
        ).toBe(true);
      });

      for (let attempt = 0; attempt < 4; attempt += 1) {
        fireEvent.click(screen.getByRole("button", { name: "Refresh dashboard" }));
        await waitFor(() => {
          expect(
            events.some((item) => item.source === "view-dashboard" && item.metric === "dashboard.refresh")
          ).toBe(true);
        });
      }

      const loadDurations = events
        .filter((item) => item.source === "view-dashboard" && item.metric === "dashboard.load")
        .map((item) => Number(item.duration_ms ?? 0));
      const refreshDurations = events
        .filter((item) => item.source === "view-dashboard" && item.metric === "dashboard.refresh")
        .map((item) => Number(item.duration_ms ?? 0));
      const scopeDurations = events
        .filter(
          (item) =>
            item.source === "view-dashboard" &&
            (item.metric === "dashboard.scope_change_mode" || item.metric === "dashboard.scope_change_year")
        )
        .map((item) => Number(item.duration_ms ?? 0));

      expect(loadDurations.length).toBeGreaterThan(0);
      expect(refreshDurations.length).toBeGreaterThan(0);
      expect(scopeDurations.length).toBeGreaterThan(0);
      expect(p95(loadDurations)).toBeLessThan(1000);
      expect(p95(refreshDurations)).toBeLessThan(1000);
      expect(p95(scopeDurations)).toBeLessThan(1000);
    } finally {
      window.removeEventListener("chronicle:ui-timing", listener);
    }
  });
});
