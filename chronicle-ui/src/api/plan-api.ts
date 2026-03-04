import { getJson } from "./http-client";

export interface PlanMetricBands {
  wow_change?: string;
  long_pct?: string;
  mi_t30_ratio?: string;
  t7_p7_ratio?: string;
  t30_p30_ratio?: string;
  session_spike_ratio?: string;
}

export interface PlanSessionDetail {
  ordinal: number;
  planned_miles: number;
  run_type?: string;
  workout_code?: string;
  planned_workout?: string;
}

export interface PlanRow {
  date: string;
  is_today: boolean;
  is_past_or_today: boolean;
  is_complete: boolean;
  run_type: string;
  notes: string;
  planned_miles: number;
  planned_input: string;
  weekly_total: number;
  wow_change: number | null;
  long_pct: number | null;
  monthly_total: number;
  mom_change: number | null;
  t7_miles: number;
  t7_p7_ratio: number | null;
  t30_miles: number;
  t30_p30_ratio: number | null;
  avg30_miles_per_day: number;
  mi_t30_ratio: number | null;
  planned_sessions_detail?: PlanSessionDetail[];
  bands?: PlanMetricBands;
}

export interface PlanSummary {
  anchor_date: string;
  week_planned: number;
  week_actual: number;
  week_delta: number;
}

export interface PlanDataResponse {
  status: string;
  timezone: string;
  today: string;
  center_date: string;
  min_center_date: string;
  max_center_date: string;
  window_days: number;
  start_date: string;
  end_date: string;
  summary: PlanSummary;
  rows: PlanRow[];
  run_type_options?: string[];
}

export interface GetPlanDataRequest {
  center_date?: string;
  window_days?: number;
  start_date?: string;
  end_date?: string;
  include_meta?: boolean;
}

export interface PlanSessionInput {
  planned_miles: number;
  run_type?: string;
  workout_code?: string;
  planned_workout?: string;
}

export interface UpdatePlanDayRequest {
  distance?: string | number;
  planned_total_miles?: number;
  sessions?: Array<number | PlanSessionInput>;
  run_type?: string;
  notes?: string;
  is_complete?: boolean | null;
}

export interface UpdatePlanDayResponse {
  status: string;
  date_local: string;
  run_type?: string;
  planned_total_miles?: number;
  sessions?: Array<Record<string, unknown>>;
}

export interface BulkPlanDayUpdate extends UpdatePlanDayRequest {
  date_local: string;
}

export interface UpdatePlanDaysBulkRequest {
  days: BulkPlanDayUpdate[];
}

export interface UpdatePlanDaysBulkResponse {
  status: string;
  saved_count: number;
  days: UpdatePlanDayResponse[];
}

export interface PlanWorkoutDefinition {
  workout_code: string;
  title: string;
  structure: string;
  created_at_utc?: string;
  updated_at_utc?: string;
}

export interface PlanWorkoutsResponse {
  status: string;
  workouts: PlanWorkoutDefinition[];
}

export interface UpsertPlanWorkoutRequest {
  workout_code?: string;
  title?: string;
  structure: string;
}

export interface UpsertPlanWorkoutResponse {
  status: string;
  workout: PlanWorkoutDefinition;
  workouts: PlanWorkoutDefinition[];
}

export interface PlanGarminSyncRecord {
  request_id: string;
  date_local: string;
  workout_code: string;
  status: string;
  status_code: string;
  queued_at_utc: string;
  updated_at_utc: string;
  garmin_workout_id?: string;
  garmin_workout_created?: boolean;
  calendar_entry_id?: string;
  next_step?: string;
  error_message?: string;
  retry_guidance?: string;
}

export interface GarminWorkoutRecord {
  garmin_workout_id: string;
  workout_code: string;
  title: string;
  created_at_utc: string;
  updated_at_utc: string;
}

export interface GarminCalendarEntryRecord {
  calendar_entry_id: string;
  date_local: string;
  garmin_workout_id: string;
  workout_code: string;
  scheduled_at_utc: string;
  updated_at_utc: string;
}

export interface SendPlanDayWorkoutToGarminRequest {
  workout_code?: string;
}

export interface SendPlanDayWorkoutToGarminResponse {
  status: string;
  date_local: string;
  sync: PlanGarminSyncRecord;
}

export interface RunPlanDayGarminSyncRequest {
  workout_code?: string;
}

export interface RunPlanDayGarminSyncResponse {
  status: string;
  date_local: string;
  sync: PlanGarminSyncRecord;
  garmin_workout: GarminWorkoutRecord;
}

export interface SchedulePlanDayGarminSyncRequest {
  workout_code?: string;
}

export interface SchedulePlanDayGarminSyncResponse {
  status: string;
  date_local: string;
  sync: PlanGarminSyncRecord;
  garmin_workout: GarminWorkoutRecord;
  calendar_entry: GarminCalendarEntryRecord;
}

export interface ResolvePlanDayGarminSyncResultRequest {
  workout_code?: string;
}

export interface PlanDayGarminSyncResultRecord {
  outcome: "scheduled" | "failed";
  status_code: string;
  timestamp_utc: string;
  message: string;
  retry_guidance?: string;
  attempt_count: number;
}

