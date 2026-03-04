import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getPlanData,
  getPlanWorkouts,
  resolvePlanDayGarminSyncResult,
  sendPlanDayWorkoutToGarmin,
  updatePlanDaysBulk,
  upsertPlanWorkout,
  type BulkPlanDayUpdate,
  type PlanGarminSyncRecord,
  type PlanDataResponse,
  type PlanWorkoutDefinition,
} from "../../api/plan-api";
import { ApiRequestError } from "../../api/http-client";
import { timePlanOperation } from "./plan-timing";

type Feedback = {
  severity: "success" | "info" | "error";
  message: string;
};

type DayDraftState = {
  distance: string;
  run_type: string;
  workout_code: string;
};

type WorkoutWorkshopDraft = {
  workout_code: string;
  title: string;
  structure: string;
};

function emptyWorkoutWorkshopDraft(): WorkoutWorkshopDraft {
  return {
    workout_code: "",
    title: "",
    structure: "",
  };
}

const WORKOUT_PRESET_OPTIONS = [
  "2E + 3x2T w/2:00 jog + 2E (Hansons strength)",
  "2E + 6x800m @5k w/400m jog + 2E (Hansons speed)",
  "1.5E + 10x400m @5k w/400m jog + 1.5E (Hansons speed)",
  "2E + 20T + 2E (Jack Daniels tempo)",
  "2E + 5x1k @I w/3:00 jog + 2E (Jack Daniels interval)",
  "2E + 6x200m @R w/200m jog + 2E (Jack Daniels repetition)",
  "15WU + 4x4min @LT2 w/3min easy + 10CD (Norwegian 4x4)",
  "15WU + 5x4min @LT2 w/2min easy + 10CD (Norwegian variant)",
  "15WU + 3x8min @LT1 w/2min easy + 10CD (Norwegian threshold)",
];

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return `${Math.round(value * 100)}%`;
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unable to save plan edits. Correct highlighted values and try again.";
}

function workshopErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unable to save workout definition. Correct fields and try again.";
}

function garminSyncErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unable to start Garmin sync. Try again in a moment.";
}

function formatSyncTimestamp(isoTimestamp: string | undefined): string {
  const value = String(isoTimestamp || "").trim();
  if (!value) {
    return "";
  }
  return value;
}

function normalizeDistanceInput(rawValue: string): { isValid: boolean; normalized?: string; error?: string } {
  const normalized = rawValue.replace(/\s+/g, "");
  if (normalized.length === 0) {
    return {
      isValid: false,
      error: "Distance is required. Enter a numeric value like 6 or a split like 6+4."
    };
  }
  const part = "-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)";
  const pattern = new RegExp(`^${part}(?:\\+${part})*$`);
  if (!pattern.test(normalized)) {
    return {
      isValid: false,
      error: "Distance must be numeric or '+' separated numeric values."
    };
  }
  return {
    isValid: true,
    normalized
  };
}

