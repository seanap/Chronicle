import { getJson } from "./http-client";

export type DashboardResponseMode = "full" | "summary" | "year";

export interface DashboardTypeMeta {
  label: string;
  accent: string;
}

export interface DashboardAggregateEntry {
  count: number;
  distance: number;
  moving_time: number;
  elevation_gain: number;
  activity_ids: string[];
  avg_pace_mps?: number;
  avg_efficiency_factor?: number;
  avg_fitness?: number;
  avg_fatigue?: number;
}

export interface DashboardActivity {
  id: string;
  date: string;
  year: number;
  type: string;
  raw_type: string;
  start_date_local: string;
  hour: number;
  distance: number;
  moving_time: number;
  elevation_gain: number;
  url: string;
  name?: string;
  avg_pace_mps?: number;
  avg_efficiency_factor?: number;
  avg_fitness?: number;
  avg_fatigue?: number;
}

export interface DashboardDataResponse {
  source: string;
  generated_at: string;
  validated_at: string;
  years: number[];
  types: string[];
  type_meta: Record<string, DashboardTypeMeta>;
  other_bucket: string;
  aggregates: Record<string, Record<string, Record<string, DashboardAggregateEntry>>>;
  units: {
    distance: string;
    elevation: string;
  };
  week_start: "sunday" | "monday";
  activities: DashboardActivity[];
  activity_count?: number;
  cache_state?: string;
  revalidating?: boolean;
  response_mode?: DashboardResponseMode;
  response_year?: number;
}

export interface GetDashboardDataRequest {
  force?: boolean;
  mode?: DashboardResponseMode;
  year?: number;
}

function buildDashboardQuery(params?: GetDashboardDataRequest): string {
  const parts: string[] = [];
  if (params?.force) {
    parts.push("force=1");
  }
  if (typeof params?.mode === "string" && params.mode.trim().length > 0) {
    parts.push(`mode=${encodeURIComponent(params.mode)}`);
  }
  if (typeof params?.year === "number" && Number.isFinite(params.year)) {
    parts.push(`year=${encodeURIComponent(String(Math.trunc(params.year)))}`);
  }
  return parts.join("&");
}

export async function getDashboardData(params?: GetDashboardDataRequest): Promise<DashboardDataResponse> {
  const query = buildDashboardQuery(params);
  const path = query.length > 0 ? `/dashboard/data.json?${query}` : "/dashboard/data.json";
  return getJson<DashboardDataResponse>(path);
}