export interface ResolvePlanDayGarminSyncResultResponse {
  status: string;
  date_local: string;
  sync: PlanGarminSyncRecord;
  garmin_workout?: GarminWorkoutRecord;
  calendar_entry?: GarminCalendarEntryRecord;
  result: PlanDayGarminSyncResultRecord;
}

function buildPlanQuery(params?: GetPlanDataRequest): string {
  const queryParts: string[] = [];
  if (typeof params?.center_date === "string" && params.center_date.trim().length > 0) {
    queryParts.push(`center_date=${encodeURIComponent(params.center_date)}`);
  }
  if (typeof params?.window_days === "number" && Number.isFinite(params.window_days)) {
    queryParts.push(`window_days=${encodeURIComponent(String(Math.trunc(params.window_days)))}`);
  }
  if (typeof params?.start_date === "string" && params.start_date.trim().length > 0) {
    queryParts.push(`start_date=${encodeURIComponent(params.start_date)}`);
  }
  if (typeof params?.end_date === "string" && params.end_date.trim().length > 0) {
    queryParts.push(`end_date=${encodeURIComponent(params.end_date)}`);
  }
  if (typeof params?.include_meta === "boolean") {
    queryParts.push(`include_meta=${params.include_meta ? "1" : "0"}`);
  }
  return queryParts.join("&");
}

export async function getPlanData(params?: GetPlanDataRequest): Promise<PlanDataResponse> {
  const query = buildPlanQuery(params);
  const path = query.length > 0 ? `/plan/data.json?${query}` : "/plan/data.json";
  return getJson<PlanDataResponse>(path);
}

export async function updatePlanDay(
  dateLocal: string,
  payload: UpdatePlanDayRequest
): Promise<UpdatePlanDayResponse> {
  const normalizedDate = dateLocal.trim();
  if (normalizedDate.length === 0) {
    throw new Error("dateLocal is required.");
  }
  return getJson<UpdatePlanDayResponse>(`/plan/day/${encodeURIComponent(normalizedDate)}`, {
    method: "PUT",
    body: payload
  });
}

export async function updatePlanDaysBulk(
  payload: UpdatePlanDaysBulkRequest
): Promise<UpdatePlanDaysBulkResponse> {
  return getJson<UpdatePlanDaysBulkResponse>("/plan/days/bulk", {
    method: "POST",
    body: payload
  });
}

export async function getPlanWorkouts(): Promise<PlanWorkoutsResponse> {
  return getJson<PlanWorkoutsResponse>("/plan/workouts");
}

export async function upsertPlanWorkout(
  workoutCode: string,
  payload: UpsertPlanWorkoutRequest
): Promise<UpsertPlanWorkoutResponse> {
  const normalizedCode = workoutCode.trim();
  if (normalizedCode.length === 0) {
    throw new Error("workoutCode is required.");
  }
  return getJson<UpsertPlanWorkoutResponse>(`/plan/workouts/${encodeURIComponent(normalizedCode)}`, {
    method: "PUT",
    body: payload
  });
}

export async function sendPlanDayWorkoutToGarmin(
  dateLocal: string,
  payload: SendPlanDayWorkoutToGarminRequest = {}
): Promise<SendPlanDayWorkoutToGarminResponse> {
  const normalizedDate = dateLocal.trim();
  if (normalizedDate.length === 0) {
    throw new Error("dateLocal is required.");
  }
  return getJson<SendPlanDayWorkoutToGarminResponse>(
    `/plan/day/${encodeURIComponent(normalizedDate)}/garmin-sync`,
    {
      method: "POST",
      body: payload,
    }
  );
}

export async function runPlanDayGarminSync(
  dateLocal: string,
  payload: RunPlanDayGarminSyncRequest = {}
): Promise<RunPlanDayGarminSyncResponse> {
  const normalizedDate = dateLocal.trim();
  if (normalizedDate.length === 0) {
    throw new Error("dateLocal is required.");
  }
  return getJson<RunPlanDayGarminSyncResponse>(
    `/plan/day/${encodeURIComponent(normalizedDate)}/garmin-sync/run`,
    {
      method: "POST",
      body: payload,
    }
  );
}

export async function schedulePlanDayGarminSync(
  dateLocal: string,
  payload: SchedulePlanDayGarminSyncRequest = {}
): Promise<SchedulePlanDayGarminSyncResponse> {
  const normalizedDate = dateLocal.trim();
  if (normalizedDate.length === 0) {
    throw new Error("dateLocal is required.");
  }
  return getJson<SchedulePlanDayGarminSyncResponse>(
    `/plan/day/${encodeURIComponent(normalizedDate)}/garmin-sync/schedule`,
    {
      method: "POST",
      body: payload,
    }
  );
}

export async function resolvePlanDayGarminSyncResult(
  dateLocal: string,
  payload: ResolvePlanDayGarminSyncResultRequest = {}
): Promise<ResolvePlanDayGarminSyncResultResponse> {
  const normalizedDate = dateLocal.trim();
  if (normalizedDate.length === 0) {
    throw new Error("dateLocal is required.");
  }
  return getJson<ResolvePlanDayGarminSyncResultResponse>(
    `/plan/day/${encodeURIComponent(normalizedDate)}/garmin-sync/result`,
    {
      method: "POST",
      body: payload,
    }
  );
}
