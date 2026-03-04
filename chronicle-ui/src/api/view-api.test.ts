import { afterEach, describe, expect, it, vi } from "vitest";
import { getDashboardData } from "./view-api";

const getJson = vi.fn();

vi.mock("./http-client", () => ({
  getJson: (...args: unknown[]) => getJson(...args)
}));

describe("view api", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("loads dashboard data with default full response mode", async () => {
    getJson.mockResolvedValueOnce({
      source: "strava",
      generated_at: "2026-03-04T00:00:00+00:00",
      validated_at: "2026-03-04T00:00:00+00:00",
      years: [2026],
      types: ["Run"],
      type_meta: { Run: { label: "Run", accent: "#3fa8ff" } },
      other_bucket: "OtherSports",
      aggregates: {},
      units: { distance: "mi", elevation: "ft" },
      week_start: "sunday",
      activities: [],
    });

    await getDashboardData();

    expect(getJson).toHaveBeenCalledWith("/dashboard/data.json");
  });

  it("passes force, mode, and year query params for dashboard requests", async () => {
    getJson.mockResolvedValueOnce({
      source: "strava",
      generated_at: "2026-03-04T00:00:00+00:00",
      validated_at: "2026-03-04T00:00:00+00:00",
      years: [2026],
      types: ["Run"],
      type_meta: { Run: { label: "Run", accent: "#3fa8ff" } },
      other_bucket: "OtherSports",
      aggregates: {},
      units: { distance: "mi", elevation: "ft" },
      week_start: "sunday",
      activities: [],
      response_mode: "year"
    });

    await getDashboardData({ force: true, mode: "year", year: 2026 });

    expect(getJson).toHaveBeenCalledWith("/dashboard/data.json?force=1&mode=year&year=2026");
  });

  it("passes summary mode without year query params", async () => {
    getJson.mockResolvedValueOnce({
      source: "strava",
      generated_at: "2026-03-04T00:00:00+00:00",
      validated_at: "2026-03-04T00:00:00+00:00",
      years: [2026],
      types: ["Run"],
      type_meta: { Run: { label: "Run", accent: "#3fa8ff" } },
      other_bucket: "OtherSports",
      aggregates: {},
      units: { distance: "mi", elevation: "ft" },
      week_start: "sunday",
      activities: [],
      response_mode: "summary"
    });

    await getDashboardData({ mode: "summary" });

    expect(getJson).toHaveBeenCalledWith("/dashboard/data.json?mode=summary");
  });
});
