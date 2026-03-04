import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type DashboardAggregateEntry,
  getDashboardData,
  type DashboardActivity,
  type DashboardDataResponse,
  type DashboardResponseMode,
  type GetDashboardDataRequest
} from "../../api/view-api";
import { ApiRequestError } from "../../api/http-client";
import { recordViewTiming, timeViewOperation } from "./view-timing";

const TREND_WEEKS = 8;
const HEATMAP_DAYS = 84;
const HEATMAP_COLUMNS = 14;
const HEATMAP_COLORS = [
  "rgba(255, 255, 255, 0.06)",
  "rgba(63, 168, 255, 0.35)",
  "rgba(57, 217, 138, 0.45)",
  "rgba(255, 209, 102, 0.6)",
  "rgba(245, 124, 0, 0.85)"
];
const DEFAULT_SCOPE_MODE: DashboardResponseMode = "full";

interface WeeklyTrendPoint {
  week_start: string;
  label: string;
  distance: number;
}

interface HeatmapCell {
  date: string;
  count: number;
  intensity: number;
}

interface TypeMetricPanel {
  type: string;
  label: string;
  accent: string;
  activityCount: number;
  distance: number;
  movingTime: number;
  avgEfficiencyFactor: number | null;
  avgFitness: number | null;
  avgFatigue: number | null;
}

function toIsoDateUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseIsoDateUtc(value: string): Date | null {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function addDaysUtc(value: Date, deltaDays: number): Date {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next;
}

function startOfWeekUtc(value: Date, weekStart: "sunday" | "monday"): Date {
  const day = value.getUTCDay();
  const offset = weekStart === "monday" ? (day === 0 ? 6 : day - 1) : day;
  return addDaysUtc(value, -offset);
}

function activityDate(activity: DashboardActivity): Date | null {
  const direct = parseIsoDateUtc(activity.date);
  if (direct) {
    return direct;
  }
  const parsed = new Date(String(activity.start_date_local || "").trim());
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function formatDistance(value: number, unit: string): string {
  const normalizedUnit = String(unit || "").trim() || "mi";
  return `${value.toFixed(1)} ${normalizedUnit}`;
}

function formatElevation(value: number, unit: string): string {
  const normalizedUnit = String(unit || "").trim() || "ft";
  return `${Math.round(value)} ${normalizedUnit}`;
}

function formatHours(valueSeconds: number): string {
  const hours = valueSeconds / 3600;
  return `${hours.toFixed(1)} h`;
}

function formatOptionalMetric(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }
  return value.toFixed(digits);
}

function formatWeekLabel(weekStartDate: Date): string {
  const month = String(weekStartDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(weekStartDate.getUTCDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function buildWeeklyTrend(
  activities: DashboardActivity[],
  weekStart: "sunday" | "monday"
): WeeklyTrendPoint[] {
  const byWeek = new Map<string, number>();
  for (const activity of activities) {
    const date = activityDate(activity);
    if (!date) {
      continue;
    }
    const weekStartDate = startOfWeekUtc(date, weekStart);
    const key = toIsoDateUtc(weekStartDate);
    byWeek.set(key, (byWeek.get(key) ?? 0) + Number(activity.distance || 0));
  }
  const keys = Array.from(byWeek.keys()).sort();
  const lastKeys = keys.slice(-TREND_WEEKS);
  return lastKeys.map((key) => {
    const weekStartDate = parseIsoDateUtc(key);
    return {
      week_start: key,
      label: weekStartDate ? formatWeekLabel(weekStartDate) : key,
      distance: byWeek.get(key) ?? 0
    };
  });
}

function buildHeatmapCells(activities: DashboardActivity[]): { cells: HeatmapCell[]; activeDays: number } {
  const countsByDate = new Map<string, number>();
  let maxDate: Date | null = null;
  for (const activity of activities) {
    const date = activityDate(activity);
    if (!date) {
      continue;
    }
    const key = toIsoDateUtc(date);
    countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
    if (!maxDate || date.getTime() > maxDate.getTime()) {
      maxDate = date;
    }
  }

  const endDate = maxDate ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const startDate = addDaysUtc(endDate, -(HEATMAP_DAYS - 1));

  const rows: HeatmapCell[] = [];
  let maxCount = 0;
  let activeDays = 0;
  for (let index = 0; index < HEATMAP_DAYS; index += 1) {
    const currentDate = addDaysUtc(startDate, index);
    const key = toIsoDateUtc(currentDate);
    const count = countsByDate.get(key) ?? 0;
    if (count > maxCount) {
      maxCount = count;
    }
    if (count > 0) {
      activeDays += 1;
    }
    rows.push({
      date: key,
      count,
      intensity: 0
    });
  }

  const cells = rows.map((row) => {
    if (row.count <= 0 || maxCount <= 0) {
      return { ...row, intensity: 0 };
    }
    const scaled = Math.ceil((row.count / maxCount) * 4);
    return { ...row, intensity: Math.min(4, Math.max(1, scaled)) };
  });

  return { cells, activeDays };
}

function dashboardErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unable to load dashboard data.";
}

function normalizeYears(years: number[]): number[] {
  const unique = new Set<number>();
  for (const value of years) {
    const asNumber = Number(value);
    if (!Number.isFinite(asNumber)) {
      continue;
    }
    unique.add(Math.trunc(asNumber));
  }
  return Array.from(unique).sort((a, b) => a - b);
}

function buildDashboardRequest(params: {
  force: boolean;
  mode: DashboardResponseMode;
  year: number | null;
}): GetDashboardDataRequest | undefined {
  const request: GetDashboardDataRequest = {};
  if (params.force) {
    request.force = true;
  }
  if (params.mode !== "full") {
    request.mode = params.mode;
  }
  if (params.mode === "year" && typeof params.year === "number" && Number.isFinite(params.year)) {
    request.year = Math.trunc(params.year);
  }
  if (Object.keys(request).length === 0) {
    return undefined;
  }
  return request;
}

function buildTypeMetricPanels(
  payload: DashboardDataResponse | null,
  selectedType: string,
  scopedYears: Set<string>
): TypeMetricPanel[] {
  if (!payload) {
    return [];
  }

  const typeMeta = payload.type_meta ?? {};
  const aggregates = payload.aggregates ?? {};
  const byType = new Map<
    string,
    {
      type: string;
      label: string;
      accent: string;
      activityCount: number;
      distance: number;
      movingTime: number;
      efficiencyWeightedSum: number;
      efficiencyWeight: number;
      fitnessWeightedSum: number;
      fitnessWeight: number;
      fatigueWeightedSum: number;
      fatigueWeight: number;
    }
  >();

  for (const [yearKey, yearBucket] of Object.entries(aggregates)) {
    if (scopedYears.size > 0 && !scopedYears.has(yearKey)) {
      continue;
    }
    if (!yearBucket || typeof yearBucket !== "object") {
      continue;
    }
    for (const [typeName, typeBucket] of Object.entries(yearBucket)) {
      if (selectedType !== "all" && typeName !== selectedType) {
        continue;
      }
      const meta = typeMeta[typeName];
      const existing = byType.get(typeName);
      const panel =
        existing ??
        {
          type: typeName,
          label: typeof meta?.label === "string" && meta.label.trim().length > 0 ? meta.label : typeName,
          accent: typeof meta?.accent === "string" && meta.accent.trim().length > 0 ? meta.accent : "#3fa8ff",
          activityCount: 0,
          distance: 0,
          movingTime: 0,
          efficiencyWeightedSum: 0,
          efficiencyWeight: 0,
          fitnessWeightedSum: 0,
          fitnessWeight: 0,
          fatigueWeightedSum: 0,
          fatigueWeight: 0
        };

      if (!typeBucket || typeof typeBucket !== "object") {
        byType.set(typeName, panel);
        continue;
      }

      for (const entry of Object.values(typeBucket)) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const count = Number((entry as DashboardAggregateEntry).count || 0);
        const distance = Number((entry as DashboardAggregateEntry).distance || 0);
        const movingTime = Number((entry as DashboardAggregateEntry).moving_time || 0);
        const avgEfficiency = Number((entry as DashboardAggregateEntry).avg_efficiency_factor);
        const avgFitness = Number((entry as DashboardAggregateEntry).avg_fitness);
        const avgFatigue = Number((entry as DashboardAggregateEntry).avg_fatigue);

        if (Number.isFinite(count) && count > 0) {
          panel.activityCount += count;
        }
        if (Number.isFinite(distance) && distance > 0) {
          panel.distance += distance;
        }
        if (Number.isFinite(movingTime) && movingTime > 0) {
          panel.movingTime += movingTime;
        }
        if (Number.isFinite(avgEfficiency) && avgEfficiency > 0 && Number.isFinite(movingTime) && movingTime > 0) {
          panel.efficiencyWeightedSum += avgEfficiency * movingTime;
          panel.efficiencyWeight += movingTime;
        }
        if (Number.isFinite(avgFitness) && Number.isFinite(count) && count > 0) {
          panel.fitnessWeightedSum += avgFitness * count;
          panel.fitnessWeight += count;
        }
        if (Number.isFinite(avgFatigue) && Number.isFinite(count) && count > 0) {
          panel.fatigueWeightedSum += avgFatigue * count;
          panel.fatigueWeight += count;
        }
      }

      byType.set(typeName, panel);
    }
  }

  return Array.from(byType.values())
    .map((panel) => {
      return {
        type: panel.type,
        label: panel.label,
        accent: panel.accent,
        activityCount: panel.activityCount,
        distance: panel.distance,
        movingTime: panel.movingTime,
        avgEfficiencyFactor:
          panel.efficiencyWeight > 0 ? panel.efficiencyWeightedSum / panel.efficiencyWeight : null,
        avgFitness: panel.fitnessWeight > 0 ? panel.fitnessWeightedSum / panel.fitnessWeight : null,
        avgFatigue: panel.fatigueWeight > 0 ? panel.fatigueWeightedSum / panel.fatigueWeight : null
      };
    })
    .sort((left, right) => {
      if (right.activityCount !== left.activityCount) {
        return right.activityCount - left.activityCount;
      }
      return left.label.localeCompare(right.label);
    });
}

export function ViewPage() {
  const [payload, setPayload] = useState<DashboardDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<DashboardResponseMode>(DEFAULT_SCOPE_MODE);
  const [scopeYear, setScopeYear] = useState<number | null>(null);
  const [knownYears, setKnownYears] = useState<number[]>([]);
  const [selectedType, setSelectedType] = useState("all");

  const loadDashboard = useCallback(async (params: {
    force: boolean;
    metric: string;
    mode: DashboardResponseMode;
    year: number | null;
  }) => {
    if (params.mode === "year" && (params.year === null || !Number.isFinite(params.year))) {
      setError("Select a year to scope the dashboard.");
      return;
    }
    if (params.force) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const request = buildDashboardRequest(params);
      const response = await timeViewOperation(params.metric, () => getDashboardData(request));
      setPayload(response);
    } catch (loadError) {
      setError(dashboardErrorMessage(loadError));
      if (!params.force) {
        setPayload(null);
      }
    } finally {
      if (params.force) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard({
      force: false,
      metric: "dashboard.load",
      mode: DEFAULT_SCOPE_MODE,
      year: null
    });
  }, [loadDashboard]);

  useEffect(() => {
    const incomingYears = normalizeYears(payload?.years ?? []);
    if (incomingYears.length === 0) {
      return;
    }
    setKnownYears((current) => {
      const merged = normalizeYears([...current, ...incomingYears]);
      if (merged.length === current.length && merged.every((value, index) => value === current[index])) {
        return current;
      }
      return merged;
    });
  }, [payload]);

  const yearOptions = useMemo(() => {
    if (knownYears.length > 0) {
      return knownYears;
    }
    return normalizeYears(payload?.years ?? []);
  }, [knownYears, payload]);

  useEffect(() => {
    if (yearOptions.length === 0) {
      setScopeYear(null);
      return;
    }
    if (scopeYear === null || !yearOptions.includes(scopeYear)) {
      setScopeYear(yearOptions[yearOptions.length - 1]);
    }
  }, [scopeYear, yearOptions]);

  const typeOptions = useMemo(() => ["all", ...(payload?.types ?? [])], [payload]);

  useEffect(() => {
    if (scopeMode === "summary" && selectedType !== "all") {
      setSelectedType("all");
    }
  }, [scopeMode, selectedType]);

  useEffect(() => {
    if (selectedType === "all") {
      return;
    }
    if (!typeOptions.includes(selectedType)) {
      setSelectedType("all");
    }
  }, [selectedType, typeOptions]);

  const filteredActivities = useMemo(() => {
    const activities = payload?.activities ?? [];
    if (selectedType === "all") {
      return activities;
    }
    return activities.filter((activity) => String(activity.type || "") === selectedType);
  }, [payload, selectedType]);

  const totals = useMemo(() => {
    return filteredActivities.reduce(
      (accumulator, activity) => {
        return {
          activityCount: accumulator.activityCount + 1,
          distance: accumulator.distance + Number(activity.distance || 0),
          elevation: accumulator.elevation + Number(activity.elevation_gain || 0),
          movingTime: accumulator.movingTime + Number(activity.moving_time || 0)
        };
      },
      { activityCount: 0, distance: 0, elevation: 0, movingTime: 0 }
    );
  }, [filteredActivities]);

  const weeklyTrend = useMemo(
    () => buildWeeklyTrend(filteredActivities, payload?.week_start ?? "sunday"),
    [filteredActivities, payload?.week_start]
  );
  const maxTrendDistance = useMemo(
    () => weeklyTrend.reduce((max, point) => Math.max(max, point.distance), 0),
    [weeklyTrend]
  );
  const heatmap = useMemo(() => buildHeatmapCells(filteredActivities), [filteredActivities]);
  const scopedYearKeys = useMemo(() => {
    const years = new Set<string>();
    if (scopeMode === "year" && scopeYear !== null) {
      years.add(String(scopeYear));
      return years;
    }
    for (const yearValue of payload?.years ?? []) {
      years.add(String(Math.trunc(yearValue)));
    }
    return years;
  }, [payload?.years, scopeMode, scopeYear]);
  const typeMetricPanels = useMemo(
    () => buildTypeMetricPanels(payload, selectedType, scopedYearKeys),
    [payload, scopedYearKeys, selectedType]
  );
  const selectedScopeLabel = useMemo(() => {
    if (scopeMode === "summary") {
      return "Summary mode";
    }
    if (scopeMode === "year") {
      return scopeYear === null ? "Year mode" : `Year ${scopeYear}`;
    }
    return "Full history";
  }, [scopeMode, scopeYear]);
  const displayedActivityCount = useMemo(() => {
    if (
      scopeMode === "summary" &&
      selectedType === "all" &&
      typeof payload?.activity_count === "number" &&
      Number.isFinite(payload.activity_count)
    ) {
      return Math.max(0, Math.trunc(payload.activity_count));
    }
    return totals.activityCount;
  }, [payload?.activity_count, scopeMode, selectedType, totals.activityCount]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">View</Typography>
        <Typography variant="body2" color="text.secondary">
          Review training trends and heatmap patterns from your current dashboard activity data.
        </Typography>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
        <Button
          variant="contained"
          onClick={() =>
            void loadDashboard({
              force: true,
              metric: "dashboard.refresh",
              mode: scopeMode,
              year: scopeYear
            })
          }
          disabled={isLoading || isRefreshing}
        >
          {isRefreshing ? "Refreshing dashboard..." : "Refresh dashboard"}
        </Button>
        <TextField
          select
          SelectProps={{ native: true }}
          size="small"
          label="Dashboard scope mode"
          value={scopeMode}
          onChange={(event) => {
            const nextMode = String(event.target.value || "full").trim().toLowerCase() as DashboardResponseMode;
            const normalizedMode: DashboardResponseMode = ["full", "summary", "year"].includes(nextMode)
              ? nextMode
              : "full";
            const fallbackYear = scopeYear ?? (yearOptions.length > 0 ? yearOptions[yearOptions.length - 1] : null);
            setScopeMode(normalizedMode);
            recordViewTiming("dashboard.scope_mode_select", 0);
            if (normalizedMode === "year") {
              if (fallbackYear === null) {
                setError("No dashboard years are available for year scope.");
                return;
              }
              setScopeYear(fallbackYear);
              void loadDashboard({
                force: false,
                metric: "dashboard.scope_change_mode",
                mode: "year",
                year: fallbackYear
              });
              return;
            }
            void loadDashboard({
              force: false,
              metric: "dashboard.scope_change_mode",
              mode: normalizedMode,
              year: fallbackYear
            });
          }}
          inputProps={{ "aria-label": "Dashboard scope mode" }}
          sx={{ minWidth: { sm: 220 } }}
          disabled={isLoading || isRefreshing}
        >
          <option value="full">Full history</option>
          <option value="summary">Summary mode</option>
          <option value="year">Year mode</option>
        </TextField>
        <TextField
          select
          SelectProps={{ native: true }}
          size="small"
          label="Dashboard scope year"
          value={scopeYear === null ? "" : String(scopeYear)}
          onChange={(event) => {
            const nextYear = Number(event.target.value);
            if (!Number.isFinite(nextYear)) {
              return;
            }
            setScopeYear(Math.trunc(nextYear));
            recordViewTiming("dashboard.scope_year_select", 0);
            if (scopeMode !== "year") {
              return;
            }
            void loadDashboard({
              force: false,
              metric: "dashboard.scope_change_year",
              mode: "year",
              year: Math.trunc(nextYear)
            });
          }}
          inputProps={{ "aria-label": "Dashboard scope year" }}
          sx={{ minWidth: { sm: 180 } }}
          disabled={isLoading || isRefreshing || scopeMode !== "year" || yearOptions.length === 0}
        >
          {scopeYear === null ? <option value="">Select year</option> : null}
          {yearOptions.map((yearValue) => (
            <option key={yearValue} value={yearValue}>
              {yearValue}
            </option>
          ))}
        </TextField>
        <TextField
          select
          SelectProps={{ native: true }}
          size="small"
          label="Activity type filter"
          value={selectedType}
          onChange={(event) => {
            setSelectedType(event.target.value);
            recordViewTiming("dashboard.filter_type", 0);
          }}
          inputProps={{ "aria-label": "Activity type filter" }}
          sx={{ minWidth: { sm: 220 } }}
          disabled={isLoading || !payload || scopeMode === "summary"}
        >
          <option value="all">All activity types</option>
          {(payload?.types ?? []).map((typeName) => (
            <option key={typeName} value={typeName}>
              {payload?.type_meta?.[typeName]?.label ?? typeName}
            </option>
          ))}
        </TextField>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {isLoading && !payload ? <Typography>Loading dashboard data...</Typography> : null}

      {payload ? (
        <>
          <Alert severity="info" data-testid="dashboard-selected-scope">
            Selected scope: {selectedScopeLabel}
          </Alert>

          {payload.cache_state ? (
            <Alert severity={payload.revalidating ? "info" : "warning"}>
              Dashboard cache state: {payload.cache_state}
            </Alert>
          ) : null}

          <Card variant="outlined">
            <CardContent sx={{ display: "grid", gap: 1 }}>
              <Typography variant="subtitle1">Current training snapshot</Typography>
              <Typography variant="body2">Activities in scope: {displayedActivityCount}</Typography>
              <Typography variant="body2">
                Distance in scope: {formatDistance(totals.distance, payload.units.distance)}
              </Typography>
              <Typography variant="body2">
                Elevation in scope: {formatElevation(totals.elevation, payload.units.elevation)}
              </Typography>
              <Typography variant="body2">Moving time in scope: {formatHours(totals.movingTime)}</Typography>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent sx={{ display: "grid", gap: 1.5 }}>
              <Typography variant="subtitle1">Distance trend (last 8 weeks)</Typography>
              {weeklyTrend.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No trend data available yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {weeklyTrend.map((point) => {
                    const percent = maxTrendDistance > 0 ? (point.distance / maxTrendDistance) * 100 : 0;
                    return (
                      <Box key={point.week_start} sx={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 1, alignItems: "center" }}>
                        <Typography variant="caption" color="text.secondary">
                          {point.label}
                        </Typography>
                        <Box
                          role="img"
                          aria-label={`Trend ${point.week_start}: ${point.distance.toFixed(1)} ${payload.units.distance}`}
                          sx={{
                            position: "relative",
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: "rgba(255,255,255,0.08)",
                            overflow: "hidden"
                          }}
                        >
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 0,
                              width: `${Math.max(4, Math.round(percent))}%`,
                              borderRadius: 999,
                              background: "linear-gradient(90deg, #3fa8ff, #39d98a)"
                            }}
                          />
                        </Box>
                        <Typography variant="caption">{formatDistance(point.distance, payload.units.distance)}</Typography>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent sx={{ display: "grid", gap: 1.25 }}>
              <Typography variant="subtitle1">Activity-type labels and custom metrics</Typography>
              {typeMetricPanels.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No activity-type custom metrics available for selected scope.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {typeMetricPanels.map((panel) => (
                    <Box
                      key={panel.type}
                      data-testid={`type-metric-${panel.type}`}
                      sx={{
                        border: "1px solid rgba(255,255,255,0.14)",
                        borderRadius: 1,
                        p: 1
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
                      >
                        <Typography variant="subtitle2">
                          <Box
                            component="span"
                            sx={{
                              display: "inline-block",
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              bgcolor: panel.accent,
                              mr: 1,
                              verticalAlign: "middle"
                            }}
                          />
                          {panel.label}
                          {panel.label !== panel.type ? ` (${panel.type})` : ""}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Activities: {panel.activityCount}
                        </Typography>
                      </Stack>
                      <Typography variant="body2">
                        Distance: {formatDistance(panel.distance, payload.units.distance)} | Moving time:{" "}
                        {formatHours(panel.movingTime)}
                      </Typography>
                      <Typography variant="body2">
                        Avg efficiency: {formatOptionalMetric(panel.avgEfficiencyFactor, 2)}
                      </Typography>
                      <Typography variant="body2">Avg fitness: {formatOptionalMetric(panel.avgFitness, 1)}</Typography>
                      <Typography variant="body2">Avg fatigue: {formatOptionalMetric(panel.avgFatigue, 1)}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent sx={{ display: "grid", gap: 1.5 }}>
              <Typography variant="subtitle1">Activity heatmap (last 12 weeks)</Typography>
              <Typography variant="body2" color="text.secondary">
                Active days: {heatmap.activeDays}/{HEATMAP_DAYS}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${HEATMAP_COLUMNS}, minmax(0, 1fr))`,
                  gap: 0.5
                }}
              >
                {heatmap.cells.map((cell) => (
                  <Box
                    key={cell.date}
                    component="span"
                    role="img"
                    aria-label={`Heatmap ${cell.date}: ${cell.count} activities`}
                    data-testid={`heatmap-cell-${cell.date}`}
                    sx={{
                      height: 12,
                      borderRadius: 0.5,
                      backgroundColor: HEATMAP_COLORS[cell.intensity]
                    }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </>
      ) : null}
    </Box>
  );
}
