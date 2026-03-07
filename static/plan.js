(function () {
  const bodyEl = document.getElementById("planTableBody");
  const metaEl = document.getElementById("planTopMeta");
  const summaryEl = document.getElementById("planSummary");
  const planActionStatusEl = document.getElementById("planActionStatus");
  const tableWrapEl = document.querySelector(".plan-table-wrap");
  const centerDateEl = document.getElementById("planCenterDate");
  const centerBtn = document.getElementById("planCenterBtn");
  const reloadBtn = document.getElementById("planReloadBtn");
  const settingsBtn = document.getElementById("planSettingsBtn");
  const settingsPanel = document.getElementById("planSettingsPanel");
  const seedBtn = document.getElementById("planSeedBtn");
  const settingsStatusEl = document.getElementById("planSettingsStatus");
  const paceDrawer = document.getElementById("planPaceDrawer");
  const workoutDrawer = document.getElementById("planWorkoutDrawer");
  const paceDrawerTab = document.getElementById("planPaceDrawerTab");
  const workoutDrawerTab = document.getElementById("planWorkoutDrawerTab");
  const paceDrawerClose = document.getElementById("planPaceDrawerClose");
  const workoutDrawerClose = document.getElementById("planWorkoutDrawerClose");
  const paceBackdrop = document.getElementById("planPaceBackdrop");
  const paceStatusEl = document.getElementById("planPaceStatus");
  const marathonGoalInputEl = document.getElementById("planMarathonGoalInput");
  const marathonGoalSetBtn = document.getElementById("planMarathonGoalSetBtn");
  const paceDistanceSelectEl = document.getElementById("planPaceDistanceSelect");
  const paceTimeInputEl = document.getElementById("planPaceTimeInput");
  const paceCalcBtn = document.getElementById("planPaceCalcBtn");
  const paceDerivedGoalEl = document.getElementById("planPaceDerivedGoal");
  const paceSetDerivedBtn = document.getElementById("planPaceSetDerivedBtn");
  const raceEquivalencyListEl = document.getElementById("planRaceEquivalencyList");
  const trainingPacesListEl = document.getElementById("planTrainingPacesList");
  const paceFamilyListEl = document.getElementById("planPaceFamilyList");
  const workoutWorkshopSection = document.getElementById("planWorkoutWorkshopSection");
  const workoutWorkshopMetaEl = document.getElementById("planWorkoutWorkshopMeta");
  const workoutDocumentMetaEl = document.getElementById("planWorkoutDocumentMeta");
  const workoutPickerToggleEl = document.getElementById("planWorkoutPickerToggle");
  const workoutPickerPanelEl = document.getElementById("planWorkoutPickerPanel");
  const workoutNewBtn = document.getElementById("planWorkoutNewBtn");
  const workoutSaveBtn = document.getElementById("planWorkoutSaveBtn");
  const workoutReloadBtn = document.getElementById("planWorkoutReloadBtn");
  const workoutYamlEditorEl = document.getElementById("planWorkoutYamlEditor");
  const workoutStatusEl = document.getElementById("planWorkoutStatus");

  let runTypeOptions = [""];
  let workoutCatalog = [];
  let workoutCatalogById = new Map();
  let selectedWorkoutId = "";
  let workoutDraftMode = false;
  let workoutDraftName = "";
  let workoutYamlText = "";
  let workoutYamlLoadedText = "";
  let workoutYamlSourcePath = "";
  let workoutYamlLoadError = "";
  let workoutPickerOpen = false;
  let activeDrawer = "";
  let pendingFocus = { date: "", field: "distance" };
  let rowsByDate = new Map();
  let renderedRows = [];
  let loadedStartDate = "";
  let loadedEndDate = "";
  let loadedTimezone = "";
  let metricContextByDate = new Map();
  let metricContextStartDate = "";
  let metricContextEndDate = "";
  let metricContextToday = "";
  let refreshFromDate = "";
  let refreshTimer = null;
  let refreshInFlight = false;
  let refreshQueuedAfterFlight = false;
  let pendingPlanSaves = new Map();
  let saveFlushTimer = null;
  let saveFlushInFlight = false;
  let saveFlushQueuedAfterFlight = false;
  let saveMaxNextFocusDate = "";
  let loadRequestVersion = 0;
  let hasLoadedPlanMeta = false;
  let paceCurrentGoal = "5:00:00";
  let paceDerivedGoal = "";
  const PLAN_INITIAL_FUTURE_DAYS = 365;
  const PLAN_APPEND_FUTURE_DAYS = 56;
  const PLAN_MAX_AUTO_REFRESH_ROWS = 220;

  const runTypeHotkeys = {
    e: "Easy",
    r: "Recovery",
    s: "SOS",
    l: "Long Road",
    m: "Long Moderate",
    t: "Long Trail",
    x: "Race",
    h: "HIIT",
    "1": "LT1",
    "2": "LT2",
  };
  const longRunTypeKeys = new Set(["longroad", "longmoderate", "longtrail", "race"]);
  const workoutLibraryOrder = [
    "Hansons",
    "Pfitz",
    "Higdon",
    "JD",
    "Galloway",
    "Strength",
    "Stretching",
    "Run Type",
    "Other",
  ];
  let workoutMenuHandlersBound = false;
  let rowActionMenuHandlersBound = false;

  function normalizeRunType(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isSosRunType(value) {
    return normalizeRunType(value) === "sos";
  }

  function bindWorkoutMenuHandlers() {
    if (workoutMenuHandlersBound) return;
    workoutMenuHandlersBound = true;
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".plan-workout-picker-shell")) {
        return;
      }
      closeWorkoutPickerPanel();
      if (target instanceof Element && target.closest(".plan-workout-field")) return;
      for (const field of document.querySelectorAll(".plan-workout-field")) {
        field.dataset.open = "0";
      }
      for (const menu of document.querySelectorAll(".plan-workout-menu")) {
        if (!(menu instanceof HTMLElement)) continue;
        menu.hidden = true;
      }
    });
  }

  function setWorkoutMenuOpen(field, menu, nextOpen) {
    if (!(field instanceof HTMLElement) || !(menu instanceof HTMLElement)) return;
    field.dataset.open = nextOpen ? "1" : "0";
    menu.hidden = !nextOpen;
  }

  function setPlanActionStatus(message, tone) {
    if (!(planActionStatusEl instanceof HTMLElement)) return;
    planActionStatusEl.textContent = String(message || "");
    if (tone === "ok" || tone === "error") {
      planActionStatusEl.dataset.tone = tone;
      return;
    }
    planActionStatusEl.dataset.tone = "neutral";
  }

  function closeRowActionMenus(exceptEl) {
    for (const shell of document.querySelectorAll(".plan-row-actions")) {
      if (!(shell instanceof HTMLElement)) continue;
      if (exceptEl instanceof HTMLElement && shell === exceptEl) continue;
      shell.dataset.open = "0";
      const trigger = shell.querySelector(".plan-row-actions-trigger");
      if (trigger instanceof HTMLElement) {
        trigger.setAttribute("aria-expanded", "false");
      }
      const menu = shell.querySelector(".plan-row-actions-menu");
      if (menu instanceof HTMLElement) {
        menu.hidden = true;
      }
    }
  }

  function bindRowActionMenuHandlers() {
    if (rowActionMenuHandlersBound) return;
    rowActionMenuHandlersBound = true;
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".plan-row-actions")) {
        return;
      }
      closeRowActionMenus();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const openMenu = document.querySelector('.plan-row-actions[data-open="1"]');
      if (!(openMenu instanceof HTMLElement)) return;
      const trigger = openMenu.querySelector(".plan-row-actions-trigger");
      closeRowActionMenus();
      if (trigger instanceof HTMLElement) {
        trigger.focus();
      }
    });
  }

  function normalizeWorkoutId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function rowAttachedWorkoutCodes(row) {
    const codes = [];
    const seen = new Set();
    for (const session of Array.isArray(row && row.planned_sessions_detail) ? row.planned_sessions_detail : []) {
      if (!session || typeof session !== "object") continue;
      const sessionRunType = String(session.run_type || (row && row.run_type) || "").trim();
      if (!isSosRunType(sessionRunType)) continue;
      const workoutCode = String(session.workout_code || session.planned_workout || "").trim();
      if (!workoutCode) continue;
      const normalized = workoutCode.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      codes.push(workoutCode);
    }
    return codes;
  }

  function attachedWorkoutWindowSummary(startDate, spanDays) {
    const summary = {
      dayCount: 0,
      workoutCount: 0,
    };
    if (!isIsoDateString(startDate)) return summary;
    for (let offset = 0; offset < Math.max(1, Number(spanDays) || 1); offset += 1) {
      const dateKey = addDaysIso(startDate, offset);
      const row = rowsByDate.get(dateKey);
      const codes = rowAttachedWorkoutCodes(row);
      if (codes.length <= 0) continue;
      summary.dayCount += 1;
      summary.workoutCount += codes.length;
    }
    return summary;
  }

  function workoutYamlDirty() {
    return String(workoutYamlText || "") !== String(workoutYamlLoadedText || "");
  }

  function currentWorkoutRecord() {
    if (workoutDraftMode) return null;
    return workoutCatalogById.get(normalizeWorkoutId(selectedWorkoutId)) || null;
  }

  function setWorkoutStatus(message, tone) {
    if (!workoutStatusEl) return;
    workoutStatusEl.textContent = String(message || "");
    if (tone === "ok" || tone === "error") {
      workoutStatusEl.dataset.tone = tone;
      return;
    }
    workoutStatusEl.dataset.tone = "neutral";
  }

  function workoutDisplayLabel(workout) {
    if (!workout || typeof workout !== "object") return "Select workout";
    return String(workout.label || workout.title || workout.workout_id || "Select workout");
  }

  function workoutGroupRank(library) {
    const key = String(library || "");
    const index = workoutLibraryOrder.findIndex((item) => item.toLowerCase() === key.toLowerCase());
    return index >= 0 ? index : workoutLibraryOrder.length;
  }

  function workoutsGroupedByLibrary(options) {
    const includeInvalid = Boolean(options && options.includeInvalid);
    const groups = new Map();
    for (const workout of Array.isArray(workoutCatalog) ? workoutCatalog : []) {
      if (!includeInvalid && workout && workout.invalid) continue;
      const library = String(workout && workout.library ? workout.library : "Other");
      if (!groups.has(library)) groups.set(library, []);
      groups.get(library).push(workout);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const rankDiff = workoutGroupRank(a[0]) - workoutGroupRank(b[0]);
      if (rankDiff !== 0) return rankDiff;
      return String(a[0]).localeCompare(String(b[0]));
    });
  }

  function renderWorkoutPickerPanel() {
    if (!(workoutPickerPanelEl instanceof HTMLElement)) return;
    workoutPickerPanelEl.textContent = "";
    const groups = workoutsGroupedByLibrary({ includeInvalid: true });
    if (groups.length === 0) {
      const empty = document.createElement("div");
      empty.className = "plan-workout-picker-empty";
      empty.textContent = "No workouts yet. Create one with New.";
      workoutPickerPanelEl.appendChild(empty);
      return;
    }
    for (const [library, workouts] of groups) {
      const details = document.createElement("details");
      details.className = "plan-workout-picker-group";
      details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = `${library} (${workouts.length})`;
      details.appendChild(summary);
      if (!Array.isArray(workouts) || workouts.length === 0) {
        const empty = document.createElement("div");
        empty.className = "plan-workout-picker-empty";
        empty.textContent = "No workouts yet.";
        details.appendChild(empty);
      } else {
        const items = document.createElement("div");
        items.className = "plan-workout-picker-items";
        workouts.forEach((workout) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "plan-workout-picker-item";
          item.dataset.workoutId = String(workout.workout_id || "");
          const shorthandText = workout && workout.invalid
            ? `Invalid YAML | ${String(workout.load_error || "repair required")}`
            : String(workout.shorthand || "");
          item.innerHTML = `<strong>${workoutDisplayLabel(workout)}</strong><span>${shorthandText}</span>`;
          item.addEventListener("click", async () => {
            if (workoutYamlDirty()) {
              const ok = window.confirm("Discard unsaved workout YAML changes?");
              if (!ok) return;
            }
            workoutDraftMode = false;
            workoutDraftName = "";
            selectedWorkoutId = String(workout.workout_id || "");
            closeWorkoutPickerPanel();
            await loadSelectedWorkoutDocument({ force: true });
          });
          items.appendChild(item);
        });
        details.appendChild(items);
      }
      workoutPickerPanelEl.appendChild(details);
    }
  }

  function closeWorkoutPickerPanel() {
    workoutPickerOpen = false;
    if (workoutPickerToggleEl instanceof HTMLElement) {
      workoutPickerToggleEl.setAttribute("aria-expanded", "false");
    }
    if (workoutPickerPanelEl instanceof HTMLElement) {
      workoutPickerPanelEl.hidden = true;
    }
  }

  function openWorkoutPickerPanel() {
    workoutPickerOpen = true;
    renderWorkoutPickerPanel();
    if (workoutPickerToggleEl instanceof HTMLElement) {
      workoutPickerToggleEl.setAttribute("aria-expanded", "true");
    }
    if (workoutPickerPanelEl instanceof HTMLElement) {
      workoutPickerPanelEl.hidden = false;
    }
  }

  function buildWorkoutYamlSkeleton(name) {
    const workoutId = String(name || "")
      .trim()
      .replace(/"/g, '\\"') || "New Workout";
    return [
      "library: Run Type",
      "run_type_default: SOS",
      "workout:",
      "  type: Run",
      `  "${workoutId}":`,
      "    - warmup: lap @H(z2)",
      "    - repeat(4):",
      "        - run: 4min @P($strength)",
      "        - recovery: 4min",
      "    - cooldown: 2mi @H(z2)",
      "tags:",
      "  - workout",
      "notes: ''",
      "",
    ].join("\n");
  }

  function applyWorkoutDocument(documentPayload) {
    const workout = documentPayload && typeof documentPayload === "object" ? (documentPayload.workout || {}) : {};
    selectedWorkoutId = String(workout.workout_id || selectedWorkoutId || "");
    workoutYamlText = String(documentPayload && documentPayload.yaml_text ? documentPayload.yaml_text : "");
    workoutYamlLoadedText = String(documentPayload && documentPayload.yaml_text ? documentPayload.yaml_text : "");
    workoutYamlSourcePath = String(documentPayload && documentPayload.source_path ? documentPayload.source_path : "");
    workoutYamlLoadError = String(documentPayload && documentPayload.load_error ? documentPayload.load_error : "");
    workoutDraftMode = false;
    workoutDraftName = String(workout.label || workoutDraftName || "");
  }

  async function loadSelectedWorkoutDocument({ force = false } = {}) {
    const workoutId = normalizeWorkoutId(selectedWorkoutId);
    if (!workoutId || workoutDraftMode) {
      renderWorkoutWorkshop();
      return true;
    }
    if (!force && workoutYamlDirty()) {
      const ok = window.confirm("Discard unsaved workout YAML changes?");
      if (!ok) return false;
    }
    const response = await fetch(`/plan/workouts/${encodeURIComponent(workoutId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || payload.status !== "ok") {
      setWorkoutStatus(String((payload && payload.error) || "Failed to load workout YAML"), "error");
      return false;
    }
    applyWorkoutDocument(payload);
    renderWorkoutWorkshop();
    return true;
  }

  async function loadWorkoutCatalog({ reloadDocument = true } = {}) {
    if (workoutWorkshopMetaEl) {
      workoutWorkshopMetaEl.textContent = "Loading workouts...";
    }
    const response = await fetch("/plan/workouts", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || payload.status !== "ok") {
      setWorkoutStatus(String((payload && payload.error) || "Failed to load workouts"), "error");
      return false;
    }
    workoutCatalog = Array.isArray(payload.workouts) ? payload.workouts : [];
    workoutCatalogById = new Map(
      workoutCatalog.map((item) => [normalizeWorkoutId(item && item.workout_id), item]),
    );
    if (!workoutDraftMode) {
      const selectedExists = workoutCatalogById.has(normalizeWorkoutId(selectedWorkoutId));
      if (!selectedExists) {
        selectedWorkoutId = workoutCatalog.length > 0 ? String(workoutCatalog[0].workout_id || "") : "";
      }
    }
    renderWorkoutWorkshop();
    if (reloadDocument && !workoutDraftMode && selectedWorkoutId) {
      await loadSelectedWorkoutDocument({ force: true });
    }
    return true;
  }

  function renderWorkoutWorkshop() {
    const selectedWorkout = currentWorkoutRecord();
    if (workoutWorkshopMetaEl) {
      workoutWorkshopMetaEl.textContent = `Workouts: ${workoutCatalog.length} | grouped by library`;
    }
    if (workoutPickerToggleEl) {
      workoutPickerToggleEl.textContent = workoutDraftMode
        ? `Draft | ${workoutDraftName || selectedWorkoutId || "New Workout"}`
        : workoutDisplayLabel(selectedWorkout);
    }
    if (workoutYamlEditorEl && workoutYamlEditorEl.value !== workoutYamlText) {
      workoutYamlEditorEl.value = workoutYamlText;
    }
    if (workoutDocumentMetaEl) {
      const bits = [];
      if (selectedWorkout) {
        bits.push(String(selectedWorkout.library || "Other"));
        bits.push(String(selectedWorkout.run_type_default || "SOS"));
      }
      if (workoutYamlSourcePath) bits.push(workoutYamlSourcePath);
      if (workoutYamlDirty()) bits.push("Unsaved changes");
      workoutDocumentMetaEl.textContent = bits.join(" | ") || "No workout selected.";
    }
    if (workoutStatusEl) {
      workoutStatusEl.textContent = workoutYamlLoadError || workoutStatusEl.textContent || "Create a workout, save it as YAML, then reuse it from SOS rows.";
    }
    if (workoutSaveBtn) {
      workoutSaveBtn.disabled = !String(workoutYamlText || "").trim();
    }
    renderWorkoutPickerPanel();
  }

  async function createNewWorkoutDraft() {
    if (workoutYamlDirty()) {
      const ok = window.confirm("Discard unsaved workout YAML changes and start a new workout?");
      if (!ok) return;
    }
    const rawName = window.prompt("New workout name");
    const name = String(rawName || "").trim();
    if (!name) return;
    workoutDraftMode = true;
    workoutDraftName = name;
    selectedWorkoutId = name
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "new-workout";
    workoutYamlText = buildWorkoutYamlSkeleton(name);
    workoutYamlLoadedText = "";
    workoutYamlSourcePath = "Not saved yet";
    workoutYamlLoadError = "";
    renderWorkoutWorkshop();
    setWorkoutStatus(`Drafting workout: ${name}`, "ok");
  }

  async function saveCurrentWorkoutYaml() {
    const yamlText = String(workoutYamlText || "");
    if (!yamlText.trim()) {
      setWorkoutStatus("Workout YAML is empty", "error");
      return false;
    }
    const isNew = Boolean(workoutDraftMode);
    const endpoint = isNew ? "/plan/workouts" : `/plan/workouts/${encodeURIComponent(selectedWorkoutId)}`;
    const method = isNew ? "POST" : "PUT";
    const response = await fetch(endpoint, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workout_name: workoutDraftName || selectedWorkoutId,
        yaml_text: yamlText,
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== "ok") {
      setWorkoutStatus(String((payload && payload.error) || "Failed to save workout"), "error");
      return false;
    }
    applyWorkoutDocument(payload);
    await loadWorkoutCatalog({ reloadDocument: false });
    renderWorkoutWorkshop();
    setWorkoutStatus(`Workout saved: ${workoutDraftName || selectedWorkoutId}`, "ok");
    return true;
  }

  function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function numberOrZero(value) {
    const direct = asNumber(value);
    if (direct !== null) return direct;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  function formatMiles(value, decimals) {
    const parsed = asNumber(value);
    return parsed === null ? "--" : parsed.toFixed(decimals);
  }

  function formatPct(value) {
    const parsed = asNumber(value);
    return parsed === null ? "--" : `${Math.round(parsed * 100)}%`;
  }

  function formatRatio(value, decimals) {
    const parsed = asNumber(value);
    return parsed === null ? "--" : parsed.toFixed(decimals);
  }

  function formatSigned(value, decimals) {
    const parsed = asNumber(value);
    if (parsed === null) return "--";
    const fixed = parsed.toFixed(decimals);
    return parsed > 0 ? `+${fixed}` : fixed;
  }

  function formatPercentRatio(value) {
    const parsed = asNumber(value);
    if (parsed === null) return "--";
    return `${Math.round(parsed * 100)}%`;
  }

  function formatSessionValue(value) {
    if (Math.abs(value - Math.round(value)) < 1e-9) {
      return String(Math.round(value));
    }
    return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function metricBandClass(band) {
    const key = String(band || "neutral").toLowerCase();
    if (key === "easy" || key === "good" || key === "caution" || key === "hard") {
      return `metric-${key}`;
    }
    return "metric-neutral";
  }

  function wowBandFromValue(value) {
    const parsed = asNumber(value);
    if (parsed === null) return "metric-neutral";
    if (parsed < 0) return "metric-easy";
    if (parsed <= 0.08) return "metric-good";
    if (parsed <= 0.12) return "metric-caution";
    return "metric-hard";
  }

  function miT30BandFromValue(value) {
    const parsed = asNumber(value);
    if (parsed === null) return "metric-neutral";
    const rounded = Number(parsed.toFixed(1));
    if (rounded < 0.8) return "metric-easy";
    if (rounded <= 1.4) return "metric-good";
    if (rounded <= 1.8) return "metric-caution";
    return "metric-hard";
  }

  function ratioOrNull(numerator, denominator) {
    const parsedNumerator = asNumber(numerator);
    const parsedDenominator = asNumber(denominator);
    if (parsedNumerator === null || parsedDenominator === null || parsedDenominator <= 0) {
      return null;
    }
    return parsedNumerator / parsedDenominator;
  }

  function t7BandFromValue(value) {
    const parsed = asNumber(value);
    if (parsed === null) return "neutral";
    if (parsed < 0.90) return "easy";
    if (parsed <= 1.20) return "good";
    if (parsed <= 1.35) return "caution";
    return "hard";
  }

  function sessionSpikeBandFromValue(value) {
    const parsed = asNumber(value);
    if (parsed === null) return "neutral";
    if (parsed <= 1.10) return "good";
    if (parsed <= 1.30) return "caution";
    return "hard";
  }

  const DISTANCE_COLOR_STOPS = [
    { miles: 4.50, rgb: [201, 207, 218] }, // light gray (min)
    { miles: 6.15, rgb: [66, 196, 117] }, // green (mid)
    { miles: 13.10, rgb: [132, 88, 206] }, // purple (max)
  ];

  function interpolateRgb(a, b, ratio) {
    const next = Math.max(0, Math.min(1, Number(ratio || 0)));
    return [
      Math.round(a[0] + ((b[0] - a[0]) * next)),
      Math.round(a[1] + ((b[1] - a[1]) * next)),
      Math.round(a[2] + ((b[2] - a[2]) * next)),
    ];
  }

  function distanceColorForMiles(value) {
    const miles = asNumber(value);
    if (miles === null) return "";
    const first = DISTANCE_COLOR_STOPS[0];
    const last = DISTANCE_COLOR_STOPS[DISTANCE_COLOR_STOPS.length - 1];
    if (miles <= first.miles) return `rgb(${first.rgb.join(" ")})`;
    if (miles >= last.miles) return `rgb(${last.rgb.join(" ")})`;
    for (let idx = 1; idx < DISTANCE_COLOR_STOPS.length; idx += 1) {
      const left = DISTANCE_COLOR_STOPS[idx - 1];
      const right = DISTANCE_COLOR_STOPS[idx];
      if (miles > right.miles) continue;
      const span = right.miles - left.miles;
      const ratio = span > 0 ? (miles - left.miles) / span : 0;
      const rgb = interpolateRgb(left.rgb, right.rgb, ratio);
      return `rgb(${rgb.join(" ")})`;
    }
    return `rgb(${last.rgb.join(" ")})`;
  }

  function makeCell(text, className) {
    const td = document.createElement("td");
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function rowAt(rows, index) {
    if (index < 0 || index >= rows.length) return null;
    return rows[index];
  }

  function parseIsoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
    if (!match) return null;
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  }

  function formatIsoDate(date) {
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function todayIsoLocal() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${today.getFullYear()}-${month}-${day}`;
  }

  function addDaysIso(value, days) {
    const parsed = parseIsoDate(value);
    if (!parsed) return "";
    const shifted = new Date(parsed.getTime());
    shifted.setUTCDate(shifted.getUTCDate() + Number(days || 0));
    return formatIsoDate(shifted);
  }

  function isIsoDateString(value) {
    return parseIsoDate(value) !== null;
  }

  function loadCachedRunTypeOptions() {
    try {
      const raw = window.sessionStorage.getItem("plan.run_type_options");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      runTypeOptions = parsed.map((item) => String(item || ""));
      hasLoadedPlanMeta = true;
    } catch (_err) {
      // Ignore cache parse errors.
    }
  }

  function cacheRunTypeOptions(options) {
    try {
      window.sessionStorage.setItem("plan.run_type_options", JSON.stringify(options || []));
    } catch (_err) {
      // Ignore storage errors.
    }
  }

  function setPaceStatus(message, tone) {
    if (!paceStatusEl) return;
    paceStatusEl.textContent = String(message || "");
    if (tone === "ok" || tone === "error") {
      paceStatusEl.dataset.tone = tone;
      return;
    }
    paceStatusEl.dataset.tone = "neutral";
  }

  function setActiveDrawer(nextDrawer) {
    activeDrawer = nextDrawer === "pace" || nextDrawer === "workout" ? nextDrawer : "";
    const paceOpen = activeDrawer === "pace";
    const workoutOpen = activeDrawer === "workout";
    if (paceDrawer instanceof HTMLElement) {
      paceDrawer.classList.toggle("open", paceOpen);
      paceDrawer.setAttribute("aria-hidden", paceOpen ? "false" : "true");
    }
    if (workoutDrawer instanceof HTMLElement) {
      workoutDrawer.classList.toggle("open", workoutOpen);
      workoutDrawer.setAttribute("aria-hidden", workoutOpen ? "false" : "true");
    }
    document.body.classList.toggle("plan-drawer-open", Boolean(activeDrawer));
    if (paceBackdrop instanceof HTMLElement) {
      paceBackdrop.classList.toggle("open", Boolean(activeDrawer));
      paceBackdrop.setAttribute("aria-hidden", activeDrawer ? "false" : "true");
    }
    if (activeDrawer !== "workout") {
      closeWorkoutPickerPanel();
    }
  }

  function scrollDrawerSectionIntoView(sectionEl) {
    if (!(sectionEl instanceof HTMLElement)) return;
    sectionEl.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  async function openPlanDrawer(section) {
    if (section === "workout") {
      setActiveDrawer("workout");
      await loadWorkoutCatalog();
      scrollDrawerSectionIntoView(workoutWorkshopSection);
      return;
    }
    setActiveDrawer("pace");
    scrollDrawerSectionIntoView(raceEquivalencyListEl);
  }

  function paceSetButtonBusy(buttonEl, isBusy, busyLabel) {
    if (!(buttonEl instanceof HTMLElement)) return;
    if (isBusy) {
      buttonEl.dataset.originalLabel = buttonEl.textContent || "";
      buttonEl.textContent = String(busyLabel || "Saving...");
      buttonEl.setAttribute("disabled", "disabled");
      return;
    }
    const original = String(buttonEl.dataset.originalLabel || "").trim();
    if (original) buttonEl.textContent = original;
    buttonEl.removeAttribute("disabled");
  }

  function makePaceItem(labelText, valueText) {
    const row = document.createElement("div");
    row.className = "plan-pace-item";
    const label = document.createElement("span");
    label.className = "plan-pace-item-label";
    label.textContent = String(labelText || "--");
    const value = document.createElement("span");
    value.className = "plan-pace-item-value";
    value.textContent = String(valueText || "--");
    row.appendChild(label);
    row.appendChild(value);
    return row;
  }

  function renderPaceGrid(targetEl, rows) {
    if (!(targetEl instanceof HTMLElement)) return;
    targetEl.textContent = "";
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || typeof row !== "object") continue;
      targetEl.appendChild(makePaceItem(row.label, row.time || row.pace));
    }
  }

  function renderPaceFamilies(targetEl, families) {
    if (!(targetEl instanceof HTMLElement)) return;
    targetEl.textContent = "";
    for (const family of Array.isArray(families) ? families : []) {
      if (!family || typeof family !== "object") continue;
      const section = document.createElement("section");
      section.className = "plan-pace-family";

      const heading = document.createElement("h4");
      heading.className = "plan-pace-family-title";
      heading.textContent = String(family.label || "--");
      section.appendChild(heading);

      const items = Array.isArray(family.items) ? family.items : [];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const row = document.createElement("div");
        row.className = "plan-pace-family-item";

        const label = document.createElement("span");
        label.className = "plan-pace-family-item-label";
        label.textContent = String(item.label || "--");

        const value = document.createElement("span");
        value.className = "plan-pace-family-item-value";
        value.textContent = String(item.display || item.default_pace || "--");

        row.appendChild(label);
        row.appendChild(value);
        section.appendChild(row);

        const metaBits = [];
        if (item.canonical_label) {
          metaBits.push(String(item.canonical_label));
        }
        if (item.preferred_token) {
          metaBits.push(`use $${String(item.preferred_token || "").replace(/^\$/, "")}`);
        }
        if (metaBits.length > 0) {
          const meta = document.createElement("p");
          meta.className = "plan-pace-family-meta";
          meta.textContent = metaBits.join(" | ");
          section.appendChild(meta);
        }

        const noteText = String(item.note || "").trim();
        if (noteText) {
          const note = document.createElement("p");
          note.className = "plan-pace-family-note";
          note.textContent = noteText;
          section.appendChild(note);
        }
      }

      targetEl.appendChild(section);
    }
  }

  function updatePaceDerivedGoalDisplay() {
    if (!(paceDerivedGoalEl instanceof HTMLElement)) return;
    if (paceDerivedGoal) {
      paceDerivedGoalEl.textContent = `Marathon Equivalent: ${paceDerivedGoal}`;
      return;
    }
    paceDerivedGoalEl.textContent = "Marathon Equivalent: --";
  }

  function supportedDistanceFallback() {
    return [
      { value: "1mi", label: "1mi" },
      { value: "2mi", label: "2mi" },
      { value: "5k", label: "5k" },
      { value: "10k", label: "10k" },
      { value: "15k", label: "15k" },
      { value: "10mi", label: "10mi" },
      { value: "hm", label: "HM" },
      { value: "marathon", label: "Marathon" },
    ];
  }

  function setDistanceOptions(options) {
    if (!(paceDistanceSelectEl instanceof HTMLSelectElement)) return;
    const items = Array.isArray(options) && options.length > 0 ? options : supportedDistanceFallback();
    const currentValue = String(paceDistanceSelectEl.value || "10k");
    paceDistanceSelectEl.textContent = "";
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const value = String(item.value || "").trim();
      if (!value) continue;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = String(item.label || value);
      paceDistanceSelectEl.appendChild(option);
    }
    if (Array.from(paceDistanceSelectEl.options).some((option) => option.value === currentValue)) {
      paceDistanceSelectEl.value = currentValue;
    } else if (Array.from(paceDistanceSelectEl.options).some((option) => option.value === "10k")) {
      paceDistanceSelectEl.value = "10k";
    }
  }

  function applyPaceWorkshopPayload(payload) {
    if (!payload || payload.status !== "ok") return;
    if (marathonGoalInputEl instanceof HTMLInputElement && typeof payload.marathon_goal === "string") {
      paceCurrentGoal = payload.marathon_goal;
      marathonGoalInputEl.value = paceCurrentGoal;
    }
    setDistanceOptions(payload.supported_distances);
    const goalTraining = payload.goal_training && typeof payload.goal_training === "object"
      ? payload.goal_training
      : {};
    renderPaceGrid(trainingPacesListEl, goalTraining.paces);
    renderPaceFamilies(paceFamilyListEl, goalTraining.plan_families);
  }

  async function loadPaceWorkshop() {
    if (!(paceDistanceSelectEl instanceof HTMLSelectElement)) return;
    setPaceStatus("Loading pace workshop...", "neutral");
    updatePaceDerivedGoalDisplay();
    try {
      const response = await fetch("/plan/pace-workshop.json", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload.status !== "ok") {
        throw new Error(String((payload && payload.error) || "Failed to load pace workshop"));
      }
      applyPaceWorkshopPayload(payload);
      setPaceStatus("", "neutral");
    } catch (err) {
      setDistanceOptions([]);
      renderPaceFamilies(paceFamilyListEl, []);
      setPaceStatus(String(err && err.message ? err.message : "Failed to load pace workshop"), "error");
    }
  }

  async function saveMarathonGoal(goalText) {
    if (!goalText) return;
    paceSetButtonBusy(marathonGoalSetBtn, true, "Saving...");
    setPaceStatus("Saving marathon goal...", "neutral");
    try {
      const response = await fetch("/plan/pace-workshop/goal", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ marathon_goal: String(goalText || "").trim() }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "ok") {
        throw new Error(String((payload && payload.error) || "Failed to save marathon goal"));
      }
      applyPaceWorkshopPayload(payload);
      setPaceStatus(`Goal set to ${payload.marathon_goal}`, "ok");
    } catch (err) {
      setPaceStatus(String(err && err.message ? err.message : "Failed to save marathon goal"), "error");
    } finally {
      paceSetButtonBusy(marathonGoalSetBtn, false);
    }
  }

  async function calculatePaces() {
    if (!(paceDistanceSelectEl instanceof HTMLSelectElement) || !(paceTimeInputEl instanceof HTMLInputElement)) return;
    const distance = String(paceDistanceSelectEl.value || "").trim();
    const time = String(paceTimeInputEl.value || "").trim();
    if (!distance || !time) {
      setPaceStatus("Enter race distance and time before calculating.", "error");
      return;
    }
    paceSetButtonBusy(paceCalcBtn, true, "Working...");
    setPaceStatus("Calculating race equivalency and training paces...", "neutral");
    try {
      const response = await fetch("/plan/pace-workshop/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          distance,
          time,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "ok") {
        throw new Error(String((payload && payload.error) || "Calculation failed"));
      }
      paceDerivedGoal = String(payload.derived_marathon_goal || "");
      updatePaceDerivedGoalDisplay();
      renderPaceGrid(raceEquivalencyListEl, payload.race_equivalency);
      const trainingBlock = payload.training && typeof payload.training === "object" ? payload.training : {};
      renderPaceGrid(trainingPacesListEl, trainingBlock.paces);
      renderPaceFamilies(paceFamilyListEl, trainingBlock.plan_families);
      if (paceSetDerivedBtn instanceof HTMLButtonElement) {
        paceSetDerivedBtn.disabled = !paceDerivedGoal;
      }
      setPaceStatus("Calculation complete.", "ok");
    } catch (err) {
      setPaceStatus(String(err && err.message ? err.message : "Calculation failed"), "error");
    } finally {
      paceSetButtonBusy(paceCalcBtn, false);
    }
  }

  function mergeRowsByDate(existingRows, incomingRows) {
    const merged = new Map();
    for (const row of existingRows) {
      if (!row || typeof row !== "object") continue;
      const dateKey = String(row.date || "");
      if (!dateKey) continue;
      merged.set(dateKey, row);
    }
    for (const row of incomingRows) {
      if (!row || typeof row !== "object") continue;
      const dateKey = String(row.date || "");
      if (!dateKey) continue;
      merged.set(dateKey, row);
    }
    const sorted = Array.from(merged.values());
    sorted.sort((a, b) => String(a && a.date ? a.date : "").localeCompare(String(b && b.date ? b.date : "")));
    return sorted;
  }

  function formatDisplayDate(value) {
    const parsed = parseIsoDate(value);
    if (!parsed) return String(value || "--");
    return `${parsed.getUTCMonth() + 1}-${parsed.getUTCDate()}`;
  }

  function weekInfoForDate(value) {
    const date = parseIsoDate(value);
    if (!date) {
      return {
        weekKey: "",
      };
    }
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    const weekStart = new Date(date.getTime());
    weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);
    return {
      weekKey: formatIsoDate(weekStart),
    };
  }

  function weekStartIso(value) {
    const parsed = parseIsoDate(value);
    if (!parsed) return "";
    const mondayOffset = (parsed.getUTCDay() + 6) % 7;
    const weekStart = new Date(parsed.getTime());
    weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);
    return formatIsoDate(weekStart);
  }

  function monthStartIso(value) {
    const parsed = parseIsoDate(value);
    if (!parsed) return "";
    const monthStart = new Date(parsed.getTime());
    monthStart.setUTCDate(1);
    return formatIsoDate(monthStart);
  }

  function prevMonthKeyForDate(value) {
    const parsed = parseIsoDate(value);
    if (!parsed) return "";
    const year = parsed.getUTCFullYear();
    const month = parsed.getUTCMonth();
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    return `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`;
  }

  function sumDays(dayValues, endingDate, days) {
    const parsed = parseIsoDate(endingDate);
    if (!parsed) return 0;
    let total = 0;
    for (let offset = 0; offset < Number(days || 0); offset += 1) {
      const dayKey = formatIsoDate(new Date(parsed.getTime() - (offset * 86400000)));
      total += Number(dayValues.get(dayKey) || 0);
    }
    return total;
  }

  function maxDays(dayValues, endingDate, days) {
    const parsed = parseIsoDate(endingDate);
    if (!parsed) return 0;
    let maxValue = 0;
    for (let offset = 0; offset < Number(days || 0); offset += 1) {
      const dayKey = formatIsoDate(new Date(parsed.getTime() - (offset * 86400000)));
      const value = Number(dayValues.get(dayKey) || 0);
      if (value > maxValue) {
        maxValue = value;
      }
    }
    return maxValue;
  }

  function normalizedRunTypeKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function normalizeMetricContextDay(day) {
    if (!day || typeof day !== "object") return null;
    const dateKey = String(day.date || "").trim();
    if (!isIsoDateString(dateKey)) return null;
    return {
      date: dateKey,
      planned_miles: numberOrZero(day.planned_miles),
      actual_miles: numberOrZero(day.actual_miles),
      run_type: String(day.run_type || "").trim(),
    };
  }

  function applyMetricContextPayload(payload, options = {}) {
    const { append = false } = options;
    const rawContext = payload && typeof payload === "object" ? payload.metric_context : null;
    if (!rawContext || !Array.isArray(rawContext.days)) {
      if (!append) {
        metricContextByDate = new Map();
        metricContextStartDate = "";
        metricContextEndDate = "";
        metricContextToday = String((payload && payload.today) || "");
      }
      return false;
    }

    const next = append ? new Map(metricContextByDate) : new Map();
    for (const rawDay of rawContext.days) {
      const normalized = normalizeMetricContextDay(rawDay);
      if (!normalized) continue;
      next.set(normalized.date, normalized);
    }
    metricContextByDate = next;
    metricContextStartDate = String(rawContext.start_date || metricContextStartDate || "");
    metricContextEndDate = String(rawContext.end_date || metricContextEndDate || "");
    metricContextToday = String((payload && payload.today) || metricContextToday || "");
    return metricContextByDate.size > 0;
  }

  function updateMetricContextDay(dateLocal, plannedMiles, actualMiles, runType) {
    const dateKey = String(dateLocal || "").trim();
    if (!isIsoDateString(dateKey)) return null;
    const next = {
      date: dateKey,
      planned_miles: numberOrZero(plannedMiles),
      actual_miles: numberOrZero(actualMiles),
      run_type: String(runType || "").trim(),
    };
    metricContextByDate.set(dateKey, next);
    if (!isIsoDateString(metricContextStartDate) || dateKey < metricContextStartDate) {
      metricContextStartDate = dateKey;
    }
    if (!isIsoDateString(metricContextEndDate) || dateKey > metricContextEndDate) {
      metricContextEndDate = dateKey;
    }
    return next;
  }

  function metricContextEffectiveMiles(dayKey, plannedMiles, actualMiles) {
    const planned = numberOrZero(plannedMiles);
    const actual = numberOrZero(actualMiles);
    if (isIsoDateString(metricContextToday) && isIsoDateString(dayKey) && dayKey <= metricContextToday) {
      return actual > 0 ? actual : planned;
    }
    return planned;
  }

  function recomputeDerivedPlanMetrics() {
    if (!(metricContextByDate instanceof Map) || metricContextByDate.size === 0 || !Array.isArray(renderedRows) || renderedRows.length === 0) {
      return false;
    }

    const sortedDateKeys = Array.from(metricContextByDate.keys())
      .filter((item) => isIsoDateString(item))
      .sort((a, b) => a.localeCompare(b));
    if (sortedDateKeys.length === 0) {
      return false;
    }

    const effectiveMiles = new Map();
    const plannedMiles = new Map();
    const actualMiles = new Map();
    const runTypeByDate = new Map();
    const weekTotals = new Map();
    const weekPlannedTotals = new Map();
    const weekActualTotals = new Map();
    const weekLongMiles = new Map();
    const monthTotals = new Map();
    const monthPlannedTotals = new Map();
    const monthActualTotals = new Map();

    for (const dateKey of sortedDateKeys) {
      const day = metricContextByDate.get(dateKey);
      if (!day) continue;
      const planned = numberOrZero(day.planned_miles);
      const actual = numberOrZero(day.actual_miles);
      const effective = metricContextEffectiveMiles(dateKey, planned, actual);
      plannedMiles.set(dateKey, planned);
      actualMiles.set(dateKey, actual);
      effectiveMiles.set(dateKey, effective);
      runTypeByDate.set(dateKey, String(day.run_type || ""));
    }

    for (const dateKey of sortedDateKeys) {
      const weekKey = weekStartIso(dateKey);
      if (weekKey && !weekTotals.has(weekKey)) {
        let weekTotal = 0;
        let weekPlanned = 0;
        let weekActual = 0;
        let weekLong = 0;
        for (let idx = 0; idx < 7; idx += 1) {
          const cursor = addDaysIso(weekKey, idx);
          const effective = Number(effectiveMiles.get(cursor) || 0);
          const planned = Number(plannedMiles.get(cursor) || 0);
          const actual = Number(actualMiles.get(cursor) || 0);
          weekTotal += effective;
          weekPlanned += planned;
          weekActual += actual;
          if (longRunTypeKeys.has(normalizedRunTypeKey(runTypeByDate.get(cursor)))) {
            weekLong = Math.max(weekLong, effective);
          }
        }
        if (weekLong <= 0) {
          for (let idx = 0; idx < 7; idx += 1) {
            const cursor = addDaysIso(weekKey, idx);
            weekLong = Math.max(weekLong, Number(effectiveMiles.get(cursor) || 0));
          }
        }
        weekTotals.set(weekKey, weekTotal);
        weekPlannedTotals.set(weekKey, weekPlanned);
        weekActualTotals.set(weekKey, weekActual);
        weekLongMiles.set(weekKey, weekLong);
      }

      const monthKey = dateKey.slice(0, 7);
      if (!monthTotals.has(monthKey)) {
        let monthTotal = 0;
        let monthPlanned = 0;
        let monthActual = 0;
        let cursor = monthStartIso(dateKey);
        while (cursor && cursor.slice(0, 7) === monthKey) {
          monthTotal += Number(effectiveMiles.get(cursor) || 0);
          monthPlanned += Number(plannedMiles.get(cursor) || 0);
          monthActual += Number(actualMiles.get(cursor) || 0);
          cursor = addDaysIso(cursor, 1);
        }
        monthTotals.set(monthKey, monthTotal);
        monthPlannedTotals.set(monthKey, monthPlanned);
        monthActualTotals.set(monthKey, monthActual);
      }
    }

    for (const row of renderedRows) {
      if (!row || !isIsoDateString(row.date)) continue;
      const dateKey = row.date;
      const weekKey = weekStartIso(dateKey);
      const prevWeekKey = addDaysIso(weekKey, -7);
      const monthKey = dateKey.slice(0, 7);
      const prevMonthKey = prevMonthKeyForDate(dateKey);
      const effective = Number(effectiveMiles.get(dateKey) || 0);
      const planned = Number(plannedMiles.get(dateKey) || 0);
      const actual = Number(actualMiles.get(dateKey) || 0);
      const weekTotal = Number(weekTotals.get(weekKey) || 0);
      const weekPlanned = Number(weekPlannedTotals.get(weekKey) || 0);
      const weekActual = Number(weekActualTotals.get(weekKey) || 0);
      const prevWeekTotal = Number(weekTotals.get(prevWeekKey) || 0);
      const monthTotal = Number(monthTotals.get(monthKey) || 0);
      const monthPlanned = Number(monthPlannedTotals.get(monthKey) || 0);
      const monthActual = Number(monthActualTotals.get(monthKey) || 0);
      const prevMonthTotal = Number(monthTotals.get(prevMonthKey) || 0);
      const wowChange = prevWeekTotal > 0 ? ((weekTotal - prevWeekTotal) / prevWeekTotal) : null;
      const momChange = prevMonthTotal > 0 ? ((monthTotal - prevMonthTotal) / prevMonthTotal) : null;
      const longPct = weekTotal > 0 ? (Number(weekLongMiles.get(weekKey) || 0) / weekTotal) : null;
      const t7 = sumDays(effectiveMiles, dateKey, 7);
      const t7Planned = sumDays(plannedMiles, dateKey, 7);
      const t7Actual = sumDays(actualMiles, dateKey, 7);
      const t30 = sumDays(effectiveMiles, dateKey, 30);
      const t30Planned = sumDays(plannedMiles, dateKey, 30);
      const t30Actual = sumDays(actualMiles, dateKey, 30);
      const avg30 = t30 / 30;
      const miT30Ratio = avg30 > 0 ? (effective / avg30) : null;
      const prevT7 = sumDays(effectiveMiles, addDaysIso(dateKey, -7), 7);
      const prevT30 = sumDays(effectiveMiles, addDaysIso(dateKey, -30), 30);
      const t7P7Ratio = prevT7 > 0 ? (t7 / prevT7) : null;
      const t30P30Ratio = prevT30 > 0 ? (t30 / prevT30) : null;
      const longest30dBefore = maxDays(effectiveMiles, addDaysIso(dateKey, -1), 30);
      const sessionSpikeRatio = longest30dBefore > 0 ? (effective / longest30dBefore) : null;

      row.run_type = String(runTypeByDate.get(dateKey) || row.run_type || "");
      row.actual_miles = actual;
      row.effective_miles = effective;
      row.day_delta = actual - planned;
      row.weekly_total = weekTotal;
      row.weekly_planned_total = weekPlanned;
      row.weekly_actual_total = weekActual;
      row.weekly_adherence_ratio = ratioOrNull(weekActual, weekPlanned);
      row.wow_change = wowChange;
      row.long_pct = longPct;
      row.monthly_total = monthTotal;
      row.monthly_planned_total = monthPlanned;
      row.monthly_actual_total = monthActual;
      row.monthly_adherence_ratio = ratioOrNull(monthActual, monthPlanned);
      row.mom_change = momChange;
      row.t7_miles = t7;
      row.t7_planned_miles = t7Planned;
      row.t7_actual_miles = t7Actual;
      row.t7_adherence_ratio = ratioOrNull(t7Actual, t7Planned);
      row.t30_miles = t30;
      row.t30_planned_miles = t30Planned;
      row.t30_actual_miles = t30Actual;
      row.t30_adherence_ratio = ratioOrNull(t30Actual, t30Planned);
      row.avg30_miles_per_day = avg30;
      row.mi_t30_ratio = miT30Ratio;
      row.t7_p7_ratio = t7P7Ratio;
      row.t30_p30_ratio = t30P30Ratio;
      row.session_spike_ratio = sessionSpikeRatio;
      row.bands = {
        ...(row.bands && typeof row.bands === "object" ? row.bands : {}),
        wow_change: wowBandFromValue(wowChange).replace("metric-", ""),
        long_pct: metricBandClass(longPct === null ? "neutral" : (
          longPct < 0.20 ? "easy" : longPct <= 0.30 ? "good" : longPct <= 0.35 ? "caution" : "hard"
        )).replace("metric-", ""),
        mi_t30_ratio: miT30BandFromValue(miT30Ratio).replace("metric-", ""),
        t7_p7_ratio: t7BandFromValue(t7P7Ratio),
        t30_p30_ratio: t7BandFromValue(t30P30Ratio),
        session_spike_ratio: sessionSpikeBandFromValue(sessionSpikeRatio),
      };
    }
    return true;
  }

  function updateMetricCell(cell, text, className) {
    if (!(cell instanceof HTMLElement)) return;
    cell.textContent = text;
    if (className) {
      cell.className = className;
    }
  }

  function syncRenderedMetricCells() {
    for (const row of renderedRows) {
      if (!row || !isIsoDateString(row.date)) continue;
      const tr = bodyEl.querySelector(`tr[data-date="${row.date}"]`);
      if (!(tr instanceof HTMLTableRowElement)) continue;
      updateMetricCell(
        tr.querySelector(".metric-t7"),
        formatMiles(row && row.t7_miles, 1),
        "metric-neutral metric-t7",
      );
      updateMetricCell(
        tr.querySelector(".metric-t7-ratio"),
        formatRatio(row && row.t7_p7_ratio, 1),
        `${metricBandClass(row && row.bands && row.bands.t7_p7_ratio)} metric-t7-ratio`,
      );
      updateMetricCell(
        tr.querySelector(".metric-t30"),
        formatMiles(row && row.t30_miles, 1),
        "metric-neutral metric-t30",
      );
      updateMetricCell(
        tr.querySelector(".metric-t30-ratio"),
        formatRatio(row && row.t30_p30_ratio, 1),
        `${metricBandClass(row && row.bands && row.bands.t30_p30_ratio)} metric-t30-ratio`,
      );
      updateMetricCell(
        tr.querySelector(".metric-avg30"),
        formatRatio(row && row.avg30_miles_per_day, 2),
        "metric-neutral metric-avg30",
      );
      updateMetricCell(
        tr.querySelector(".metric-mi-t30"),
        formatRatio(row && row.mi_t30_ratio, 1),
        `${miT30BandFromValue(row && row.mi_t30_ratio)} metric-mi-t30`,
      );
      if (row && row.show_week_metrics) {
        updateMetricCell(
          tr.querySelector(".metric-week"),
          formatMiles(row && row.weekly_total, 1),
          "metric-week metric-week-block metric-block-center metric-week-joined",
        );
        updateMetricCell(
          tr.querySelector(".metric-wow-block"),
          formatPct(row && row.wow_change),
          `${wowBandFromValue(row && row.wow_change)} metric-wow-block metric-block-center metric-week-joined`,
        );
        updateMetricCell(
          tr.querySelector(".metric-long-block"),
          formatPct(row && row.long_pct),
          `${metricBandClass(row && row.bands && row.bands.long_pct)} metric-long-block metric-block-center metric-week-joined`,
        );
      }
      if (row && row.show_month_metrics) {
        updateMetricCell(
          tr.querySelector(".metric-month"),
          formatMiles(row && row.monthly_total, 1),
          "metric-month metric-month-block metric-block-bottom",
        );
        updateMetricCell(
          tr.querySelector(".metric-mom-block"),
          formatPct(row && row.mom_change),
          `${wowBandFromValue(row && row.mom_change)} metric-mom-block metric-block-bottom`,
        );
      }
    }
  }

  function overlapStartForDate(anchorDate, floorDate = "") {
    const weekBoundaryStart = weekStartIso(anchorDate);
    const monthBoundaryStart = monthStartIso(anchorDate);
    let appendStart = "";
    if (isIsoDateString(weekBoundaryStart) && isIsoDateString(monthBoundaryStart)) {
      appendStart = weekBoundaryStart < monthBoundaryStart ? weekBoundaryStart : monthBoundaryStart;
    } else if (isIsoDateString(weekBoundaryStart)) {
      appendStart = weekBoundaryStart;
    } else if (isIsoDateString(monthBoundaryStart)) {
      appendStart = monthBoundaryStart;
    }
    if (!appendStart && isIsoDateString(anchorDate)) {
      appendStart = anchorDate;
    }
    if (isIsoDateString(floorDate) && appendStart < floorDate) {
      appendStart = floorDate;
    }
    return appendStart;
  }

  function parseDistanceExpression(value) {
    const text = String(value || "").trim();
    if (!text) return [];
    const parts = text.replace(/\s+/g, "").split("+");
    const values = [];
    for (const part of parts) {
      if (!part) continue;
      const parsed = Number.parseFloat(part);
      if (!Number.isFinite(parsed) || parsed <= 0) continue;
      values.push(parsed);
    }
    return values;
  }

  function parseMileagePasteValues(rawText) {
    const normalized = String(rawText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!normalized.trim()) return { values: [] };
    const hasGridSeparators = normalized.includes("\n") || normalized.includes("\t");
    if (!hasGridSeparators) {
      const spaceTokens = normalized.trim().split(/\s+/).filter((item) => String(item || "").trim().length > 0);
      if (spaceTokens.length > 1) {
        const values = [];
        for (let idx = 0; idx < spaceTokens.length; idx += 1) {
          const rawCell = String(spaceTokens[idx] || "").trim();
          const parsed = Number.parseFloat(rawCell.replace(/,/g, ""));
          if (!Number.isFinite(parsed) || parsed < 0) {
            return {
              error: `Invalid mileage "${rawCell}" at position ${idx + 1}.`,
              values: [],
            };
          }
          values.push(parsed > 0 ? formatSessionValue(parsed) : "");
        }
        return { values };
      }
    }
    const lines = normalized.split("\n");
    while (lines.length > 0 && !String(lines[lines.length - 1] || "").trim()) {
      lines.pop();
    }
    const values = [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const cells = String(lines[lineIndex] || "").split("\t");
      for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
        const rawCell = String(cells[cellIndex] || "").trim();
        if (!rawCell) {
          values.push("");
          continue;
        }
        const parsed = Number.parseFloat(rawCell.replace(/,/g, ""));
        if (!Number.isFinite(parsed) || parsed < 0) {
          return {
            error: `Invalid mileage "${rawCell}" at line ${lineIndex + 1}.`,
            values: [],
          };
        }
        values.push(parsed > 0 ? formatSessionValue(parsed) : "");
      }
    }
    return { values };
  }

  async function applyDistancePaste(targetInput, rawText) {
    const parsed = parseMileagePasteValues(rawText);
    if (parsed.error) {
      if (metaEl) metaEl.textContent = parsed.error;
      return false;
    }
    const values = Array.isArray(parsed.values) ? parsed.values : [];
    if (values.length <= 1) {
      return false;
    }

    const startDate = String(targetInput && targetInput.dataset ? targetInput.dataset.date || "" : "");
    const startIndex = rowIndexByDate(startDate);
    if (!isIsoDateString(startDate) || startIndex < 0) {
      return false;
    }

    const lastNeededDate = addDaysIso(startDate, values.length - 1);
    if (isIsoDateString(lastNeededDate)) {
      await ensureDateLoadedForCenter(lastNeededDate);
    }

    let appliedCount = 0;
    for (let offset = 0; offset < values.length; offset += 1) {
      const row = rowAt(renderedRows, startIndex + offset);
      if (!row || !isIsoDateString(row.date)) break;
      const rowIndex = rowIndexByDate(row.date);
      if (rowIndex < 0) continue;
      const inputEl = bodyEl.querySelector(distanceSelectorForDate(row.date));
      if (!(inputEl instanceof HTMLInputElement)) continue;
      inputEl.value = String(values[offset] || "");
      const nextRow = rowAt(renderedRows, rowIndex + 1);
      saveSessionPayload(
        row,
        rowIndex,
        renderedRows,
        nextRow ? nextRow.date : addDaysIso(row.date, 1),
        undefined,
        { preserveFocus: true },
      );
      appliedCount += 1;
    }

    if (appliedCount > 0 && metaEl) {
      metaEl.textContent = `Pasted ${appliedCount} day(s) starting ${startDate}.`;
    }
    return appliedCount > 0;
  }

  function sessionDetailsFromRow(row) {
    const fromDetail = Array.isArray(row && row.planned_sessions_detail) ? row.planned_sessions_detail : [];
    const normalized = [];
    for (let idx = 0; idx < fromDetail.length; idx += 1) {
      const item = fromDetail[idx];
      if (!item || typeof item !== "object") continue;
      const planned = Number.parseFloat(String(item.planned_miles));
      if (!Number.isFinite(planned) || planned <= 0) continue;
      normalized.push({
        ordinal: idx + 1,
        planned_miles: planned,
        run_type: String(item.run_type || ""),
        planned_workout: String(item.planned_workout || item.workout_code || ""),
      });
    }
    if (normalized.length > 0) return normalized;

    const explicit = Array.isArray(row && row.planned_sessions) ? row.planned_sessions : [];
    const fromExplicit = explicit
      .map((value, idx) => ({
        ordinal: idx + 1,
        planned_miles: Number.parseFloat(String(value)),
        run_type: idx === 0 ? String((row && row.run_type) || "") : "",
        planned_workout: "",
      }))
      .filter((item) => Number.isFinite(item.planned_miles) && item.planned_miles > 0);
    if (fromExplicit.length > 0) return fromExplicit;

    const parsed = parseDistanceExpression(row && row.planned_input);
    if (parsed.length > 0) {
      return parsed.map((value, idx) => ({
        ordinal: idx + 1,
        planned_miles: value,
        run_type: idx === 0 ? String((row && row.run_type) || "") : "",
        planned_workout: "",
      }));
    }

    const fallback = Number.parseFloat(String(row && row.planned_miles));
    if (Number.isFinite(fallback) && fallback > 0) {
      return [{ ordinal: 1, planned_miles: fallback, run_type: String((row && row.run_type) || ""), planned_workout: "" }];
    }
    return [{ ordinal: 1, planned_miles: null, run_type: String((row && row.run_type) || ""), planned_workout: "" }];
  }

  function serializeSessionsForApi(sessionDetails) {
    const payload = [];
    for (let idx = 0; idx < sessionDetails.length; idx += 1) {
      const session = sessionDetails[idx];
      if (!session || typeof session !== "object") continue;
      const planned = Number.parseFloat(String(session.planned_miles));
      if (!Number.isFinite(planned) || planned <= 0) continue;
      const runType = String(session.run_type || "").trim();
      const plannedWorkout = String(session.planned_workout || session.workout_code || "").trim();
      const item = {
        ordinal: payload.length + 1,
        planned_miles: planned,
      };
      if (runType) {
        item.run_type = runType;
      }
      const workoutCode = String(session.workout_code || "").trim();
      if (workoutCode) {
        item.workout_code = workoutCode;
      }
      if (plannedWorkout) {
        item.planned_workout = plannedWorkout;
      }
      payload.push(item);
    }
    return payload;
  }

  function canonicalSessionPayload(sessions) {
    const normalized = [];
    for (const session of Array.isArray(sessions) ? sessions : []) {
      if (!session || typeof session !== "object") continue;
      const planned = Number.parseFloat(String(session.planned_miles));
      if (!Number.isFinite(planned) || planned <= 0) continue;
      normalized.push({
        planned_miles: Number(planned.toFixed(3)),
        run_type: String(session.run_type || "").trim(),
        workout_code: String(session.workout_code || "").trim(),
        planned_workout: String(session.planned_workout || session.workout_code || "").trim(),
      });
    }
    return normalized;
  }

  function payloadsEqualByValue(left, right) {
    const l = JSON.stringify(canonicalSessionPayload(left));
    const r = JSON.stringify(canonicalSessionPayload(right));
    return l === r;
  }

  function applyLocalPlanEdit(dateLocal, sessions, runType) {
    const row = rowsByDate.get(dateLocal);
    if (!row || typeof row !== "object") return;
    const normalizedSessions = canonicalSessionPayload(sessions).map((item, idx) => ({
      ordinal: idx + 1,
      planned_miles: item.planned_miles,
      run_type: item.run_type,
      planned_workout: item.planned_workout,
      workout_code: item.workout_code,
    }));
    const plannedTotal = normalizedSessions.reduce((sum, item) => sum + Number(item.planned_miles || 0), 0);
    row.run_type = String(runType || row.run_type || "");
    row.planned_sessions_detail = normalizedSessions;
    row.planned_sessions = normalizedSessions.map((item) => Number(item.planned_miles));
    row.planned_miles = Number(plannedTotal.toFixed(3));
    row.planned_input = normalizedSessions.map((item) => formatSessionValue(Number(item.planned_miles))).join("+");
    const actualMiles = asNumber(row.actual_miles) || 0;
    row.day_delta = actualMiles - Number(row.planned_miles || 0);
    rowsByDate.set(dateLocal, row);
    updateMetricContextDay(dateLocal, row.planned_miles, actualMiles, row.run_type);
    const centerDate = isIsoDateString(centerDateEl && centerDateEl.value) ? centerDateEl.value : "";
    if (recomputeDerivedPlanMetrics()) {
      syncRenderedMetricCells();
      if (centerDate) {
        setSummaryForDate(centerDate);
      }
    } else if (centerDate && centerDate === dateLocal) {
      updateLocalDaySummaryCard(row);
    }
  }

  function queuePlanBackgroundRefresh(anchorDate) {
    const anchor = String(anchorDate || "").trim();
    const candidate = overlapStartForDate(anchor, loadedStartDate);
    if (isIsoDateString(candidate)) {
      if (!isIsoDateString(refreshFromDate) || candidate < refreshFromDate) {
        refreshFromDate = candidate;
      }
    }
    if (refreshTimer !== null) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void runPlanBackgroundRefresh();
    }, 280);
  }

  async function runPlanBackgroundRefresh() {
    if (refreshInFlight) {
      refreshQueuedAfterFlight = true;
      return;
    }
    if (!isIsoDateString(loadedStartDate) || !isIsoDateString(loadedEndDate)) return;
    const activeEl = document.activeElement;
    const activeIsInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLSelectElement;
    const activeClassName = activeIsInput ? String(activeEl.className || "") : "";
    const activeDate = activeIsInput && activeEl.dataset ? String(activeEl.dataset.date || "") : "";
    const activeSessionIndex = activeIsInput && activeEl.dataset
      ? String(activeEl.dataset.sessionIndex || "0")
      : "0";
    const restoreSelector = (
      activeIsInput
      && isIsoDateString(activeDate)
      && (
        activeClassName.includes("plan-session-distance")
        || activeClassName.includes("plan-session-type")
        || activeClassName.includes("plan-session-workout")
      )
    )
      ? `.${activeClassName.split(/\s+/).find((name) => name.startsWith("plan-session-"))}[data-date="${activeDate}"][data-session-index="${activeSessionIndex}"]`
      : "";
    const prevScrollTop = tableWrapEl ? tableWrapEl.scrollTop : 0;
    const prevScrollLeft = tableWrapEl ? tableWrapEl.scrollLeft : 0;
    refreshFromDate = "";
    refreshInFlight = true;
    try {
      const refreshed = await loadPlanRange({
        startDate: loadedStartDate,
        endDate: loadedEndDate,
        centerDateOverride: centerDateEl.value,
        append: false,
        suppressPendingFocus: true,
      });
      if (!refreshed) {
        return;
      }
      if (tableWrapEl) {
        tableWrapEl.scrollTop = prevScrollTop;
        tableWrapEl.scrollLeft = prevScrollLeft;
      }
      if (restoreSelector) {
        const restoreTarget = bodyEl.querySelector(restoreSelector);
        if (restoreTarget instanceof HTMLElement) {
          restoreTarget.focus();
          if (restoreTarget instanceof HTMLInputElement && typeof restoreTarget.select === "function") {
            restoreTarget.select();
          }
        }
      }
    } finally {
      refreshInFlight = false;
      if (refreshQueuedAfterFlight || isIsoDateString(refreshFromDate)) {
        refreshQueuedAfterFlight = false;
        void runPlanBackgroundRefresh();
      }
    }
  }

  function sessionsFromRunTypeEditors(dateLocal) {
    const runTypeSelects = Array.from(bodyEl.querySelectorAll(`.plan-session-type[data-date="${dateLocal}"]`));
    runTypeSelects.sort(
      (a, b) => Number.parseInt(a.dataset.sessionIndex || "0", 10) - Number.parseInt(b.dataset.sessionIndex || "0", 10),
    );
    if (runTypeSelects.length === 0) return [];
    const fallbackRow = rowsByDate.get(dateLocal);
    const fallbackSessions = sessionDetailsFromRow(fallbackRow);
    const raw = runTypeSelects.map((runTypeSelect, sessionIndex) => {
      const fallbackSession = fallbackSessions[sessionIndex] || {};
      const workoutInput = bodyEl.querySelector(
        `.plan-session-workout[data-date="${dateLocal}"][data-session-index="${sessionIndex}"]`,
      );
      const fallbackWorkout = runTypeSelect.dataset
        ? String(runTypeSelect.dataset.plannedWorkout || fallbackSession.planned_workout || "")
        : String(fallbackSession.planned_workout || "");
      const fallbackWorkoutCode = runTypeSelect.dataset
        ? String(runTypeSelect.dataset.workoutCode || fallbackSession.workout_code || "")
        : String(fallbackSession.workout_code || "");
      const workoutValue = workoutInput && typeof workoutInput.value === "string"
        ? workoutInput.value
        : fallbackWorkout;
      if (runTypeSelect.dataset) {
        runTypeSelect.dataset.plannedWorkout = String(workoutValue || "");
      }
      return {
        planned_miles: fallbackSession.planned_miles,
        run_type: runTypeSelect && typeof runTypeSelect.value === "string"
          ? runTypeSelect.value
          : String(fallbackSession.run_type || ""),
        planned_workout: workoutValue,
        workout_code: fallbackWorkoutCode,
      };
    });
    return serializeSessionsForApi(raw);
  }

  function collectSessionPayloadForDate(dateLocal) {
    const distanceInputs = Array.from(bodyEl.querySelectorAll(`.plan-session-distance[data-date="${dateLocal}"]`));
    distanceInputs.sort(
      (a, b) => Number.parseInt(a.dataset.sessionIndex || "0", 10) - Number.parseInt(b.dataset.sessionIndex || "0", 10),
    );
    if (distanceInputs.length === 0) {
      return sessionsFromRunTypeEditors(dateLocal);
    }
    const raw = distanceInputs.map((distanceInput) => {
      const sessionIndex = Number.parseInt(distanceInput.dataset.sessionIndex || "0", 10);
      const runTypeSelect = bodyEl.querySelector(
        `.plan-session-type[data-date="${dateLocal}"][data-session-index="${sessionIndex}"]`,
      );
      const workoutInput = bodyEl.querySelector(
        `.plan-session-workout[data-date="${dateLocal}"][data-session-index="${sessionIndex}"]`,
      );
      const fallbackWorkout = runTypeSelect && runTypeSelect.dataset ? String(runTypeSelect.dataset.plannedWorkout || "") : "";
      const fallbackWorkoutCode = runTypeSelect && runTypeSelect.dataset ? String(runTypeSelect.dataset.workoutCode || "") : "";
      const workoutValue = workoutInput && typeof workoutInput.value === "string"
        ? workoutInput.value
        : fallbackWorkout;
      if (runTypeSelect && runTypeSelect.dataset) {
        runTypeSelect.dataset.plannedWorkout = String(workoutValue || "");
      }
      return {
        planned_miles: distanceInput && typeof distanceInput.value === "string" ? distanceInput.value : "",
        run_type: runTypeSelect && typeof runTypeSelect.value === "string" ? runTypeSelect.value : "",
        planned_workout: workoutValue,
        workout_code: fallbackWorkoutCode,
      };
    });
    return serializeSessionsForApi(raw);
  }

  function buildPastDistanceSummary(row) {
    const summary = document.createElement("div");
    summary.className = "plan-aed-summary";

    function appendMetric(symbol, value) {
      const part = document.createElement("span");
      part.className = "plan-aed-part";
      const symbolEl = document.createElement("strong");
      symbolEl.className = "plan-aed-symbol";
      symbolEl.textContent = `${symbol}:`;
      part.appendChild(symbolEl);
      part.appendChild(document.createTextNode(` ${value}`));
      summary.appendChild(part);
    }

    appendMetric("Λ", formatMiles(row && row.actual_miles, 1));
    summary.appendChild(document.createTextNode("\u00A0\u00A0|\u00A0\u00A0"));
    appendMetric("Σ", formatMiles(row && row.planned_miles, 1));
    summary.appendChild(document.createTextNode("\u00A0\u00A0|\u00A0\u00A0"));
    appendMetric("Δ", formatSigned(row && row.day_delta, 1));
    return summary;
  }

  function resolveDayRunType(dateLocal, fallback) {
    const sessions = collectSessionPayloadForDate(dateLocal);
    for (const session of sessions) {
      if (!session || typeof session !== "object") continue;
      const candidate = String(session.run_type || "").trim();
      if (candidate) return candidate;
    }
    return String(fallback || "").trim();
  }

  function saveSessionPayload(row, index, rows, nextFocusDate, sessionsOverride, saveOptions) {
    const sessions = Array.isArray(sessionsOverride) ? sessionsOverride : collectSessionPayloadForDate(row.date);
    const runType = resolveDayRunType(row.date, row && row.run_type);
    const existingSessions = serializeSessionsForApi(sessionDetailsFromRow(row));
    const existingRunType = String(row && row.run_type ? row.run_type : "").trim();
    if (payloadsEqualByValue(existingSessions, sessions) && existingRunType === String(runType || "").trim()) {
      return;
    }
    applyLocalPlanEdit(row.date, sessions, runType);
    void savePlanRow(
      row.date,
      {
        sessions,
        run_type: runType,
      },
      nextFocusDate || row.date,
      saveOptions,
    );
  }

  function setPendingFocus(dateValue) {
    pendingFocus = {
      date: String(dateValue || ""),
      field: "distance",
    };
  }

  function clearPendingFocus() {
    pendingFocus = { date: "", field: "distance" };
  }

  function mergeSavePayload(existingPayload, incomingPayload) {
    const base = existingPayload && typeof existingPayload === "object" ? existingPayload : {};
    const next = incomingPayload && typeof incomingPayload === "object" ? incomingPayload : {};
    return {
      ...base,
      ...next,
    };
  }

  async function refreshCenterSummaryLightweight() {
    const centerDate = isIsoDateString(centerDateEl && centerDateEl.value) ? centerDateEl.value : "";
    if (!centerDate) return;
    try {
      const response = await fetch(`/plan/day/${encodeURIComponent(centerDate)}/metrics`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload.status !== "ok") return;
      if (payload.summary && typeof payload.summary === "object") {
        setSummary({
          status: "ok",
          summary: payload.summary,
        });
      }
    } catch (_err) {
      // Lightweight summary refresh is best-effort.
    }
  }

  function queuePlanSave(dateLocal, payload, nextFocusDate, saveOptions) {
    const options = (saveOptions && typeof saveOptions === "object") ? saveOptions : {};
    const preserveFocus = Boolean(options.preserveFocus);
    const dateKey = String(dateLocal || "").trim();
    if (!isIsoDateString(dateKey)) return;
    const nextPayload = mergeSavePayload(pendingPlanSaves.get(dateKey), payload || {});
    pendingPlanSaves.set(dateKey, nextPayload);
    if (preserveFocus) {
      clearPendingFocus();
    } else if (isIsoDateString(nextFocusDate)) {
      if (!isIsoDateString(saveMaxNextFocusDate) || nextFocusDate > saveMaxNextFocusDate) {
        saveMaxNextFocusDate = nextFocusDate;
      }
      setPendingFocus(nextFocusDate);
    }
    if (saveFlushTimer !== null) {
      clearTimeout(saveFlushTimer);
    }
    saveFlushTimer = setTimeout(() => {
      saveFlushTimer = null;
      void flushQueuedPlanSaves();
    }, 120);
  }

  async function flushQueuedPlanSaves() {
    if (saveFlushInFlight) {
      saveFlushQueuedAfterFlight = true;
      return;
    }
    if (!(pendingPlanSaves instanceof Map) || pendingPlanSaves.size === 0) return;
    const entries = Array.from(pendingPlanSaves.entries());
    pendingPlanSaves = new Map();
    const batchMaxNextFocusDate = saveMaxNextFocusDate;
    saveMaxNextFocusDate = "";
    saveFlushInFlight = true;
    try {
      const response = await fetch("/plan/days/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          days: entries.map(([dateKey, dayPayload]) => ({
            date_local: dateKey,
            ...(dayPayload && typeof dayPayload === "object" ? dayPayload : {}),
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok || result.status !== "ok") {
        throw new Error(String((result && result.error) || "Failed to save plan days"));
      }

      const savedDays = Array.isArray(result && result.days) ? result.days : [];
      let minSavedDate = "";
      for (const saved of savedDays) {
        if (!saved || typeof saved !== "object") continue;
        const dateKey = String(saved.date_local || "");
        if (!isIsoDateString(dateKey)) continue;
        if (!isIsoDateString(minSavedDate) || dateKey < minSavedDate) {
          minSavedDate = dateKey;
        }
        const savedSessions = Array.isArray(saved.sessions) ? saved.sessions : [];
        applyLocalPlanEdit(
          dateKey,
          savedSessions,
          String(saved.run_type || ""),
        );
      }

      const needsAppendFuture = (
        isIsoDateString(batchMaxNextFocusDate)
        && isIsoDateString(loadedEndDate)
        && batchMaxNextFocusDate > loadedEndDate
      );
      if (needsAppendFuture) {
        const appendTarget = addDaysIso(loadedEndDate, PLAN_APPEND_FUTURE_DAYS);
        const appendEnd = batchMaxNextFocusDate > appendTarget ? batchMaxNextFocusDate : appendTarget;
        const fullStart = isIsoDateString(loadedStartDate) ? loadedStartDate : overlapStartForDate(minSavedDate, "");
        await loadPlanRange({
          startDate: fullStart,
          endDate: appendEnd,
          centerDateOverride: centerDateEl.value,
          append: false,
        });
      } else if (
        isIsoDateString(minSavedDate)
        && (renderedRows.length <= PLAN_MAX_AUTO_REFRESH_ROWS || savedDays.length > 1)
      ) {
        queuePlanBackgroundRefresh(minSavedDate);
      }
      void refreshCenterSummaryLightweight();
      if (metaEl) {
        metaEl.textContent = `Saved ${savedDays.length} day(s) | syncing metrics...`;
      }
    } catch (err) {
      for (const [dateKey, dayPayload] of entries) {
        pendingPlanSaves.set(dateKey, mergeSavePayload(pendingPlanSaves.get(dateKey), dayPayload));
      }
      if (metaEl) {
        metaEl.textContent = String(err && err.message ? err.message : "Failed to save plan days");
      }
      if (saveFlushTimer !== null) {
        clearTimeout(saveFlushTimer);
      }
      saveFlushTimer = setTimeout(() => {
        saveFlushTimer = null;
        void flushQueuedPlanSaves();
      }, 300);
    } finally {
      saveFlushInFlight = false;
      if (saveFlushQueuedAfterFlight || pendingPlanSaves.size > 0) {
        saveFlushQueuedAfterFlight = false;
        void flushQueuedPlanSaves();
      }
    }
  }

  async function savePlanRow(dateLocal, payload, nextFocusDate, saveOptions) {
    try {
      queuePlanSave(dateLocal, payload || {}, nextFocusDate, saveOptions);
    } catch (err) {
      if (metaEl) {
        metaEl.textContent = String(err && err.message ? err.message : "Failed to queue plan save");
      }
    }
  }

  function distanceSelectorForDate(dateValue) {
    const dateEscaped = String(dateValue || "");
    return `.plan-session-distance[data-date="${dateEscaped}"][data-session-index="0"]`;
  }

  function rowIndexByDate(dateValue) {
    const dateKey = String(dateValue || "");
    if (!dateKey) return -1;
    return renderedRows.findIndex((item) => item && item.date === dateKey);
  }

  function focusNeighbor(rows, index, delta) {
    const target = rowAt(rows, index + delta);
    if (!target) return false;
    const element = bodyEl.querySelector(distanceSelectorForDate(target.date));
    if (!element) return false;
    element.focus();
    if (typeof element.select === "function") {
      element.select();
    }
    return true;
  }

  function rerenderEditedRowAfterSessionShapeChange(dateValue, sessionIndex = 0) {
    const dateKey = String(dateValue || "").trim();
    if (!isIsoDateString(dateKey)) return;
    const rowIndex = rowIndexByDate(dateKey);
    if (rowIndex < 0) return;
    const row = rowAt(renderedRows, rowIndex);
    if (!row) return;
    const tr = bodyEl.querySelector(`tr[data-date="${dateKey}"]`);
    if (!(tr instanceof HTMLTableRowElement)) return;

    const distanceTd = tr.children.item(2);
    if (distanceTd instanceof HTMLTableCellElement) {
      distanceTd.className = "distance-cell";
      distanceTd.textContent = "";
      let distanceMileage = null;
      if (row && row.is_past_or_today && !row.is_today) {
        distanceMileage = asNumber(row.actual_miles);
        if (distanceMileage === null) distanceMileage = asNumber(row.planned_miles);
      } else {
        distanceMileage = asNumber(row && row.planned_miles);
      }
      const distanceTone = distanceColorForMiles(distanceMileage);
      if (distanceTone) {
        distanceTd.classList.add("distance-gradient-cell");
        distanceTd.style.setProperty("--distance-mile-color", distanceTone);
      } else {
        distanceTd.classList.remove("distance-gradient-cell");
        distanceTd.style.removeProperty("--distance-mile-color");
      }
      if (row && row.is_past_or_today && !row.is_today) {
        distanceTd.appendChild(buildPastDistanceSummary(row));
      } else {
        distanceTd.appendChild(buildSessionDistanceEditor(row, rowIndex, renderedRows));
      }
    }

    const runTypeTd = tr.children.item(3);
    if (runTypeTd instanceof HTMLTableCellElement) {
      runTypeTd.className = "run-type-cell";
      runTypeTd.textContent = "";
      runTypeTd.appendChild(buildSessionTypeEditor(row, rowIndex, renderedRows));
    }

    const targetIndex = Math.max(0, Number.parseInt(String(sessionIndex || 0), 10) || 0);
    const selector = `.plan-session-distance[data-date="${dateKey}"][data-session-index="${targetIndex}"]`;
    const target = bodyEl.querySelector(selector) || bodyEl.querySelector(distanceSelectorForDate(dateKey));
    if (!(target instanceof HTMLInputElement)) return;
    target.focus();
    if (typeof target.select === "function") {
      target.select();
    }
  }

  function buildSessionTypeSelect(row, index, rows, session, sessionIndex) {
    const select = document.createElement("select");
    select.className = "plan-run-type plan-session-type";
    select.dataset.date = row.date;
    select.dataset.sessionIndex = String(sessionIndex);
    select.dataset.plannedWorkout = String(session && (session.planned_workout || session.workout_code) ? (session.planned_workout || session.workout_code) : "");
    select.dataset.workoutCode = String(session && session.workout_code ? session.workout_code : "");
    for (const optionValue of runTypeOptions) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue || "--";
      if (optionValue === String(session && session.run_type ? session.run_type : "")) {
        option.selected = true;
      }
      select.appendChild(option);
    }
    return select;
  }

  function buildSessionWorkoutInput(row, index, rows, session, sessionIndex, runTypeSelect) {
    const field = document.createElement("div");
    field.className = "plan-workout-field";
    field.dataset.open = "0";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "plan-workout-input plan-session-workout";
    input.dataset.date = row.date;
    input.dataset.sessionIndex = String(sessionIndex);
    input.placeholder = "Workout shorthand";
    input.title = "Workout shorthand for SOS session. Press Enter to save.";
    input.value = String((session && (session.planned_workout || session.workout_code)) || runTypeSelect.dataset.plannedWorkout || "");
    if (session && session.workout_code) {
      runTypeSelect.dataset.workoutCode = String(session.workout_code || "");
    }
    runTypeSelect.dataset.plannedWorkout = input.value;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "plan-workout-toggle";
    toggle.setAttribute("aria-label", "Show workout library");
    toggle.title = "Show workout library";
    toggle.textContent = "▾";

    const menu = document.createElement("div");
    menu.className = "plan-workout-menu";
    menu.hidden = true;
    for (const [library, workouts] of workoutsGroupedByLibrary()) {
      const group = document.createElement("div");
      group.className = "plan-workout-menu-group";
      const heading = document.createElement("div");
      heading.className = "plan-workout-menu-heading";
      heading.textContent = library;
      group.appendChild(heading);
      for (const workout of workouts) {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "plan-workout-menu-item";
        option.textContent = `${workoutDisplayLabel(workout)} | ${String(workout.shorthand || "")}`;
        option.title = `${workoutDisplayLabel(workout)} | ${String(workout.shorthand || "")}`;
        option.addEventListener("click", () => {
          input.value = String(workout.shorthand || "");
          runTypeSelect.dataset.plannedWorkout = String(workout.shorthand || "");
          runTypeSelect.dataset.workoutCode = String(workout.workout_id || "");
          setWorkoutMenuOpen(field, menu, false);
          saveSessionPayload(row, index, rows, row.date, undefined, { preserveFocus: true });
        });
        group.appendChild(option);
      }
      menu.appendChild(group);
    }

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextOpen = field.dataset.open !== "1";
      for (const openField of document.querySelectorAll(".plan-workout-field")) {
        if (openField instanceof HTMLElement && openField !== field) {
          openField.dataset.open = "0";
        }
      }
      for (const openMenu of document.querySelectorAll(".plan-workout-menu")) {
        if (!(openMenu instanceof HTMLElement) || openMenu === menu) continue;
        openMenu.hidden = true;
      }
      setWorkoutMenuOpen(field, menu, nextOpen);
    });

    input.addEventListener("input", () => {
      runTypeSelect.dataset.plannedWorkout = String(input.value || "");
      if (!String(input.value || "").trim()) {
        runTypeSelect.dataset.workoutCode = "";
      }
      if (String(input.value || "").trim() !== String(session && session.planned_workout ? session.planned_workout : "").trim()) {
        // Keep the original workout id until the server derives or resolves the edited shorthand.
      }
    });
    input.addEventListener("change", () => {
      runTypeSelect.dataset.plannedWorkout = String(input.value || "");
      saveSessionPayload(row, index, rows, row.date, undefined, { preserveFocus: true });
    });
    input.addEventListener("keydown", (event) => {
      if (!event.ctrlKey || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) {
        if (event.altKey && event.key === "ArrowDown") {
          event.preventDefault();
          setWorkoutMenuOpen(field, menu, true);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          runTypeSelect.dataset.plannedWorkout = String(input.value || "");
          saveSessionPayload(row, index, rows, row.date, undefined, { preserveFocus: true });
        }
        return;
      }
      event.preventDefault();
      focusNeighbor(rows, index, event.key === "ArrowDown" ? 1 : -1);
    });
    field.appendChild(input);
    field.appendChild(toggle);
    field.appendChild(menu);
    return field;
  }

  function buildSessionDistanceEditor(row, index, rows) {
    const editor = document.createElement("div");
    editor.className = "session-editor session-distance-editor";
    const sessions = sessionDetailsFromRow(row);
    const nonEmptySessions = sessions.filter((item) => Number.isFinite(Number(item.planned_miles)) && Number(item.planned_miles) > 0);
    const rowsToRender = nonEmptySessions.length > 0 ? nonEmptySessions : sessions.slice(0, 1);

    for (let sessionIndex = 0; sessionIndex < rowsToRender.length; sessionIndex += 1) {
      const session = rowsToRender[sessionIndex];
      const rowEl = document.createElement("div");
      rowEl.className = "plan-session-row";
      rowEl.dataset.date = row.date;
      rowEl.dataset.sessionIndex = String(sessionIndex);

      const distanceWrap = document.createElement("div");
      distanceWrap.className = "session-distance-wrap";

      if (sessionIndex === 0) {
        const inlineActions = document.createElement("div");
        inlineActions.className = "session-inline-actions";

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "session-inline-btn";
        addBtn.textContent = "+";
        addBtn.title = "Add session";
        addBtn.addEventListener("click", () => {
          const current = collectSessionPayloadForDate(row.date);
          current.push({ ordinal: current.length + 1, planned_miles: 1.0, run_type: "", planned_workout: "" });
          saveSessionPayload(row, index, rows, row.date, current, { preserveFocus: true });
          rerenderEditedRowAfterSessionShapeChange(row.date, Math.max(0, current.length - 1));
        });
        inlineActions.appendChild(addBtn);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "session-inline-btn";
        removeBtn.textContent = "-";
        removeBtn.title = "Remove last session";
        removeBtn.disabled = nonEmptySessions.length <= 1;
        removeBtn.addEventListener("click", () => {
          const current = collectSessionPayloadForDate(row.date);
          if (current.length > 0) current.pop();
          saveSessionPayload(row, index, rows, row.date, current, { preserveFocus: true });
          rerenderEditedRowAfterSessionShapeChange(row.date, Math.max(0, current.length - 1));
        });
        inlineActions.appendChild(removeBtn);

        distanceWrap.appendChild(inlineActions);
      }

      const input = document.createElement("input");
      input.className = "plan-distance-input plan-session-distance";
      input.type = "text";
      input.dataset.date = row.date;
      input.dataset.sessionIndex = String(sessionIndex);
      input.value = Number.isFinite(Number(session.planned_miles)) && Number(session.planned_miles) > 0
        ? formatSessionValue(Number(session.planned_miles))
        : "";
      input.placeholder = "mi";
      input.title = "Distance for this session. Press Enter to save.";
      distanceWrap.appendChild(input);

      rowEl.appendChild(distanceWrap);
      editor.appendChild(rowEl);
    }
    return editor;
  }

  function buildSessionTypeEditor(row, index, rows) {
    const editor = document.createElement("div");
    editor.className = "session-editor session-type-editor";
    const sessions = sessionDetailsFromRow(row);
    const nonEmptySessions = sessions.filter((item) => Number.isFinite(Number(item.planned_miles)) && Number(item.planned_miles) > 0);
    const rowsToRender = nonEmptySessions.length > 0 ? nonEmptySessions : sessions.slice(0, 1);

    for (let sessionIndex = 0; sessionIndex < rowsToRender.length; sessionIndex += 1) {
      const session = rowsToRender[sessionIndex];
      const rowEl = document.createElement("div");
      rowEl.className = "plan-session-row";
      rowEl.dataset.date = row.date;
      rowEl.dataset.sessionIndex = String(sessionIndex);
      const runTypeSelect = buildSessionTypeSelect(row, index, rows, session, sessionIndex);
      rowEl.appendChild(runTypeSelect);
      const runTypeValue = String(session && session.run_type ? session.run_type : runTypeSelect.value || "");
      if (isSosRunType(runTypeValue)) {
        rowEl.appendChild(buildSessionWorkoutInput(row, index, rows, session, sessionIndex, runTypeSelect));
      }
      editor.appendChild(rowEl);
    }
    return editor;
  }

  async function sendRowToGarmin(dateLocal) {
    const dateKey = String(dateLocal || "").trim();
    if (!isIsoDateString(dateKey)) return;
    setPlanActionStatus(`Sending ${dateKey} to Garmin...`, "neutral");
    try {
      const response = await fetch(`/plan/day/${encodeURIComponent(dateKey)}/garmin-sync/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const payload = await response.json();
      if (!response.ok || !payload || !payload.status || payload.status === "error") {
        throw new Error(String((payload && payload.error) || "Failed to send workout to Garmin"));
      }
      const summary = payload.summary && typeof payload.summary === "object" ? payload.summary : {};
      const succeeded = Number(summary.succeeded_count || 0);
      const failed = Number(summary.failed_count || 0);
      const requested = Number(summary.requested_count || 0);
      const message = failed > 0
        ? `Garmin send partial for ${dateKey}: ${succeeded}/${requested} succeeded, ${failed} failed.`
        : `Garmin send complete for ${dateKey}: ${succeeded} workout${succeeded === 1 ? "" : "s"} scheduled.`;
      setPlanActionStatus(message, failed > 0 ? "error" : "ok");
    } catch (err) {
      setPlanActionStatus(String(err && err.message ? err.message : "Failed to send workout to Garmin"), "error");
    }
  }

  async function sendWeekToGarmin(dateLocal) {
    const dateKey = String(dateLocal || "").trim();
    if (!isIsoDateString(dateKey)) return;
    setPlanActionStatus(`Sending ${dateKey} + next 6 days to Garmin...`, "neutral");
    try {
      const response = await fetch(`/plan/day/${encodeURIComponent(dateKey)}/garmin-sync/send-window`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ span_days: 7 }),
      });
      const payload = await response.json();
      if (!response.ok || !payload || !payload.status || payload.status === "error") {
        throw new Error(String((payload && payload.error) || "Failed to send 7-day Garmin window"));
      }
      const summary = payload.summary && typeof payload.summary === "object" ? payload.summary : {};
      const succeeded = Number(summary.succeeded_count || 0);
      const failed = Number(summary.failed_count || 0);
      const skipped = Number(summary.skipped_day_count || 0);
      const requested = Number(summary.requested_count || 0);
      const message = failed > 0
        ? `Garmin 7-day send partial: ${succeeded}/${requested} workouts scheduled, ${failed} failed, ${skipped} day${skipped === 1 ? "" : "s"} skipped.`
        : `Garmin 7-day send complete: ${succeeded} workout${succeeded === 1 ? "" : "s"} scheduled across ${Math.max(0, 7 - skipped)} day${Math.max(0, 7 - skipped) === 1 ? "" : "s"}.`;
      setPlanActionStatus(message, failed > 0 ? "error" : "ok");
    } catch (err) {
      setPlanActionStatus(String(err && err.message ? err.message : "Failed to send 7-day Garmin window"), "error");
    }
  }

  function buildRowActions(row) {
    const dateKey = String(row && row.date ? row.date : "");
    const workoutCodes = rowAttachedWorkoutCodes(row);
    const sevenDaySummary = attachedWorkoutWindowSummary(dateKey, 7);
    const shell = document.createElement("div");
    shell.className = "plan-row-actions";
    shell.dataset.open = "0";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "plan-row-actions-trigger";
    trigger.setAttribute("aria-label", `Open row actions for ${dateKey}`);
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.textContent = "⋮";

    const menu = document.createElement("div");
    menu.className = "plan-row-actions-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", `Plan row actions for ${dateKey}`);
    menu.hidden = true;

    const sendDay = document.createElement("button");
    sendDay.type = "button";
    sendDay.className = "plan-row-actions-item";
    sendDay.setAttribute("role", "menuitem");
    sendDay.textContent = workoutCodes.length > 1
      ? `Send to Garmin (${workoutCodes.length} workouts)`
      : "Send to Garmin";
    sendDay.disabled = workoutCodes.length <= 0;
    sendDay.addEventListener("click", async () => {
      closeRowActionMenus();
      await sendRowToGarmin(dateKey);
    });
    menu.appendChild(sendDay);

    const sendWeek = document.createElement("button");
    sendWeek.type = "button";
    sendWeek.className = "plan-row-actions-item";
    sendWeek.setAttribute("role", "menuitem");
    sendWeek.textContent = `Send 7 days to Garmin (${sevenDaySummary.workoutCount})`;
    sendWeek.disabled = sevenDaySummary.workoutCount <= 0;
    sendWeek.addEventListener("click", async () => {
      closeRowActionMenus();
      await sendWeekToGarmin(dateKey);
    });
    menu.appendChild(sendWeek);

    const note = document.createElement("p");
    note.className = "plan-row-actions-note";
    note.textContent = workoutCodes.length > 0
      ? `${workoutCodes.length} attached workout${workoutCodes.length === 1 ? "" : "s"} on this day.`
      : "No attached SOS workouts on this day.";
    menu.appendChild(note);

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextOpen = shell.dataset.open !== "1";
      closeRowActionMenus(shell);
      shell.dataset.open = nextOpen ? "1" : "0";
      menu.hidden = !nextOpen;
      trigger.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      if (nextOpen) {
        const firstEnabledAction = menu.querySelector(".plan-row-actions-item:not([disabled])");
        if (firstEnabledAction instanceof HTMLElement) {
          firstEnabledAction.focus();
        }
      }
    });

    shell.appendChild(trigger);
    shell.appendChild(menu);
    return shell;
  }

  async function renderRows(rows) {
    bodyEl.textContent = "";
    rowsByDate = new Map();
    let chunkFragment = document.createDocumentFragment();
    let chunkCount = 0;
    const shouldChunk = rows.length > 320;
    const chunkSize = 72;
    let weekIndex = -1;
    let currentWeekKey = "";
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (row && typeof row.date === "string" && row.date) {
        rowsByDate.set(row.date, row);
      }
      const tr = document.createElement("tr");
      if (row && typeof row.date === "string" && row.date) {
        tr.dataset.date = row.date;
      }
      const weekInfo = weekInfoForDate(row && row.date);
      const prevWeekInfo = weekInfoForDate(rowAt(rows, index - 1) && rowAt(rows, index - 1).date);
      const nextWeekInfo = weekInfoForDate(rowAt(rows, index + 1) && rowAt(rows, index + 1).date);
      const isWeekStart = !weekInfo.weekKey || weekInfo.weekKey !== prevWeekInfo.weekKey;
      const isWeekEnd = !weekInfo.weekKey || weekInfo.weekKey !== nextWeekInfo.weekKey;

      if (isWeekStart && weekInfo.weekKey && weekInfo.weekKey !== currentWeekKey) {
        currentWeekKey = weekInfo.weekKey;
        weekIndex += 1;
      }
      if (isWeekStart) tr.classList.add("week-start");
      if (isWeekEnd) tr.classList.add("week-end");
      tr.classList.add((weekIndex + 1) % 2 === 0 ? "week-block-even" : "week-block-odd");
      if (row && row.is_today) tr.classList.add("is-today");

      const doneTd = document.createElement("td");
      doneTd.className = "done-cell";
      const doneChip = document.createElement("span");
      doneChip.className = "done-chip";
      const actualMiles = asNumber(row && row.actual_miles);
      const plannedMiles = asNumber(row && row.planned_miles);
      const isPast = !!(row && row.is_past_or_today && !row.is_today);
      const isTodayPending = !!(row && row.is_today && (actualMiles === null || actualMiles <= 0));
      let doneState = "pending";
      if (actualMiles !== null && actualMiles > 0) {
        doneState = "done";
      } else if (isPast && (plannedMiles !== null && plannedMiles > 0)) {
        doneState = "missed";
      } else if (isPast) {
        doneState = "done";
      } else if (isTodayPending) {
        doneState = "pending";
      }
      doneChip.classList.add(doneState);
      doneChip.title = (
        doneState === "done"
          ? "Compliant day based on detected activity and planned mileage."
          : doneState === "missed"
            ? "Planned run without detected activity."
            : "Future/today pending activity."
      );
      doneTd.appendChild(buildRowActions(row));
      doneTd.appendChild(doneChip);
      tr.appendChild(doneTd);

      const dateTd = document.createElement("td");
      dateTd.className = "date-cell";
      const dateWrap = document.createElement("div");
      dateWrap.className = "plan-date-cell-wrap";
      const dateMain = document.createElement("span");
      dateMain.className = "plan-date-main";
      dateMain.textContent = formatDisplayDate(row && row.date);
      dateMain.title = String((row && row.date) || "--");
      dateWrap.appendChild(dateMain);
      dateTd.appendChild(dateWrap);
      tr.appendChild(dateTd);

      const distanceTd = document.createElement("td");
      distanceTd.className = "distance-cell";
      let distanceMileage = null;
      if (row && row.is_past_or_today && !row.is_today) {
        distanceMileage = asNumber(row.actual_miles);
        if (distanceMileage === null) distanceMileage = asNumber(row.planned_miles);
      } else {
        distanceMileage = asNumber(row && row.planned_miles);
      }
      const distanceTone = distanceColorForMiles(distanceMileage);
      if (distanceTone) {
        distanceTd.classList.add("distance-gradient-cell");
        distanceTd.style.setProperty("--distance-mile-color", distanceTone);
      }
      if (row && row.is_past_or_today && !row.is_today) {
        distanceTd.appendChild(buildPastDistanceSummary(row));
      } else {
        distanceTd.appendChild(buildSessionDistanceEditor(row, index, rows));
      }
      tr.appendChild(distanceTd);

      const runTypeTd = document.createElement("td");
      runTypeTd.className = "run-type-cell";
      runTypeTd.appendChild(buildSessionTypeEditor(row, index, rows));
      tr.appendChild(runTypeTd);

      const showWeekMetrics = !!(row && row.show_week_metrics);
      const weekRowSpan = Math.max(1, Number(row && row.week_row_span) || 1);
      if (showWeekMetrics) {
        const weekTd = makeCell(formatMiles(row && row.weekly_total, 1), "metric-week metric-week-block metric-block-center metric-week-joined");
        weekTd.classList.add("metric-block-start");
        weekTd.rowSpan = weekRowSpan;
        tr.appendChild(weekTd);

        const wowTd = makeCell(
          formatPct(row && row.wow_change),
          `${wowBandFromValue(row && row.wow_change)} metric-wow-block metric-block-center metric-week-joined`,
        );
        wowTd.classList.add("metric-block-start");
        wowTd.rowSpan = weekRowSpan;
        tr.appendChild(wowTd);

        const longTd = makeCell(
          formatPct(row && row.long_pct),
          `${metricBandClass(row && row.bands && row.bands.long_pct)} metric-long-block metric-block-center metric-week-joined`,
        );
        longTd.classList.add("metric-block-start");
        longTd.rowSpan = weekRowSpan;
        tr.appendChild(longTd);
      }

      const showMonthMetrics = !!(row && row.show_month_metrics);
      const monthRowSpan = Math.max(1, Number(row && row.month_row_span) || 1);
      if (showMonthMetrics) {
        const monthTd = makeCell(formatMiles(row && row.monthly_total, 1), "metric-month metric-month-block metric-block-bottom");
        monthTd.classList.add("metric-block-start");
        monthTd.rowSpan = monthRowSpan;
        tr.appendChild(monthTd);

        const momTd = makeCell(
          formatPct(row && row.mom_change),
          `${wowBandFromValue(row && row.mom_change)} metric-mom-block metric-block-bottom`,
        );
        momTd.classList.add("metric-block-start");
        momTd.rowSpan = monthRowSpan;
        tr.appendChild(momTd);
      }

      tr.appendChild(makeCell(formatMiles(row && row.t7_miles, 1), "metric-neutral metric-t7"));
      tr.appendChild(makeCell(formatRatio(row && row.t7_p7_ratio, 1), `${metricBandClass(row && row.bands && row.bands.t7_p7_ratio)} metric-t7-ratio`));
      tr.appendChild(makeCell(formatMiles(row && row.t30_miles, 1), "metric-neutral metric-t30"));
      tr.appendChild(makeCell(formatRatio(row && row.t30_p30_ratio, 1), `${metricBandClass(row && row.bands && row.bands.t30_p30_ratio)} metric-t30-ratio`));
      tr.appendChild(makeCell(formatRatio(row && row.avg30_miles_per_day, 2), "metric-neutral metric-avg30"));
      tr.appendChild(makeCell(formatRatio(row && row.mi_t30_ratio, 1), `${miT30BandFromValue(row && row.mi_t30_ratio)} metric-mi-t30`));

      chunkFragment.appendChild(tr);
      chunkCount += 1;
      if (shouldChunk && chunkCount >= chunkSize) {
        bodyEl.appendChild(chunkFragment);
        chunkFragment = document.createDocumentFragment();
        chunkCount = 0;
        // Yield to keep typing and scroll interactions responsive on long ranges.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    if (chunkCount > 0) {
      bodyEl.appendChild(chunkFragment);
    }
  }

  function setMeta(payload) {
    if (!metaEl) return;
    if (!payload || payload.status !== "ok") {
      metaEl.textContent = "Data unavailable";
      return;
    }
    loadedTimezone = String(payload.timezone || loadedTimezone || "");
    metaEl.textContent = `${payload.start_date} to ${payload.end_date} | Center ${payload.center_date} | ${loadedTimezone}`;
  }

  function setMetaFromState(centerDate) {
    if (!metaEl) return;
    if (!isIsoDateString(loadedStartDate) || !isIsoDateString(loadedEndDate)) return;
    const centerValue = isIsoDateString(centerDate) ? centerDate : centerDateEl.value;
    const effectiveCenter = isIsoDateString(centerValue) ? centerValue : loadedEndDate;
    const timezoneText = loadedTimezone || "--";
    metaEl.textContent = `${loadedStartDate} to ${loadedEndDate} | Center ${effectiveCenter} | ${timezoneText}`;
  }

  function setSettingsStatus(message, tone) {
    if (!settingsStatusEl) return;
    settingsStatusEl.textContent = String(message || "");
    settingsStatusEl.dataset.tone = tone === "error" ? "error" : (tone === "ok" ? "ok" : "neutral");
  }

  function setSettingsOpen(nextOpen) {
    if (!settingsPanel) return;
    settingsPanel.hidden = !nextOpen;
    if (!nextOpen) {
      setSettingsStatus("", "neutral");
    }
  }

  async function seedPlanFromActuals() {
    if (!seedBtn) return;
    seedBtn.disabled = true;
    setSettingsStatus("Seeding expected mileage from actuals...", "neutral");
    try {
      const response = await fetch("/plan/seed/from-actuals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "ok") {
        throw new Error(String((payload && payload.error) || "Seed failed"));
      }
      const seededDays = Number(payload.seeded_days || 0);
      const seededMiles = Number(payload.seeded_total_miles || 0);
      setSettingsStatus(`Seed complete: ${seededDays} day(s), ${seededMiles.toFixed(1)} mi`, "ok");
      await loadPlan(centerDateEl.value);
    } catch (err) {
      setSettingsStatus(String(err && err.message ? err.message : "Seed failed"), "error");
    } finally {
      seedBtn.disabled = false;
    }
  }

  function setSummary(payload) {
    if (!summaryEl) return;
    if (!payload || payload.status !== "ok" || !payload.summary) {
      summaryEl.textContent = "";
      return;
    }
    const summary = payload.summary;
    const cards = [
      {
        key: "day",
        label: "Day Plan vs Actual",
        value: `${formatMiles(summary.day_planned, 1)} / ${formatMiles(summary.day_actual, 1)}`,
        detail: `Δ ${formatSigned(summary.day_delta, 1)}`,
      },
      {
        key: "t7",
        label: "Trailing 7d Plan vs Actual",
        value: `${formatMiles(summary.t7_planned, 1)} / ${formatMiles(summary.t7_actual, 1)}`,
        detail: `Δ ${formatSigned(summary.t7_delta, 1)} | ${formatPercentRatio(summary.t7_adherence_ratio)}`,
      },
      {
        key: "t30",
        label: "Trailing 30d Plan vs Actual",
        value: `${formatMiles(summary.t30_planned, 1)} / ${formatMiles(summary.t30_actual, 1)}`,
        detail: `Δ ${formatSigned(summary.t30_delta, 1)} | ${formatPercentRatio(summary.t30_adherence_ratio)}`,
      },
      {
        key: "week",
        label: "Week Plan vs Actual",
        value: `${formatMiles(summary.week_planned, 1)} / ${formatMiles(summary.week_actual, 1)}`,
        detail: `Δ ${formatSigned(summary.week_delta, 1)} | ${formatPercentRatio(summary.week_adherence_ratio)}`,
      },
      {
        key: "month",
        label: "Month Plan vs Actual",
        value: `${formatMiles(summary.month_planned, 1)} / ${formatMiles(summary.month_actual, 1)}`,
        detail: `Δ ${formatSigned(summary.month_delta, 1)} | ${formatPercentRatio(summary.month_adherence_ratio)}`,
      },
    ];
    summaryEl.textContent = "";
    for (const card of cards) {
      const item = document.createElement("div");
      item.className = "plan-summary-card";
      item.dataset.summaryKey = String(card.key || "");
      const label = document.createElement("span");
      label.className = "plan-summary-label";
      label.textContent = card.label;
      const value = document.createElement("span");
      value.className = "plan-summary-value";
      value.textContent = card.value;
      const detail = document.createElement("span");
      detail.className = "plan-summary-detail";
      detail.textContent = card.detail;
      item.appendChild(label);
      item.appendChild(value);
      item.appendChild(detail);
      summaryEl.appendChild(item);
    }
  }

  function updateLocalDaySummaryCard(row) {
    if (!summaryEl || !row || typeof row !== "object") return;
    const dayCard = summaryEl.querySelector('.plan-summary-card[data-summary-key="day"]');
    if (!(dayCard instanceof HTMLElement)) {
      setSummaryForDate(String(row.date || ""));
      return;
    }
    const valueEl = dayCard.querySelector(".plan-summary-value");
    const detailEl = dayCard.querySelector(".plan-summary-detail");
    if (valueEl instanceof HTMLElement) {
      valueEl.textContent = `${formatMiles(row.planned_miles, 1)} / ${formatMiles(row.actual_miles, 1)}`;
    }
    if (detailEl instanceof HTMLElement) {
      detailEl.textContent = `Δ ${formatSigned(row.day_delta, 1)}`;
    }
  }

  function summaryFromRow(row) {
    const weekPlanned = Number(row && row.weekly_planned_total) || 0;
    const weekActual = Number(row && row.weekly_actual_total) || 0;
    const monthPlanned = Number(row && row.monthly_planned_total) || 0;
    const monthActual = Number(row && row.monthly_actual_total) || 0;
    const t7Planned = Number(row && row.t7_planned_miles) || 0;
    const t7Actual = Number(row && row.t7_actual_miles) || 0;
    const t30Planned = Number(row && row.t30_planned_miles) || 0;
    const t30Actual = Number(row && row.t30_actual_miles) || 0;
    return {
      day_planned: Number(row && row.planned_miles) || 0,
      day_actual: Number(row && row.actual_miles) || 0,
      day_delta: Number(row && row.day_delta) || 0,
      t7_planned: t7Planned,
      t7_actual: t7Actual,
      t7_delta: t7Actual - t7Planned,
      t7_adherence_ratio: row ? row.t7_adherence_ratio : null,
      t30_planned: t30Planned,
      t30_actual: t30Actual,
      t30_delta: t30Actual - t30Planned,
      t30_adherence_ratio: row ? row.t30_adherence_ratio : null,
      week_planned: weekPlanned,
      week_actual: weekActual,
      week_delta: weekActual - weekPlanned,
      week_adherence_ratio: row ? row.weekly_adherence_ratio : null,
      month_planned: monthPlanned,
      month_actual: monthActual,
      month_delta: monthActual - monthPlanned,
      month_adherence_ratio: row ? row.monthly_adherence_ratio : null,
    };
  }

  function setSummaryForDate(dateValue) {
    if (!isIsoDateString(dateValue)) return;
    const row = rowsByDate.get(dateValue);
    if (!row) return;
    setSummary({
      status: "ok",
      summary: summaryFromRow(row),
    });
  }

  function centerDateRowInView(dateValue, behavior = "auto") {
    if (!tableWrapEl || !isIsoDateString(dateValue)) return false;
    const targetRow = bodyEl.querySelector(`tr[data-date="${dateValue}"]`);
    if (!(targetRow instanceof HTMLElement)) return false;
    const tableEl = tableWrapEl.querySelector("table");
    const headerHeight = tableEl && tableEl.tHead ? tableEl.tHead.getBoundingClientRect().height : 0;
    const viewportHeight = Math.max(1, tableWrapEl.clientHeight - headerHeight);
    const desiredTop = targetRow.offsetTop - headerHeight - ((viewportHeight - targetRow.offsetHeight) / 2);
    const maxScroll = Math.max(0, tableWrapEl.scrollHeight - tableWrapEl.clientHeight);
    const nextTop = Math.max(0, Math.min(desiredTop, maxScroll));
    tableWrapEl.scrollTo({
      top: nextTop,
      behavior: behavior === "smooth" ? "smooth" : "auto",
    });
    return true;
  }

  async function ensureDateLoadedForCenter(targetDate) {
    if (!isIsoDateString(targetDate)) return;
    if (!isIsoDateString(loadedEndDate)) return;
    const hasStart = isIsoDateString(loadedStartDate);
    if (hasStart && targetDate < loadedStartDate) {
      await loadPlanRange({
        startDate: targetDate,
        endDate: loadedEndDate,
        centerDateOverride: targetDate,
        append: false,
      });
      return;
    }
    if (targetDate > loadedEndDate) {
      const appendStart = overlapStartForDate(loadedEndDate, hasStart ? loadedStartDate : "");
      const appendTarget = addDaysIso(loadedEndDate, PLAN_APPEND_FUTURE_DAYS);
      const appendEnd = targetDate > appendTarget ? targetDate : appendTarget;
      await loadPlanRange({
        startDate: appendStart,
        endDate: appendEnd,
        centerDateOverride: targetDate,
        append: true,
      });
    }
  }

  function applyPendingFocus() {
    if (!pendingFocus.date) return;
    const target = bodyEl.querySelector(distanceSelectorForDate(pendingFocus.date));
    const field = pendingFocus.field;
    pendingFocus = { date: "", field: "distance" };
    if (!target) return;
    target.focus();
    if (field === "distance" && typeof target.select === "function") {
      target.select();
    }
  }

  async function loadPlanRange({
    startDate = "",
    endDate = "",
    centerDateOverride = "",
    append = false,
    centerDateInView = "",
    centerBehavior = "auto",
    suppressPendingFocus = false,
  } = {}) {
    const requestVersion = ++loadRequestVersion;
    const params = new URLSearchParams();
    params.set("window_days", "14");
    params.set("include_meta", hasLoadedPlanMeta ? "0" : "1");
    const targetDate = String(centerDateOverride || centerDateEl.value || "").trim();
    if (targetDate) {
      params.set("center_date", targetDate);
    }
    if (isIsoDateString(startDate)) {
      params.set("start_date", String(startDate));
    }
    if (isIsoDateString(endDate)) {
      params.set("end_date", String(endDate));
    }

    try {
      if (metaEl) metaEl.textContent = "Loading...";
      const response = await fetch(`/plan/data.json?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (requestVersion !== loadRequestVersion) {
        return false;
      }
      if (!response.ok || payload.status !== "ok") {
        const error = String((payload && payload.error) || "Failed to load plan data");
        if (renderedRows.length > 0 && bodyEl.childElementCount > 0) {
          if (metaEl) metaEl.textContent = `Refresh failed. Keeping current grid. ${error}`;
          return false;
        }
        bodyEl.innerHTML = `<tr><td colspan="15">${error}</td></tr>`;
        if (metaEl) metaEl.textContent = "Load failed";
        return false;
      }
      if (typeof payload.center_date === "string" && payload.center_date) {
        centerDateEl.value = payload.center_date;
      }
      if (typeof payload.min_center_date === "string" && payload.min_center_date) {
        centerDateEl.min = payload.min_center_date;
      }
      if (typeof payload.max_center_date === "string" && payload.max_center_date) {
        centerDateEl.max = payload.max_center_date;
      }
      if (Array.isArray(payload.run_type_options) && payload.run_type_options.length > 0) {
        runTypeOptions = payload.run_type_options.map((item) => String(item || ""));
        hasLoadedPlanMeta = true;
        cacheRunTypeOptions(runTypeOptions);
      } else if (!Array.isArray(runTypeOptions) || runTypeOptions.length === 0) {
        runTypeOptions = [""];
      }
      setMeta(payload);
      setSummary(payload);
      const incomingRows = Array.isArray(payload.rows) ? payload.rows : [];
      renderedRows = append ? mergeRowsByDate(renderedRows, incomingRows) : incomingRows;
      applyMetricContextPayload(payload, { append });
      await renderRows(renderedRows);
      const payloadStart = (typeof payload.start_date === "string" && isIsoDateString(payload.start_date))
        ? payload.start_date
        : (isIsoDateString(startDate) ? String(startDate) : "");
      const payloadEnd = (typeof payload.end_date === "string" && isIsoDateString(payload.end_date))
        ? payload.end_date
        : (isIsoDateString(endDate) ? String(endDate) : "");
      if (append) {
        if (isIsoDateString(payloadStart)) {
          if (!isIsoDateString(loadedStartDate) || payloadStart < loadedStartDate) {
            loadedStartDate = payloadStart;
          }
        }
        if (isIsoDateString(payloadEnd)) {
          if (!isIsoDateString(loadedEndDate) || payloadEnd > loadedEndDate) {
            loadedEndDate = payloadEnd;
          }
        }
      } else {
        if (isIsoDateString(payloadStart)) loadedStartDate = payloadStart;
        if (isIsoDateString(payloadEnd)) loadedEndDate = payloadEnd;
      }
      if (!suppressPendingFocus) {
        applyPendingFocus();
      }
      const centerTarget = String(centerDateInView || "").trim();
      if (isIsoDateString(centerTarget)) {
        requestAnimationFrame(() => {
          centerDateRowInView(centerTarget, centerBehavior);
        });
      }
      return true;
    } catch (error) {
      if (requestVersion !== loadRequestVersion) {
        return false;
      }
      const message = String(error && error.message ? error.message : "Network error while loading plan data.");
      if (renderedRows.length > 0 && bodyEl.childElementCount > 0) {
        if (metaEl) metaEl.textContent = `Refresh failed. Keeping current grid. ${message}`;
        return false;
      }
      bodyEl.innerHTML = `<tr><td colspan="15">${message}</td></tr>`;
      if (metaEl) metaEl.textContent = "Network error";
      return false;
    }
  }

  async function loadPlan(centerDate, options = {}) {
    const centerInView = !!options.centerInView;
    const centerBehavior = String(options.centerBehavior || "auto");
    const today = todayIsoLocal();
    const targetDate = String(centerDate || centerDateEl.value || today).trim();
    const endDate = isIsoDateString(loadedEndDate) ? loadedEndDate : addDaysIso(today, PLAN_INITIAL_FUTURE_DAYS);
    const startDate = isIsoDateString(loadedStartDate) ? loadedStartDate : addDaysIso(today, -365);
    await loadPlanRange({
      startDate,
      endDate,
      centerDateOverride: targetDate,
      append: false,
      centerDateInView: centerInView ? targetDate : "",
      centerBehavior,
    });
  }

  async function centerOnSelectedDate() {
    const selectedDate = isIsoDateString(centerDateEl.value) ? centerDateEl.value : todayIsoLocal();
    centerDateEl.value = selectedDate;
    await ensureDateLoadedForCenter(selectedDate);
    const effectiveCenter = isIsoDateString(centerDateEl.value) ? centerDateEl.value : selectedDate;
    setMetaFromState(effectiveCenter);
    setSummaryForDate(effectiveCenter);
    if (!centerDateRowInView(effectiveCenter, "smooth")) {
      await loadPlan(effectiveCenter, { centerInView: true, centerBehavior: "smooth" });
    }
  }

  reloadBtn.addEventListener("click", () => {
    void loadPlan(centerDateEl.value);
  });
  if (centerBtn) {
    centerBtn.addEventListener("click", () => {
      void centerOnSelectedDate();
    });
  }
  centerDateEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void centerOnSelectedDate();
  });

  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener("click", (event) => {
      event.preventDefault();
      const nextOpen = Boolean(settingsPanel.hidden);
      setSettingsOpen(nextOpen);
    });

    document.addEventListener("click", (event) => {
      if (settingsPanel.hidden) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (settingsPanel.contains(target) || settingsBtn.contains(target)) return;
      setSettingsOpen(false);
    });
  }
  if (seedBtn) {
    seedBtn.addEventListener("click", () => {
      void seedPlanFromActuals();
    });
  }

  if (bodyEl) {
    bodyEl.addEventListener("paste", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches(".plan-session-distance")) return;
      const rawText = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
      if (!rawText) return;
      const parsed = parseMileagePasteValues(rawText);
      if (parsed.error) {
        event.preventDefault();
        if (metaEl) metaEl.textContent = parsed.error;
        return;
      }
      if (!Array.isArray(parsed.values) || parsed.values.length <= 1) {
        return;
      }
      event.preventDefault();
      void applyDistancePaste(target, rawText);
    });

    bodyEl.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.matches(".plan-session-type")) {
        const dateLocal = String(target.getAttribute("data-date") || "");
        const sessionIndex = Number.parseInt(String(target.getAttribute("data-session-index") || "0"), 10);
        const row = rowsByDate.get(dateLocal);
        if (!row) return;
        const index = rowIndexByDate(dateLocal);
        if (index < 0) return;
        saveSessionPayload(row, index, renderedRows, dateLocal, undefined, { preserveFocus: true });
        rerenderEditedRowAfterSessionShapeChange(dateLocal, sessionIndex);
        if (isSosRunType(target.value)) {
          requestAnimationFrame(() => {
            const workoutInput = bodyEl.querySelector(
              `.plan-session-workout[data-date="${dateLocal}"][data-session-index="${sessionIndex}"]`,
            );
            if (workoutInput instanceof HTMLInputElement) {
              workoutInput.focus();
              if (typeof workoutInput.select === "function") {
                workoutInput.select();
              }
            }
          });
        }
        return;
      }
      if (target.matches(".plan-session-distance")) {
        const dateLocal = String(target.getAttribute("data-date") || "");
        const row = rowsByDate.get(dateLocal);
        if (!row) return;
        const index = rowIndexByDate(dateLocal);
        if (index < 0) return;
        saveSessionPayload(row, index, renderedRows, dateLocal, undefined, { preserveFocus: true });
      }
    });

    bodyEl.addEventListener("keydown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.matches(".plan-session-type")) {
        if (!event.ctrlKey || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) {
          return;
        }
        const dateLocal = String(target.getAttribute("data-date") || "");
        const index = rowIndexByDate(dateLocal);
        if (index < 0) return;
        event.preventDefault();
        focusNeighbor(renderedRows, index, event.key === "ArrowDown" ? 1 : -1);
        return;
      }

      if (!target.matches(".plan-session-distance")) return;

      const dateLocal = String(target.getAttribute("data-date") || "");
      const row = rowsByDate.get(dateLocal);
      if (!row) return;
      const index = rowIndexByDate(dateLocal);
      if (index < 0) return;
      const sessionIndex = Number.parseInt(String(target.getAttribute("data-session-index") || "0"), 10);
      if (sessionIndex === 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        focusNeighbor(renderedRows, index, event.key === "ArrowDown" ? 1 : -1);
        return;
      }

      if (event.ctrlKey && event.shiftKey) {
        const mapped = runTypeHotkeys[String(event.key || "").toLowerCase()];
        if (mapped && runTypeOptions.includes(mapped)) {
          event.preventDefault();
          const sessionTypeSelect = bodyEl.querySelector(
            `.plan-session-type[data-date="${dateLocal}"][data-session-index="${sessionIndex}"]`,
          );
          if (sessionTypeSelect instanceof HTMLSelectElement) {
            sessionTypeSelect.value = mapped;
          }
          saveSessionPayload(row, index, renderedRows, dateLocal, undefined, { preserveFocus: true });
          rerenderEditedRowAfterSessionShapeChange(dateLocal, sessionIndex);
          return;
        }
      }

      if (event.key !== "Enter") return;
      event.preventDefault();
      const nextRow = rowAt(renderedRows, index + 1);
      if (nextRow) {
        focusNeighbor(renderedRows, index, 1);
      }
      saveSessionPayload(
        row,
        index,
        renderedRows,
        nextRow ? nextRow.date : addDaysIso(dateLocal, 1),
      );
    });
  }

  if (paceDrawerTab) {
    paceDrawerTab.addEventListener("click", () => {
      if (activeDrawer === "pace") {
        setActiveDrawer("");
        return;
      }
      void openPlanDrawer("pace");
    });
  }
  if (workoutDrawerTab) {
    workoutDrawerTab.addEventListener("click", () => {
      if (activeDrawer === "workout") {
        setActiveDrawer("");
        return;
      }
      void openPlanDrawer("workout");
    });
  }
  if (paceDrawerClose) {
    paceDrawerClose.addEventListener("click", () => {
      setActiveDrawer("");
      closeWorkoutPickerPanel();
    });
  }
  if (workoutDrawerClose) {
    workoutDrawerClose.addEventListener("click", () => {
      setActiveDrawer("");
      closeWorkoutPickerPanel();
    });
  }
  if (paceBackdrop) {
    paceBackdrop.addEventListener("click", () => {
      setActiveDrawer("");
      closeWorkoutPickerPanel();
    });
  }
  if (marathonGoalSetBtn && marathonGoalInputEl) {
    marathonGoalSetBtn.addEventListener("click", () => {
      void saveMarathonGoal(marathonGoalInputEl.value);
    });
    marathonGoalInputEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void saveMarathonGoal(marathonGoalInputEl.value);
    });
  }
  if (paceCalcBtn) {
    paceCalcBtn.addEventListener("click", () => {
      void calculatePaces();
    });
  }
  if (paceTimeInputEl) {
    paceTimeInputEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void calculatePaces();
    });
  }
  if (paceSetDerivedBtn && marathonGoalInputEl) {
    paceSetDerivedBtn.addEventListener("click", () => {
      if (!paceDerivedGoal) return;
      marathonGoalInputEl.value = paceDerivedGoal;
      void saveMarathonGoal(paceDerivedGoal);
    });
  }
  if (workoutPickerToggleEl) {
    workoutPickerToggleEl.addEventListener("click", (event) => {
      event.preventDefault();
      if (workoutPickerOpen) {
        closeWorkoutPickerPanel();
      } else {
        openWorkoutPickerPanel();
      }
    });
  }
  if (workoutNewBtn) {
    workoutNewBtn.addEventListener("click", () => {
      void createNewWorkoutDraft();
    });
  }
  if (workoutReloadBtn) {
    workoutReloadBtn.addEventListener("click", () => {
      void loadSelectedWorkoutDocument({ force: false });
    });
  }
  if (workoutSaveBtn) {
    workoutSaveBtn.addEventListener("click", () => {
      void saveCurrentWorkoutYaml();
    });
  }
  if (workoutYamlEditorEl) {
    workoutYamlEditorEl.addEventListener("input", (event) => {
      workoutYamlText = String(event.target && event.target.value ? event.target.value : "");
      workoutYamlLoadError = "";
      renderWorkoutWorkshop();
    });
  }

  bindWorkoutMenuHandlers();
  bindRowActionMenuHandlers();
  loadCachedRunTypeOptions();
  setActiveDrawer("");
  setDistanceOptions([]);
  if (paceSetDerivedBtn instanceof HTMLButtonElement) {
    paceSetDerivedBtn.disabled = true;
  }
  void loadPaceWorkshop();
  void loadWorkoutCatalog({ reloadDocument: true });
  if (!isIsoDateString(centerDateEl.value)) {
    centerDateEl.value = todayIsoLocal();
  }
  void loadPlan(centerDateEl.value || todayIsoLocal(), { centerInView: true, centerBehavior: "auto" });
})();