function distancePiecesFromInput(normalizedDistance: string): number[] {
  return normalizedDistance
    .split("+")
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function firstWorkoutCodeFromRow(row: {
  planned_sessions_detail?: Array<{ planned_workout?: string; workout_code?: string }>;
}): string {
  const sessions = Array.isArray(row.planned_sessions_detail) ? row.planned_sessions_detail : [];
  for (const session of sessions) {
    const workout = String(session?.planned_workout || session?.workout_code || "").trim();
    if (workout.length > 0) {
      return workout;
    }
  }
  return "";
}

export function PlanPage() {
  const [payload, setPayload] = useState<PlanDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [centerDateInput, setCenterDateInput] = useState("");
  const [draftByDate, setDraftByDate] = useState<Record<string, DayDraftState>>({});
  const [workshopDefinitions, setWorkshopDefinitions] = useState<PlanWorkoutDefinition[]>([]);
  const [isWorkshopOpen, setIsWorkshopOpen] = useState(false);
  const [isWorkshopLoading, setIsWorkshopLoading] = useState(true);
  const [isWorkshopSaving, setIsWorkshopSaving] = useState(false);
  const [workshopFeedback, setWorkshopFeedback] = useState<Feedback | null>(null);
  const [workshopSelectedCode, setWorkshopSelectedCode] = useState("");
  const [workshopDraft, setWorkshopDraft] = useState<WorkoutWorkshopDraft>(emptyWorkoutWorkshopDraft());
  const [workoutSearchInput, setWorkoutSearchInput] = useState("");
  const [garminSyncByDate, setGarminSyncByDate] = useState<Record<string, PlanGarminSyncRecord>>({});
  const [sendingGarminByDate, setSendingGarminByDate] = useState<Record<string, boolean>>({});
  const requestIdRef = useRef(0);

  const rowByDate = useMemo(() => {
    const map = new Map<string, { planned_input?: string; run_type?: string; workout_code?: string }>();
    for (const row of payload?.rows ?? []) {
      map.set(String(row.date), {
        planned_input: String(row.planned_input ?? ""),
        run_type: String(row.run_type ?? ""),
        workout_code: firstWorkoutCodeFromRow(row),
      });
    }
    return map;
  }, [payload]);

  const dirtyDates = useMemo(() => {
    return Object.entries(draftByDate)
      .filter(([date, value]) => {
        const baselineDistance = String(rowByDate.get(date)?.planned_input ?? "");
        const baselineRunType = String(rowByDate.get(date)?.run_type ?? "");
        const baselineWorkout = String(rowByDate.get(date)?.workout_code ?? "");
        return (
          value.distance.trim() !== baselineDistance.trim()
          || value.run_type.trim() !== baselineRunType.trim()
          || value.workout_code.trim() !== baselineWorkout.trim()
        );
      })
      .map(([date]) => date)
      .sort((left, right) => left.localeCompare(right));
  }, [draftByDate, rowByDate]);

  const runTypeOptions = useMemo(() => {
    const options: string[] = [];
    const seen = new Set<string>();
    const append = (value: string) => {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
      options.push(value);
    };
    append("");
    for (const option of payload?.run_type_options ?? []) {
      const value = String(option ?? "").trim();
      append(value);
    }
    for (const row of payload?.rows ?? []) {
      const value = String(row.run_type ?? "").trim();
      append(value);
    }
    return options;
  }, [payload]);

  const runTypeOptionSet = useMemo(() => new Set(runTypeOptions), [runTypeOptions]);

  const workoutOptions = useMemo(() => {
    const options: string[] = [];
    const seen = new Set<string>();
    const append = (value: string) => {
      const normalized = String(value || "").trim();
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      options.push(normalized);
    };
    append("");
    for (const option of WORKOUT_PRESET_OPTIONS) {
      append(String(option || "").trim());
    }
    for (const definition of workshopDefinitions) {
      append(String(definition?.workout_code || "").trim());
    }
    for (const row of payload?.rows ?? []) {
      append(firstWorkoutCodeFromRow(row));
    }
    return options;
  }, [payload, workshopDefinitions]);

  const workoutOptionLabelByCode = useMemo(() => {
    const labels = new Map<string, string>();
    for (const option of WORKOUT_PRESET_OPTIONS) {
      const normalized = String(option || "").trim();
      if (!normalized) {
        continue;
      }
      labels.set(normalized.toLowerCase(), normalized);
    }
    for (const definition of workshopDefinitions) {
      const code = String(definition?.workout_code || "").trim();
      if (!code) {
        continue;
      }
      const title = String(definition?.title || "").trim();
      labels.set(
        code.toLowerCase(),
        title && title.toLowerCase() !== code.toLowerCase() ? `${title} (${code})` : code
      );
    }
    for (const row of payload?.rows ?? []) {
      const workoutCode = firstWorkoutCodeFromRow(row).trim();
      if (!workoutCode || labels.has(workoutCode.toLowerCase())) {
        continue;
      }
      labels.set(workoutCode.toLowerCase(), workoutCode);
    }
    return labels;
  }, [payload, workshopDefinitions]);

  const workoutSearchIndexByOption = useMemo(() => {
    const index = new Map<string, string>();
    for (const option of WORKOUT_PRESET_OPTIONS) {
      const normalized = String(option || "").trim();
      if (!normalized) {
        continue;
      }
      index.set(normalized.toLowerCase(), normalized.toLowerCase());
    }
    for (const definition of workshopDefinitions) {
      const code = String(definition?.workout_code || "").trim();
      if (!code) {
        continue;
      }
      const title = String(definition?.title || "").trim();
      const structure = String(definition?.structure || "").trim();
      index.set(
        code.toLowerCase(),
        `${code} ${title} ${structure}`.toLowerCase()
      );
    }
    for (const row of payload?.rows ?? []) {
      const workoutCode = firstWorkoutCodeFromRow(row).trim();
      if (!workoutCode || index.has(workoutCode.toLowerCase())) {
        continue;
      }
      index.set(workoutCode.toLowerCase(), workoutCode.toLowerCase());
    }
    return index;
  }, [payload, workshopDefinitions]);

  const normalizedWorkoutSearch = workoutSearchInput.trim().toLowerCase();

  const doesWorkoutOptionMatch = useCallback((option: string) => {
    const normalizedOption = String(option || "").trim();
    if (normalizedOption.length === 0 || normalizedWorkoutSearch.length === 0) {
      return true;
    }
    const searchText = workoutSearchIndexByOption.get(normalizedOption.toLowerCase()) ?? normalizedOption.toLowerCase();
    return searchText.includes(normalizedWorkoutSearch);
  }, [normalizedWorkoutSearch, workoutSearchIndexByOption]);

  const workoutMatchedCount = useMemo(() => {
    let count = 0;
    for (const option of workoutOptions) {
      if (!option) {
        continue;
      }
      if (doesWorkoutOptionMatch(option)) {
        count += 1;
      }
    }
    return count;
  }, [doesWorkoutOptionMatch, workoutOptions]);

  const filteredWorkoutOptionsForRow = useCallback((selectedWorkoutCode: string): string[] => {
    if (normalizedWorkoutSearch.length === 0) {
      return workoutOptions;
    }
    const filtered = workoutOptions.filter((option) => doesWorkoutOptionMatch(option));
    const normalizedSelected = String(selectedWorkoutCode || "").trim();
    if (
      normalizedSelected
      && !filtered.some((item) => item.toLowerCase() === normalizedSelected.toLowerCase())
    ) {
      filtered.push(normalizedSelected);
    }
    return filtered;
  }, [doesWorkoutOptionMatch, normalizedWorkoutSearch, workoutOptions]);

  const loadPlan = useCallback(async (nextCenterDate?: string): Promise<PlanDataResponse | null> => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await timePlanOperation("plan-grid-load", () =>
        getPlanData(
          nextCenterDate && nextCenterDate.trim().length > 0
            ? { center_date: nextCenterDate.trim(), window_days: 14 }
            : { window_days: 14 }
        )
      );
      if (requestId !== requestIdRef.current) {
        return null;
      }
      setPayload(response);
      setCenterDateInput(String(response.center_date || ""));
      setDraftByDate({});
      return response;
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return null;
      }
      setLoadError(error instanceof Error ? error.message : "Unable to load plan data.");
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadWorkouts = useCallback(async (options?: { suppressFeedback?: boolean }): Promise<boolean> => {
    setIsWorkshopLoading(true);
    try {
      const response = await getPlanWorkouts();
      const workouts = Array.isArray(response.workouts) ? response.workouts : [];
      setWorkshopDefinitions(workouts);
      setWorkshopSelectedCode((currentSelectedCode) => {
        const normalizedSelectedCode = String(currentSelectedCode || "").trim();
        if (normalizedSelectedCode.length === 0) {
          return "";
        }
        const selected = workouts.find(
          (item) => String(item.workout_code || "") === normalizedSelectedCode
        );
        if (selected) {
          return normalizedSelectedCode;
        }
        setWorkshopDraft(emptyWorkoutWorkshopDraft());
        return "";
      });
      return true;
    } catch (error) {
      if (!options?.suppressFeedback) {
        setWorkshopFeedback({
          severity: "error",
          message: workshopErrorMessage(error),
        });
      }
      return false;
    } finally {
      setIsWorkshopLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    void loadWorkouts();
  }, [loadWorkouts]);

  const updateDraft = useCallback((date: string, update: Partial<DayDraftState>) => {
    setDraftByDate((current) => {
      const baselineDistance = String(rowByDate.get(date)?.planned_input ?? "");
      const baselineRunType = String(rowByDate.get(date)?.run_type ?? "");
      const baselineWorkout = String(rowByDate.get(date)?.workout_code ?? "");
      const existing = current[date];
      const nextDistance = update.distance ?? existing?.distance ?? baselineDistance;
      const nextRunType = update.run_type ?? existing?.run_type ?? baselineRunType;
      const nextWorkout = update.workout_code ?? existing?.workout_code ?? baselineWorkout;
      const isUnchanged =
        nextDistance.trim() === baselineDistance.trim()
        && nextRunType.trim() === baselineRunType.trim()
        && nextWorkout.trim() === baselineWorkout.trim();
      if (isUnchanged) {
        if (!(date in current)) {
          return current;
        }
        const next = { ...current };
        delete next[date];
        return next;
      }
      return {
        ...current,
        [date]: {
          distance: nextDistance,
          run_type: nextRunType,
          workout_code: nextWorkout,
        }
      };
    });
  }, [rowByDate]);

  const handleDistanceDraftChange = useCallback((date: string, value: string) => {
    updateDraft(date, { distance: value });
  }, [updateDraft]);

  const handleRunTypeDraftChange = useCallback((date: string, value: string) => {
    updateDraft(date, { run_type: value });
  }, [updateDraft]);

  const handleWorkoutDraftChange = useCallback((date: string, value: string) => {
    updateDraft(date, { workout_code: value });
  }, [updateDraft]);

  const handleWorkshopToggle = useCallback(() => {
    setIsWorkshopOpen((current) => !current);
  }, []);

  const handleWorkshopSelectChange = useCallback((value: string) => {
    const nextCode = String(value || "");
    setWorkshopSelectedCode(nextCode);
    setWorkshopFeedback(null);
    if (nextCode.trim().length === 0) {
      setWorkshopDraft(emptyWorkoutWorkshopDraft());
      return;
    }
    const existing = workshopDefinitions.find((item) => String(item.workout_code || "") === nextCode);
    if (!existing) {
      return;
    }
    setWorkshopDraft({
      workout_code: String(existing.workout_code || ""),
      title: String(existing.title || ""),
      structure: String(existing.structure || ""),
    });
  }, [workshopDefinitions]);

  const handleWorkshopDraftChange = useCallback((update: Partial<WorkoutWorkshopDraft>) => {
    setWorkshopDraft((current) => ({
      ...current,
      ...update,
    }));
  }, []);

  const handleWorkshopReset = useCallback(() => {
    setWorkshopSelectedCode("");
    setWorkshopFeedback(null);
    setWorkshopDraft(emptyWorkoutWorkshopDraft());
  }, []);

  const handleWorkshopSave = useCallback(async () => {
    const workoutCode = workshopDraft.workout_code.trim();
    const structure = workshopDraft.structure.trim();
    const title = workshopDraft.title.trim();
    if (workoutCode.length === 0) {
      setWorkshopFeedback({
        severity: "error",
        message: "Workout code is required.",
      });
      return;
    }
    if (workoutCode.includes("/") || workoutCode.includes("\\")) {
      setWorkshopFeedback({
        severity: "error",
        message: "Workout code cannot contain '/' or '\\'.",
      });
      return;
    }
    if (structure.length === 0) {
      setWorkshopFeedback({
        severity: "error",
        message: "Workout structure is required.",
      });
      return;
    }

    setIsWorkshopSaving(true);
    setWorkshopFeedback(null);
    try {
      const response = await upsertPlanWorkout(workoutCode, {
        workout_code: workoutCode,
        title,
        structure,
      });
      const saved = response.workout;
      const savedCode = String(saved?.workout_code || workoutCode);
      const savedTitle = String(saved?.title || title || savedCode);
      const savedStructure = String(saved?.structure || structure);
      setWorkshopSelectedCode(savedCode);
      setWorkshopDraft({
        workout_code: savedCode,
        title: savedTitle,
        structure: savedStructure,
      });
      setWorkshopFeedback({
        severity: "success",
        message: `Saved workout "${savedCode}".`,
      });
      const refreshed = await loadWorkouts({ suppressFeedback: true });
      if (!refreshed) {
        setWorkshopFeedback({
          severity: "error",
          message: 'Workout saved, but latest workshop list reload failed. Use "Reload" to retry.',
        });
      }
    } catch (error) {
      setWorkshopFeedback({
        severity: "error",
        message: workshopErrorMessage(error),
      });
    } finally {
      setIsWorkshopSaving(false);
    }
  }, [loadWorkouts, workshopDraft]);

  const handleCenter = useCallback(() => {
    setFeedback(null);
    void loadPlan(centerDateInput);
  }, [centerDateInput, loadPlan]);

  const handleReload = useCallback(() => {
    setFeedback(null);
    void loadPlan(centerDateInput);
  }, [centerDateInput, loadPlan]);

  const handleSave = useCallback(async () => {
    if (dirtyDates.length === 0) {
      setFeedback({ severity: "info", message: "No changes to save." });
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    const days: BulkPlanDayUpdate[] = [];
    for (const date of dirtyDates) {
      const baseline = rowByDate.get(date);
      const currentDraft = draftByDate[date];
      const distanceRaw = String(currentDraft?.distance ?? baseline?.planned_input ?? "");
      const baselineDistance = String(baseline?.planned_input ?? "");
      const baselineRunType = String(baseline?.run_type ?? "").trim();
      const runType = String(currentDraft?.run_type ?? baseline?.run_type ?? "").trim();
      const baselineWorkout = String(baseline?.workout_code ?? "").trim();
      const workoutCode = String(currentDraft?.workout_code ?? baseline?.workout_code ?? "").trim();

      const parsed = normalizeDistanceInput(distanceRaw);
      if (!parsed.isValid) {
        setIsSaving(false);
        setFeedback({
          severity: "error",
          message: `${date}: ${parsed.error ?? "Invalid distance value."}`
        });
        return;
      }
      if (runType.length > 0 && !runTypeOptionSet.has(runType)) {
        setIsSaving(false);
        setFeedback({
          severity: "error",
          message: `${date}: Run type is unsupported. Choose a value from the list.`
        });
        return;
      }
      const segments = distancePiecesFromInput(parsed.normalized ?? "");
      if (workoutCode.length > 0 && segments.length === 0) {
        setIsSaving(false);
        setFeedback({
          severity: "error",
          message: `${date}: Set mileage before attaching a workout.`
        });
        return;
      }

      const workoutChanged = workoutCode !== baselineWorkout;
      const distanceChanged = distanceRaw.trim() !== baselineDistance.trim();
      const runTypeChanged = runType !== baselineRunType;
      const hasWorkoutState = workoutCode.length > 0 || baselineWorkout.length > 0;
      const shouldSendSessions = hasWorkoutState && (workoutChanged || distanceChanged);

      const dayPayload: {
        date_local: string;
        distance?: string;
        run_type?: string;
        sessions?: Array<{ planned_miles: number; workout_code?: string }>;
      } = {
        date_local: date,
      };
      if (shouldSendSessions) {
        dayPayload.sessions = segments.map((plannedMiles, index) => ({
          planned_miles: plannedMiles,
          ...(index === 0 && workoutCode.length > 0 ? { workout_code: workoutCode } : {})
        }));
      } else if (distanceChanged) {
        dayPayload.distance = parsed.normalized ?? "";
      }
      if (runTypeChanged) {
        dayPayload.run_type = runType;
      }
      days.push(dayPayload);
    }
    try {
      const response = await timePlanOperation("plan-grid-save", () => updatePlanDaysBulk({ days }));
      const count = Number(response.saved_count ?? days.length);
      const dayLabel = count === 1 ? "day" : "days";
      const refreshed = await loadPlan(centerDateInput);
      if (refreshed) {
        setFeedback({
          severity: "success",
          message: `Saved ${count} ${dayLabel}.`
        });
      } else {
        setFeedback({
          severity: "error",
          message: "Plan changes were saved, but the latest grid reload failed. Use Reload to retry."
        });
      }
    } catch (error) {
      await loadPlan(centerDateInput);
      setFeedback({
        severity: "error",
        message: saveErrorMessage(error)
      });
    } finally {
      setIsSaving(false);
    }
  }, [centerDateInput, dirtyDates, draftByDate, loadPlan, rowByDate, runTypeOptionSet]);

  const handleSendToGarmin = useCallback(async (dateKey: string, workoutCode: string) => {
    const normalizedWorkoutCode = String(workoutCode || "").trim();
    if (!normalizedWorkoutCode) {
      setFeedback({
        severity: "error",
        message: `${dateKey}: Attach a workout before sending to Garmin.`,
      });
      return;
    }
    setSendingGarminByDate((current) => ({ ...current, [dateKey]: true }));
    setFeedback(null);
    try {
      const response = await sendPlanDayWorkoutToGarmin(dateKey, { workout_code: normalizedWorkoutCode });
      setGarminSyncByDate((current) => ({ ...current, [dateKey]: response.sync }));

      const resultResponse = await resolvePlanDayGarminSyncResult(dateKey, { workout_code: normalizedWorkoutCode });
      setGarminSyncByDate((current) => ({ ...current, [dateKey]: resultResponse.sync }));
      const statusCode = String(resultResponse.result?.status_code || resultResponse.sync?.status_code || "unknown");
      const timestamp =
        formatSyncTimestamp(resultResponse.result?.timestamp_utc || resultResponse.sync?.updated_at_utc) || "unavailable";
      if (resultResponse.result?.outcome === "scheduled") {
        setFeedback({
          severity: "success",
          message: `Garmin sync completed for ${dateKey}. Status: ${statusCode}. Timestamp: ${timestamp}. Scheduling confirmed.`,
        });
      } else {
        const retryGuidance = String(
          resultResponse.result?.retry_guidance || resultResponse.sync?.retry_guidance || ""
        ).trim();
        setFeedback({
          severity: "error",
          message: retryGuidance
            ? `Garmin sync failed for ${dateKey}. Status: ${statusCode}. Timestamp: ${timestamp}. ${retryGuidance}`
            : `Garmin sync failed for ${dateKey}. Status: ${statusCode}. Timestamp: ${timestamp}. Retry from Plan after checking Garmin connection.`,
        });
      }
    } catch (error) {
      setFeedback({
        severity: "error",
        message: garminSyncErrorMessage(error),
      });
    } finally {
      setSendingGarminByDate((current) => {
        const next = { ...current };
        delete next[dateKey];
        return next;
      });
    }
  }, []);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">Plan</Typography>
        <Typography variant="body2" color="text.secondary">
          Multi-week grid with fast inline mileage edits.
        </Typography>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
        <TextField
          label="Center date"
          type="date"
          size="small"
          value={centerDateInput}
          onChange={(event) => setCenterDateInput(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button variant="outlined" onClick={handleCenter} disabled={isLoading || isSaving}>
          Center
        </Button>
        <Button variant="outlined" onClick={handleReload} disabled={isLoading || isSaving}>
          Reload
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={isLoading || isSaving || dirtyDates.length === 0}>
          Save changes
        </Button>
        <TextField
          label="Workout search"
          size="small"
          value={workoutSearchInput}
          onChange={(event) => setWorkoutSearchInput(event.target.value)}
          placeholder="Search by name or type"
          inputProps={{ "aria-label": "Workout search" }}
          sx={{ minWidth: { sm: 260 } }}
        />
      </Stack>
      {normalizedWorkoutSearch.length > 0 ? (
        <Typography variant="body2" color="text.secondary">
          {workoutMatchedCount > 0
            ? `Showing ${workoutMatchedCount} matching workouts for "${workoutSearchInput.trim()}".`
            : `No workouts matched "${workoutSearchInput.trim()}".`}
        </Typography>
      ) : null}

      <Card variant="outlined">
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">Workout Workshop</Typography>
              <Typography variant="body2" color="text.secondary">
                Create or edit structured workouts and make them available in day selection lists.
              </Typography>
            </Box>
            <Button variant={isWorkshopOpen ? "outlined" : "contained"} onClick={handleWorkshopToggle}>
              {isWorkshopOpen ? "Hide Workout Workshop" : "Open Workout Workshop"}
            </Button>
          </Stack>

          {isWorkshopOpen ? (
            <Box sx={{ display: "grid", gap: 1.5 }}>
              {isWorkshopLoading ? <Typography>Loading workout definitions...</Typography> : null}
              <TextField
                select
                label="Existing workout"
                size="small"
                value={workshopSelectedCode}
                onChange={(event) => handleWorkshopSelectChange(event.target.value)}
                SelectProps={{ native: true }}
                inputProps={{ "aria-label": "Existing workout" }}
                disabled={isWorkshopSaving}
              >
                <option value="">Create new workout</option>
                {workshopDefinitions.map((item) => (
                  <option key={item.workout_code} value={item.workout_code}>
                    {item.title || item.workout_code}
                  </option>
                ))}
              </TextField>
              <TextField
                label="Workout code"
                size="small"
                value={workshopDraft.workout_code}
                onChange={(event) => handleWorkshopDraftChange({ workout_code: event.target.value })}
                inputProps={{ "aria-label": "Workout code" }}
                disabled={isWorkshopSaving}
              />
              <TextField
                label="Workout title"
                size="small"
                value={workshopDraft.title}
                onChange={(event) => handleWorkshopDraftChange({ title: event.target.value })}
                inputProps={{ "aria-label": "Workout title" }}
                disabled={isWorkshopSaving}
              />
              <TextField
                label="Workout structure"
                size="small"
                multiline
                minRows={5}
                value={workshopDraft.structure}
                onChange={(event) => handleWorkshopDraftChange({ structure: event.target.value })}
                inputProps={{ "aria-label": "Workout structure" }}
                disabled={isWorkshopSaving}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="contained"
                  onClick={handleWorkshopSave}
                  disabled={isWorkshopSaving || isWorkshopLoading}
                >
                  Save workout
                </Button>
                <Button variant="outlined" onClick={handleWorkshopReset} disabled={isWorkshopSaving}>
                  Create new
                </Button>
              </Stack>
              {workshopFeedback ? <Alert severity={workshopFeedback.severity}>{workshopFeedback.message}</Alert> : null}
            </Box>
          ) : null}
        </CardContent>
      </Card>

      {loadError ? <Alert severity="error">{loadError}</Alert> : null}
      {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

      {payload?.summary ? (
        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Typography variant="body2">Anchor: {payload.summary.anchor_date}</Typography>
              <Typography variant="body2">Week Plan: {formatNumber(payload.summary.week_planned, 1)} mi</Typography>
              <Typography variant="body2">Week Delta: {formatNumber(payload.summary.week_delta, 1)} mi</Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {isLoading && !payload ? <Typography>Loading plan...</Typography> : null}

      {payload ? (
        <TableContainer>
          <Table size="small" aria-label="Plan grid">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Planned (mi)</TableCell>
                <TableCell>Run Type</TableCell>
                <TableCell>Workout</TableCell>
                <TableCell>Week Mi</TableCell>
                <TableCell>WoW</TableCell>
                <TableCell>T7 Mi</TableCell>
                <TableCell>T30 Mi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payload.rows.map((row) => {
                const dateKey = String(row.date);
                const rowDraft = draftByDate[dateKey];
                const distanceValue = rowDraft?.distance ?? String(row.planned_input ?? "");
                const runTypeValue = rowDraft?.run_type ?? String(row.run_type ?? "");
                const workoutValue = rowDraft?.workout_code ?? firstWorkoutCodeFromRow(row);
                const hasUnsavedDayChanges = Boolean(rowDraft);
                const hasAttachedWorkout = workoutValue.trim().length > 0;
                const syncRecord = garminSyncByDate[dateKey];
                const isSendingGarmin = Boolean(sendingGarminByDate[dateKey]);
                const rowWorkoutOptions = filteredWorkoutOptionsForRow(workoutValue);
                return (
                  <TableRow key={dateKey} selected={Boolean(row.is_today)}>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <span>{dateKey}</span>
                        {row.is_today ? <Chip label="Today" size="small" color="primary" /> : null}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={distanceValue}
                        onChange={(event) => handleDistanceDraftChange(dateKey, event.target.value)}
                        inputProps={{
                          "aria-label": `Planned miles for ${dateKey}`,
                          inputMode: "decimal"
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={runTypeValue}
                        onChange={(event) => handleRunTypeDraftChange(dateKey, event.target.value)}
                        SelectProps={{ native: true }}
                        inputProps={{
                          "aria-label": `Run type for ${dateKey}`
                        }}
                      >
                        {runTypeOptions.map((option) => (
                          <option key={option || "__empty"} value={option}>
                            {option || "Unspecified"}
                          </option>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.75}>
                        <TextField
                          select
                          size="small"
                          value={workoutValue}
                          onChange={(event) => handleWorkoutDraftChange(dateKey, event.target.value)}
                          SelectProps={{ native: true }}
                          inputProps={{
                            "aria-label": `Workout for ${dateKey}`
                          }}
                        >
                          {rowWorkoutOptions.map((option) => (
                            <option key={option || "__empty"} value={option}>
                              {option
                                ? (workoutOptionLabelByCode.get(option.toLowerCase()) ?? option)
                                : "No workout"}
                            </option>
                          ))}
                        </TextField>
                        {hasAttachedWorkout ? (
                          <Box sx={{ display: "grid", gap: 0.5 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                void handleSendToGarmin(dateKey, workoutValue);
                              }}
                              disabled={isLoading || isSaving || isSendingGarmin || hasUnsavedDayChanges}
                              aria-label={`Send to Garmin for ${dateKey}`}
                            >
                              {isSendingGarmin ? "Syncing..." : "Send to Garmin"}
                            </Button>
                            {hasUnsavedDayChanges ? (
                              <Typography variant="caption" color="text.secondary">
                                Save day changes before sending to Garmin.
                              </Typography>
                            ) : null}
                            {syncRecord ? (
                              <Box sx={{ display: "grid", gap: 0.25 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Garmin sync: {syncRecord.status} ({syncRecord.status_code})
                                  {formatSyncTimestamp(syncRecord.updated_at_utc)
                                    ? ` at ${formatSyncTimestamp(syncRecord.updated_at_utc)}`
                                    : ""}
                                </Typography>
                                {syncRecord.status === "failed" && syncRecord.retry_guidance ? (
                                  <Typography variant="caption" color="error.main">
                                    {syncRecord.retry_guidance}
                                  </Typography>
                                ) : null}
                              </Box>
                            ) : null}
                          </Box>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell>{formatNumber(row.weekly_total, 1)}</TableCell>
                    <TableCell>{formatPercent(row.wow_change)}</TableCell>
                    <TableCell>{formatNumber(row.t7_miles, 1)}</TableCell>
                    <TableCell>{formatNumber(row.t30_miles, 1)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </Box>
  );
}
