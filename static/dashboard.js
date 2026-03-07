/*
 * Portions adapted from aspain/git-sweaty (MIT License).
 * Source: https://github.com/aspain/git-sweaty
 */

const DEFAULT_COLORS = ["#2a2a2a", "#2a2a2a", "#2a2a2a", "#2a2a2a", "#2a2a2a"];
const MULTI_TYPE_COLOR = "#ff8a3d";
const FALLBACK_VAPORWAVE = ["#3fa8ff", "#39d98a", "#ffd166", "#b392f0", "#ff7aa2", "#7bdff2", "#95d5b2", "#cdb4db"];
const STAT_PLACEHOLDER = "- - -";
const CREATOR_REPO_SLUG = "aspain/git-sweaty";
let TYPE_META = {};
let OTHER_BUCKET = "OtherSports";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_START_SUNDAY = "sunday";
const WEEK_START_MONDAY = "monday";
const WEEKDAY_LABELS_BY_WEEK_START = Object.freeze({
  [WEEK_START_SUNDAY]: Object.freeze(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]),
  [WEEK_START_MONDAY]: Object.freeze(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
});
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const ACTIVE_DAYS_METRIC_KEY = "active_days";
const FIT_FAT_CYCLE_KEY = "fit_fat_cycle";
const FITNESS_METRIC_KEY = "avg_fitness";
const FATIGUE_METRIC_KEY = "avg_fatigue";
const PACE_METRIC_KEY = "avg_pace_mps";
const EFFICIENCY_METRIC_KEY = "avg_efficiency_factor";
const DEFAULT_UNITS = Object.freeze({ distance: "mi", elevation: "ft" });
const UNIT_SYSTEM_TO_UNITS = Object.freeze({
  imperial: Object.freeze({ distance: "mi", elevation: "ft" }),
  metric: Object.freeze({ distance: "km", elevation: "m" }),
});

const typeButtons = document.getElementById("typeButtons");
const yearButtons = document.getElementById("yearButtons");
const typeMenu = document.getElementById("typeMenu");
const yearMenu = document.getElementById("yearMenu");
const typeMenuButton = document.getElementById("typeMenuButton");
const yearMenuButton = document.getElementById("yearMenuButton");
const typeMenuLabel = document.getElementById("typeMenuLabel");
const yearMenuLabel = document.getElementById("yearMenuLabel");
const typeClearButton = document.getElementById("typeClearButton");
const yearClearButton = document.getElementById("yearClearButton");
const resetAllButton = document.getElementById("resetAllButton");
const imperialUnitsButton = document.getElementById("imperialUnitsButton");
const metricUnitsButton = document.getElementById("metricUnitsButton");
const typeMenuOptions = document.getElementById("typeMenuOptions");
const yearMenuOptions = document.getElementById("yearMenuOptions");
const heatmaps = document.getElementById("heatmaps");
const tooltip = document.getElementById("tooltip");
const summary = document.getElementById("summary");
const headerMeta = document.getElementById("headerMeta");
const headerLinks = document.querySelector(".header-links");
const repoLink = document.querySelector(".repo-link");
const stravaProfileLink = document.querySelector(".strava-profile-link");
const stravaProfileLabel = stravaProfileLink
  ? stravaProfileLink.querySelector(".strava-profile-label")
  : null;
const footerHostedPrefix = document.getElementById("footerHostedPrefix");
const footerHostedLink = document.getElementById("footerHostedLink");
const footerPoweredLabel = document.getElementById("footerPoweredLabel");
const dashboardTitle = document.getElementById("dashboardTitle");
const dashboardSubtitle = document.getElementById("dashboardSubtitle");
const dashboardTopStatus = document.getElementById("dashboardTopStatus");
const dashboardSettingsToggle = document.getElementById("dashboardSettingsToggle");
const dashboardSettingsPanel = document.getElementById("dashboardSettingsPanel");
const dashboardFilterDrawerToggle = document.getElementById("dashboardFilterDrawerToggle");
const dashboardFilterDrawer = document.getElementById("dashboardFilterDrawer");
const dashboardScopeSummary = document.getElementById("dashboardScopeSummary");
const dashboardScopeResetButton = document.getElementById("dashboardScopeResetButton");
const customDateRangePanel = document.getElementById("customDateRangePanel");
const customDateStartInput = document.getElementById("customDateStartInput");
const customDateEndInput = document.getElementById("customDateEndInput");
const dashboardThemeToggle = document.getElementById("dashboardThemeToggle");
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
const hasTouchInput = Number(window.navigator?.maxTouchPoints || 0) > 0;
const useTouchInteractions = isTouch || hasTouchInput;
const BREAKPOINTS = Object.freeze({
  NARROW_LAYOUT_MAX: 900,
});
const FILTER_MENU_DROPDOWN_GAP_PX = 6;
const FILTER_MENU_VIEWPORT_GUTTER_PX = 12;
const FILTER_MENU_MIN_HEIGHT_PX = 180;
const FILTER_MENU_MAX_VIEWPORT_RATIO = 0.75;
let pendingAlignmentFrame = null;
let pendingSummaryTailFrame = null;
let persistentSideStatCardWidth = 0;
let persistentSideStatCardMinHeight = 0;
let pinnedTooltipCell = null;
let touchTooltipInteractionBlockUntil = 0;
let touchTooltipDismissBlockUntil = 0;
let lastTooltipPointerType = "";
let touchTooltipLinkClickSuppressUntil = 0;
let touchTooltipRecentPointerUpCell = null;
let touchTooltipRecentPointerUpUntil = 0;
let touchTooltipRecentPointerUpWasTap = true;
let touchTooltipPointerDownState = null;
let tooltipPositionFrame = null;
let tooltipSettleFrame = null;
let pendingTooltipPoint = null;
let tooltipResizeObserver = null;
const PROFILE_PROVIDER_STRAVA = "strava";
const PROFILE_PROVIDER_GARMIN = "garmin";
const TOUCH_TOOLTIP_TAP_MAX_MOVE_PX = 10;
const TOUCH_TOOLTIP_TAP_MAX_SCROLL_PX = 2;
const TOUCH_TOOLTIP_MAX_EFFECTIVE_ZOOM = 1.2;
const TOUCH_TOOLTIP_MIN_SCALE = 0.5;
const DASHBOARD_THEME_STORAGE_KEY = "chronicle.dashboard.theme";
const DASHBOARD_PAYLOAD_CACHE_KEY = "chronicle.dashboard.payload.v1";
const DASHBOARD_SCOPE_STORAGE_KEY = "chronicle.dashboard.scope.v1";
const CUSTOM_RANGE_VALUE = "__custom__";
const DASHBOARD_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const dashboardReducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");

function runDashboardTransition(callback) {
  if (typeof callback !== "function") return;
  callback();
}

function isDashboardPayloadShape(value) {
  return Boolean(
    value
    && typeof value === "object"
    && Array.isArray(value.years)
    && Array.isArray(value.types)
    && value.aggregates
    && Array.isArray(value.activities)
  );
}

function readCachedDashboardPayload() {
  try {
    const raw = localStorage.getItem(DASHBOARD_PAYLOAD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isDashboardPayloadShape(parsed)) {
      localStorage.removeItem(DASHBOARD_PAYLOAD_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch (_error) {
    try {
      localStorage.removeItem(DASHBOARD_PAYLOAD_CACHE_KEY);
    } catch (_storageError) {
      // Ignore localStorage errors in restricted browser modes.
    }
    return null;
  }
}

function writeCachedDashboardPayload(payload) {
  if (!isDashboardPayloadShape(payload)) return;
  try {
    localStorage.setItem(DASHBOARD_PAYLOAD_CACHE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore localStorage errors in restricted browser modes.
  }
}

function dashboardPayloadRevision(payload) {
  if (!isDashboardPayloadShape(payload)) return "";
  const latestActivityId = String(payload.latest_activity_id || "");
  const latestActivityStart = String(payload.latest_activity_start_date || "");
  const activityCount = Array.isArray(payload.activities) ? payload.activities.length : 0;
  const yearCount = Array.isArray(payload.years) ? payload.years.length : 0;
  const typeCount = Array.isArray(payload.types) ? payload.types.length : 0;
  return [latestActivityId, latestActivityStart, activityCount, yearCount, typeCount].join("|");
}

async function fetchLiveDashboardPayload() {
  const resp = await fetch("/dashboard/data.json", { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Failed to load data.json (${resp.status})`);
  }
  const payload = await resp.json();
  if (!isDashboardPayloadShape(payload)) {
    throw new Error("Invalid dashboard data format.");
  }
  writeCachedDashboardPayload(payload);
  return payload;
}

function resetPersistentSideStatSizing() {
  persistentSideStatCardWidth = 0;
  persistentSideStatCardMinHeight = 0;
  if (!heatmaps) return;
  heatmaps.style.removeProperty("--side-stat-card-width");
  heatmaps.style.removeProperty("--side-stat-card-min-height");
}

function normalizeUnits(units) {
  const distance = units?.distance === "km" ? "km" : "mi";
  const elevation = units?.elevation === "m" ? "m" : "ft";
  return { distance, elevation };
}

function normalizeWeekStart(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "monday" || normalized === "mon") {
    return WEEK_START_MONDAY;
  }
  return WEEK_START_SUNDAY;
}

function getUnitSystemFromUnits(units) {
  const normalized = normalizeUnits(units);
  return normalized.distance === "km" && normalized.elevation === "m"
    ? "metric"
    : "imperial";
}

function getUnitsForSystem(system) {
  return normalizeUnits(UNIT_SYSTEM_TO_UNITS[system] || DEFAULT_UNITS);
}

function isNarrowLayoutViewport() {
  return window.matchMedia(`(max-width: ${BREAKPOINTS.NARROW_LAYOUT_MAX}px)`).matches;
}

function isDesktopLikeViewport() {
  return !isNarrowLayoutViewport();
}

function requestLayoutAlignment() {
  if (pendingAlignmentFrame !== null) {
    window.cancelAnimationFrame(pendingAlignmentFrame);
  }
  pendingAlignmentFrame = window.requestAnimationFrame(() => {
    pendingAlignmentFrame = null;
    alignStackedStatsToYAxisLabels();
    syncChronicleStageScales(document);
    syncChronicleLensLayouts(document);
  });
}

function requestSummaryTypeTailCentering() {
  if (pendingSummaryTailFrame !== null) {
    window.cancelAnimationFrame(pendingSummaryTailFrame);
  }
  pendingSummaryTailFrame = window.requestAnimationFrame(() => {
    pendingSummaryTailFrame = null;
    centerSummaryTypeCardTailRow(summary);
  });
}

function schedulePostInteractionAlignment() {
  if (useTouchInteractions) return;
  requestLayoutAlignment();
}

function captureCardScrollOffsets(container) {
  const offsets = new Map();
  if (!container) return offsets;
  container.querySelectorAll(".card[data-scroll-key]").forEach((card) => {
    const key = String(card.dataset.scrollKey || "");
    if (!key) return;
    const scrollLeft = Number(card.scrollLeft || 0);
    if (Number.isFinite(scrollLeft) && scrollLeft > 0) {
      offsets.set(key, scrollLeft);
    }
  });
  return offsets;
}

function restoreCardScrollOffsets(container, offsets) {
  if (!container || !(offsets instanceof Map) || !offsets.size) return;
  container.querySelectorAll(".card[data-scroll-key]").forEach((card) => {
    const key = String(card.dataset.scrollKey || "");
    if (!key || !offsets.has(key)) return;
    const target = Number(offsets.get(key));
    if (!Number.isFinite(target) || target <= 0) return;
    const maxScroll = Math.max(0, card.scrollWidth - card.clientWidth);
    card.scrollLeft = Math.min(target, maxScroll);
  });
}

function inferGitHubRepoFromLocation(loc) {
  const host = String(loc.hostname || "").toLowerCase();
  const pathParts = String(loc.pathname || "")
    .split("/")
    .filter(Boolean);

  if (host.endsWith(".github.io")) {
    const owner = host.replace(/\.github\.io$/, "");
    if (!owner) return null;
    const repo = pathParts[0] || `${owner}.github.io`;
    return { owner, repo };
  }

  if (host === "github.com" && pathParts.length >= 2) {
    return { owner: pathParts[0], repo: pathParts[1] };
  }

  return null;
}

function parseGitHubRepo(value) {
  if (value && typeof value === "object") {
    const owner = String(value.owner || "").trim();
    const repo = String(value.repo || "").trim().replace(/\.git$/i, "");
    if (owner && repo) {
      return { owner, repo };
    }
    return null;
  }

  let raw = String(value || "").trim();
  if (!raw) return null;

  if (/^git@github\.com:/i.test(raw)) {
    raw = raw.replace(/^git@github\.com:/i, "");
  } else if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (String(parsed.hostname || "").toLowerCase() !== "github.com") {
        return null;
      }
      raw = parsed.pathname || "";
    } catch (_error) {
      return null;
    }
  } else {
    raw = raw.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "");
  }

  const pathParts = raw
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  if (pathParts.length < 2) return null;

  const owner = String(pathParts[0] || "").trim();
  const repo = String(pathParts[1] || "").trim().replace(/\.git$/i, "");
  if (!owner || !repo) return null;
  return { owner, repo };
}

function resolveGitHubRepo(loc, fallbackRepo) {
  return inferGitHubRepoFromLocation(loc) || parseGitHubRepo(fallbackRepo);
}

function normalizeRepoSlug(value) {
  const parsed = parseGitHubRepo(value);
  if (!parsed) return "";
  return `${parsed.owner}/${parsed.repo}`.toLowerCase();
}

function shouldHideHostedFooter(repoCandidate) {
  const repoSlug = normalizeRepoSlug(repoCandidate);
  return !repoSlug || repoSlug === CREATOR_REPO_SLUG;
}

function footerPoweredLabelText(repoCandidate) {
  return "Inspired by";
}

function isGitHubHostedLocation(loc) {
  const host = String(loc?.hostname || "").toLowerCase();
  return Boolean(host) && (host === "github.com" || host.endsWith(".github.io"));
}

function customDashboardUrlFromLocation(loc) {
  const protocol = String(loc?.protocol || "").toLowerCase();
  const host = String(loc?.host || loc?.hostname || "").trim();
  if (!host) return "";
  const pathname = String(loc?.pathname || "/");
  const search = String(loc?.search || "");
  if (!protocol || !/^https?:$/.test(protocol)) return "";

  try {
    const normalized = new URL(`${protocol}//${host}${pathname}${search}`);
    return normalized.toString();
  } catch (_error) {
    return "";
  }
}

function customDashboardLabelFromUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    const path = String(parsed.pathname || "").replace(/\/+$/, "");
    const suffixPath = path && path !== "/" ? path : "";
    return `${parsed.host}${suffixPath}${parsed.search}`;
  } catch (_error) {
    return "";
  }
}

function resolveHeaderRepoLink(loc, fallbackRepo) {
  const inferred = resolveGitHubRepo(loc, fallbackRepo);
  if (inferred) {
    return {
      href: `https://github.com/${inferred.owner}/${inferred.repo}`,
      text: `${inferred.owner}/${inferred.repo}`,
    };
  }

  if (!isGitHubHostedLocation(loc)) {
    const customUrl = customDashboardUrlFromLocation(loc);
    if (customUrl) {
      const customLabel = customDashboardLabelFromUrl(customUrl) || customUrl;
      return { href: customUrl, text: customLabel };
    }
  }

  return null;
}

function resolveFooterHostedLink(loc, fallbackRepo) {
  const inferred = resolveGitHubRepo(loc, fallbackRepo);
  if (!inferred) return null;
  return {
    href: `https://github.com/${inferred.owner}/${inferred.repo}`,
    text: `${inferred.owner}/${inferred.repo}`,
  };
}

function syncRepoLink(fallbackRepo) {
  if (!repoLink) return;
  const resolved = resolveHeaderRepoLink(
    window.location,
    fallbackRepo || repoLink.getAttribute("href") || repoLink.textContent,
  );
  if (!resolved) return;
  repoLink.href = resolved.href;
  repoLink.textContent = resolved.text;
}

function syncFooterHostedLink(fallbackRepo) {
  if (!footerHostedLink) return;
  const footerFallbackRepo = fallbackRepo
    || repoLink?.getAttribute("href")
    || repoLink?.textContent;
  const resolved = resolveFooterHostedLink(
    window.location,
    footerFallbackRepo,
  );
  if (resolved) {
    footerHostedLink.href = resolved.href;
    footerHostedLink.textContent = resolved.text;
  }
  const footerRepoCandidate = resolved?.text || resolved?.href || footerFallbackRepo;
  if (footerHostedPrefix) {
    footerHostedPrefix.hidden = shouldHideHostedFooter(footerRepoCandidate);
  }
  if (footerPoweredLabel) {
    footerPoweredLabel.textContent = footerPoweredLabelText(footerRepoCandidate);
  }
}

function syncHeaderLinkPlacement() {
  if (!repoLink || !headerLinks) return;
  if (repoLink.parentElement !== headerLinks) {
    headerLinks.insertBefore(repoLink, headerLinks.firstChild);
  }

  if (!stravaProfileLink || !headerMeta) return;
  if (stravaProfileLink.parentElement !== headerMeta) {
    headerMeta.appendChild(stravaProfileLink);
  }
}

function syncProfileLinkNavigationTarget() {
  if (!stravaProfileLink) return;
  if (isDesktopLikeViewport()) {
    stravaProfileLink.target = "_blank";
    stravaProfileLink.rel = "noopener noreferrer";
    return;
  }
  stravaProfileLink.removeAttribute("target");
  stravaProfileLink.removeAttribute("rel");
}

function setProfileProviderIcon(provider) {
  if (!stravaProfileLink) return;
  stravaProfileLink.classList.remove("profile-provider-strava", "profile-provider-garmin");
  if (provider === PROFILE_PROVIDER_GARMIN) {
    stravaProfileLink.classList.add("profile-provider-garmin");
    return;
  }
  stravaProfileLink.classList.add("profile-provider-strava");
}

function parseStravaProfileUrl(value) {
  let raw = String(value || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw.replace(/^\/+/, "")}`;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_error) {
    return null;
  }

  const host = String(parsed.hostname || "").toLowerCase();
  const isStravaHost = host === "strava.com" || host.endsWith(".strava.com");
  const isGarminHost = host === "connect.garmin.com" || host.endsWith(".connect.garmin.com");
  if (!isStravaHost && !isGarminHost) {
    return null;
  }

  const path = String(parsed.pathname || "").trim().replace(/\/+$/, "");
  if (!path || path === "/") {
    return null;
  }

  let normalizedPath = path;
  if (isGarminHost) {
    const garminMatch = path.match(/^\/(?:modern\/)?profile\/([^/]+)(?:\/.*)?$/i);
    if (!garminMatch) {
      return null;
    }
    normalizedPath = `/modern/profile/${garminMatch[1]}`;
  }

  return {
    href: `${parsed.protocol}//${parsed.host}${normalizedPath}${parsed.search}`,
    label: isGarminHost ? "Garmin" : "Strava",
  };
}

function parseStravaActivityUrl(value) {
  let raw = String(value || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw.replace(/^\/+/, "")}`;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_error) {
    return null;
  }

  const host = String(parsed.hostname || "").toLowerCase();
  const isStravaHost = host === "strava.com" || host.endsWith(".strava.com");
  const isGarminHost = host === "connect.garmin.com" || host.endsWith(".connect.garmin.com");
  if (!isStravaHost && !isGarminHost) {
    return null;
  }

  const path = String(parsed.pathname || "").trim().replace(/\/+$/, "");
  if (isStravaHost && !/^\/activities\/[^/]+$/i.test(path)) {
    return null;
  }
  if (isGarminHost && !/^\/(?:modern\/)?activity\/[^/]+$/i.test(path)) {
    return null;
  }

  return {
    href: `${parsed.protocol}//${parsed.host}${path}${parsed.search}`,
  };
}

function syncStravaProfileLink(profileUrl, source) {
  if (!stravaProfileLink) return;
  const parsed = parseStravaProfileUrl(profileUrl);
  if (!parsed) {
    stravaProfileLink.hidden = true;
    setProfileProviderIcon(PROFILE_PROVIDER_STRAVA);
    syncProfileLinkNavigationTarget();
    syncHeaderLinkPlacement();
    return;
  }
  stravaProfileLink.href = parsed.href;
  const providerLabel = parsed.label || providerDisplayName(source) || "Profile";
  const provider = providerLabel === "Garmin"
    ? PROFILE_PROVIDER_GARMIN
    : PROFILE_PROVIDER_STRAVA;
  setProfileProviderIcon(provider);
  if (stravaProfileLabel) {
    stravaProfileLabel.textContent = providerLabel;
  } else {
    stravaProfileLink.textContent = providerLabel;
  }
  stravaProfileLink.hidden = false;
  syncProfileLinkNavigationTarget();
  syncHeaderLinkPlacement();
}

function providerDisplayName(source) {
  const normalized = String(source || "").trim().toLowerCase();
  if (normalized === "garmin") return "Garmin";
  if (normalized === "strava") return "Strava";
  return "";
}

function payloadRepoCandidate(payload) {
  return payload?.repo
    || payload?.repo_slug
    || payload?.repo_url
    || payload?.repository
    || "";
}

function payloadProfileUrl(payload) {
  return payload?.profile_url
    || payload?.profileUrl
    || payload?.provider_profile_url
    || payload?.garmin_profile_url
    || payload?.garminProfileUrl
    || payload?.garmin_profile
    || payload?.strava_profile_url
    || payload?.stravaProfileUrl
    || payload?.strava_profile
    || "";
}

function payloadSource(payload) {
  return payload?.source || payload?.provider || "";
}

function cloneSelectionState(allMode, selectedValues) {
  return {
    allMode: Boolean(allMode),
    selectedValues: new Set(selectedValues),
  };
}

function reduceTopButtonSelection({
  rawValue,
  allMode,
  selectedValues,
  allValues,
  normalizeValue = (value) => value,
}) {
  if (rawValue === "all") {
    if (!allValues.length) {
      return { allMode: true, selectedValues: new Set() };
    }
    const hasExplicitAllSelection = !allMode
      && selectedValues.size === allValues.length
      && allValues.every((value) => selectedValues.has(value));
    if (hasExplicitAllSelection) {
      return { allMode: true, selectedValues: new Set() };
    }
    return { allMode: false, selectedValues: new Set(allValues) };
  }
  const normalizedValue = normalizeValue(rawValue);
  if (!allValues.includes(normalizedValue)) {
    return { allMode, selectedValues };
  }
  if (allMode) {
    return {
      allMode: false,
      selectedValues: new Set([normalizedValue]),
    };
  }
  const nextSelectedValues = new Set(selectedValues);
  if (nextSelectedValues.has(normalizedValue)) {
    nextSelectedValues.delete(normalizedValue);
    if (!nextSelectedValues.size) {
      return { allMode: true, selectedValues: new Set() };
    }
    return { allMode: false, selectedValues: nextSelectedValues };
  }
  nextSelectedValues.add(normalizedValue);
  return { allMode: false, selectedValues: nextSelectedValues };
}

function reduceMenuSelection({
  rawValue,
  allMode,
  selectedValues,
  allValues,
  normalizeValue = (value) => value,
  allowToggleOffAll = false,
}) {
  if (rawValue === "all") {
    const hasExplicitAllSelection = !allMode
      && allValues.length > 0
      && selectedValues.size === allValues.length
      && allValues.every((value) => selectedValues.has(value));
    if (allowToggleOffAll && (allMode || hasExplicitAllSelection)) {
      return { allMode: false, selectedValues: new Set() };
    }
    return { allMode: true, selectedValues: new Set() };
  }
  const normalizedValue = normalizeValue(rawValue);
  if (!allValues.includes(normalizedValue)) {
    return { allMode, selectedValues };
  }
  if (allMode) {
    return {
      allMode: false,
      selectedValues: new Set(allValues.filter((value) => value !== normalizedValue)),
    };
  }
  const nextSelectedValues = new Set(selectedValues);
  if (nextSelectedValues.has(normalizedValue)) {
    nextSelectedValues.delete(normalizedValue);
    return { allMode: false, selectedValues: nextSelectedValues };
  }
  nextSelectedValues.add(normalizedValue);
  return { allMode: false, selectedValues: nextSelectedValues };
}

function deriveActiveSummaryYearMetricKey({
  visibleYears,
  selectedMetricByYear,
  filterableMetricsByYear,
}) {
  const selectedMetrics = new Set();
  for (const year of visibleYears) {
    const selectedMetric = selectedMetricByYear.get(year);
    const filterableSet = filterableMetricsByYear.get(year) || new Set();
    if (selectedMetric && filterableSet.has(selectedMetric)) {
      selectedMetrics.add(selectedMetric);
    }
  }
  if (selectedMetrics.size !== 1) {
    return null;
  }
  const [candidateMetric] = Array.from(selectedMetrics);
  let hasEligibleYear = false;
  for (const year of visibleYears) {
    const filterableSet = filterableMetricsByYear.get(year) || new Set();
    if (!filterableSet.has(candidateMetric)) continue;
    hasEligibleYear = true;
    if (selectedMetricByYear.get(year) !== candidateMetric) {
      return null;
    }
  }
  return hasEligibleYear ? candidateMetric : null;
}

function toStringSet(values) {
  const result = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    if (typeof value === "string") {
      result.add(value);
    }
  });
  return result;
}

function trackYearMetricAvailability(year, visibleYearsSet) {
  visibleYearsSet.add(Number(year));
}

function pruneYearMetricSelectionsByFilterability(selectionByYear, filterableMetricsByYearMap) {
  Array.from(selectionByYear.keys()).forEach((year) => {
    const filterableSet = filterableMetricsByYearMap.get(year);
    const selectedMetricKey = selectionByYear.get(year) || null;
    if (!filterableSet || (selectedMetricKey && !filterableSet.has(selectedMetricKey))) {
      selectionByYear.delete(year);
    }
  });
}

function selectedTypesListForState(state, allTypes) {
  if (!state || state.allMode) {
    return allTypes.slice();
  }
  return allTypes.filter((type) => state.selectedValues.has(type));
}

function selectedYearsListForState(state, visibleYears) {
  if (!state || state.allMode) {
    return visibleYears.slice();
  }
  return visibleYears.filter((year) => state.selectedValues.has(Number(year)));
}

function updateButtonState(container, selectedValues, isAllSelected, allValues, normalizeValue) {
  if (!container) return;
  const hasExplicitAllSelection = allValues.length > 0
    && !isAllSelected
    && selectedValues.size === allValues.length
    && allValues.every((value) => selectedValues.has(value));
  container.querySelectorAll(".filter-button").forEach((button) => {
    const rawValue = String(button.dataset.value || "");
    const value = normalizeValue ? normalizeValue(rawValue) : rawValue;
    const isActive = rawValue === "all"
      ? hasExplicitAllSelection
      : (!isAllSelected && selectedValues.has(value));
    button.classList.toggle("active", isActive);
  });
}

function getTypeMenuText(types, allTypesSelected) {
  if (allTypesSelected) return "All Activities";
  if (types.length) return types.map((type) => displayType(type)).join(", ");
  return "No Activities Selected";
}

function getYearMenuText(years, allYearsSelected) {
  if (allYearsSelected) return "All Years";
  if (years.length) return years.map((year) => String(year)).join(", ");
  return "No Years Selected";
}

function getScopeSummaryText(typeText, yearText, customRange) {
  if (customRange?.start && customRange?.end) {
    return `${typeText} • ${formatDisplayDate(customRange.start)} - ${formatDisplayDate(customRange.end)}`;
  }
  return `${typeText} • ${yearText}`;
}

function setMenuLabel(labelEl, text, fallbackText) {
  if (!labelEl) return;
  if (fallbackText && fallbackText !== text) {
    labelEl.textContent = fallbackText;
    return;
  }
  labelEl.textContent = text;
}

function setMenuOpenState(menuEl, buttonEl, isOpen) {
  if (!menuEl) return;
  menuEl.classList.toggle("open", isOpen);
  if (buttonEl) {
    buttonEl.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }
}

function ensureFilterMenuList(container) {
  if (!container) return null;
  let list = container.querySelector(".filter-menu-options-list");
  if (list) return list;
  list = document.createElement("div");
  list.className = "filter-menu-options-list";
  container.appendChild(list);
  return list;
}

function resetFilterMenuScroll(container) {
  if (!container) return;
  const list = container.querySelector(".filter-menu-options-list");
  if (list) {
    list.scrollTop = 0;
    return;
  }
  container.scrollTop = 0;
}

function getFilterMenuMaxHeightPx(triggerButtonEl) {
  if (!triggerButtonEl) return null;
  const viewportHeight = Number(window.innerHeight || document.documentElement?.clientHeight || 0);
  if (!viewportHeight) return null;
  const rect = triggerButtonEl.getBoundingClientRect();
  const spaceBelow = Math.max(
    0,
    viewportHeight - rect.bottom - FILTER_MENU_DROPDOWN_GAP_PX - FILTER_MENU_VIEWPORT_GUTTER_PX,
  );
  const viewportCap = Math.floor(viewportHeight * FILTER_MENU_MAX_VIEWPORT_RATIO);
  const boundedCap = Math.min(spaceBelow, viewportCap);
  const minimum = Math.min(FILTER_MENU_MIN_HEIGHT_PX, spaceBelow);
  return Math.max(minimum, boundedCap);
}

function applyFilterMenuMaxHeight(menuEl, triggerButtonEl, optionsEl) {
  if (!menuEl || !optionsEl || !menuEl.classList.contains("open")) {
    if (optionsEl) {
      optionsEl.style.removeProperty("--filter-menu-max-height");
    }
    return;
  }
  const maxHeight = getFilterMenuMaxHeightPx(triggerButtonEl);
  if (Number.isFinite(maxHeight) && maxHeight > 0) {
    optionsEl.style.setProperty("--filter-menu-max-height", `${Math.round(maxHeight)}px`);
    return;
  }
  optionsEl.style.removeProperty("--filter-menu-max-height");
}

function syncOpenFilterMenuMaxHeights() {
  applyFilterMenuMaxHeight(typeMenu, typeMenuButton, typeMenuOptions);
  applyFilterMenuMaxHeight(yearMenu, yearMenuButton, yearMenuOptions);
}

function renderFilterButtons(container, options, onSelect) {
  if (!container) return;
  container.innerHTML = "";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-button";
    button.dataset.value = option.value;
    button.textContent = option.label;
    button.addEventListener("click", () => onSelect(option.value));
    container.appendChild(button);
  });
}

function renderFilterMenuOptions(
  container,
  options,
  selectedValues,
  isAllSelected,
  onSelect,
  normalizeValue,
) {
  if (!container) return;
  container.innerHTML = "";
  const list = ensureFilterMenuList(container);
  if (!list) return;
  const normalizedOptionValues = options
    .filter((option) => String(option.value) !== "all")
    .map((option) => {
      const rawValue = String(option.value);
      return normalizeValue ? normalizeValue(rawValue) : rawValue;
    });
  const hasExplicitAllSelection = !isAllSelected
    && normalizedOptionValues.length > 0
    && normalizedOptionValues.every((value) => selectedValues.has(value));
  const allOptionSelected = isAllSelected || hasExplicitAllSelection;
  options.forEach((option) => {
    const rawValue = String(option.value);
    const normalized = normalizeValue ? normalizeValue(rawValue) : rawValue;
    const isActive = rawValue === "all"
      ? allOptionSelected
      : (!isAllSelected && selectedValues.has(normalized));
    const isChecked = rawValue === "all"
      ? allOptionSelected
      : (isAllSelected || selectedValues.has(normalized));

    const row = document.createElement("button");
    row.type = "button";
    row.className = "filter-menu-option";
    if (isActive) {
      row.classList.add("active");
    }
    row.dataset.value = rawValue;
    row.setAttribute("aria-pressed", isActive ? "true" : "false");

    const label = document.createElement("span");
    label.className = "filter-menu-option-label";
    label.textContent = option.label;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "filter-menu-check";
    check.checked = isChecked;
    check.tabIndex = -1;
    check.setAttribute("aria-hidden", "true");

    row.appendChild(label);
    row.appendChild(check);
    row.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    row.addEventListener("click", () => onSelect(rawValue));
    list.appendChild(row);
  });
}

function renderYearMenuOptions(
  container,
  visibleYears,
  selection,
  customActive,
  onSelectPreset,
  onSelectCustom,
) {
  if (!container) return;
  container.innerHTML = "";
  const list = ensureFilterMenuList(container);
  if (!list) return;
  const rows = [
    { value: "all", label: "All Years", checked: selection.allMode && !customActive, active: selection.allMode && !customActive, handler: onSelectPreset },
    ...visibleYears.map((year) => ({
      value: String(year),
      label: String(year),
      checked: !selection.allMode && selection.selectedValues.has(Number(year)) && !customActive,
      active: !selection.allMode && selection.selectedValues.has(Number(year)) && !customActive,
      handler: onSelectPreset,
    })),
    { value: CUSTOM_RANGE_VALUE, label: "Custom Range", checked: customActive, active: customActive, handler: onSelectCustom },
  ];
  rows.forEach((option) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "filter-menu-option";
    row.dataset.value = option.value;
    row.setAttribute("aria-pressed", option.active ? "true" : "false");
    if (option.active) {
      row.classList.add("active");
    }
    const label = document.createElement("span");
    label.className = "filter-menu-option-label";
    label.textContent = option.label;
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "filter-menu-check";
    check.checked = option.checked;
    check.tabIndex = -1;
    check.setAttribute("aria-hidden", "true");
    row.appendChild(label);
    row.appendChild(check);
    row.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    row.addEventListener("click", () => option.handler(option.value));
    list.appendChild(row);
  });
}

function renderFilterMenuDoneButton(container, onDone) {
  if (!container) return;
  const footer = document.createElement("div");
  footer.className = "filter-menu-footer";
  const done = document.createElement("button");
  done.type = "button";
  done.className = "filter-menu-done";
  done.textContent = "Done";
  done.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  done.addEventListener("click", () => onDone());
  footer.appendChild(done);
  container.appendChild(footer);
}

function syncCustomDateRangePanel(customActive, customRange, bounds) {
  if (customDateRangePanel) {
    customDateRangePanel.setAttribute("data-active", customActive ? "true" : "false");
  }
  if (customDateStartInput) {
    customDateStartInput.disabled = !customActive;
    customDateStartInput.value = customRange?.start || "";
    if (bounds?.start) customDateStartInput.min = bounds.start;
    if (bounds?.end) customDateStartInput.max = bounds.end;
  }
  if (customDateEndInput) {
    customDateEndInput.disabled = !customActive;
    customDateEndInput.value = customRange?.end || "";
    if (bounds?.start) customDateEndInput.min = bounds.start;
    if (bounds?.end) customDateEndInput.max = bounds.end;
  }
}

function syncFilterControlState({
  typeButtons,
  yearButtons,
  selectedTypes,
  selectedYears,
  allTypeValues,
  allYearValues,
  allTypesSelected,
  allYearsSelected,
  typeMenuTypes,
  yearMenuYears,
  typeMenuSelection,
  yearMenuSelection,
  typeMenuLabel,
  yearMenuLabel,
  typeClearButton,
  yearClearButton,
  keepTypeMenuOpen,
  keepYearMenuOpen,
  typeMenu,
  yearMenu,
  typeMenuButton,
  yearMenuButton,
  yearMenuCustomActive,
  customRange,
}) {
  updateButtonState(typeButtons, selectedTypes, allTypesSelected, allTypeValues);
  updateButtonState(yearButtons, selectedYears, allYearsSelected, allYearValues, (v) => Number(v));
  const typeMenuText = getTypeMenuText(
    typeMenuTypes,
    typeMenuSelection.allMode || typeMenuTypes.length === allTypeValues.length,
  );
  const yearMenuText = getYearMenuText(
    yearMenuYears,
    yearMenuSelection.allMode || yearMenuYears.length === allYearValues.length,
  );
  setMenuLabel(
    typeMenuLabel,
    typeMenuText,
    !typeMenuSelection.allMode
    && typeMenuTypes.length > 1
    && typeMenuTypes.length < allTypeValues.length
      ? "Multiple Activities Selected"
      : "",
  );
  setMenuLabel(
    yearMenuLabel,
    yearMenuCustomActive ? "Custom Range" : yearMenuText,
    !yearMenuCustomActive
    && !yearMenuSelection.allMode
    && yearMenuYears.length > 1
    && yearMenuYears.length < allYearValues.length
      ? "Multiple Years Selected"
      : "",
  );
  if (dashboardScopeSummary) {
    dashboardScopeSummary.textContent = getScopeSummaryText(
      typeMenuText,
      yearMenuCustomActive ? "Custom Range" : yearMenuText,
      yearMenuCustomActive ? customRange : null,
    );
  }
  if (typeClearButton) {
    typeClearButton.textContent = "Clear";
    typeClearButton.disabled = allTypesSelected;
  }
  if (yearClearButton) {
    yearClearButton.textContent = yearMenuCustomActive ? "Exit Custom" : "Select All";
    yearClearButton.disabled = !yearMenuCustomActive && allYearsSelected;
  }
  if (keepTypeMenuOpen) {
    setMenuOpenState(typeMenu, typeMenuButton, true);
  }
  if (keepYearMenuOpen) {
    setMenuOpenState(yearMenu, yearMenuButton, true);
  }
}

function setDashboardTitle(source) {
  const provider = providerDisplayName(source);
  const title = "Chronicle View";
  const subtitle = provider
    ? `${provider} activity layers that change how you read your fitness story.`
    : "Activity layers that change how you read your fitness story.";
  if (dashboardTitle) {
    dashboardTitle.textContent = title;
  }
  if (dashboardSubtitle) {
    dashboardSubtitle.textContent = subtitle;
  }
  document.title = provider ? `${provider} Heatmaps` : "Heatmaps";
}

function setDashboardTopStatus(text, tone = "neutral") {
  if (!dashboardTopStatus) return;
  dashboardTopStatus.textContent = String(text || "").trim() || "Ready";
  dashboardTopStatus.setAttribute("data-tone", tone);
}

function applyDashboardTheme(theme) {
  const resolved = theme === "light" ? "light" : "dark";
  document.body.setAttribute("data-theme", resolved);
  if (document.documentElement) {
    document.documentElement.style.colorScheme = resolved;
  }
  if (dashboardThemeToggle) {
    dashboardThemeToggle.checked = resolved === "dark";
  }
}

function readStoredDashboardTheme() {
  try {
    const stored = localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch (_error) {
    // Ignore localStorage errors in restricted browser modes.
  }
  return "dark";
}

function persistDashboardTheme(theme) {
  try {
    localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, theme);
  } catch (_error) {
    // Ignore localStorage errors in restricted browser modes.
  }
}

function normalizeDashboardScopeState(rawState) {
  const next = rawState && typeof rawState === "object" ? rawState : {};
  const scopeMode = next.scopeMode === "custom" ? "custom" : "preset";
  const types = Array.isArray(next.types)
    ? next.types.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const years = Array.isArray(next.years)
    ? next.years.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [];
  const start = normalizeDateKeyInput(next.start);
  const end = normalizeDateKeyInput(next.end);
  return {
    types,
    years,
    scopeMode,
    start: scopeMode === "custom" ? start : "",
    end: scopeMode === "custom" ? end : "",
  };
}

function readStoredDashboardScopeState() {
  try {
    const stored = localStorage.getItem(DASHBOARD_SCOPE_STORAGE_KEY);
    if (!stored) return null;
    return normalizeDashboardScopeState(JSON.parse(stored));
  } catch (_error) {
    try {
      localStorage.removeItem(DASHBOARD_SCOPE_STORAGE_KEY);
    } catch (_storageError) {
      // Ignore localStorage errors in restricted browser modes.
    }
    return null;
  }
}

function persistDashboardScopeState(state) {
  try {
    localStorage.setItem(
      DASHBOARD_SCOPE_STORAGE_KEY,
      JSON.stringify(normalizeDashboardScopeState(state)),
    );
  } catch (_error) {
    // Ignore localStorage errors in restricted browser modes.
  }
}

function parseCsvParam(rawValue) {
  return String(rawValue || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeDateKeyInput(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function getPayloadDateBounds(payload) {
  const dates = (payload.activities || [])
    .map((activity) => normalizeDateKeyInput(activity?.date))
    .filter(Boolean)
    .sort();
  if (!dates.length) {
    return { start: "", end: "" };
  }
  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
}

function normalizeCustomDateRange(start, end, bounds) {
  const fallbackStart = normalizeDateKeyInput(bounds?.start);
  const fallbackEnd = normalizeDateKeyInput(bounds?.end);
  let normalizedStart = normalizeDateKeyInput(start) || fallbackStart;
  let normalizedEnd = normalizeDateKeyInput(end) || fallbackEnd;
  if (!normalizedStart || !normalizedEnd) {
    return { start: "", end: "" };
  }
  if (normalizedStart > normalizedEnd) {
    [normalizedStart, normalizedEnd] = [normalizedEnd, normalizedStart];
  }
  if (fallbackStart && normalizedStart < fallbackStart) {
    normalizedStart = fallbackStart;
  }
  if (fallbackEnd && normalizedEnd > fallbackEnd) {
    normalizedEnd = fallbackEnd;
  }
  if (normalizedStart > normalizedEnd) {
    normalizedStart = normalizedEnd;
  }
  return {
    start: normalizedStart,
    end: normalizedEnd,
  };
}

function isDateWithinRange(dateStr, start, end) {
  const normalizedDate = normalizeDateKeyInput(dateStr);
  if (!normalizedDate || !start || !end) return false;
  return normalizedDate >= start && normalizedDate <= end;
}

function buildDateScopedPayload(payload, start, end) {
  if (!start || !end) return payload;
  const nextAggregates = {};
  const nextYears = new Set();
  Object.entries(payload.aggregates || {}).forEach(([year, yearData]) => {
    const nextYearData = {};
    Object.entries(yearData || {}).forEach(([type, entries]) => {
      const nextEntries = {};
      Object.entries(entries || {}).forEach(([dateKey, entry]) => {
        if (isDateWithinRange(dateKey, start, end)) {
          nextEntries[dateKey] = entry;
          nextYears.add(Number(year));
        }
      });
      if (Object.keys(nextEntries).length) {
        nextYearData[type] = nextEntries;
      }
    });
    if (Object.keys(nextYearData).length) {
      nextAggregates[year] = nextYearData;
    }
  });
  const nextActivities = (payload.activities || []).filter((activity) => isDateWithinRange(activity?.date, start, end));
  return {
    ...payload,
    years: Array.from(nextYears).filter((year) => Number.isFinite(year)).sort((a, b) => b - a),
    aggregates: nextAggregates,
    activities: nextActivities,
  };
}

function readDashboardUrlState() {
  const params = new URLSearchParams(window.location.search);
  const types = parseCsvParam(params.get("types"));
  const years = parseCsvParam(params.get("years"))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const units = params.get("units") === "metric" ? "metric" : params.get("units") === "imperial" ? "imperial" : null;
  const lens = String(params.get("lens") || "").trim() || null;
  const start = normalizeDateKeyInput(params.get("start"));
  const end = normalizeDateKeyInput(params.get("end"));
  return {
    types,
    years,
    units,
    lens,
    start,
    end,
    hasTypesParam: params.has("types"),
    hasYearsParam: params.has("years"),
    hasUnitsParam: params.has("units"),
    hasLensParam: params.has("lens"),
    hasStartParam: params.has("start"),
    hasEndParam: params.has("end"),
  };
}

function syncDashboardUrlState(state) {
  if (!window.history || typeof window.history.replaceState !== "function") {
    return;
  }
  const nextUrl = new URL(window.location.href);
  if (Array.isArray(state.types) && state.types.length) {
    nextUrl.searchParams.set("types", state.types.join(","));
  } else {
    nextUrl.searchParams.delete("types");
  }
  if (Array.isArray(state.years) && state.years.length) {
    nextUrl.searchParams.set("years", state.years.join(","));
  } else {
    nextUrl.searchParams.delete("years");
  }
  if (state.units === "metric" || state.units === "imperial") {
    nextUrl.searchParams.set("units", state.units);
  } else {
    nextUrl.searchParams.delete("units");
  }
  if (typeof state.lens === "string" && state.lens) {
    nextUrl.searchParams.set("lens", state.lens);
  } else {
    nextUrl.searchParams.delete("lens");
  }
  if (typeof state.start === "string" && state.start) {
    nextUrl.searchParams.set("start", state.start);
  } else {
    nextUrl.searchParams.delete("start");
  }
  if (typeof state.end === "string" && state.end) {
    nextUrl.searchParams.set("end", state.end);
  } else {
    nextUrl.searchParams.delete("end");
  }
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const replacementUrl = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  if (replacementUrl !== currentUrl) {
    window.history.replaceState({}, "", replacementUrl);
  }
}

function setDashboardSettingsOpen(open) {
  const expanded = Boolean(open);
  if (dashboardSettingsPanel) {
    dashboardSettingsPanel.setAttribute("aria-hidden", expanded ? "false" : "true");
  }
  if (dashboardSettingsToggle) {
    dashboardSettingsToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  }
}

function setDashboardFilterDrawerOpen(open) {
  const expanded = Boolean(open);
  if (dashboardFilterDrawer) {
    dashboardFilterDrawer.setAttribute("aria-hidden", expanded ? "false" : "true");
  }
  if (dashboardFilterDrawerToggle) {
    dashboardFilterDrawerToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  }
}

function initDashboardChrome() {
  applyDashboardTheme(readStoredDashboardTheme());
  setDashboardSettingsOpen(false);
  setDashboardFilterDrawerOpen(false);

  if (dashboardThemeToggle) {
    dashboardThemeToggle.addEventListener("change", () => {
      const nextTheme = dashboardThemeToggle.checked ? "dark" : "light";
      applyDashboardTheme(nextTheme);
      persistDashboardTheme(nextTheme);
    });
  }

  if (dashboardSettingsToggle) {
    dashboardSettingsToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const panelHidden = dashboardSettingsPanel?.getAttribute("aria-hidden") !== "false";
      setDashboardSettingsOpen(panelHidden);
    });
  }

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (
      dashboardSettingsPanel
      && dashboardSettingsPanel.getAttribute("aria-hidden") === "false"
      && dashboardSettingsToggle
      && !dashboardSettingsPanel.contains(target)
      && !dashboardSettingsToggle.contains(target)
    ) {
      setDashboardSettingsOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setDashboardSettingsOpen(false);
      setDashboardFilterDrawerOpen(false);
    }
  });
}

function readCssVar(name, fallback, scope) {
  const target = scope || document.body || document.documentElement;
  const value = getComputedStyle(target).getPropertyValue(name).trim();
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getLayout(scope) {
  return {
    cell: readCssVar("--cell", 12, scope),
    gap: readCssVar("--gap", 2, scope),
    gridPadTop: readCssVar("--grid-pad-top", 6, scope),
    gridPadLeft: readCssVar("--grid-pad-left", 6, scope),
    gridPadRight: readCssVar("--grid-pad-right", 4, scope),
    gridPadBottom: readCssVar("--grid-pad-bottom", 6, scope),
  };
}

function getElementBoxWidth(element) {
  if (!element) return 0;
  const width = element.getBoundingClientRect().width;
  return Number.isFinite(width) ? width : 0;
}

function getElementContentWidth(element) {
  if (!element) return 0;
  const styles = getComputedStyle(element);
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  const paddingRight = parseFloat(styles.paddingRight) || 0;
  return Math.max(0, element.clientWidth - paddingLeft - paddingRight);
}

function alignFrequencyMetricChipsToSecondGraphAxis(frequencyCard, title, metricChipRow) {
  metricChipRow.style.removeProperty("margin-left");
  const secondGraphYearLabel = frequencyCard.querySelector(
    ".more-stats-grid > .more-stats-col[data-chip-axis-anchor=\"true\"] .axis-day-col .axis-y-label",
  );
  if (!secondGraphYearLabel) return;

  const titleRect = title.getBoundingClientRect();
  const chipRect = metricChipRow.getBoundingClientRect();
  const yearLabelRect = secondGraphYearLabel.getBoundingClientRect();
  const currentLeft = chipRect.left - titleRect.left;
  const targetLeft = yearLabelRect.left - titleRect.left;

  if (!Number.isFinite(currentLeft) || !Number.isFinite(targetLeft)) return;
  const extraOffset = targetLeft - currentLeft;
  if (extraOffset > 0.5) {
    metricChipRow.style.setProperty("margin-left", `${extraOffset}px`);
  }
}

function resetCardLayoutState() {
  if (!heatmaps) return;
  heatmaps.querySelectorAll(".more-stats").forEach((card) => {
    card.classList.remove("more-stats-stacked");
    card.style.removeProperty("--card-graph-rail-width");
    card.style.removeProperty("--frequency-graph-gap");
    card.style.removeProperty("--frequency-grid-pad-right");
    const metricChipRow = card.querySelector(".more-stats-metric-chips");
    const facts = card.querySelector(".more-stats-facts.side-stats-column");
    if (metricChipRow && facts && facts.firstElementChild !== metricChipRow) {
      metricChipRow.style.removeProperty("margin-left");
      facts.insertBefore(metricChipRow, facts.firstChild);
    }
  });
  heatmaps.querySelectorAll(".year-card").forEach((card) => {
    card.classList.remove("year-card-stacked");
    card.style.removeProperty("--card-graph-rail-width");
  });
}

function normalizeSideStatCardSize() {
  if (!heatmaps) return;
  const configuredMinWidth = readCssVar("--side-stat-card-width-min", 0, heatmaps);
  const cards = Array.from(
    heatmaps.querySelectorAll(
      ".year-card .card-stats.side-stats-column .card-stat, .more-stats .more-stats-fact-card",
    ),
  );
  cards.forEach((card) => {
    card.style.removeProperty("width");
    card.style.removeProperty("maxWidth");
    card.style.removeProperty("minHeight");
  });
  if (!cards.length) {
    if (persistentSideStatCardWidth > 0) {
      heatmaps.style.setProperty("--side-stat-card-width", `${persistentSideStatCardWidth}px`);
    } else if (configuredMinWidth > 0) {
      heatmaps.style.setProperty("--side-stat-card-width", `${configuredMinWidth}px`);
    } else {
      heatmaps.style.removeProperty("--side-stat-card-width");
    }
    if (persistentSideStatCardMinHeight > 0) {
      heatmaps.style.setProperty("--side-stat-card-min-height", `${persistentSideStatCardMinHeight}px`);
    } else {
      heatmaps.style.removeProperty("--side-stat-card-min-height");
    }
    return;
  }

  const maxWidth = cards.reduce((acc, card) => Math.max(acc, Math.ceil(getElementBoxWidth(card))), 0);
  const maxHeight = cards.reduce((acc, card) => Math.max(acc, Math.ceil(card.getBoundingClientRect().height || 0)), 0);
  const normalizedWidth = Math.max(maxWidth, Math.ceil(configuredMinWidth));
  persistentSideStatCardWidth = Math.max(persistentSideStatCardWidth, normalizedWidth);
  persistentSideStatCardMinHeight = Math.max(persistentSideStatCardMinHeight, maxHeight);

  if (persistentSideStatCardWidth > 0) {
    heatmaps.style.setProperty("--side-stat-card-width", `${persistentSideStatCardWidth}px`);
  }
  if (persistentSideStatCardMinHeight > 0) {
    heatmaps.style.setProperty("--side-stat-card-min-height", `${persistentSideStatCardMinHeight}px`);
  }
}

function buildSectionLayoutPlan(list) {
  const frequencyCard = list.querySelector(".chronicle-story-patterns");
  const chronicleCard = list.querySelector(":scope > .chronicle-stage");
  if (!frequencyCard && !chronicleCard) return null;

  let graphRailWidth = chronicleCard
    ? getElementBoxWidth(chronicleCard.querySelector(".chronicle-stage-graph-shell"))
    : 0;
  let frequencyGap = null;
  let frequencyPadRight = null;

  if (frequencyCard) {
    const frequencyCols = Array.from(frequencyCard.querySelectorAll(".more-stats-grid > .more-stats-col"));
    const columnWidths = frequencyCols
      .map((col) => getElementBoxWidth(col))
      .filter((width) => width > 0);
    const graphCount = columnWidths.length;
    const totalFrequencyGraphWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    if (!graphRailWidth && totalFrequencyGraphWidth > 0) {
      const baseGap = readCssVar("--frequency-graph-gap-base", 12, frequencyCard);
      graphRailWidth = totalFrequencyGraphWidth + (Math.max(0, graphCount - 1) * baseGap);
    }

    if (graphRailWidth > 0 && totalFrequencyGraphWidth > 0) {
      const totalGap = Math.max(0, graphRailWidth - totalFrequencyGraphWidth);
      if (graphCount > 1) {
        const gapCount = graphCount - 1;
        const desiredTrailingPad = isNarrowLayoutViewport()
          ? 0
          : readCssVar("--year-grid-pad-right", 0, frequencyCard);
        const trailingPad = Math.max(0, Math.min(totalGap, desiredTrailingPad));
        const distributableGap = Math.max(0, totalGap - trailingPad);
        // Reserve trailing right gutter first so the third graph rail stays aligned with yearly rails.
        frequencyGap = distributableGap / gapCount;
        frequencyPadRight = trailingPad;
      } else {
        frequencyPadRight = totalGap;
      }
    }
  }

  return {
    frequencyCard,
    graphRailWidth,
    frequencyGap,
    frequencyPadRight,
  };
}

function applySectionLayoutPlan(plan) {
  const {
    frequencyCard,
    graphRailWidth,
    frequencyGap,
    frequencyPadRight,
  } = plan;

  if (frequencyCard) {
    if (graphRailWidth > 0) {
      frequencyCard.style.setProperty("--card-graph-rail-width", `${graphRailWidth}px`);
    } else {
      frequencyCard.style.removeProperty("--card-graph-rail-width");
    }
    if (Number.isFinite(frequencyGap)) {
      frequencyCard.style.setProperty("--frequency-graph-gap", `${Math.max(0, frequencyGap)}px`);
    } else {
      frequencyCard.style.removeProperty("--frequency-graph-gap");
    }
    if (Number.isFinite(frequencyPadRight)) {
      frequencyCard.style.setProperty("--frequency-grid-pad-right", `${Math.max(0, frequencyPadRight)}px`);
    } else {
      frequencyCard.style.removeProperty("--frequency-grid-pad-right");
    }
    frequencyCard.classList.remove("more-stats-stacked");
  }
}

function alignStackedStatsToYAxisLabels() {
  if (!heatmaps) return;
  resetCardLayoutState();
  normalizeSideStatCardSize();

  const plans = Array.from(heatmaps.querySelectorAll(".type-list"))
    .map((list) => buildSectionLayoutPlan(list))
    .filter(Boolean);

  plans.forEach((plan) => {
    applySectionLayoutPlan(plan);
  });
}

function sundayOnOrBefore(d) {
  const day = d.getDay();
  const offset = day % 7; // Sunday=0
  const result = new Date(d);
  result.setDate(d.getDate() - offset);
  return result;
}

function localDayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

function weekIndexFromSundayStart(date, start) {
  return Math.floor((localDayNumber(date) - localDayNumber(start)) / 7);
}

function weekOfYear(date) {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const start = sundayOnOrBefore(yearStart);
  return weekIndexFromSundayStart(date, start) + 1;
}

function utcDateFromParts(year, monthIndex, dayOfMonth) {
  return new Date(Date.UTC(year, monthIndex, dayOfMonth));
}

function formatUtcDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function utcDayNumber(date) {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY);
}

function weekdayRowFromStart(utcDayIndex, weekStart) {
  if (normalizeWeekStart(weekStart) === WEEK_START_MONDAY) {
    return (utcDayIndex + 6) % 7;
  }
  return utcDayIndex;
}

function weekStartOnOrBeforeUtc(date, weekStart) {
  const offset = weekdayRowFromStart(date.getUTCDay(), weekStart);
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() - offset);
  return result;
}

function weekEndOnOrAfterUtc(date, weekStart) {
  const offset = weekdayRowFromStart(date.getUTCDay(), weekStart);
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + (6 - offset));
  return result;
}

function weekIndexFromWeekStartUtc(date, start) {
  return Math.floor((utcDayNumber(date) - utcDayNumber(start)) / 7);
}

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function heatColor(hex, value, max) {
  if (max <= 0) return DEFAULT_COLORS[0];
  if (value <= 0) return "#0f172a";
  const rgb = hexToRgb(hex);
  const base = hexToRgb("#0f172a");
  if (!rgb || !base) return hex;
  const intensity = Math.pow(Math.min(value / max, 1), 0.75);
  const r = Math.round(base.r + (rgb.r - base.r) * intensity);
  const g = Math.round(base.g + (rgb.g - base.g) * intensity);
  const b = Math.round(base.b + (rgb.b - base.b) * intensity);
  return `rgb(${r}, ${g}, ${b})`;
}

function updateMetricRange(metricRangeByKey, key, value) {
  if (!metricRangeByKey || !key) return;
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return;
  const current = metricRangeByKey[key];
  if (!current) {
    metricRangeByKey[key] = { min: numeric, max: numeric };
    return;
  }
  if (numeric < current.min) current.min = numeric;
  if (numeric > current.max) current.max = numeric;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getViewportMetrics() {
  const viewport = useTouchInteractions ? window.visualViewport : null;
  if (!viewport) {
    return {
      offsetLeft: 0,
      offsetTop: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }
  return {
    offsetLeft: Number.isFinite(viewport.offsetLeft) ? viewport.offsetLeft : 0,
    offsetTop: Number.isFinite(viewport.offsetTop) ? viewport.offsetTop : 0,
    width: Number.isFinite(viewport.width) ? viewport.width : window.innerWidth,
    height: Number.isFinite(viewport.height) ? viewport.height : window.innerHeight,
  };
}

function tooltipViewportAnchorOffset(viewport) {
  if (!useTouchInteractions) {
    return { x: 0, y: 0 };
  }
  return {
    x: Number.isFinite(viewport?.offsetLeft) ? viewport.offsetLeft : 0,
    y: Number.isFinite(viewport?.offsetTop) ? viewport.offsetTop : 0,
  };
}

function pickTooltipCoordinate(preferred, alternate, min, max) {
  const preferredFits = preferred >= min && preferred <= max;
  if (preferredFits) {
    return preferred;
  }
  const alternateFits = alternate >= min && alternate <= max;
  if (alternateFits) {
    return alternate;
  }
  const clampedPreferred = clamp(preferred, min, max);
  const clampedAlternate = clamp(alternate, min, max);
  return Math.abs(clampedPreferred - preferred) <= Math.abs(clampedAlternate - alternate)
    ? clampedPreferred
    : clampedAlternate;
}

function getTouchTooltipScale() {
  if (!useTouchInteractions) {
    return 1;
  }
  const viewport = window.visualViewport;
  const scale = Number(viewport?.scale);
  if (!Number.isFinite(scale) || scale <= 0) {
    return 1;
  }
  const desiredScale = TOUCH_TOOLTIP_MAX_EFFECTIVE_ZOOM / scale;
  return clamp(desiredScale, TOUCH_TOOLTIP_MIN_SCALE, 1);
}

function updateDesktopTooltipBounds() {
  if (useTouchInteractions) return;
  const padding = 12;
  const viewport = getViewportMetrics();
  const maxWidth = Math.max(200, Math.floor(viewport.width - (padding * 2)));
  const maxHeight = Math.max(120, Math.floor(viewport.height - (padding * 2)));
  tooltip.style.maxWidth = `${maxWidth}px`;
  tooltip.style.maxHeight = `${maxHeight}px`;
  tooltip.style.overflowY = "auto";
  tooltip.style.overflowX = "hidden";
}

function positionTooltip(x, y) {
  const padding = 12;
  const rect = tooltip.getBoundingClientRect();
  const rectWidth = Number.isFinite(rect.width) && rect.width > 0
    ? rect.width
    : Math.max(0, Number(tooltip.offsetWidth || 0));
  const rectHeight = Number.isFinite(rect.height) && rect.height > 0
    ? rect.height
    : Math.max(0, Number(tooltip.offsetHeight || 0));
  const viewport = getViewportMetrics();
  const anchorOffset = tooltipViewportAnchorOffset(viewport);
  const anchorX = x + anchorOffset.x;
  const anchorY = y + anchorOffset.y;
  const minX = anchorOffset.x + padding;
  const minY = anchorOffset.y + padding;
  const maxX = Math.max(minX, anchorOffset.x + viewport.width - rectWidth - padding);
  const maxY = Math.max(minY, anchorOffset.y + viewport.height - rectHeight - padding);
  const preferredLeft = anchorX + padding;
  const alternateLeft = anchorX - rectWidth - padding;
  const left = pickTooltipCoordinate(preferredLeft, alternateLeft, minX, maxX);
  const preferredTop = useTouchInteractions
    ? (anchorY - rectHeight - padding)
    : (anchorY + padding);
  const alternateTop = useTouchInteractions
    ? (anchorY + padding)
    : (anchorY - rectHeight - padding);
  const top = pickTooltipCoordinate(preferredTop, alternateTop, minY, maxY);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.bottom = "auto";
  const finalRect = tooltip.getBoundingClientRect();
  const finalMaxX = Math.max(minX, anchorOffset.x + viewport.width - finalRect.width - padding);
  const finalMaxY = Math.max(minY, anchorOffset.y + viewport.height - finalRect.height - padding);
  const finalPreferredLeft = anchorX + padding;
  const finalAlternateLeft = anchorX - finalRect.width - padding;
  const adjustedLeft = pickTooltipCoordinate(finalPreferredLeft, finalAlternateLeft, minX, finalMaxX);
  const finalPreferredTop = useTouchInteractions
    ? (anchorY - finalRect.height - padding)
    : (anchorY + padding);
  const finalAlternateTop = useTouchInteractions
    ? (anchorY + padding)
    : (anchorY - finalRect.height - padding);
  const adjustedTop = pickTooltipCoordinate(finalPreferredTop, finalAlternateTop, minY, finalMaxY);
  if (Math.abs(adjustedLeft - finalRect.left) > 0.5) {
    tooltip.style.left = `${adjustedLeft}px`;
  }
  if (Math.abs(adjustedTop - finalRect.top) > 0.5) {
    tooltip.style.top = `${adjustedTop}px`;
  }
  if (!useTouchInteractions && window.visualViewport) {
    const visualViewport = window.visualViewport;
    const vvLeft = Number.isFinite(visualViewport.offsetLeft) ? visualViewport.offsetLeft : 0;
    const vvTop = Number.isFinite(visualViewport.offsetTop) ? visualViewport.offsetTop : 0;
    const vvWidth = Number.isFinite(visualViewport.width) ? visualViewport.width : viewport.width;
    const vvHeight = Number.isFinite(visualViewport.height) ? visualViewport.height : viewport.height;
    const afterClampRect = tooltip.getBoundingClientRect();
    const vvMinX = vvLeft + padding;
    const vvMinY = vvTop + padding;
    const vvMaxX = Math.max(vvMinX, vvLeft + vvWidth - afterClampRect.width - padding);
    const vvMaxY = Math.max(vvMinY, vvTop + vvHeight - afterClampRect.height - padding);
    const vvPreferredLeft = anchorX + padding;
    const vvAlternateLeft = anchorX - afterClampRect.width - padding;
    const vvAdjustedLeft = pickTooltipCoordinate(vvPreferredLeft, vvAlternateLeft, vvMinX, vvMaxX);
    const vvPreferredTop = anchorY + padding;
    const vvAlternateTop = anchorY - afterClampRect.height - padding;
    const vvAdjustedTop = pickTooltipCoordinate(vvPreferredTop, vvAlternateTop, vvMinY, vvMaxY);
    if (Math.abs(vvAdjustedLeft - afterClampRect.left) > 0.5) {
      tooltip.style.left = `${vvAdjustedLeft}px`;
    }
    if (Math.abs(vvAdjustedTop - afterClampRect.top) > 0.5) {
      tooltip.style.top = `${vvAdjustedTop}px`;
    }
  }
}

function updateTouchTooltipWrapMode() {
  if (!useTouchInteractions) return;
  const padding = 12;
  const viewport = getViewportMetrics();
  const anchorOffset = tooltipViewportAnchorOffset(viewport);
  const touchTooltipScale = getTouchTooltipScale();
  const effectiveScale = touchTooltipScale > 0 ? touchTooltipScale : 1;
  const availableWidth = Math.max(0, viewport.width - (padding * 2));
  const availableHeight = Math.max(0, viewport.height - (padding * 2));
  const scaledAvailableWidth = Math.max(0, Math.floor(availableWidth / effectiveScale));
  const scaledAvailableHeight = Math.max(0, Math.floor(availableHeight / effectiveScale));
  if (availableHeight > 0) {
    const preferredMaxHeight = Math.max(120, Math.floor((viewport.height * 0.7) / effectiveScale));
    const maxHeight = Math.min(scaledAvailableHeight, preferredMaxHeight);
    tooltip.style.maxHeight = `${maxHeight}px`;
    tooltip.style.overflowY = "auto";
    tooltip.style.removeProperty("overflow-x");
  } else {
    tooltip.style.removeProperty("max-height");
    tooltip.style.removeProperty("overflow-y");
    tooltip.style.removeProperty("overflow-x");
  }
  if (availableWidth <= 0) {
    tooltip.style.removeProperty("max-width");
    tooltip.classList.remove("nowrap");
    return;
  }
  const maxWidth = scaledAvailableWidth;
  tooltip.style.maxWidth = `${maxWidth}px`;

  tooltip.classList.remove("nowrap");
  tooltip.style.left = `${anchorOffset.x + padding}px`;
  tooltip.style.top = `${anchorOffset.y + padding}px`;
  tooltip.style.bottom = "auto";
  tooltip.style.right = "auto";

  tooltip.classList.add("nowrap");
  const nowrapWidth = Math.max(0, Number(tooltip.scrollWidth || 0));
  if (!nowrapWidth || nowrapWidth > maxWidth) {
    tooltip.classList.remove("nowrap");
    tooltip.style.overflowX = "hidden";
  } else {
    tooltip.style.removeProperty("overflow-x");
  }
}

function normalizeTooltipHref(value) {
  const parsed = parseStravaActivityUrl(value);
  return parsed?.href || "";
}

function normalizeTooltipLine(line) {
  if (Array.isArray(line)) {
    return line.map((segment) => {
      if (segment && typeof segment === "object") {
        return {
          text: String(segment.text ?? ""),
          href: normalizeTooltipHref(segment.href),
        };
      }
      return { text: String(segment ?? ""), href: "" };
    });
  }
  return [{ text: String(line ?? ""), href: "" }];
}

function normalizeTooltipContent(content) {
  if (content && typeof content === "object" && Array.isArray(content.lines)) {
    return content.lines.map((line) => normalizeTooltipLine(line));
  }
  if (Array.isArray(content)) {
    return content.map((line) => normalizeTooltipLine(line));
  }
  return String(content ?? "").split("\n").map((line) => normalizeTooltipLine(line));
}

function rememberTooltipPointerType(event) {
  const pointerType = String(event?.pointerType || "").trim().toLowerCase();
  if (pointerType) {
    lastTooltipPointerType = pointerType;
    return;
  }
  const type = String(event?.type || "").trim().toLowerCase();
  if (type.startsWith("touch")) {
    lastTooltipPointerType = "touch";
  }
}

function isTouchTooltipActivationEvent(event) {
  const pointerType = String(event?.pointerType || "").trim().toLowerCase();
  if (pointerType) {
    return pointerType === "touch" || pointerType === "pen";
  }
  if (lastTooltipPointerType) {
    return lastTooltipPointerType === "touch" || lastTooltipPointerType === "pen";
  }
  if (event?.sourceCapabilities && event.sourceCapabilities.firesTouchEvents === true) {
    return true;
  }
  return useTouchInteractions;
}

function renderTooltipContent(content) {
  const normalizedLines = normalizeTooltipContent(content);
  tooltip.innerHTML = "";
  let hasLinks = false;
  normalizedLines.forEach((line) => {
    const lineEl = document.createElement("div");
    lineEl.className = "tooltip-line";
    if (!line.length) {
      lineEl.textContent = "";
      tooltip.appendChild(lineEl);
      return;
    }
    line.forEach((segment) => {
      const text = String(segment?.text ?? "");
      const href = normalizeTooltipHref(segment?.href);
      if (href) {
        hasLinks = true;
        const link = document.createElement("a");
        link.className = "tooltip-link";
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.addEventListener(
          "touchstart",
          (event) => {
            rememberTooltipPointerType(event);
            event.stopPropagation();
            markTouchTooltipInteractionBlock(1600);
          },
          { passive: true },
        );
        link.addEventListener("pointerdown", (event) => {
          rememberTooltipPointerType(event);
          event.stopPropagation();
          if (isTouchTooltipActivationEvent(event)) {
            markTouchTooltipInteractionBlock(1600);
          }
        });
        link.addEventListener(
          "touchend",
          (event) => {
            rememberTooltipPointerType(event);
            if (!isTouchTooltipActivationEvent(event)) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            markTouchTooltipInteractionBlock(1600);
            markTouchTooltipLinkClickSuppress(1200);
            openTooltipLinkInCurrentTab(link);
          },
          { passive: false },
        );
        link.addEventListener("click", (event) => {
          if (shouldSuppressTouchTooltipLinkClick() && isTouchTooltipActivationEvent(event)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          handleTooltipLinkActivation(event);
        });
        link.textContent = text;
        lineEl.appendChild(link);
      } else {
        lineEl.appendChild(document.createTextNode(text));
      }
    });
    tooltip.appendChild(lineEl);
  });
  return { hasLinks };
}

function isTooltipPinned() {
  return Boolean(pinnedTooltipCell);
}

function clearPinnedTooltipCell() {
  if (!pinnedTooltipCell) return;
  pinnedTooltipCell.classList.remove("active");
  pinnedTooltipCell = null;
}

function showTooltip(content, x, y, options = {}) {
  const { interactive = false } = options;
  const rendered = renderTooltipContent(content);
  const allowInteraction = rendered.hasLinks && (useTouchInteractions || interactive);
  tooltip.classList.toggle("interactive", allowInteraction);
  if (useTouchInteractions) {
    tooltip.classList.add("touch");
    const touchTooltipScale = getTouchTooltipScale();
    tooltip.style.transformOrigin = "top left";
    if (touchTooltipScale === 1) {
      tooltip.style.removeProperty("transform");
    } else {
      tooltip.style.transform = `scale(${touchTooltipScale})`;
    }
  } else {
    tooltip.classList.remove("touch");
    updateDesktopTooltipBounds();
    tooltip.style.transform = "none";
    tooltip.style.removeProperty("transform-origin");
  }
  tooltip.classList.add("visible");
  if (useTouchInteractions) {
    updateTouchTooltipWrapMode();
  }
  pendingTooltipPoint = { x, y };
  if (tooltipPositionFrame !== null) {
    window.cancelAnimationFrame(tooltipPositionFrame);
    tooltipPositionFrame = null;
  }
  if (tooltipSettleFrame !== null) {
    window.cancelAnimationFrame(tooltipSettleFrame);
    tooltipSettleFrame = null;
  }
  tooltipPositionFrame = window.requestAnimationFrame(() => {
    tooltipPositionFrame = null;
    if (!pendingTooltipPoint) return;
    positionTooltip(pendingTooltipPoint.x, pendingTooltipPoint.y);
    tooltipSettleFrame = window.requestAnimationFrame(() => {
      tooltipSettleFrame = null;
      if (!pendingTooltipPoint) return;
      positionTooltip(pendingTooltipPoint.x, pendingTooltipPoint.y);
    });
  });
}

function hideTooltip() {
  if (tooltipPositionFrame !== null) {
    window.cancelAnimationFrame(tooltipPositionFrame);
    tooltipPositionFrame = null;
  }
  if (tooltipSettleFrame !== null) {
    window.cancelAnimationFrame(tooltipSettleFrame);
    tooltipSettleFrame = null;
  }
  pendingTooltipPoint = null;
  tooltip.classList.remove("visible");
  tooltip.classList.remove("nowrap");
  tooltip.classList.remove("interactive");
  tooltip.innerHTML = "";
}

function clearActiveTouchCell() {
  const active = document.querySelector(".cell.active");
  if (active) active.classList.remove("active");
}

function dismissTooltipState() {
  clearPinnedTooltipCell();
  clearActiveTouchCell();
  hideTooltip();
}

function nowMs() {
  return (window.performance && typeof window.performance.now === "function")
    ? window.performance.now()
    : Date.now();
}

function markTouchTooltipDismissBlock(durationMs = 450) {
  if (!useTouchInteractions) return;
  const blockUntil = nowMs() + Math.max(0, Number(durationMs) || 0);
  touchTooltipDismissBlockUntil = Math.max(touchTooltipDismissBlockUntil, blockUntil);
}

function shouldIgnoreTouchTooltipDismiss() {
  if (!useTouchInteractions) return false;
  return nowMs() <= touchTooltipDismissBlockUntil;
}

function markTouchTooltipLinkClickSuppress(durationMs = 1200) {
  if (!useTouchInteractions) return;
  const blockUntil = nowMs() + Math.max(0, Number(durationMs) || 0);
  touchTooltipLinkClickSuppressUntil = Math.max(touchTooltipLinkClickSuppressUntil, blockUntil);
}

function shouldSuppressTouchTooltipLinkClick() {
  if (!useTouchInteractions) return false;
  return nowMs() <= touchTooltipLinkClickSuppressUntil;
}

function markTouchTooltipCellPointerUp(cell, durationMs = 700, wasTap = true) {
  if (!useTouchInteractions) return;
  if (!cell) return;
  touchTooltipRecentPointerUpCell = cell;
  touchTooltipRecentPointerUpUntil = nowMs() + Math.max(0, Number(durationMs) || 0);
  touchTooltipRecentPointerUpWasTap = Boolean(wasTap);
}

function shouldSuppressTouchTooltipCellClick(event, cell) {
  if (!useTouchInteractions) return false;
  if (!cell) return false;
  if (!isTouchTooltipActivationEvent(event)) return false;
  if (nowMs() > touchTooltipRecentPointerUpUntil) {
    return false;
  }
  if (!touchTooltipRecentPointerUpWasTap) {
    return true;
  }
  if (!touchTooltipRecentPointerUpCell || touchTooltipRecentPointerUpCell !== cell) {
    return false;
  }
  return true;
}

function markTouchTooltipCellPointerDown(event, cell) {
  if (!useTouchInteractions) return;
  if (!cell) return;
  if (!isTouchTooltipActivationEvent(event)) return;
  const pointerId = Number(event?.pointerId);
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  const scrollHost = typeof cell.closest === "function"
    ? cell.closest(".card")
    : null;
  touchTooltipPointerDownState = {
    pointerId: Number.isFinite(pointerId) ? pointerId : null,
    clientX: Number.isFinite(clientX) ? clientX : null,
    clientY: Number.isFinite(clientY) ? clientY : null,
    viewportX: window.scrollX || window.pageXOffset || 0,
    viewportY: window.scrollY || window.pageYOffset || 0,
    scrollHost,
    scrollLeft: scrollHost ? Number(scrollHost.scrollLeft || 0) : 0,
    scrollTop: scrollHost ? Number(scrollHost.scrollTop || 0) : 0,
  };
}

function wasTouchTooltipCellTapGesture(event) {
  const state = touchTooltipPointerDownState;
  if (!state) {
    return true;
  }

  const pointerId = Number(event?.pointerId);
  if (state.pointerId !== null && Number.isFinite(pointerId) && pointerId !== state.pointerId) {
    return false;
  }

  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  const movedByPointer = Number.isFinite(clientX)
    && Number.isFinite(clientY)
    && state.clientX !== null
    && state.clientY !== null
    && (
      Math.abs(clientX - state.clientX) > TOUCH_TOOLTIP_TAP_MAX_MOVE_PX
      || Math.abs(clientY - state.clientY) > TOUCH_TOOLTIP_TAP_MAX_MOVE_PX
    );

  const viewportX = window.scrollX || window.pageXOffset || 0;
  const viewportY = window.scrollY || window.pageYOffset || 0;
  const viewportMoved = Math.abs(viewportX - state.viewportX) > TOUCH_TOOLTIP_TAP_MAX_SCROLL_PX
    || Math.abs(viewportY - state.viewportY) > TOUCH_TOOLTIP_TAP_MAX_SCROLL_PX;

  let scrollHostMoved = false;
  if (state.scrollHost && state.scrollHost.isConnected) {
    const hostScrollLeft = Number(state.scrollHost.scrollLeft || 0);
    const hostScrollTop = Number(state.scrollHost.scrollTop || 0);
    scrollHostMoved = Math.abs(hostScrollLeft - state.scrollLeft) > TOUCH_TOOLTIP_TAP_MAX_SCROLL_PX
      || Math.abs(hostScrollTop - state.scrollTop) > TOUCH_TOOLTIP_TAP_MAX_SCROLL_PX;
  }

  return !(movedByPointer || viewportMoved || scrollHostMoved);
}

function resolveTouchTooltipCellPointerUpTap(event) {
  if (!useTouchInteractions) return true;
  const wasTap = wasTouchTooltipCellTapGesture(event);
  touchTooltipPointerDownState = null;
  return wasTap;
}

function markTouchTooltipInteractionBlock(durationMs = 450) {
  if (!useTouchInteractions) return;
  const blockUntil = nowMs() + Math.max(0, Number(durationMs) || 0);
  touchTooltipInteractionBlockUntil = Math.max(touchTooltipInteractionBlockUntil, blockUntil);
  touchTooltipDismissBlockUntil = Math.max(touchTooltipDismissBlockUntil, blockUntil);
}

function shouldIgnoreTouchCellClick() {
  if (!useTouchInteractions) return false;
  return nowMs() <= touchTooltipInteractionBlockUntil;
}

function hasActiveTooltipCell() {
  if (!useTouchInteractions) return false;
  return Boolean(document.querySelector(".cell.active"));
}

function resolveTooltipTargetElement(target) {
  return target?.nodeType === Node.TEXT_NODE
    ? target.parentElement
    : target;
}

function tooltipLinkElementFromEventTarget(target) {
  const resolvedTarget = resolveTooltipTargetElement(target);
  if (!resolvedTarget || typeof resolvedTarget.closest !== "function") {
    return null;
  }
  const linkElement = resolvedTarget.closest(".tooltip-link");
  return linkElement || null;
}

function openTooltipLinkInNewTab(linkElement) {
  const href = normalizeTooltipHref(linkElement?.href || linkElement?.getAttribute?.("href"));
  if (!href) return false;
  let opened = null;
  try {
    opened = window.open(href, "_blank", "noopener,noreferrer");
  } catch (_) {
    opened = null;
  }
  if (opened && typeof opened === "object") {
    try {
      opened.opener = null;
    } catch (_) {
      // Ignore cross-origin access errors; noopener is already requested.
    }
    return true;
  }
  return false;
}

function openTooltipLinkInCurrentTab(linkElement) {
  const href = normalizeTooltipHref(linkElement?.href || linkElement?.getAttribute?.("href"));
  if (!href) return false;
  if (window.location && typeof window.location.assign === "function") {
    window.location.assign(href);
  } else if (window.location) {
    window.location.href = href;
  }
  return true;
}

function handleTooltipLinkActivation(event) {
  const linkElement = tooltipLinkElementFromEventTarget(event.target);
  if (!linkElement) {
    return false;
  }
  rememberTooltipPointerType(event);
  event.stopPropagation();
  if (isTouchTooltipActivationEvent(event)) {
    if (shouldSuppressTouchTooltipLinkClick()) {
      event.preventDefault();
      return true;
    }
    // Mobile/touch: force same-tab navigation so universal links can hand off to provider apps.
    event.preventDefault();
    markTouchTooltipInteractionBlock(1600);
    markTouchTooltipLinkClickSuppress(1200);
    openTooltipLinkInCurrentTab(linkElement);
    return true;
  }
  // Desktop/mouse: open explicitly in a new tab and never navigate current tab.
  event.preventDefault();
  openTooltipLinkInNewTab(linkElement);
  window.setTimeout(() => {
    dismissTooltipState();
  }, 0);
  return true;
}

function getTooltipEventPoint(event, fallbackElement) {
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    return { x: clientX, y: clientY };
  }
  const rect = fallbackElement?.getBoundingClientRect?.();
  if (!rect) {
    const viewport = getViewportMetrics();
    return { x: viewport.width / 2, y: viewport.height / 2 };
  }
  return {
    x: rect.left + (rect.width / 2),
    y: rect.top + (rect.height / 2),
  };
}

function attachTooltip(cell, text) {
  if (!text) return;
  if (!useTouchInteractions) {
    cell.addEventListener("mouseenter", (event) => {
      if (isTooltipPinned()) return;
      if (hasActiveTooltipCell()) return;
      showTooltip(text, event.clientX, event.clientY);
    });
    cell.addEventListener("mousemove", (event) => {
      if (isTooltipPinned()) return;
      if (hasActiveTooltipCell()) return;
      showTooltip(text, event.clientX, event.clientY);
    });
    cell.addEventListener("mouseleave", () => {
      if (isTooltipPinned()) return;
      if (hasActiveTooltipCell()) return;
      hideTooltip();
    });
    return;
  }
  const handleTouchCellSelection = (event) => {
    if (shouldIgnoreTouchCellClick()) {
      event.stopPropagation();
      return;
    }
    markTouchTooltipDismissBlock(900);
    if (cell.classList.contains("active")) {
      // Keep touch selection stable; outside tap or another cell tap clears it.
      return;
    }
    clearActiveTouchCell();
    cell.classList.add("active");
    const point = getTooltipEventPoint(event, cell);
    showTooltip(text, point.x, point.y);
  };
  cell.addEventListener("pointerdown", (event) => {
    rememberTooltipPointerType(event);
    markTouchTooltipCellPointerDown(event, cell);
  });
  cell.addEventListener("pointerup", (event) => {
    rememberTooltipPointerType(event);
    if (!isTouchTooltipActivationEvent(event)) {
      return;
    }
    const wasTap = resolveTouchTooltipCellPointerUpTap(event);
    markTouchTooltipCellPointerUp(cell, 700, wasTap);
    if (!wasTap) {
      event.stopPropagation();
      return;
    }
    handleTouchCellSelection(event);
  });
  cell.addEventListener("pointercancel", (event) => {
    rememberTooltipPointerType(event);
    if (!isTouchTooltipActivationEvent(event)) {
      return;
    }
    resolveTouchTooltipCellPointerUpTap(event);
    markTouchTooltipCellPointerUp(cell, 700, false);
  });
  cell.addEventListener("click", (event) => {
    rememberTooltipPointerType(event);
    if (shouldSuppressTouchTooltipCellClick(event, cell)) {
      event.stopPropagation();
      return;
    }
    handleTouchCellSelection(event);
  });
}

function getColors(type) {
  const accent = TYPE_META[type]?.accent || fallbackColor(type);
  return [DEFAULT_COLORS[0], DEFAULT_COLORS[1], DEFAULT_COLORS[2], DEFAULT_COLORS[3], accent];
}

function buildMultiTypeBackgroundImage(types) {
  const accentColors = Array.from(new Set((types || [])
    .map((type) => getColors(type)[4])
    .filter(Boolean)));
  if (!accentColors.length) return "";
  if (accentColors.length === 1) return "";
  if (accentColors.length === 2) {
    return `linear-gradient(135deg, ${accentColors[0]} 0 50%, ${accentColors[1]} 50% 100%)`;
  }
  const step = 100 / accentColors.length;
  const stops = accentColors.map((color, index) => {
    const start = (index * step).toFixed(2);
    const end = ((index + 1) * step).toFixed(2);
    return `${color} ${start}% ${end}%`;
  });
  return `conic-gradient(from 225deg, ${stops.join(", ")})`;
}

function displayType(type) {
  return capitalizeLabelStart(TYPE_META[type]?.label || prettifyType(type));
}

function summaryTypeTitle(type) {
  return displayType(type);
}

function pluralizeLabel(label) {
  if (/(s|x|z|ch|sh)$/i.test(label)) return `${label}es`;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

function getTypeCountNouns(type) {
  if (!type || type === "all") {
    return { singular: "activity", plural: "activities" };
  }

  const meta = TYPE_META[type] || {};
  const singularMeta = String(meta.count_singular || meta.singular || "").trim().toLowerCase();
  const pluralMeta = String(meta.count_plural || meta.plural || "").trim().toLowerCase();
  if (singularMeta && pluralMeta) {
    return { singular: singularMeta, plural: pluralMeta };
  }

  const baseLabel = String(singularMeta || meta.label || prettifyType(type)).trim().toLowerCase();
  if (!baseLabel) {
    return { singular: "activity", plural: "activities" };
  }
  if (pluralMeta) {
    return { singular: baseLabel, plural: pluralMeta };
  }

  if (isOtherSportsType(type) || baseLabel.includes(" ") || /(ing|ion)$/i.test(baseLabel)) {
    return {
      singular: `${baseLabel} activity`,
      plural: `${baseLabel} activities`,
    };
  }

  return {
    singular: baseLabel,
    plural: pluralizeLabel(baseLabel),
  };
}

function formatActivityCountLabel(count, types = []) {
  if (Array.isArray(types) && types.length === 1) {
    const nouns = getTypeCountNouns(types[0]);
    return `${count} ${count === 1 ? nouns.singular : nouns.plural}`;
  }
  return `${count} ${count === 1 ? "Activity" : "Activities"}`;
}

function formatDisplayDate(dateStr) {
  const value = String(dateStr || "").trim();
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DASHBOARD_DATE_FORMATTER.format(date);
}

function fallbackColor(type) {
  if (!type) return FALLBACK_VAPORWAVE[0];
  let index = 0;
  for (let i = 0; i < type.length; i += 1) {
    index += (i + 1) * type.charCodeAt(i);
  }
  return FALLBACK_VAPORWAVE[index % FALLBACK_VAPORWAVE.length];
}

function prettifyType(type) {
  const value = String(type || "Other").trim();
  return capitalizeLabelStart(value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim());
}

function capitalizeLabelStart(label) {
  const value = String(label || "").trim();
  if (!value) return "Other";
  const firstLetterIndex = value.search(/[a-z]/i);
  if (firstLetterIndex < 0) return value;
  return `${value.slice(0, firstLetterIndex)}${value[firstLetterIndex].toUpperCase()}${value.slice(firstLetterIndex + 1)}`;
}

function formatNumber(value, fractionDigits) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  }).format(value);
}

function formatDistance(meters, units) {
  if (units.distance === "km") {
    return `${formatNumber(meters / 1000, 1)} km`;
  }
  return `${formatNumber(meters / 1609.344, 1)} mi`;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${formatNumber(hours, 0)}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

function formatElevation(meters, units) {
  if (units.elevation === "m") {
    return `${formatNumber(Math.round(meters), 0)} m`;
  }
  return `${formatNumber(Math.round(meters * 3.28084), 0)} ft`;
}

function formatPaceFromMps(valueMps, units) {
  const speed = Number(valueMps || 0);
  if (!(speed > 0)) {
    return STAT_PLACEHOLDER;
  }
  const metersPerUnit = units?.distance === "km" ? 1000 : 1609.344;
  const secondsPerUnit = metersPerUnit / speed;
  if (!(secondsPerUnit > 0) || !Number.isFinite(secondsPerUnit)) {
    return STAT_PLACEHOLDER;
  }
  const totalSeconds = Math.round(secondsPerUnit);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const unitLabel = units?.distance === "km" ? "km" : "mi";
  return `${minutes}:${String(seconds).padStart(2, "0")}/${unitLabel}`;
}

function derivePaceMpsFromEntry(entry) {
  if (!entry || typeof entry !== "object") return 0;
  const explicit = Number(entry[PACE_METRIC_KEY] || 0);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  const distance = Number(entry.distance || 0);
  const movingTime = Number(entry.moving_time || 0);
  if (distance > 0 && movingTime > 0) {
    return distance / movingTime;
  }
  return 0;
}

function formatEfficiency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return STAT_PLACEHOLDER;
  }
  return formatNumber(numeric, 2);
}

function getChronicleLensMeta(metricKey, fallbackAccent = MULTI_TYPE_COLOR) {
  if (metricKey && CHRONICLE_LENS_META[metricKey]) {
    return CHRONICLE_LENS_META[metricKey];
  }
  return {
    title: "Activity Lens",
    summary: "Read the same training story through a steadier default activity view.",
    accent: fallbackAccent || MULTI_TYPE_COLOR,
  };
}

function buildYearMetricStatItems(totals, units, activeMetricKey, options = {}) {
  const intervalsEnabled = Boolean(options.intervalsEnabled);
  const hasFitness = totals.avg_fitness > 0;
  const hasFatigue = totals.avg_fatigue > 0;
  const fitFatState = activeMetricKey === FATIGUE_METRIC_KEY
    ? FATIGUE_METRIC_KEY
    : FITNESS_METRIC_KEY;
  const fitFatHasData = fitFatState === FATIGUE_METRIC_KEY ? hasFatigue : hasFitness;
  const fitFatValue = fitFatState === FATIGUE_METRIC_KEY ? totals.avg_fatigue : totals.avg_fitness;
  const fitFatDisplay = fitFatHasData ? formatNumber(fitFatValue, 0) : STAT_PLACEHOLDER;
  const fitFatLabel = fitFatState === FATIGUE_METRIC_KEY ? "Avg. Fatigue" : "Avg. Fitness";
  const items = [
    {
      key: "moving_time",
      label: "Total Time",
      value: formatDuration(totals.moving_time),
      filterable: totals.moving_time > 0,
    },
    {
      key: "distance",
      label: "Total Distance",
      value: totals.distance > 0
        ? formatDistance(totals.distance, units || { distance: "mi" })
        : STAT_PLACEHOLDER,
      filterable: totals.distance > 0,
    },
    {
      key: "elevation_gain",
      label: "Total Elevation",
      value: totals.elevation > 0
        ? formatElevation(totals.elevation, units || { elevation: "ft" })
        : STAT_PLACEHOLDER,
      filterable: totals.elevation > 0,
    },
    {
      key: PACE_METRIC_KEY,
      label: "Avg. Pace",
      value: formatPaceFromMps(totals.avg_pace_mps, units || { distance: "mi" }),
      filterable: true,
    },
  ];
  if (intervalsEnabled) {
    items.push({
      key: FIT_FAT_CYCLE_KEY,
      label: fitFatLabel,
      value: fitFatDisplay,
      filterable: true,
      filterableMetricKeys: [FITNESS_METRIC_KEY, FATIGUE_METRIC_KEY],
      isActive: (metricKey) => metricKey === FITNESS_METRIC_KEY || metricKey === FATIGUE_METRIC_KEY,
    });
    items.push({
      key: EFFICIENCY_METRIC_KEY,
      label: "Avg Efficency",
      value: formatEfficiency(totals.avg_efficiency_factor),
      filterable: true,
    });
  }
  return items;
}

const FREQUENCY_METRIC_ITEMS = [
  { key: "distance", label: "Distance" },
  { key: "moving_time", label: "Time" },
  { key: "elevation_gain", label: "Elevation" },
];
const METRIC_LABEL_BY_KEY = Object.freeze({
  [ACTIVE_DAYS_METRIC_KEY]: "Active Days",
  distance: "Distance",
  moving_time: "Time",
  elevation_gain: "Elevation",
  [PACE_METRIC_KEY]: "Avg. Pace",
  [EFFICIENCY_METRIC_KEY]: "Avg Efficency",
  [FITNESS_METRIC_KEY]: "Avg. Fitness",
  [FATIGUE_METRIC_KEY]: "Avg. Fatigue",
});
const CHRONICLE_LENS_META = Object.freeze({
  [ACTIVE_DAYS_METRIC_KEY]: Object.freeze({
    title: "Consistency Lens",
    summary: "See where you kept showing up, even when the load stayed light.",
    accent: "#ff8a5b",
  }),
  moving_time: Object.freeze({
    title: "Time Lens",
    summary: "Read the block by commitment instead of raw activity count.",
    accent: "#76f1c7",
  }),
  distance: Object.freeze({
    title: "Distance Lens",
    summary: "Turn the story into pure coverage and surface where mileage stacked.",
    accent: "#74c6ff",
  }),
  elevation_gain: Object.freeze({
    title: "Elevation Lens",
    summary: "Expose climbing blocks and mountainous weeks without flat-volume noise.",
    accent: "#ffd36e",
  }),
  [PACE_METRIC_KEY]: Object.freeze({
    title: "Pace Lens",
    summary: "Reveal the sharper efforts and speed clusters hidden inside the same calendar.",
    accent: "#b898ff",
  }),
  [EFFICIENCY_METRIC_KEY]: Object.freeze({
    title: "Efficiency Lens",
    summary: "Highlight the days where output looked cleaner than the effort felt.",
    accent: "#7ae6ff",
  }),
  [FITNESS_METRIC_KEY]: Object.freeze({
    title: "Fitness Lens",
    summary: "Watch readiness accumulate and identify the densest growth periods.",
    accent: "#7cf0a2",
  }),
  [FATIGUE_METRIC_KEY]: Object.freeze({
    title: "Fatigue Lens",
    summary: "Surface compression points where training stress outweighed freshness.",
    accent: "#ff8db4",
  }),
});

const FREQUENCY_METRIC_UNAVAILABLE_REASON_BY_KEY = {
  distance: "No distance data in current selection.",
  moving_time: "No time data in current selection.",
  elevation_gain: "No elevation data in current selection.",
};

function getFrequencyMetricUnavailableReason(metricKey, metricLabel) {
  return FREQUENCY_METRIC_UNAVAILABLE_REASON_BY_KEY[metricKey]
    || `No ${String(metricLabel || "metric").toLowerCase()} data in current selection.`;
}

function formatMetricTotal(metricKey, value, units) {
  if (metricKey === ACTIVE_DAYS_METRIC_KEY) {
    return formatNumber(value, 0);
  }
  if (metricKey === "distance") {
    return formatDistance(value, units || { distance: "mi" });
  }
  if (metricKey === "moving_time") {
    return formatDuration(value);
  }
  if (metricKey === "elevation_gain") {
    return formatElevation(value, units || { elevation: "ft" });
  }
  if (metricKey === PACE_METRIC_KEY) {
    return formatPaceFromMps(value, units || { distance: "mi" });
  }
  if (metricKey === EFFICIENCY_METRIC_KEY) {
    return formatEfficiency(value);
  }
  if (metricKey === FITNESS_METRIC_KEY || metricKey === FATIGUE_METRIC_KEY) {
    return formatNumber(value, 0);
  }
  return formatNumber(value, 0);
}

function formatHourLabel(hour) {
  const suffix = hour < 12 ? "a" : "p";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${suffix}`;
}

function isOtherSportsType(type) {
  return String(type || "") === String(OTHER_BUCKET || "OtherSports");
}

function getActivitySubtypeLabel(activity) {
  const rawSubtype = activity?.subtype || activity?.raw_type;
  const value = String(rawSubtype || "").trim();
  if (!value) return "";
  if (isOtherSportsType(activity?.type) && value === String(activity?.type || "")) {
    return "";
  }
  return TYPE_META[value]?.label || prettifyType(value);
}

function createTooltipBreakdown() {
  return {
    typeCounts: {},
    otherSubtypeCounts: {},
  };
}

function addTooltipBreakdownCount(breakdown, activityType, subtypeLabel) {
  if (!breakdown) return;
  breakdown.typeCounts[activityType] = (breakdown.typeCounts[activityType] || 0) + 1;
  if (isOtherSportsType(activityType) && subtypeLabel) {
    breakdown.otherSubtypeCounts[subtypeLabel] = (breakdown.otherSubtypeCounts[subtypeLabel] || 0) + 1;
  }
}

function sortBreakdownEntries(counts) {
  return Object.entries(counts || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return String(a[0]).localeCompare(String(b[0]));
    });
}

function formatTypeBreakdownLines(breakdown, types) {
  const lines = [];
  const typeCounts = breakdown?.typeCounts || {};
  const subtypeEntries = sortBreakdownEntries(breakdown?.otherSubtypeCounts || {});
  const selectedTypes = Array.isArray(types) ? types : [];
  const showTypeBreakdown = selectedTypes.length > 1;
  let otherSportsLineRendered = false;

  if (showTypeBreakdown) {
    selectedTypes.forEach((type) => {
      const count = typeCounts[type] || 0;
      if (count <= 0) return;
      const otherType = isOtherSportsType(type);
      lines.push(`${displayType(type)}: ${count}`);
      if (!otherType || !subtypeEntries.length) return;
      otherSportsLineRendered = true;
      subtypeEntries.forEach(([subtype, subtypeCount]) => {
        lines.push(`  - ${subtype}: ${subtypeCount}`);
      });
    });
  }

  if (subtypeEntries.length && !otherSportsLineRendered) {
    const otherTotal = typeCounts[OTHER_BUCKET]
      || subtypeEntries.reduce((sum, [, count]) => sum + count, 0);
    if (otherTotal > 0) {
      lines.push(`${displayType(OTHER_BUCKET)}: ${otherTotal}`);
    }
    subtypeEntries.forEach(([subtype, count]) => {
      lines.push(`  - ${subtype}: ${count}`);
    });
  }

  return lines;
}

function createTooltipTextLine(text) {
  return [{ text: String(text ?? "") }];
}

function createTooltipLinkedTypeLine(prefix, label, suffix, href) {
  const segments = [];
  if (prefix) segments.push({ text: prefix });
  if (href) {
    segments.push({ text: label, href });
  } else {
    segments.push({ text: label });
  }
  if (suffix) segments.push({ text: suffix });
  return segments;
}

function activityTypeOrderForTooltip(typeBreakdown, types) {
  const typeCounts = typeBreakdown?.typeCounts || {};
  const selectedTypes = Array.isArray(types) ? types : [];
  const ordered = [];
  const seen = new Set();

  selectedTypes.forEach((type) => {
    if (Number(typeCounts[type] || 0) <= 0) return;
    ordered.push(type);
    seen.add(type);
  });

  Object.keys(typeCounts)
    .filter((type) => Number(typeCounts[type] || 0) > 0 && !seen.has(type))
    .sort((a, b) => String(a).localeCompare(String(b)))
    .forEach((type) => {
      ordered.push(type);
    });

  return ordered;
}

function flattenTooltipActivityLinks(activityLinksByType) {
  const links = [];
  Object.values(activityLinksByType || {}).forEach((entries) => {
    if (!Array.isArray(entries)) return;
    entries.forEach((entry) => {
      const href = normalizeTooltipHref(entry?.href);
      if (!href) return;
      links.push({ href, name: String(entry?.name || "").trim() });
    });
  });
  return links;
}

function firstTooltipActivityLink(activityLinksByType, preferredType) {
  if (!activityLinksByType || typeof activityLinksByType !== "object") {
    return "";
  }
  const preferred = String(preferredType || "").trim();
  if (preferred && preferred !== "all") {
    const entries = Array.isArray(activityLinksByType[preferred]) ? activityLinksByType[preferred] : [];
    if (entries.length === 1) {
      return normalizeTooltipHref(entries[0]?.href);
    }
    return "";
  }
  const allLinks = flattenTooltipActivityLinks(activityLinksByType);
  return allLinks.length === 1 ? String(allLinks[0].href || "") : "";
}

function formatTypeBreakdownLinesWithLinks(typeBreakdown, types, activityLinksByType) {
  const lines = [];
  const orderedTypes = activityTypeOrderForTooltip(typeBreakdown, types);
  const typeCounts = typeBreakdown?.typeCounts || {};

  orderedTypes.forEach((activityType) => {
    const count = Number(typeCounts[activityType] || 0);
    if (count <= 0) return;

    const typeLabel = displayType(activityType);
    const links = Array.isArray(activityLinksByType?.[activityType])
      ? activityLinksByType[activityType]
      : [];
    const hasSingleLinkedType = count === 1 && links.length === 1 && normalizeTooltipHref(links[0]?.href);

    if (hasSingleLinkedType) {
      lines.push(createTooltipLinkedTypeLine("", typeLabel, `: ${count}`, links[0].href));
      return;
    }

    lines.push(createTooltipTextLine(`${typeLabel}: ${count}`));
    if (count > 1 && links.length > 1) {
      links.forEach((entry, index) => {
        const fallbackName = `${typeLabel} ${index + 1}`;
        const name = String(entry?.name || "").trim() || fallbackName;
        lines.push(createTooltipLinkedTypeLine("    - ", name, "", entry?.href || ""));
      });
    }
  });

  return lines;
}

function getSingleActivityTooltipTypeLabel(typeBreakdown, entry, typeLabels) {
  if (Number(entry?.count || 0) !== 1) {
    return "";
  }

  const typeEntries = sortBreakdownEntries(typeBreakdown?.typeCounts || {});
  if (typeEntries.length === 1 && Number(typeEntries[0][1]) === 1) {
    const activityType = String(typeEntries[0][0] || "").trim();
    if (activityType) {
      if (isOtherSportsType(activityType)) {
        const subtypeEntries = sortBreakdownEntries(typeBreakdown?.otherSubtypeCounts || {});
        if (subtypeEntries.length === 1 && Number(subtypeEntries[0][1]) === 1) {
          return String(subtypeEntries[0][0] || "").trim();
        }
      }
      return displayType(activityType);
    }
  }

  if (Array.isArray(typeLabels) && typeLabels.length === 1) {
    return String(typeLabels[0] || "").replace(/\s+subtype$/i, "").trim();
  }
  if (Array.isArray(entry?.types) && entry.types.length === 1) {
    return displayType(entry.types[0]);
  }
  return "";
}

function formatTooltipBreakdown(total, breakdown, types) {
  const lines = [`Total: ${formatActivityCountLabel(total, types)}`];
  const detailLines = formatTypeBreakdownLines(breakdown, types);
  if (!detailLines.length) {
    return lines.join("\n");
  }
  lines.push(...detailLines);
  return lines.join("\n");
}

function buildCombinedTypeDetailsByDate(payload, types, years) {
  const detailsByDate = {};
  const typeBreakdownsByDate = {};
  const activityLinksByDateType = {};
  const activities = getFilteredActivities(payload, types, years);

  activities.forEach((activity) => {
    const dateStr = String(activity.date || "");
    if (!dateStr) return;
    if (!detailsByDate[dateStr]) {
      detailsByDate[dateStr] = {
        normalTypes: new Set(),
        otherSubtypeLabels: new Set(),
        hasOtherSports: false,
      };
    }
    if (!typeBreakdownsByDate[dateStr]) {
      typeBreakdownsByDate[dateStr] = createTooltipBreakdown();
    }
    const details = detailsByDate[dateStr];
    const activityType = String(activity.type || "");
    const subtypeLabel = getActivitySubtypeLabel(activity);
    addTooltipBreakdownCount(typeBreakdownsByDate[dateStr], activityType, subtypeLabel);
    const parsedActivityLink = parseStravaActivityUrl(activity?.url || activity?.activity_url);
    if (parsedActivityLink?.href && activityType) {
      if (!activityLinksByDateType[dateStr]) {
        activityLinksByDateType[dateStr] = {};
      }
      if (!activityLinksByDateType[dateStr][activityType]) {
        activityLinksByDateType[dateStr][activityType] = [];
      }
      activityLinksByDateType[dateStr][activityType].push({
        href: parsedActivityLink.href,
        name: String(activity?.name || activity?.title || "").trim(),
      });
    }
    if (isOtherSportsType(activityType)) {
      details.hasOtherSports = true;
      if (subtypeLabel) {
        details.otherSubtypeLabels.add(`${subtypeLabel} subtype`);
      }
      return;
    }
    details.normalTypes.add(activityType);
  });

  const orderedTypes = Array.isArray(types) ? types : [];
  const typeLabelsByDate = {};

  Object.entries(detailsByDate).forEach(([dateStr, details]) => {
    const labels = [];
    orderedTypes.forEach((type) => {
      if (!isOtherSportsType(type) && details.normalTypes.has(type)) {
        labels.push(displayType(type));
      }
    });

    const extraTypes = Array.from(details.normalTypes)
      .filter((type) => !isOtherSportsType(type) && !orderedTypes.includes(type))
      .map((type) => displayType(type))
      .sort((a, b) => a.localeCompare(b));
    labels.push(...extraTypes);

    const subtypeLabels = Array.from(details.otherSubtypeLabels).sort((a, b) => a.localeCompare(b));
    if (subtypeLabels.length) {
      labels.push(...subtypeLabels);
    } else if (details.hasOtherSports) {
      labels.push(displayType(OTHER_BUCKET));
    }

    typeLabelsByDate[dateStr] = labels;
  });

  Object.values(activityLinksByDateType).forEach((linksByType) => {
    Object.values(linksByType).forEach((activitiesForType) => {
      activitiesForType.sort((a, b) => {
        const nameA = String(a?.name || "").trim();
        const nameB = String(b?.name || "").trim();
        if (nameA && nameB && nameA !== nameB) {
          return nameA.localeCompare(nameB);
        }
        if (nameA && !nameB) return -1;
        if (!nameA && nameB) return 1;
        return String(a?.href || "").localeCompare(String(b?.href || ""));
      });
    });
  });

  return { typeLabelsByDate, typeBreakdownsByDate, activityLinksByDateType };
}

function centerSummaryTypeCardTailRow(summaryEl) {
  if (!summaryEl) return;
  const allCards = Array.from(summaryEl.children || []);
  if (!allCards.length) return;

  const typeCards = allCards.filter((card) => card.classList.contains("summary-type-card"));
  typeCards.forEach((card) => {
    card.style.removeProperty("grid-column");
    card.style.removeProperty("transform");
  });
  if (!typeCards.length) return;

  const styles = getComputedStyle(summaryEl);
  const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
  const cardRects = allCards.map((card) => card.getBoundingClientRect());
  const firstRowTop = cardRects[0]?.top;
  if (!Number.isFinite(firstRowTop)) return;

  const ROW_TOLERANCE = 1;
  let columns = 0;
  for (let idx = 0; idx < cardRects.length; idx += 1) {
    const top = cardRects[idx]?.top;
    if (!Number.isFinite(top) || Math.abs(top - firstRowTop) > ROW_TOLERANCE) {
      break;
    }
    columns += 1;
  }

  if (columns <= 3) {
    summaryEl.style.setProperty("width", "100%");
    summaryEl.style.setProperty("max-width", "none");
  } else {
    summaryEl.style.removeProperty("width");
    summaryEl.style.removeProperty("max-width");
  }

  if (columns <= 1) return;

  const totalCardCount = allCards.length;
  const tailCount = totalCardCount % columns;
  if (tailCount <= 0) return;

  let trailingTypeCardCount = 0;
  for (let idx = totalCardCount - 1; idx >= 0; idx -= 1) {
    if (!allCards[idx].classList.contains("summary-type-card")) {
      break;
    }
    trailingTypeCardCount += 1;
  }
  // Only reposition when the incomplete final row is made of type cards.
  if (trailingTypeCardCount < tailCount) return;

  let columnStep = 0;
  if (columns >= 2) {
    const firstLeft = cardRects[0]?.left;
    for (let idx = 1; idx < columns; idx += 1) {
      const left = cardRects[idx]?.left;
      if (!Number.isFinite(firstLeft) || !Number.isFinite(left)) continue;
      const delta = left - firstLeft;
      if (delta > 0.5) {
        columnStep = delta;
        break;
      }
    }
  }
  if (!(columnStep > 0.5)) {
    const fallbackWidth = cardRects[0]?.width || 0;
    columnStep = fallbackWidth + gap;
  }

  const startColumn = Math.floor((columns - tailCount) / 2) + 1;
  const horizontalShift = (columns - tailCount) % 2 === 1 && columnStep > 0
    ? columnStep / 2
    : 0;

  for (let idx = 0; idx < tailCount; idx += 1) {
    const card = allCards[totalCardCount - tailCount + idx];
    card.style.gridColumn = String(startColumn + idx);
    if (horizontalShift > 0.5) {
      card.style.transform = `translateX(${horizontalShift}px)`;
    }
  }
}

function buildSummary(
  payload,
  types,
  years,
  units,
  showTypeBreakdown,
  showActiveDays,
  typeCardTypes,
  activeTypeCards,
  hoverClearedType,
  onTypeCardSelect,
  onTypeCardHoverReset,
  activeYearMetricKey,
  hoverClearedYearMetricKey,
  onYearMetricCardSelect,
  onYearMetricCardHoverReset,
) {
  const summaryUnits = normalizeUnits(units || DEFAULT_UNITS);
  summary.innerHTML = "";
  summary.classList.add("summary-cohesive");
  summary.classList.remove(
    "summary-center-two-types",
    "summary-center-three-types",
    "summary-center-four-types",
    "summary-center-tail-one",
    "summary-center-tail-two",
    "summary-center-tail-three",
    "summary-center-tail-four",
  );

  const totals = {
    count: 0,
    distance: 0,
    moving_time: 0,
    elevation: 0,
  };
  const typeTotals = {};
  const selectedTypeSet = new Set(types);
  const typeCardsList = Array.isArray(typeCardTypes) && typeCardTypes.length
    ? typeCardTypes.slice()
    : types.slice();
  const typeCardSet = new Set(typeCardsList);
  const activeDays = new Set();

  Object.entries(payload.aggregates || {}).forEach(([year, yearData]) => {
    if (!years.includes(Number(year))) return;
    Object.entries(yearData || {}).forEach(([type, entries]) => {
      const includeTotals = selectedTypeSet.has(type);
      const includeTypeCardCount = typeCardSet.has(type);
      if (!includeTotals && !includeTypeCardCount) return;
      if (includeTypeCardCount && !typeTotals[type]) {
        typeTotals[type] = { count: 0 };
      }
      Object.entries(entries || {}).forEach(([dateStr, entry]) => {
        if (includeTotals && (entry.count || 0) > 0) {
          activeDays.add(dateStr);
        }
        if (includeTotals) {
          totals.count += entry.count || 0;
          totals.distance += entry.distance || 0;
          totals.moving_time += entry.moving_time || 0;
          totals.elevation += entry.elevation_gain || 0;
        }
        if (includeTypeCardCount) {
          typeTotals[type].count += entry.count || 0;
        }
      });
    });
  });

  const visibleTypeCardsList = typeCardsList
    .filter((type) => (typeTotals[type]?.count || 0) > 0)
    .sort((a, b) => (typeTotals[b]?.count || 0) - (typeTotals[a]?.count || 0));

  if (showTypeBreakdown && visibleTypeCardsList.length) {
    const typeRail = document.createElement("div");
    typeRail.className = "summary-type-rail";

    const typeRailNav = document.createElement("div");
    typeRailNav.className = "summary-type-rail-nav";

    visibleTypeCardsList.forEach((type, index) => {
      const typeCard = document.createElement("button");
      typeCard.type = "button";
      typeCard.className = "summary-type-link";
      const isActiveTypeCard = Boolean(activeTypeCards && activeTypeCards.has(type));
      typeCard.classList.toggle("active", isActiveTypeCard);
      if (!isActiveTypeCard && hoverClearedType === type) {
        typeCard.classList.add("summary-glow-cleared");
      }
      typeCard.setAttribute("aria-pressed", isActiveTypeCard ? "true" : "false");
      typeCard.title = `Focus Chronicle on ${displayType(type)}`;
      typeCard.style.setProperty("--summary-type-accent", getColors(type)[4]);

      const label = document.createElement("span");
      label.className = "summary-type-link-label";
      label.textContent = summaryTypeTitle(type);
      const count = document.createElement("span");
      count.className = "summary-type-link-count";
      count.textContent = formatNumber(typeTotals[type]?.count || 0, 0);
      const dot = document.createElement("span");
      dot.className = "summary-type-link-dot";
      dot.style.setProperty("--summary-type-accent", getColors(type)[4]);
      const textWrap = document.createElement("span");
      textWrap.className = "summary-type-link-text";
      typeCard.appendChild(dot);
      textWrap.appendChild(label);
      textWrap.appendChild(count);
      typeCard.appendChild(textWrap);
      if (onTypeCardHoverReset) {
        typeCard.addEventListener("pointerleave", () => {
          if (typeCard.classList.contains("summary-glow-cleared")) {
            typeCard.classList.remove("summary-glow-cleared");
          }
          onTypeCardHoverReset(type);
        });
      }
      if (onTypeCardSelect) {
        typeCard.addEventListener("click", () => onTypeCardSelect(type, isActiveTypeCard));
      }
      typeRailNav.appendChild(typeCard);
      if (index < visibleTypeCardsList.length - 1) {
        const separator = document.createElement("span");
        separator.className = "summary-type-separator";
        separator.setAttribute("aria-hidden", "true");
        separator.textContent = "|";
        typeRailNav.appendChild(separator);
      }
    });
    typeRail.appendChild(typeRailNav);
    summary.appendChild(typeRail);
  }
}

function buildHeatmapArea(aggregates, year, units, colors, type, layout, options = {}) {
  const heatmapArea = document.createElement("div");
  heatmapArea.className = "heatmap-area";
  const weekStart = normalizeWeekStart(options.weekStart);
  const dayLabels = WEEKDAY_LABELS_BY_WEEK_START[weekStart] || DAYS;
  const metricHeatmapKey = typeof options.metricHeatmapKey === "string"
    ? options.metricHeatmapKey
    : null;
  const metricHeatmapMax = metricHeatmapKey === ACTIVE_DAYS_METRIC_KEY
    ? 1
    : metricHeatmapKey
    ? Number(options.metricMaxByKey?.[metricHeatmapKey] || 0)
    : 0;
  const metricRange = metricHeatmapKey && options.metricRangeByKey
    ? options.metricRangeByKey[metricHeatmapKey]
    : null;
  const metricHeatmapActive = Boolean(metricHeatmapKey);
  const metricHeatmapColor = options.metricHeatmapColor || colors[4];
  const metricHeatmapEmptyColor = options.metricHeatmapEmptyColor || DEFAULT_COLORS[0];

  const monthRow = document.createElement("div");
  monthRow.className = "month-row";
  monthRow.style.paddingLeft = `${layout.gridPadLeft}px`;
  heatmapArea.appendChild(monthRow);

  const dayCol = document.createElement("div");
  dayCol.className = "day-col";
  dayCol.style.paddingTop = `${layout.gridPadTop}px`;
  dayCol.style.gap = `${layout.gap}px`;
  dayLabels.forEach((label) => {
    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label";
    dayLabel.textContent = label;
    dayLabel.style.height = `${layout.cell}px`;
    dayLabel.style.lineHeight = `${layout.cell}px`;
    dayCol.appendChild(dayLabel);
  });
  heatmapArea.appendChild(dayCol);

  const yearStart = utcDateFromParts(year, 0, 1);
  const yearEnd = utcDateFromParts(year, 11, 31);
  const start = weekStartOnOrBeforeUtc(yearStart, weekStart);
  const end = weekEndOnOrAfterUtc(yearEnd, weekStart);

  for (let month = 0; month < 12; month += 1) {
    const monthStart = utcDateFromParts(year, month, 1);
    const weekIndex = weekIndexFromWeekStartUtc(monthStart, start);
    const monthLabel = document.createElement("div");
    monthLabel.className = "month-label";
    monthLabel.textContent = MONTHS[month];
    monthLabel.style.left = `${weekIndex * (layout.cell + layout.gap)}px`;
    monthRow.appendChild(monthLabel);
  }

  const grid = document.createElement("div");
  grid.className = "grid";

  for (let day = new Date(start.getTime()); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const dateStr = formatUtcDateKey(day);
    const inYear = day.getUTCFullYear() === year;
    const entry = (aggregates && aggregates[dateStr]) || {
      count: 0,
      distance: 0,
      moving_time: 0,
      elevation_gain: 0,
      activity_ids: [],
    };

    const weekIndex = weekIndexFromWeekStartUtc(day, start);
    const row = weekdayRowFromStart(day.getUTCDay(), weekStart);

    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.gridColumn = weekIndex + 1;
    cell.style.gridRow = row + 1;

    if (!inYear) {
      cell.classList.add("outside");
      grid.appendChild(cell);
      continue;
    }

    const filled = (entry.count || 0) > 0;
    if (metricHeatmapActive) {
      const metricValue = metricHeatmapKey === ACTIVE_DAYS_METRIC_KEY
        ? (filled ? 1 : 0)
        : metricHeatmapKey === PACE_METRIC_KEY
        ? derivePaceMpsFromEntry(entry)
        : Number(entry[metricHeatmapKey] || 0);
      let scaledMetricValue = metricValue;
      let scaledMetricMax = metricHeatmapMax;
      if (
        metricHeatmapKey !== ACTIVE_DAYS_METRIC_KEY
        && metricRange
        && Number.isFinite(Number(metricRange.min))
        && Number.isFinite(Number(metricRange.max))
        && Number(metricRange.max) > Number(metricRange.min)
      ) {
        scaledMetricValue = metricValue > 0 ? Math.max(0, metricValue - Number(metricRange.min)) : 0;
        scaledMetricMax = Math.max(0, Number(metricRange.max) - Number(metricRange.min));
      }
      cell.style.backgroundImage = "none";
      cell.style.background = metricValue > 0
        ? heatColor(metricHeatmapColor, scaledMetricValue, scaledMetricMax)
        : metricHeatmapEmptyColor;
    } else if (filled && typeof options.colorForEntry === "function") {
      const entryColor = options.colorForEntry(entry);
      const backgroundColor = typeof entryColor === "object" && entryColor !== null
        ? String(entryColor.background || colors[0])
        : String(entryColor || colors[0]);
      const backgroundImage = typeof entryColor === "object" && entryColor !== null
        ? String(entryColor.backgroundImage || "").trim()
        : "";
      cell.style.background = backgroundColor;
      cell.style.backgroundImage = backgroundImage || "none";
    } else {
      cell.style.backgroundImage = "none";
      cell.style.background = filled ? colors[4] : colors[0];
    }

    const durationMinutes = Math.round((entry.moving_time || 0) / 60);
    const duration = durationMinutes >= 60
      ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
      : `${durationMinutes}m`;

    const typeBreakdown = type === "all" ? options.typeBreakdownsByDate?.[dateStr] : null;
    const typeLabels = type === "all" ? options.typeLabelsByDate?.[dateStr] : null;
    const activityLinksByType = options.activityLinksByDateType?.[dateStr] || {};
    const singleTypeLabel = type === "all"
      ? getSingleActivityTooltipTypeLabel(typeBreakdown, entry, typeLabels)
      : (Number(entry.count || 0) === 1 ? displayType(type) : "");
    const singleActivityLink = Number(entry.count || 0) === 1
      ? firstTooltipActivityLink(activityLinksByType, type)
      : "";
    const lines = [createTooltipTextLine(formatDisplayDate(dateStr))];
    if (singleTypeLabel) {
      lines.push(createTooltipLinkedTypeLine("1 ", singleTypeLabel, "", singleActivityLink));
    } else {
      lines.push(createTooltipTextLine(formatActivityCountLabel(entry.count, type === "all" ? [] : [type])));
    }

    const showDistanceElevation = (entry.distance || 0) > 0 || (entry.elevation_gain || 0) > 0;

    if (type === "all") {
      if (!singleTypeLabel) {
        const breakdownLines = formatTypeBreakdownLinesWithLinks(
          typeBreakdown,
          options.selectedTypes || [],
          activityLinksByType,
        );
        if (breakdownLines.length) {
          lines.push(...breakdownLines);
        } else if (Array.isArray(typeLabels) && typeLabels.length) {
          lines.push(createTooltipTextLine(`Types: ${typeLabels.join(", ")}`));
        } else if (entry.types && entry.types.length) {
          lines.push(createTooltipTextLine(`Types: ${entry.types.map(displayType).join(", ")}`));
        }
      }
    }

    if (showDistanceElevation) {
      const distance = units.distance === "km"
        ? `${(entry.distance / 1000).toFixed(2)} km`
        : `${(entry.distance / 1609.344).toFixed(2)} mi`;
      const elevation = units.elevation === "m"
        ? `${Math.round(entry.elevation_gain)} m`
        : `${Math.round(entry.elevation_gain * 3.28084)} ft`;
      lines.push(createTooltipTextLine(`Distance: ${distance}`));
      lines.push(createTooltipTextLine(`Elevation: ${elevation}`));
    }

    if (filled) {
      lines.push(createTooltipTextLine(`Duration: ${duration}`));
    }
    const tooltipContent = { lines };
    const keyboardTooltipLabel = lines
      .map((line) => (Array.isArray(line) ? line.map((segment) => String(segment?.text || "")).join("") : String(line || "")))
      .join(". ");
    if (filled) {
      cell.classList.add("is-focusable");
      cell.tabIndex = 0;
      cell.setAttribute("role", "button");
      cell.setAttribute("aria-label", keyboardTooltipLabel);
    }
    const canPinTooltip = Boolean(flattenTooltipActivityLinks(activityLinksByType).length);
    if (!useTouchInteractions) {
      cell.addEventListener("mouseenter", (event) => {
        if (isTooltipPinned()) return;
        if (hasActiveTooltipCell()) return;
        showTooltip(tooltipContent, event.clientX, event.clientY);
      });
      cell.addEventListener("mousemove", (event) => {
        if (isTooltipPinned()) return;
        if (hasActiveTooltipCell()) return;
        showTooltip(tooltipContent, event.clientX, event.clientY);
      });
      cell.addEventListener("mouseleave", () => {
        if (isTooltipPinned()) return;
        if (hasActiveTooltipCell()) return;
        hideTooltip();
      });
      if (filled) {
        cell.addEventListener("focus", () => {
          if (isTooltipPinned()) return;
          const point = getTooltipEventPoint(null, cell);
          showTooltip(tooltipContent, point.x, point.y, { interactive: canPinTooltip });
        });
        cell.addEventListener("blur", () => {
          if (isTooltipPinned()) return;
          hideTooltip();
        });
        cell.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          if (canPinTooltip) {
            if (pinnedTooltipCell === cell) {
              clearPinnedTooltipCell();
              hideTooltip();
              return;
            }
            clearPinnedTooltipCell();
            pinnedTooltipCell = cell;
            cell.classList.add("active");
          }
          const point = getTooltipEventPoint(null, cell);
          showTooltip(tooltipContent, point.x, point.y, { interactive: canPinTooltip });
        });
      }
      if (canPinTooltip) {
        cell.addEventListener("click", (event) => {
          if (pinnedTooltipCell === cell) {
            clearPinnedTooltipCell();
            hideTooltip();
            return;
          }
          clearPinnedTooltipCell();
          pinnedTooltipCell = cell;
          cell.classList.add("active");
          const point = getTooltipEventPoint(event, cell);
          showTooltip(tooltipContent, point.x, point.y, { interactive: true });
        });
      } else {
        cell.addEventListener("click", () => {
          clearPinnedTooltipCell();
        });
      }
    } else {
      const handleTouchCellSelection = (event) => {
        if (shouldIgnoreTouchCellClick()) {
          event.stopPropagation();
          return;
        }
        markTouchTooltipDismissBlock(900);
        if (cell.classList.contains("active")) {
          // Keep touch selection stable; outside tap or another cell tap clears it.
          return;
        }
        const active = grid.querySelector(".cell.active");
        if (active) active.classList.remove("active");
        cell.classList.add("active");
        const point = getTooltipEventPoint(event, cell);
        showTooltip(tooltipContent, point.x, point.y);
      };
      cell.addEventListener("pointerdown", (event) => {
        rememberTooltipPointerType(event);
        markTouchTooltipCellPointerDown(event, cell);
      });
      cell.addEventListener("pointerup", (event) => {
        rememberTooltipPointerType(event);
        if (!isTouchTooltipActivationEvent(event)) {
          return;
        }
        const wasTap = resolveTouchTooltipCellPointerUpTap(event);
        markTouchTooltipCellPointerUp(cell, 700, wasTap);
        if (!wasTap) {
          event.stopPropagation();
          return;
        }
        handleTouchCellSelection(event);
      });
      cell.addEventListener("pointercancel", (event) => {
        rememberTooltipPointerType(event);
        if (!isTouchTooltipActivationEvent(event)) {
          return;
        }
        resolveTouchTooltipCellPointerUpTap(event);
        markTouchTooltipCellPointerUp(cell, 700, false);
      });
      cell.addEventListener("click", (event) => {
        rememberTooltipPointerType(event);
        if (shouldSuppressTouchTooltipCellClick(event, cell)) {
          event.stopPropagation();
          return;
        }
        handleTouchCellSelection(event);
      });
    }

    grid.appendChild(cell);
  }

  heatmapArea.appendChild(grid);
  return heatmapArea;
}

function buildSideStatCard(labelText, valueText, options = {}) {
  const {
    tagName = "div",
    className = "card-stat",
    extraClasses = [],
    disabled = false,
    ariaPressed = null,
  } = options;

  const card = document.createElement(tagName);
  card.className = className;
  extraClasses.forEach((name) => {
    if (name) {
      card.classList.add(name);
    }
  });

  if (tagName.toLowerCase() === "button") {
    card.type = "button";
    card.disabled = Boolean(disabled);
  }
  if (ariaPressed !== null) {
    card.setAttribute("aria-pressed", ariaPressed ? "true" : "false");
  }

  const label = document.createElement("div");
  label.className = "card-stat-label";
  label.textContent = labelText;
  const value = document.createElement("div");
  value.className = "card-stat-value";
  value.textContent = valueText;
  card.appendChild(label);
  card.appendChild(value);
  return card;
}

function buildSideStatColumn(items, options = {}) {
  const column = document.createElement("div");
  column.className = options.className || "card-stats side-stats-column";
  (items || []).forEach((item) => {
    if (!item) return;
    const card = buildSideStatCard(item.label, item.value, item.cardOptions || {});
    if (typeof item.enhance === "function") {
      item.enhance(card);
    }
    column.appendChild(card);
  });
  return column;
}

function createChronicleLensIcon(metricKey) {
  const icon = document.createElement("span");
  icon.className = "chronicle-lens-icon";
  icon.setAttribute("aria-hidden", "true");
  const svgByMetricKey = {
    [ACTIVE_DAYS_METRIC_KEY]: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3.5" y="5" width="17" height="15" rx="3"></rect>
        <path d="M7 3.5v3"></path>
        <path d="M17 3.5v3"></path>
        <path d="M3.5 9.5h17"></path>
        <path d="M8.5 13l2 2 5-5"></path>
      </svg>`,
    moving_time: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="8.5"></circle>
        <path d="M12 7.5v5l3 1.8"></path>
      </svg>`,
    distance: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 18c4.5-9.5 11.5-9.5 16 0"></path>
        <path d="M6.5 15.5h0"></path>
        <path d="M12 9.5h0"></path>
        <path d="M17.5 15.5h0"></path>
      </svg>`,
    elevation_gain: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3.5 18.5 9.5 9l3.5 5 3-4.5 4.5 9"></path>
        <path d="M15.5 6.5v5"></path>
        <path d="m13.5 8.5 2-2 2 2"></path>
      </svg>`,
    [PACE_METRIC_KEY]: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 16a7 7 0 1 1 14 0"></path>
        <path d="M12 12 16 9"></path>
        <path d="M8 17.5h8"></path>
      </svg>`,
    [EFFICIENCY_METRIC_KEY]: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 8.5c1.4-2 3.4-3 6-3 3.8 0 6.5 2.7 6.5 6.5S15.8 18.5 12 18.5c-2.6 0-4.6-1-6-3"></path>
        <path d="m4.5 8.5 1.5-3 3 1.5"></path>
        <path d="m19.5 15.5-1.5 3-3-1.5"></path>
      </svg>`,
    [FITNESS_METRIC_KEY]: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 13h3l2-5 3 9 2-4h6"></path>
      </svg>`,
    [FATIGUE_METRIC_KEY]: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13.5 3.5c-4.6 0-8 3.5-8 8s3.4 8 8 8c2.3 0 4.2-.7 5.8-2.2-1.1.4-2.3.5-3.5.3-4.1-.7-6.9-4.5-6.2-8.5.4-2 1.5-3.7 3-5 .2-.2.5-.4.9-.6Z"></path>
      </svg>`,
  };
  icon.innerHTML = svgByMetricKey[metricKey] || svgByMetricKey[ACTIVE_DAYS_METRIC_KEY];
  return icon;
}

function syncChronicleStageScales(scope = document) {
  if (!scope || typeof scope.querySelectorAll !== "function") return;
  scope.querySelectorAll(".chronicle-year-band-heatmap").forEach((wrapper) => {
    const heatmapArea = wrapper.querySelector(".heatmap-area");
    if (!heatmapArea) return;
    wrapper.style.removeProperty("--chronicle-heatmap-scale");
    wrapper.style.removeProperty("height");
    const availableWidth = Number(wrapper.clientWidth || 0);
    const naturalWidth = Number(heatmapArea.scrollWidth || 0);
    const naturalHeight = Number(heatmapArea.scrollHeight || 0);
    if (!(availableWidth > 0) || !(naturalWidth > 0) || !(naturalHeight > 0)) return;
    const scale = Math.min(1, availableWidth / naturalWidth);
    wrapper.style.setProperty("--chronicle-heatmap-scale", String(scale));
    wrapper.style.height = `${Math.ceil(naturalHeight * scale)}px`;
  });
}

function syncChronicleLensLayouts(scope = document) {
  if (!scope || typeof scope.querySelectorAll !== "function") return;
  scope.querySelectorAll(".chronicle-lens-row").forEach((row) => {
    const buttons = Array.from(row.querySelectorAll(".chronicle-lens-button"));
    row.querySelectorAll(".chronicle-lens-spacer").forEach((node) => node.remove());
    if (!buttons.length) {
      row.style.removeProperty("--chronicle-lens-columns");
      return;
    }
    const availableWidth = Number(row.clientWidth || row.parentElement?.clientWidth || 0);
    const minCellWidth = window.innerWidth <= 640 ? 118 : 132;
    const computedStyle = window.getComputedStyle(row);
    const columnGap = parseFloat(computedStyle.columnGap || computedStyle.gap || "14") || 14;
    const maxPerRow = Math.max(1, Math.min(buttons.length, Math.floor((availableWidth + columnGap) / (minCellWidth + columnGap)) || 1));
    const rowsNeeded = Math.max(1, Math.ceil(buttons.length / maxPerRow));
    const columns = Math.max(1, Math.ceil(buttons.length / rowsNeeded));
    row.style.setProperty("--chronicle-lens-columns", String(columns));
    const placeholderCount = Math.max(0, (columns * rowsNeeded) - buttons.length);
    for (let index = 0; index < placeholderCount; index += 1) {
      const spacer = document.createElement("span");
      spacer.className = "chronicle-lens-spacer";
      spacer.setAttribute("aria-hidden", "true");
      row.appendChild(spacer);
    }
  });
}

function getFilterableKeys(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && item.filterable)
    .map((item) => item.key);
}

function normalizeSingleSelectKey(activeKey, filterableKeys) {
  return filterableKeys.includes(activeKey) ? activeKey : null;
}

function getMetricItemActive(item, activeKey) {
  if (!item) return false;
  if (typeof item.isActive === "function") {
    return Boolean(item.isActive(activeKey));
  }
  return activeKey === item.key;
}

function renderSingleSelectButtonState(items, buttonMap, activeKey) {
  (Array.isArray(items) ? items : []).forEach((item) => {
    const button = buttonMap.get(item.key);
    if (!button) return;
    const active = getMetricItemActive(item, activeKey);
    button.classList.toggle("active", active);
    if (active) {
      button.classList.remove("fact-glow-cleared");
    }
    button.setAttribute("aria-pressed", active ? "true" : "false");
    if (typeof item.value === "string") {
      const valueNode = button.querySelector(".card-stat-value");
      if (valueNode) {
        valueNode.textContent = item.value;
      }
    }
    if (typeof item.label === "string") {
      const labelNode = button.querySelector(".card-stat-label");
      if (labelNode) {
        labelNode.textContent = item.label;
      }
    }
  });
}

function attachSingleSelectCardToggle(button, options = {}) {
  const {
    itemKey,
    getActiveKey,
    setActiveKey,
    onToggleComplete,
    clearedClassName = "fact-glow-cleared",
  } = options;
  if (!button) return;
  if (typeof getActiveKey !== "function" || typeof setActiveKey !== "function") return;
  button.addEventListener("click", () => {
    const clearing = getActiveKey() === itemKey;
    setActiveKey(clearing ? null : itemKey);
    if (clearing) {
      button.classList.add(clearedClassName);
      button.blur();
    } else {
      button.classList.remove(clearedClassName);
    }
    if (typeof onToggleComplete === "function") {
      onToggleComplete();
    }
  });
  if (!useTouchInteractions) {
    button.addEventListener("pointerleave", () => {
      button.classList.remove(clearedClassName);
    });
  }
}

function buildCard(type, year, aggregates, units, options = {}) {
  const card = document.createElement("div");
  card.className = "card year-card";

  const body = document.createElement("div");
  body.className = "card-body";

  const colors = type === "all" ? DEFAULT_COLORS : getColors(type);
  const metricHeatmapColor = options.metricHeatmapColor || (type === "all" ? MULTI_TYPE_COLOR : colors[4]);
  const metricMaxByKey = {
    [ACTIVE_DAYS_METRIC_KEY]: 0,
    distance: 0,
    moving_time: 0,
    elevation_gain: 0,
    [PACE_METRIC_KEY]: 0,
    [EFFICIENCY_METRIC_KEY]: 0,
    [FITNESS_METRIC_KEY]: 0,
    [FATIGUE_METRIC_KEY]: 0,
  };
  const metricRangeByKey = {};
  const layout = getLayout();
  const heatmapOptions = {
    ...options,
    metricMaxByKey,
    metricRangeByKey,
    metricHeatmapColor,
    metricHeatmapEmptyColor: DEFAULT_COLORS[0],
  };
  const cardMetricYear = Number(options.cardMetricYear);
  const onYearMetricStateChange = typeof options.onYearMetricStateChange === "function"
    ? options.onYearMetricStateChange
    : null;
  const intervalsEnabled = Boolean(options.intervalsEnabled);
  let activeMetricKey = typeof options.initialMetricKey === "string"
    ? options.initialMetricKey
    : null;
  let heatmapArea = null;

  const totals = {
    count: 0,
    distance: 0,
    moving_time: 0,
    elevation: 0,
    avg_pace_mps: 0,
    avg_efficiency_factor: 0,
    avg_fitness: 0,
    avg_fatigue: 0,
    _pace_weight_seconds: 0,
    _pace_weighted_sum: 0,
    _eff_weight_seconds: 0,
    _eff_weighted_sum: 0,
    _fitness_weight: 0,
    _fitness_sum: 0,
    _fatigue_weight: 0,
    _fatigue_sum: 0,
  };
  Object.entries(aggregates || {}).forEach(([, entry]) => {
    totals.count += entry.count || 0;
    totals.distance += entry.distance || 0;
    totals.moving_time += entry.moving_time || 0;
    totals.elevation += entry.elevation_gain || 0;
    metricMaxByKey.distance = Math.max(metricMaxByKey.distance, Number(entry.distance || 0));
    metricMaxByKey.moving_time = Math.max(metricMaxByKey.moving_time, Number(entry.moving_time || 0));
    metricMaxByKey.elevation_gain = Math.max(metricMaxByKey.elevation_gain, Number(entry.elevation_gain || 0));
    updateMetricRange(metricRangeByKey, "distance", entry.distance);
    updateMetricRange(metricRangeByKey, "moving_time", entry.moving_time);
    updateMetricRange(metricRangeByKey, "elevation_gain", entry.elevation_gain);
    const entryPace = derivePaceMpsFromEntry(entry);
    metricMaxByKey[PACE_METRIC_KEY] = Math.max(metricMaxByKey[PACE_METRIC_KEY], entryPace);
    updateMetricRange(metricRangeByKey, PACE_METRIC_KEY, entryPace);
    metricMaxByKey[EFFICIENCY_METRIC_KEY] = Math.max(
      metricMaxByKey[EFFICIENCY_METRIC_KEY],
      Number(entry[EFFICIENCY_METRIC_KEY] || 0),
    );
    updateMetricRange(metricRangeByKey, EFFICIENCY_METRIC_KEY, entry[EFFICIENCY_METRIC_KEY]);
    metricMaxByKey[FITNESS_METRIC_KEY] = Math.max(
      metricMaxByKey[FITNESS_METRIC_KEY],
      Number(entry[FITNESS_METRIC_KEY] || 0),
    );
    updateMetricRange(metricRangeByKey, FITNESS_METRIC_KEY, entry[FITNESS_METRIC_KEY]);
    metricMaxByKey[FATIGUE_METRIC_KEY] = Math.max(
      metricMaxByKey[FATIGUE_METRIC_KEY],
      Number(entry[FATIGUE_METRIC_KEY] || 0),
    );
    updateMetricRange(metricRangeByKey, FATIGUE_METRIC_KEY, entry[FATIGUE_METRIC_KEY]);

    const dayWeightSeconds = Number(entry.moving_time || 0);
    const dayCount = Number(entry.count || 0);
    const dayPace = entryPace;
    if (dayWeightSeconds > 0 && dayPace > 0) {
      totals._pace_weighted_sum += dayPace * dayWeightSeconds;
      totals._pace_weight_seconds += dayWeightSeconds;
    }
    const dayEfficiency = Number(entry[EFFICIENCY_METRIC_KEY] || 0);
    if (dayWeightSeconds > 0 && dayEfficiency > 0) {
      totals._eff_weighted_sum += dayEfficiency * dayWeightSeconds;
      totals._eff_weight_seconds += dayWeightSeconds;
    }
    const dayFitness = Number(entry[FITNESS_METRIC_KEY] || 0);
    if (dayCount > 0 && Number.isFinite(dayFitness) && dayFitness > 0) {
      totals._fitness_sum += dayFitness * dayCount;
      totals._fitness_weight += dayCount;
    }
    const dayFatigue = Number(entry[FATIGUE_METRIC_KEY] || 0);
    if (dayCount > 0 && Number.isFinite(dayFatigue) && dayFatigue > 0) {
      totals._fatigue_sum += dayFatigue * dayCount;
      totals._fatigue_weight += dayCount;
    }
  });
  metricMaxByKey[ACTIVE_DAYS_METRIC_KEY] = totals.count > 0 ? 1 : 0;
  if (totals._pace_weight_seconds > 0) {
    totals.avg_pace_mps = totals._pace_weighted_sum / totals._pace_weight_seconds;
  }
  if (totals._eff_weight_seconds > 0) {
    totals.avg_efficiency_factor = totals._eff_weighted_sum / totals._eff_weight_seconds;
  }
  if (totals._fitness_weight > 0) {
    totals.avg_fitness = totals._fitness_sum / totals._fitness_weight;
  }
  if (totals._fatigue_weight > 0) {
    totals.avg_fatigue = totals._fatigue_sum / totals._fatigue_weight;
  }

  const renderHeatmap = () => {
    const nextHeatmapArea = buildHeatmapArea(aggregates, year, units, colors, type, layout, {
      ...heatmapOptions,
      metricHeatmapKey: activeMetricKey,
    });
    if (heatmapArea && heatmapArea.parentNode === body) {
      body.replaceChild(nextHeatmapArea, heatmapArea);
    } else {
      body.appendChild(nextHeatmapArea);
    }
    heatmapArea = nextHeatmapArea;
  };

  const metricItems = buildYearMetricStatItems(totals, units, activeMetricKey, { intervalsEnabled });
  const filterableMetricKeys = [];
  metricItems.forEach((item) => {
    if (!item || !item.filterable) return;
    if (Array.isArray(item.filterableMetricKeys) && item.filterableMetricKeys.length) {
      item.filterableMetricKeys.forEach((key) => {
        if (typeof key === "string" && key && !filterableMetricKeys.includes(key)) {
          filterableMetricKeys.push(key);
        }
      });
      return;
    }
    if (typeof item.key === "string" && item.key && !filterableMetricKeys.includes(item.key)) {
      filterableMetricKeys.push(item.key);
    }
  });
  if (totals.count > 0) {
    filterableMetricKeys.push(ACTIVE_DAYS_METRIC_KEY);
  }
  activeMetricKey = normalizeSingleSelectKey(activeMetricKey, filterableMetricKeys);
  const metricButtons = new Map();
  const reportYearMetricState = (source) => {
    if (!onYearMetricStateChange || !Number.isFinite(cardMetricYear)) return;
    onYearMetricStateChange({
      year: cardMetricYear,
      metricKey: activeMetricKey,
      filterableMetricKeys: filterableMetricKeys.slice(),
      source,
    });
  };
  const renderMetricButtonState = () => {
    const dynamicItems = buildYearMetricStatItems(totals, units, activeMetricKey, { intervalsEnabled });
    renderSingleSelectButtonState(dynamicItems, metricButtons, activeMetricKey);
  };

  const statItems = [
    ...metricItems.map((item) => ({
      label: item.label,
      value: item.value,
      cardOptions: item.filterable
        ? {
          tagName: "button",
          className: "card-stat more-stats-fact-card more-stats-fact-button",
          extraClasses: [`year-metric-${item.key.replace(/_/g, "-")}`],
          ariaPressed: false,
        }
        : undefined,
      enhance: (statCard) => {
        if (!item.filterable) return;
        metricButtons.set(item.key, statCard);
        if (item.key === FIT_FAT_CYCLE_KEY) {
          statCard.addEventListener("click", () => {
            if (activeMetricKey === FITNESS_METRIC_KEY) {
              activeMetricKey = FATIGUE_METRIC_KEY;
            } else if (activeMetricKey === FATIGUE_METRIC_KEY) {
              activeMetricKey = null;
            } else {
              activeMetricKey = FITNESS_METRIC_KEY;
            }
            renderMetricButtonState();
            renderHeatmap();
            reportYearMetricState("card");
            schedulePostInteractionAlignment();
          });
          return;
        }
        attachSingleSelectCardToggle(statCard, {
          itemKey: item.key,
          getActiveKey: () => activeMetricKey,
          setActiveKey: (nextMetricKey) => {
            activeMetricKey = nextMetricKey;
          },
          onToggleComplete: () => {
            renderMetricButtonState();
            renderHeatmap();
            reportYearMetricState("card");
            schedulePostInteractionAlignment();
          },
        });
      },
    })),
  ];
  const stats = buildSideStatColumn(statItems, { className: "card-stats side-stats-column" });
  card.dataset.totalActivities = String(Math.max(0, Math.round(totals.count)));
  renderHeatmap();
  renderMetricButtonState();
  reportYearMetricState("init");

  body.appendChild(stats);
  card.appendChild(body);
  return card;
}

function buildCombinedChronicleCard(payload, types, years, units, options = {}) {
  const card = document.createElement("section");
  card.className = "card chronicle-stage";
  const layout = getLayout();
  const stageYears = years
    .map((year) => {
      const yearAggregates = combineYearAggregates(payload.aggregates?.[String(year)] || {}, types);
      const totalActivities = Object.values(yearAggregates).reduce((sum, entry) => sum + Number(entry?.count || 0), 0);
      return {
        year,
        aggregates: yearAggregates,
        totalActivities,
      };
    })
    .filter((entry) => entry.totalActivities > 0);

  if (!stageYears.length) {
    return {
      card: buildEmptySelectionCard(),
      filterableMetricKeys: [],
    };
  }

  const intervalsEnabled = Boolean(options.intervalsEnabled);
  const selectedTypes = Array.isArray(types) ? types.slice() : [];
  const accentFallback = getActivityFrequencyCardColor(selectedTypes);
  const lensColor = options.metricHeatmapColor || accentFallback;
  const metricMaxByKey = {
    [ACTIVE_DAYS_METRIC_KEY]: 0,
    distance: 0,
    moving_time: 0,
    elevation_gain: 0,
    [PACE_METRIC_KEY]: 0,
    [EFFICIENCY_METRIC_KEY]: 0,
    [FITNESS_METRIC_KEY]: 0,
    [FATIGUE_METRIC_KEY]: 0,
  };
  const metricRangeByKey = {};
  const totals = {
    count: 0,
    active_days: 0,
    distance: 0,
    moving_time: 0,
    elevation: 0,
    avg_pace_mps: 0,
    avg_efficiency_factor: 0,
    avg_fitness: 0,
    avg_fatigue: 0,
    _pace_weight_seconds: 0,
    _pace_weighted_sum: 0,
    _eff_weight_seconds: 0,
    _eff_weighted_sum: 0,
    _fitness_weight: 0,
    _fitness_sum: 0,
    _fatigue_weight: 0,
    _fatigue_sum: 0,
  };

  stageYears.forEach((yearEntry) => {
    Object.values(yearEntry.aggregates || {}).forEach((entry) => {
      totals.count += Number(entry.count || 0);
      totals.active_days += Number(entry.count || 0) > 0 ? 1 : 0;
      totals.distance += Number(entry.distance || 0);
      totals.moving_time += Number(entry.moving_time || 0);
      totals.elevation += Number(entry.elevation_gain || 0);
      metricMaxByKey.distance = Math.max(metricMaxByKey.distance, Number(entry.distance || 0));
      metricMaxByKey.moving_time = Math.max(metricMaxByKey.moving_time, Number(entry.moving_time || 0));
      metricMaxByKey.elevation_gain = Math.max(metricMaxByKey.elevation_gain, Number(entry.elevation_gain || 0));
      updateMetricRange(metricRangeByKey, "distance", entry.distance);
      updateMetricRange(metricRangeByKey, "moving_time", entry.moving_time);
      updateMetricRange(metricRangeByKey, "elevation_gain", entry.elevation_gain);

      const entryPace = derivePaceMpsFromEntry(entry);
      metricMaxByKey[PACE_METRIC_KEY] = Math.max(metricMaxByKey[PACE_METRIC_KEY], entryPace);
      updateMetricRange(metricRangeByKey, PACE_METRIC_KEY, entryPace);

      metricMaxByKey[EFFICIENCY_METRIC_KEY] = Math.max(
        metricMaxByKey[EFFICIENCY_METRIC_KEY],
        Number(entry[EFFICIENCY_METRIC_KEY] || 0),
      );
      updateMetricRange(metricRangeByKey, EFFICIENCY_METRIC_KEY, entry[EFFICIENCY_METRIC_KEY]);
      metricMaxByKey[FITNESS_METRIC_KEY] = Math.max(
        metricMaxByKey[FITNESS_METRIC_KEY],
        Number(entry[FITNESS_METRIC_KEY] || 0),
      );
      updateMetricRange(metricRangeByKey, FITNESS_METRIC_KEY, entry[FITNESS_METRIC_KEY]);
      metricMaxByKey[FATIGUE_METRIC_KEY] = Math.max(
        metricMaxByKey[FATIGUE_METRIC_KEY],
        Number(entry[FATIGUE_METRIC_KEY] || 0),
      );
      updateMetricRange(metricRangeByKey, FATIGUE_METRIC_KEY, entry[FATIGUE_METRIC_KEY]);

      const entryMovingTime = Number(entry.moving_time || 0);
      const entryCount = Number(entry.count || 0);
      if (entryMovingTime > 0 && entryPace > 0) {
        totals._pace_weighted_sum += entryPace * entryMovingTime;
        totals._pace_weight_seconds += entryMovingTime;
      }
      const entryEfficiency = Number(entry[EFFICIENCY_METRIC_KEY] || 0);
      if (entryMovingTime > 0 && entryEfficiency > 0) {
        totals._eff_weighted_sum += entryEfficiency * entryMovingTime;
        totals._eff_weight_seconds += entryMovingTime;
      }
      const entryFitness = Number(entry[FITNESS_METRIC_KEY] || 0);
      if (entryCount > 0 && entryFitness > 0) {
        totals._fitness_sum += entryFitness * entryCount;
        totals._fitness_weight += entryCount;
      }
      const entryFatigue = Number(entry[FATIGUE_METRIC_KEY] || 0);
      if (entryCount > 0 && entryFatigue > 0) {
        totals._fatigue_sum += entryFatigue * entryCount;
        totals._fatigue_weight += entryCount;
      }
    });
  });
  metricMaxByKey[ACTIVE_DAYS_METRIC_KEY] = totals.active_days > 0 ? 1 : 0;
  if (totals._pace_weight_seconds > 0) {
    totals.avg_pace_mps = totals._pace_weighted_sum / totals._pace_weight_seconds;
  }
  if (totals._eff_weight_seconds > 0) {
    totals.avg_efficiency_factor = totals._eff_weighted_sum / totals._eff_weight_seconds;
  }
  if (totals._fitness_weight > 0) {
    totals.avg_fitness = totals._fitness_sum / totals._fitness_weight;
  }
  if (totals._fatigue_weight > 0) {
    totals.avg_fatigue = totals._fatigue_sum / totals._fatigue_weight;
  }

  const metricItems = buildYearMetricStatItems(totals, units, null, { intervalsEnabled });
  const filterableMetricKeys = [ACTIVE_DAYS_METRIC_KEY];
  metricItems.forEach((item) => {
    if (!item || !item.filterable) return;
    if (Array.isArray(item.filterableMetricKeys) && item.filterableMetricKeys.length) {
      item.filterableMetricKeys.forEach((metricKey) => {
        if (typeof metricKey === "string" && metricKey && !filterableMetricKeys.includes(metricKey)) {
          filterableMetricKeys.push(metricKey);
        }
      });
      return;
    }
    if (typeof item.key === "string" && item.key && !filterableMetricKeys.includes(item.key)) {
      filterableMetricKeys.push(item.key);
    }
  });

  const normalizedMetricKey = normalizeSingleSelectKey(
    typeof options.initialMetricKey === "string" ? options.initialMetricKey : null,
    filterableMetricKeys,
  );
  const activeMetricKey = normalizedMetricKey;
  const lensMeta = getChronicleLensMeta(activeMetricKey, lensColor);
  const lensRgb = hexToRgb(lensMeta.accent);
  const lensSoft = lensRgb ? `rgba(${lensRgb.r}, ${lensRgb.g}, ${lensRgb.b}, 0.18)` : "rgba(255, 138, 91, 0.18)";
  const lensGlow = lensRgb ? `rgba(${lensRgb.r}, ${lensRgb.g}, ${lensRgb.b}, 0.34)` : "rgba(255, 138, 91, 0.34)";
  card.style.setProperty("--chronicle-accent", lensMeta.accent);
  card.style.setProperty("--chronicle-accent-soft", lensSoft);
  card.style.setProperty("--chronicle-accent-glow", lensGlow);
  card.dataset.activeLens = activeMetricKey || ACTIVE_DAYS_METRIC_KEY;
  card.dataset.totalActivities = String(Math.max(0, Math.round(totals.count)));

  const body = document.createElement("div");
  body.className = "chronicle-stage-body";

  const graphShell = document.createElement("div");
  graphShell.className = "chronicle-stage-graph-shell";
  const graph = document.createElement("div");
  graph.className = "chronicle-stage-graph";
  const colorForEntry = (entry) => {
    if (!entry.types || entry.types.length === 0) {
      return {
        background: DEFAULT_COLORS[0],
        backgroundImage: "",
      };
    }
    if (entry.types.length === 1) {
      return {
        background: getColors(entry.types[0])[4],
        backgroundImage: "",
      };
    }
    return {
      background: getColors(entry.types[0])[4] || MULTI_TYPE_COLOR,
      backgroundImage: buildMultiTypeBackgroundImage(entry.types),
    };
  };

  const onLensChange = typeof options.onLensChange === "function"
    ? options.onLensChange
    : null;

  stageYears.forEach((yearEntry, index) => {
    const band = document.createElement("section");
    band.className = "chronicle-year-band";

    const bandMeta = document.createElement("div");
    bandMeta.className = "chronicle-year-band-meta";
    const bandYear = document.createElement("div");
    bandYear.className = "chronicle-year-band-label";
    bandYear.textContent = String(yearEntry.year);
    const bandSummary = document.createElement("div");
    bandSummary.className = "chronicle-year-band-summary";
    bandSummary.textContent = `(${formatNumber(yearEntry.totalActivities, 0)})`;
    bandMeta.appendChild(bandYear);
    bandMeta.appendChild(bandSummary);

    const heatmapArea = buildHeatmapArea(
      yearEntry.aggregates,
      yearEntry.year,
      units,
      DEFAULT_COLORS,
      "all",
      layout,
      {
        ...options,
        weekStart: options.weekStart,
        metricHeatmapKey: activeMetricKey,
        metricMaxByKey,
        metricRangeByKey,
        metricHeatmapColor: lensMeta.accent,
        metricHeatmapEmptyColor: DEFAULT_COLORS[0],
        colorForEntry,
        selectedTypes,
      },
    );
    if (index > 0) {
      heatmapArea.classList.add("heatmap-area-compact");
    }
    const heatmapWrap = document.createElement("div");
    heatmapWrap.className = "chronicle-year-band-heatmap";
    heatmapWrap.appendChild(heatmapArea);
    band.appendChild(bandMeta);
    band.appendChild(heatmapWrap);
    graph.appendChild(band);
  });

  const lensRow = document.createElement("div");
  lensRow.className = "chronicle-lens-row";
  const metricValueByKey = {
    [ACTIVE_DAYS_METRIC_KEY]: formatNumber(totals.active_days, 0),
    moving_time: formatDuration(totals.moving_time),
    distance: totals.distance > 0
      ? formatDistance(totals.distance, units || DEFAULT_UNITS)
      : STAT_PLACEHOLDER,
    elevation_gain: totals.elevation > 0
      ? formatElevation(totals.elevation, units || DEFAULT_UNITS)
      : STAT_PLACEHOLDER,
    [PACE_METRIC_KEY]: formatPaceFromMps(totals.avg_pace_mps, units || DEFAULT_UNITS),
    [EFFICIENCY_METRIC_KEY]: formatEfficiency(totals.avg_efficiency_factor),
    [FITNESS_METRIC_KEY]: totals.avg_fitness > 0 ? formatNumber(totals.avg_fitness, 0) : STAT_PLACEHOLDER,
    [FATIGUE_METRIC_KEY]: totals.avg_fatigue > 0 ? formatNumber(totals.avg_fatigue, 0) : STAT_PLACEHOLDER,
  };
  filterableMetricKeys.forEach((metricKey) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chronicle-lens-button";
    const lensSpec = getChronicleLensMeta(metricKey, lensColor);
    button.style.setProperty("--chronicle-lens-accent", lensSpec.accent);
    button.classList.toggle("active", metricKey === activeMetricKey);
    button.setAttribute("aria-pressed", metricKey === activeMetricKey ? "true" : "false");
    button.title = `${METRIC_LABEL_BY_KEY[metricKey] || "Lens"} filter`;
    const topLine = document.createElement("span");
    topLine.className = "chronicle-lens-button-topline";
    topLine.appendChild(createChronicleLensIcon(metricKey));
    const label = document.createElement("span");
    label.className = "chronicle-lens-button-label";
    label.textContent = METRIC_LABEL_BY_KEY[metricKey] || "Lens";
    topLine.appendChild(label);
    const value = document.createElement("span");
    value.className = "chronicle-lens-button-value";
    value.textContent = metricValueByKey[metricKey] || STAT_PLACEHOLDER;
    button.appendChild(topLine);
    button.appendChild(value);
    button.addEventListener("click", () => {
      if (!onLensChange) return;
      onLensChange(metricKey === activeMetricKey ? null : metricKey);
    });
    lensRow.appendChild(button);
  });

  graphShell.appendChild(graph);
  const storySlot = document.createElement("div");
  storySlot.className = "chronicle-stage-story-slot";
  body.appendChild(lensRow);
  body.appendChild(graphShell);
  body.appendChild(storySlot);
  card.appendChild(body);

  return {
    card,
    filterableMetricKeys,
    attachStoryPatterns(panel) {
      if (!(panel instanceof HTMLElement)) return;
      storySlot.innerHTML = "";
      storySlot.appendChild(panel);
    },
  };
}

function buildEmptySelectionCard() {
  const card = document.createElement("div");
  card.className = "card card-empty-selection";
  const body = document.createElement("div");
  body.className = "card-empty-selection-body";
  const emptyStat = buildSideStatCard("No activities for current filters", "", {
    className: "card-stat card-empty-selection-stat",
  });
  body.appendChild(emptyStat);
  card.appendChild(body);
  return card;
}

function buildLabeledCardRow(label, card, kind) {
  const row = document.createElement("div");
  row.className = "labeled-card-row";
  if (kind) {
    row.classList.add(`labeled-card-row-${kind}`);
  }
  if (card?.classList?.contains("card")) {
    card.classList.add("card-with-labeled-title");
  }

  const title = document.createElement("div");
  title.className = "card-title labeled-card-title";
  if (kind === "year" && card?.dataset?.totalActivities) {
    const totalActivitiesRaw = Number(card.dataset.totalActivities || 0);
    const totalActivities = Number.isFinite(totalActivitiesRaw)
      ? Math.max(0, Math.round(totalActivitiesRaw))
      : 0;
    title.textContent = `${label} - Total Activities ${totalActivities.toLocaleString()}`;
  } else {
    title.textContent = label;
  }

  card.insertBefore(title, card.firstChild);
  row.appendChild(card);
  return row;
}

function combineYearAggregates(yearData, types) {
  const combined = {};
  types.forEach((type) => {
    const entries = yearData?.[type] || {};
    Object.entries(entries).forEach(([dateStr, entry]) => {
      if (!combined[dateStr]) {
        combined[dateStr] = {
          count: 0,
          distance: 0,
          moving_time: 0,
          elevation_gain: 0,
          _pace_weighted_sum: 0,
          _pace_weight_seconds: 0,
          _eff_weighted_sum: 0,
          _eff_weight_seconds: 0,
          _fitness_weighted_sum: 0,
          _fitness_weight_count: 0,
          _fatigue_weighted_sum: 0,
          _fatigue_weight_count: 0,
          types: new Set(),
        };
      }
      combined[dateStr].count += entry.count || 0;
      combined[dateStr].distance += entry.distance || 0;
      combined[dateStr].moving_time += entry.moving_time || 0;
      combined[dateStr].elevation_gain += entry.elevation_gain || 0;
      const entryMovingTime = Number(entry.moving_time || 0);
      const entryCount = Number(entry.count || 0);
      const entryPace = derivePaceMpsFromEntry(entry);
      if (entryMovingTime > 0 && entryPace > 0) {
        combined[dateStr]._pace_weighted_sum += entryPace * entryMovingTime;
        combined[dateStr]._pace_weight_seconds += entryMovingTime;
      }
      const entryEfficiency = Number(entry[EFFICIENCY_METRIC_KEY] || 0);
      if (entryMovingTime > 0 && entryEfficiency > 0) {
        combined[dateStr]._eff_weighted_sum += entryEfficiency * entryMovingTime;
        combined[dateStr]._eff_weight_seconds += entryMovingTime;
      }
      const entryFitness = Number(entry[FITNESS_METRIC_KEY] || 0);
      if (entryCount > 0 && entryFitness > 0) {
        combined[dateStr]._fitness_weighted_sum += entryFitness * entryCount;
        combined[dateStr]._fitness_weight_count += entryCount;
      }
      const entryFatigue = Number(entry[FATIGUE_METRIC_KEY] || 0);
      if (entryCount > 0 && entryFatigue > 0) {
        combined[dateStr]._fatigue_weighted_sum += entryFatigue * entryCount;
        combined[dateStr]._fatigue_weight_count += entryCount;
      }
      if ((entry.count || 0) > 0) {
        combined[dateStr].types.add(type);
      }
    });
  });

  const result = {};
  Object.entries(combined).forEach(([dateStr, entry]) => {
    result[dateStr] = {
      count: entry.count,
      distance: entry.distance,
      moving_time: entry.moving_time,
      elevation_gain: entry.elevation_gain,
      ...(entry._pace_weight_seconds > 0
        ? { [PACE_METRIC_KEY]: entry._pace_weighted_sum / entry._pace_weight_seconds }
        : {}),
      ...(entry._eff_weight_seconds > 0
        ? { [EFFICIENCY_METRIC_KEY]: entry._eff_weighted_sum / entry._eff_weight_seconds }
        : {}),
      ...(entry._fitness_weight_count > 0
        ? { [FITNESS_METRIC_KEY]: entry._fitness_weighted_sum / entry._fitness_weight_count }
        : {}),
      ...(entry._fatigue_weight_count > 0
        ? { [FATIGUE_METRIC_KEY]: entry._fatigue_weighted_sum / entry._fatigue_weight_count }
        : {}),
      types: Array.from(entry.types),
    };
  });
  return result;
}

function getFilteredActivities(payload, types, years) {
  const activities = payload.activities || [];
  if (!activities.length) return [];
  const yearSet = new Set(years.map(Number));
  const typeSet = new Set(types);
  return activities.filter((activity) => (
    typeSet.has(activity.type) && yearSet.has(Number(activity.year))
  ));
}

function getTypeYearTotals(payload, type, years) {
  const totals = new Map();
  years.forEach((year) => {
    const entries = payload.aggregates?.[String(year)]?.[type] || {};
    let total = 0;
    Object.values(entries).forEach((entry) => {
      total += entry.count || 0;
    });
    totals.set(year, total);
  });
  return totals;
}

function getTypesYearTotals(payload, types, years) {
  if (types.length === 1) {
    return getTypeYearTotals(payload, types[0], years);
  }
  const totals = new Map();
  years.forEach((year) => {
    const yearData = payload.aggregates?.[String(year)] || {};
    let total = 0;
    types.forEach((type) => {
      Object.values(yearData?.[type] || {}).forEach((entry) => {
        total += entry.count || 0;
      });
    });
    totals.set(year, total);
  });
  return totals;
}

function getVisibleYears(years) {
  return years.slice().sort((a, b) => b - a);
}

function getActivityFrequencyCardColor(types) {
  if (types.length === 1) {
    return getColors(types[0])[4];
  }
  return MULTI_TYPE_COLOR;
}

function buildStatPanel(title, subtitle) {
  const panel = document.createElement("div");
  panel.className = "stat-panel";
  if (title) {
    const titleEl = document.createElement("div");
    titleEl.className = "card-title";
    titleEl.textContent = title;
    panel.appendChild(titleEl);
  }
  if (subtitle) {
    const subtitleEl = document.createElement("div");
    subtitleEl.className = "stat-subtitle";
    subtitleEl.textContent = subtitle;
    panel.appendChild(subtitleEl);
  }
  const body = document.createElement("div");
  body.className = "stat-body";
  panel.appendChild(body);
  return { panel, body };
}

function buildStatsOverview(payload, types, years, color, options = {}) {
  const card = document.createElement("div");
  card.className = "card more-stats chronicle-story-patterns";

  const body = document.createElement("div");
  body.className = "more-stats-body";

  const graphs = document.createElement("div");
  graphs.className = "more-stats-grid";
  const facts = document.createElement("div");
  facts.className = "more-stats-facts";
  const factGrid = document.createElement("div");
  factGrid.className = "more-stats-fact-grid";

  const yearsDesc = years.slice().sort((a, b) => b - a);
  const emptyColor = DEFAULT_COLORS[0];
  const selectedYearSet = new Set(yearsDesc.map(Number));
  const units = normalizeUnits(options.units || payload.units || DEFAULT_UNITS);
  const onFactStateChange = typeof options.onFactStateChange === "function"
    ? options.onFactStateChange
    : null;
  const onMetricStateChange = typeof options.onMetricStateChange === "function"
    ? options.onMetricStateChange
    : null;
  let activeFactKey = typeof options.initialFactKey === "string"
    ? options.initialFactKey
    : null;
  let activeMetricKey = typeof options.initialMetricKey === "string"
    ? options.initialMetricKey
    : null;
  const aggregateYears = payload.aggregates || {};
  const activities = getFilteredActivities(payload, types, yearsDesc)
    .map((activity) => {
      const dateStr = String(activity.date || "");
      const date = new Date(`${dateStr}T00:00:00`);
      const year = Number(activity.year);
      const rawHour = activity.hour;
      const hourValue = Number(rawHour);
      const hasHour = rawHour !== null
        && rawHour !== undefined
        && Number.isFinite(hourValue)
        && hourValue >= 0
        && hourValue <= 23;
      if (!selectedYearSet.has(year) || Number.isNaN(date.getTime())) {
        return null;
      }
      const dayEntry = aggregateYears?.[String(year)]?.[activity.type]?.[dateStr] || null;
      const dayEntryCount = Number(dayEntry?.count || 0);
      const perActivityMetricValue = (metricKey) => {
        if (dayEntryCount <= 0) return 0;
        const dayValue = Number(dayEntry?.[metricKey] || 0);
        return Number.isFinite(dayValue) && dayValue > 0
          ? dayValue / dayEntryCount
          : 0;
      };
      return {
        date,
        type: activity.type,
        subtype: getActivitySubtypeLabel(activity),
        year,
        dayIndex: date.getDay(),
        monthIndex: date.getMonth(),
        weekIndex: weekOfYear(date),
        hour: hasHour ? hourValue : null,
        active_days: 1,
        distance: perActivityMetricValue("distance"),
        moving_time: perActivityMetricValue("moving_time"),
        elevation_gain: perActivityMetricValue("elevation_gain"),
      };
    })
    .filter(Boolean);

  const activityYears = new Set(activities.map((activity) => Number(activity.year)));
  const visibleYearsDesc = yearsDesc.filter((year) => activityYears.has(Number(year)));
  const yearIndex = new Map();
  visibleYearsDesc.forEach((year, index) => {
    yearIndex.set(Number(year), index);
  });

  const formatBreakdown = (total, breakdown) => formatTooltipBreakdown(total, breakdown, types);

  const dayDisplayLabels = ["Sun", "", "", "Wed", "", "", "Sat"];
  const monthDisplayLabels = ["Jan", "", "Mar", "", "May", "", "Jul", "", "Sep", "", "Nov", ""];

  const buildZeroedMatrix = (columns) => visibleYearsDesc.map(() => new Array(columns).fill(0));
  const buildBreakdownMatrix = (columns) => visibleYearsDesc.map(() => (
    Array.from({ length: columns }, () => createTooltipBreakdown())
  ));

  const buildFrequencyData = (filterFn, metricKey = null) => {
    const dayMatrix = buildZeroedMatrix(7);
    const dayBreakdowns = buildBreakdownMatrix(7);
    const monthMatrix = buildZeroedMatrix(12);
    const monthBreakdowns = buildBreakdownMatrix(12);
    const hourMatrix = buildZeroedMatrix(24);
    const hourBreakdowns = buildBreakdownMatrix(24);
    const weekTotals = new Array(54).fill(0);
    let activityCount = 0;
    let hourActivityCount = 0;

    activities.forEach((activity) => {
      if (typeof filterFn === "function" && !filterFn(activity)) {
        return;
      }
      const row = yearIndex.get(activity.year);
      if (row === undefined) return;
      const weight = metricKey === ACTIVE_DAYS_METRIC_KEY
        ? Number(activity.active_days || 0)
        : metricKey
        ? Number(activity[metricKey] || 0)
        : 1;

      activityCount += 1;
      dayMatrix[row][activity.dayIndex] += weight;
      monthMatrix[row][activity.monthIndex] += weight;
      if (activity.weekIndex >= 1 && activity.weekIndex < weekTotals.length) {
        weekTotals[activity.weekIndex] += weight;
      }

      const dayBucket = dayBreakdowns[row][activity.dayIndex];
      const monthBucket = monthBreakdowns[row][activity.monthIndex];
      addTooltipBreakdownCount(dayBucket, activity.type, activity.subtype);
      addTooltipBreakdownCount(monthBucket, activity.type, activity.subtype);

      if (Number.isFinite(activity.hour)) {
        hourActivityCount += 1;
        hourMatrix[row][activity.hour] += weight;
        const hourBucket = hourBreakdowns[row][activity.hour];
        addTooltipBreakdownCount(hourBucket, activity.type, activity.subtype);
      }
    });

    const dayTotals = dayMatrix.reduce(
      (acc, row) => row.map((value, index) => acc[index] + value),
      new Array(7).fill(0),
    );
    const monthTotals = monthMatrix.reduce(
      (acc, row) => row.map((value, index) => acc[index] + value),
      new Array(12).fill(0),
    );
    const hourTotals = hourMatrix.reduce(
      (acc, row) => row.map((value, index) => acc[index] + value),
      new Array(24).fill(0),
    );

    return {
      activityCount,
      hourActivityCount,
      dayMatrix,
      dayBreakdowns,
      monthMatrix,
      monthBreakdowns,
      hourMatrix,
      hourBreakdowns,
      weekTotals,
      dayTotals,
      monthTotals,
      hourTotals,
    };
  };

  const baseData = buildFrequencyData();
  const metricTotals = {
    [ACTIVE_DAYS_METRIC_KEY]: activities.reduce((sum, activity) => sum + Number(activity.active_days || 0), 0),
    distance: activities.reduce((sum, activity) => sum + Number(activity.distance || 0), 0),
    moving_time: activities.reduce((sum, activity) => sum + Number(activity.moving_time || 0), 0),
    elevation_gain: activities.reduce((sum, activity) => sum + Number(activity.elevation_gain || 0), 0),
  };
  const metricItems = FREQUENCY_METRIC_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    filterable: Number(metricTotals[item.key] || 0) > 0,
  }));
  const filterableMetricKeys = getFilterableKeys(metricItems);
  if (Number(metricTotals[ACTIVE_DAYS_METRIC_KEY] || 0) > 0) {
    filterableMetricKeys.push(ACTIVE_DAYS_METRIC_KEY);
  }
  activeMetricKey = normalizeSingleSelectKey(activeMetricKey, filterableMetricKeys);
  const reportMetricState = (source) => {
    if (!onMetricStateChange) return;
    onMetricStateChange({
      metricKey: activeMetricKey,
      filterableMetricKeys: filterableMetricKeys.slice(),
      source,
    });
  };
  if (baseData.activityCount <= 0) {
    if (onFactStateChange) {
      onFactStateChange({
        factKey: null,
        filterableFactKeys: [],
        source: "init",
      });
    }
    reportMetricState("init");
    return buildEmptySelectionCard();
  }

  const dayPanel = buildStatPanel("");

  const monthPanel = buildStatPanel("");

  const hourPanel = buildStatPanel("");

  const bestDayIndex = baseData.dayTotals.reduce((best, value, index) => (
    value > baseData.dayTotals[best] ? index : best
  ), 0);
  const bestDayLabel = `${DAYS[bestDayIndex]} (${baseData.dayTotals[bestDayIndex]})`;

  const bestMonthIndex = baseData.monthTotals.reduce((best, value, index) => (
    value > baseData.monthTotals[best] ? index : best
  ), 0);
  const bestMonthLabel = `${MONTHS[bestMonthIndex]} (${baseData.monthTotals[bestMonthIndex]})`;

  const bestHourIndex = baseData.hourTotals.reduce((best, value, index) => (
    value > baseData.hourTotals[best] ? index : best
  ), 0);
  const bestHourLabel = baseData.hourActivityCount > 0
    ? `${formatHourLabel(bestHourIndex)} (${baseData.hourTotals[bestHourIndex]})`
    : "Not enough time data yet";

  const bestWeekIndex = baseData.weekTotals.reduce((best, value, index) => (
    index === 0 ? best : (value > baseData.weekTotals[best] ? index : best)
  ), 1);
  const bestWeekCount = baseData.weekTotals[bestWeekIndex] || 0;
  const bestWeekLabel = bestWeekCount > 0
    ? `Week ${bestWeekIndex} (${bestWeekCount})`
    : "Not enough data yet";

  const graphColumns = [dayPanel.panel, monthPanel.panel, hourPanel.panel];

  graphColumns.forEach((panel) => {
    const col = document.createElement("div");
    col.className = "more-stats-col";
    if (panel === monthPanel.panel) {
      col.dataset.chipAxisAnchor = "true";
    }
    col.appendChild(panel);
    graphs.appendChild(col);
  });

  const factItems = [
    {
      key: "most-active-day",
      label: "Most active day",
      value: bestDayLabel,
      filter: (activity) => activity.dayIndex === bestDayIndex,
      filterable: baseData.activityCount > 0,
    },
    {
      key: "most-active-month",
      label: "Most Active Month",
      value: bestMonthLabel,
      filter: (activity) => activity.monthIndex === bestMonthIndex,
      filterable: baseData.activityCount > 0,
    },
    {
      key: "peak-hour",
      label: "Peak hour",
      value: bestHourLabel,
      filter: (activity) => Number.isFinite(activity.hour) && activity.hour === bestHourIndex,
      filterable: baseData.hourActivityCount > 0,
    },
    {
      key: "most-active-week",
      label: "Most active week",
      value: bestWeekLabel,
      filter: (activity) => activity.weekIndex === bestWeekIndex,
      filterable: bestWeekCount > 0,
    },
  ];

  const filterableFactKeys = getFilterableKeys(factItems);
  activeFactKey = normalizeSingleSelectKey(activeFactKey, filterableFactKeys);
  const reportFactState = (source) => {
    if (!onFactStateChange) return;
    onFactStateChange({
      factKey: activeFactKey,
      filterableFactKeys: filterableFactKeys.slice(),
      source,
    });
  };

  const renderFrequencyGraphs = () => {
    const activeFact = factItems.find((item) => item.key === activeFactKey) || null;
    const matrixData = buildFrequencyData(activeFact?.filter, activeMetricKey);
    const metricLabel = activeMetricKey ? (METRIC_LABEL_BY_KEY[activeMetricKey] || "Metric") : "";
    const formatTooltipValue = (value) => {
      if (!activeMetricKey) return "";
      return `${metricLabel}: ${formatMetricTotal(activeMetricKey, value, units)}`;
    };
    const formatMatrixTooltip = (year, label, value, breakdown) => {
      const lines = [`${year} · ${label}`];
      if (activeMetricKey) {
        lines.push(formatTooltipValue(value));
        const activityTotal = Object.values(breakdown?.typeCounts || {})
          .reduce((sum, count) => sum + count, 0);
        lines.push(formatBreakdown(activityTotal, breakdown));
      } else {
        lines.push(formatBreakdown(value, breakdown));
      }
      return lines.join("\n");
    };

    dayPanel.body.innerHTML = "";
    dayPanel.body.appendChild(
      buildYearMatrix(
        visibleYearsDesc,
        dayDisplayLabels,
        matrixData.dayMatrix,
        color,
        {
          tooltipLabels: DAYS,
          emptyColor,
          tooltipFormatter: (year, label, value, row, col) => {
            const breakdown = matrixData.dayBreakdowns[row][col] || {};
            return formatMatrixTooltip(year, label, value, breakdown);
          },
        },
      ),
    );

    monthPanel.body.innerHTML = "";
    monthPanel.body.appendChild(
      buildYearMatrix(
        visibleYearsDesc,
        monthDisplayLabels,
        matrixData.monthMatrix,
        color,
        {
          tooltipLabels: MONTHS,
          emptyColor,
          tooltipFormatter: (year, label, value, row, col) => {
            const breakdown = matrixData.monthBreakdowns[row][col] || {};
            return formatMatrixTooltip(year, label, value, breakdown);
          },
        },
      ),
    );

    hourPanel.body.innerHTML = "";
    if (matrixData.hourActivityCount > 0) {
      const hourLabels = matrixData.hourTotals.map((_, hour) => (hour % 3 === 0 ? formatHourLabel(hour) : ""));
      const hourTooltipLabels = matrixData.hourTotals.map((_, hour) => `${formatHourLabel(hour)} (${hour}:00)`);
      hourPanel.body.appendChild(
        buildYearMatrix(
          visibleYearsDesc,
          hourLabels,
          matrixData.hourMatrix,
          color,
          {
            tooltipLabels: hourTooltipLabels,
            emptyColor,
            tooltipFormatter: (year, label, value, row, col) => {
              const breakdown = matrixData.hourBreakdowns[row][col] || {};
              return formatMatrixTooltip(year, label, value, breakdown);
            },
          },
        ),
      );
      return;
    }

    const fallback = document.createElement("div");
    fallback.className = "stat-subtitle";
    fallback.textContent = "Time-of-day stats require activity timestamps.";
    hourPanel.body.appendChild(fallback);
  };

  const factButtons = new Map();
  const renderFactButtonState = () => {
    factItems.forEach((item) => {
      const button = factButtons.get(item.key);
      if (!button) return;
      const active = item.key === activeFactKey;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      if (active) {
        button.classList.remove("fact-glow-cleared");
      }
    });
  };

  factItems.forEach((item, index) => {
    const factButton = document.createElement("button");
    factButton.type = "button";
    factButton.className = "more-stats-fact-link";
    if (!item.filterable) {
      factButton.disabled = true;
    }
    factButton.setAttribute("aria-pressed", "false");
    factButton.style.setProperty("--more-stats-fact-accent", color);

    const label = document.createElement("span");
    label.className = "more-stats-fact-label";
    label.textContent = item.label;
    const value = document.createElement("span");
    value.className = "more-stats-fact-value";
    value.textContent = item.value;
    factButton.appendChild(label);
    factButton.appendChild(value);

    if (item.filterable) {
      factButton.addEventListener("click", () => {
        const clearing = activeFactKey === item.key;
        activeFactKey = clearing ? null : item.key;
        if (clearing) {
          factButton.classList.add("fact-glow-cleared");
          factButton.blur();
        } else {
          factButton.classList.remove("fact-glow-cleared");
        }
        renderFactButtonState();
        renderFrequencyGraphs();
        reportFactState("card");
        schedulePostInteractionAlignment();
      });
      if (!useTouchInteractions) {
        factButton.addEventListener("pointerleave", () => {
          factButton.classList.remove("fact-glow-cleared");
        });
      }
    }

    factButtons.set(item.key, factButton);
    factGrid.appendChild(factButton);
    if (index < factItems.length - 1) {
      const separator = document.createElement("span");
      separator.className = "more-stats-fact-separator";
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = "|";
      factGrid.appendChild(separator);
    }
  });

  renderFactButtonState();
  renderFrequencyGraphs();
  reportMetricState("init");
  reportFactState("init");

  facts.appendChild(factGrid);
  body.appendChild(graphs);
  card.appendChild(body);
  card.appendChild(facts);
  return card;
}

function buildYearMatrix(years, colLabels, matrixValues, color, options = {}) {
  const container = document.createElement("div");
  container.className = "stat-matrix";
  if (!years.length || !colLabels.length) {
    return container;
  }

  const matrixArea = document.createElement("div");
  matrixArea.className = "axis-matrix-area";
  matrixArea.style.gridTemplateColumns = "var(--axis-width) max-content";
  matrixArea.style.gridTemplateRows = "var(--label-row-height) auto";
  matrixArea.style.columnGap = "var(--axis-gap)";

  const monthRow = document.createElement("div");
  monthRow.className = "axis-month-row";
  monthRow.style.paddingLeft = "var(--grid-pad-left)";

  const dayCol = document.createElement("div");
  dayCol.className = "axis-day-col";
  dayCol.style.paddingTop = "var(--grid-pad-top)";
  dayCol.style.gap = "var(--gap)";

  years.forEach((year) => {
    const yLabel = document.createElement("div");
    yLabel.className = "day-label axis-y-label";
    yLabel.textContent = String(year);
    yLabel.style.height = "var(--cell)";
    yLabel.style.lineHeight = "var(--cell)";
    dayCol.appendChild(yLabel);
  });

  const grid = document.createElement("div");
  grid.className = "axis-matrix-grid";
  grid.style.gridTemplateColumns = `repeat(${colLabels.length}, var(--cell))`;
  grid.style.gridTemplateRows = `repeat(${years.length}, var(--cell))`;
  grid.style.gap = "var(--gap)";
  grid.style.padding = "var(--grid-pad-top) var(--grid-pad-right) var(--grid-pad-bottom) var(--grid-pad-left)";

  const max = matrixValues.reduce(
    (acc, row) => Math.max(acc, ...row),
    0,
  );
  const tooltipLabels = options.tooltipLabels || colLabels;

  colLabels.forEach((label, colIndex) => {
    if (!label) return;
    const xLabel = document.createElement("div");
    xLabel.className = "month-label axis-x-label";
    xLabel.textContent = label;
    xLabel.style.left = `calc(${colIndex} * (var(--cell) + var(--gap)))`;
    monthRow.appendChild(xLabel);
  });

  years.forEach((year, row) => {
    colLabels.forEach((_, col) => {
      const cell = document.createElement("div");
      cell.className = "cell axis-matrix-cell";
      cell.style.gridRow = String(row + 1);
      cell.style.gridColumn = String(col + 1);
      const value = matrixValues[row]?.[col] || 0;
      if (options.emptyColor && value <= 0) {
        cell.style.background = options.emptyColor;
      } else {
        cell.style.background = heatColor(color, value, max);
      }
      if (options.tooltipFormatter) {
        const label = tooltipLabels[col];
        const tooltipText = options.tooltipFormatter(year, label, value, row, col);
        attachTooltip(cell, tooltipText);
      }
      grid.appendChild(cell);
    });
  });

  matrixArea.appendChild(monthRow);
  matrixArea.appendChild(dayCol);
  matrixArea.appendChild(grid);
  container.appendChild(matrixArea);
  return container;
}

function renderLoadError(error) {
  const detail = error && typeof error.message === "string" && error.message
    ? error.message
    : "Unexpected error.";
  setDashboardTopStatus(detail, "error");
  if (summary) {
    summary.innerHTML = "";
  }
  if (!heatmaps) {
    return;
  }

  heatmaps.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = "Dashboard unavailable";

  const body = document.createElement("div");
  body.className = "stat-subtitle";
  body.textContent = `Could not load dashboard data. ${detail}`;

  card.appendChild(title);
  card.appendChild(body);
  heatmaps.appendChild(card);
}

async function init() {
  initDashboardChrome();
  setDashboardTopStatus("Loading dashboard...", "neutral");
  syncRepoLink();
  syncFooterHostedLink();
  syncStravaProfileLink();
  syncProfileLinkNavigationTarget();
  syncHeaderLinkPlacement();
  const cachedPayload = readCachedDashboardPayload();
  const cachedRevision = dashboardPayloadRevision(cachedPayload);
  let payload;
  let loadedFromCache = false;
  let cacheFallbackReason = "";
  try {
    if (cachedPayload) {
      payload = { ...cachedPayload, revalidating: true };
      loadedFromCache = true;
      cacheFallbackReason = "opening from local snapshot while live data refreshes";
    } else {
      payload = await fetchLiveDashboardPayload();
    }
  } catch (error) {
    if (!cachedPayload) {
      throw error;
    }
    payload = cachedPayload;
    loadedFromCache = true;
    cacheFallbackReason = String(error && error.message ? error.message : "Live dashboard refresh failed.");
  }
  const payloadRevalidating = Boolean(payload.revalidating);
  const repoCandidate = payloadRepoCandidate(payload);
  const profileUrl = payloadProfileUrl(payload);
  const sourceValue = payloadSource(payload);
  syncRepoLink(repoCandidate);
  syncFooterHostedLink(repoCandidate);
  syncStravaProfileLink(
    profileUrl,
    sourceValue,
  );
  setDashboardTitle(sourceValue);
  TYPE_META = payload.type_meta || {};
  OTHER_BUCKET = String(payload.other_bucket || "OtherSports");
  (payload.types || []).forEach((type) => {
    if (!TYPE_META[type]) {
      TYPE_META[type] = { label: prettifyType(type), accent: fallbackColor(type) };
    }
  });

  const typeOptions = [
    { value: "all", label: "All Activities" },
    ...payload.types.map((type) => ({ value: type, label: displayType(type) })),
  ];
  const initialUrlState = readDashboardUrlState();
  const storedScopeState = readStoredDashboardScopeState();
  const resolvedScopeState = {
    types: initialUrlState.hasTypesParam
      ? initialUrlState.types
      : (storedScopeState?.types || []),
    years: initialUrlState.hasYearsParam
      ? initialUrlState.years
      : (storedScopeState?.years || []),
    scopeMode: (initialUrlState.hasStartParam || initialUrlState.hasEndParam)
      ? ((initialUrlState.start && initialUrlState.end) ? "custom" : "preset")
      : (storedScopeState?.scopeMode || "preset"),
    start: (initialUrlState.hasStartParam || initialUrlState.hasEndParam)
      ? initialUrlState.start
      : (storedScopeState?.start || ""),
    end: (initialUrlState.hasStartParam || initialUrlState.hasEndParam)
      ? initialUrlState.end
      : (storedScopeState?.end || ""),
  };
  const dashboardIntervalsEnabled = Boolean(payload?.intervals?.enabled);
  const setupUnits = normalizeUnits(payload.units || DEFAULT_UNITS);
  const setupWeekStart = normalizeWeekStart(payload.week_start || payload.weekStart);

  let resizeTimer = null;
  let lastViewportWidth = window.innerWidth;
  let lastIsNarrowLayout = isNarrowLayoutViewport();

  let allTypesMode = true;
  let selectedTypes = new Set();
  let allYearsMode = true;
  let selectedYears = new Set();
  const payloadDateBounds = getPayloadDateBounds(payload);
  let yearScopeMode = resolvedScopeState.scopeMode === "custom" && resolvedScopeState.start && resolvedScopeState.end
    ? "custom"
    : "preset";
  let customDateRange = normalizeCustomDateRange(resolvedScopeState.start, resolvedScopeState.end, payloadDateBounds);
  let currentUnitSystem = initialUrlState.units || getUnitSystemFromUnits(setupUnits);
  let currentUnits = getUnitsForSystem(currentUnitSystem);
  let currentVisibleYears = payload.years.slice().sort((a, b) => b - a);
  let hoverClearedSummaryType = null;
  let hoverClearedSummaryYearMetricKey = null;
  const selectedYearMetricByYear = new Map();
  let visibleYearMetricYears = new Set();
  let filterableYearMetricsByYear = new Map();
  let selectedFrequencyFactKey = null;
  let visibleFrequencyFilterableFactKeys = new Set();
  let selectedFrequencyMetricKey = null;
  let visibleFrequencyFilterableMetricKeys = new Set();
  let draftTypeMenuSelection = null;
  let draftYearMenuSelection = null;
  let draftYearScopeMode = yearScopeMode;
  let draftCustomDateRange = { ...customDateRange };

  const initialSelectedTypes = payload.types.filter((type) => resolvedScopeState.types.includes(type));
  if (initialSelectedTypes.length > 0 && initialSelectedTypes.length < payload.types.length) {
    allTypesMode = false;
    selectedTypes = new Set(initialSelectedTypes);
  }
  const initialSelectedYears = payload.years.filter((year) => resolvedScopeState.years.includes(Number(year)));
  if (yearScopeMode !== "custom" && initialSelectedYears.length > 0 && initialSelectedYears.length < payload.years.length) {
    allYearsMode = false;
    selectedYears = new Set(initialSelectedYears);
  }
  if (initialUrlState.lens) {
    payload.years.forEach((year) => {
      selectedYearMetricByYear.set(Number(year), initialUrlState.lens);
    });
    selectedFrequencyMetricKey = initialUrlState.lens;
  }

  function hasAnyYearMetricSelection() {
    for (const metricKey of selectedYearMetricByYear.values()) {
      if (metricKey) return true;
    }
    return false;
  }

  function hasAnyFrequencyMetricSelection() {
    return Boolean(selectedFrequencyMetricKey);
  }

  function isDefaultFilterState() {
    return areAllTypesSelected()
      && areAllYearsSelected()
      && yearScopeMode !== "custom"
      && !hasAnyYearMetricSelection()
      && !selectedFrequencyFactKey
      && !hasAnyFrequencyMetricSelection();
  }

  function syncResetAllButtonState() {
    if (!resetAllButton) return;
    resetAllButton.disabled = isDefaultFilterState();
  }

  function syncUnitToggleState() {
    const isMetric = currentUnitSystem === "metric";
    if (imperialUnitsButton) {
      imperialUnitsButton.classList.toggle("active", !isMetric);
      imperialUnitsButton.setAttribute("aria-pressed", isMetric ? "false" : "true");
    }
    if (metricUnitsButton) {
      metricUnitsButton.classList.toggle("active", isMetric);
      metricUnitsButton.setAttribute("aria-pressed", isMetric ? "true" : "false");
    }
  }

  function setUnitSystem(system) {
    const normalizedSystem = system === "metric" ? "metric" : "imperial";
    if (normalizedSystem === currentUnitSystem) {
      syncUnitToggleState();
      return;
    }
    currentUnitSystem = normalizedSystem;
    currentUnits = getUnitsForSystem(currentUnitSystem);
    syncUnitToggleState();
    refreshDashboard();
  }

  function setYearMetricSelection(year, metricKey) {
    const normalizedYear = Number(year);
    if (!Number.isFinite(normalizedYear)) return;
    if (typeof metricKey === "string" && metricKey) {
      selectedYearMetricByYear.set(normalizedYear, metricKey);
      return;
    }
    selectedYearMetricByYear.delete(normalizedYear);
  }

  function getActiveSummaryYearMetricKey() {
    return deriveActiveSummaryYearMetricKey({
      visibleYears: visibleYearMetricYears,
      selectedMetricByYear: selectedYearMetricByYear,
      filterableMetricsByYear: filterableYearMetricsByYear,
    });
  }

  function getActiveSummaryMetricDisplayKey() {
    const yearSummaryMetricKey = getActiveSummaryYearMetricKey();
    if (!yearSummaryMetricKey) return null;
    return selectedFrequencyMetricKey === yearSummaryMetricKey
      ? yearSummaryMetricKey
      : null;
  }

  function syncSummaryYearMetricButtons() {
    if (!summary) return;
    const buttons = Array.from(summary.querySelectorAll(".summary-year-metric-card"));
    if (!buttons.length) return;
    const activeSummaryYearMetricKey = getActiveSummaryMetricDisplayKey();
    if (activeSummaryYearMetricKey && hoverClearedSummaryYearMetricKey === activeSummaryYearMetricKey) {
      hoverClearedSummaryYearMetricKey = null;
    }
    buttons.forEach((button) => {
      const metricKey = String(button.dataset.metricKey || "");
      const active = metricKey === activeSummaryYearMetricKey;
      button.classList.toggle("active", active);
      if (active) {
        button.classList.remove("summary-glow-cleared");
      } else {
        button.classList.toggle("summary-glow-cleared", hoverClearedSummaryYearMetricKey === metricKey);
      }
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function areAllTypesSelected() {
    return allTypesMode;
  }

  function areAllYearsSelected() {
    return allYearsMode;
  }

  function selectedTypesList() {
    if (areAllTypesSelected()) {
      return payload.types.slice();
    }
    return payload.types.filter((type) => selectedTypes.has(type));
  }

  function selectedYearsList(visibleYears) {
    if (yearScopeMode === "custom") {
      return visibleYears.slice();
    }
    if (areAllYearsSelected()) {
      return visibleYears.slice();
    }
    return visibleYears.filter((year) => selectedYears.has(Number(year)));
  }

  function toggleType(value) {
    const nextState = reduceTopButtonSelection({
      rawValue: value,
      allMode: allTypesMode,
      selectedValues: selectedTypes,
      allValues: payload.types,
    });
    allTypesMode = nextState.allMode;
    selectedTypes = nextState.selectedValues;
  }

  function toggleTypeMenu(value) {
    const selection = draftTypeMenuSelection || cloneSelectionState(allTypesMode, selectedTypes);
    const nextState = reduceMenuSelection({
      rawValue: value,
      allMode: selection.allMode,
      selectedValues: selection.selectedValues,
      allValues: payload.types,
      allowToggleOffAll: true,
    });
    draftTypeMenuSelection = nextState;
  }

  function toggleTypeFromSummaryCard(type) {
    toggleType(type);
  }

  function toggleYear(value) {
    const nextState = reduceTopButtonSelection({
      rawValue: value,
      allMode: allYearsMode,
      selectedValues: selectedYears,
      allValues: currentVisibleYears,
      normalizeValue: (rawValue) => Number(rawValue),
    });
    allYearsMode = nextState.allMode;
    selectedYears = nextState.selectedValues;
  }

  function toggleYearMenu(value) {
    if (value === CUSTOM_RANGE_VALUE) {
      draftYearScopeMode = "custom";
      draftCustomDateRange = normalizeCustomDateRange(
        draftCustomDateRange.start,
        draftCustomDateRange.end,
        payloadDateBounds,
      );
      return;
    }
    const selection = draftYearMenuSelection || cloneSelectionState(allYearsMode, selectedYears);
    const nextState = reduceMenuSelection({
      rawValue: value,
      allMode: selection.allMode,
      selectedValues: selection.selectedValues,
      allValues: currentVisibleYears,
      normalizeValue: (rawValue) => Number(rawValue),
      allowToggleOffAll: true,
    });
    draftYearMenuSelection = nextState;
    draftYearScopeMode = "preset";
  }

  function commitTypeMenuSelection() {
    if (!draftTypeMenuSelection) return;
    allTypesMode = draftTypeMenuSelection.allMode;
    selectedTypes = new Set(draftTypeMenuSelection.selectedValues);
    draftTypeMenuSelection = null;
  }

  function commitYearMenuSelection() {
    yearScopeMode = draftYearScopeMode;
    customDateRange = normalizeCustomDateRange(draftCustomDateRange.start, draftCustomDateRange.end, payloadDateBounds);
    if (yearScopeMode === "custom") {
      allYearsMode = true;
      selectedYears.clear();
      draftYearMenuSelection = null;
      return;
    }
    if (!draftYearMenuSelection) return;
    allYearsMode = draftYearMenuSelection.allMode;
    selectedYears = new Set(draftYearMenuSelection.selectedValues);
    draftYearMenuSelection = null;
  }

  function finalizeTypeSelection() {
    if (areAllTypesSelected()) return;
    selectedTypes = new Set(payload.types.filter((type) => selectedTypes.has(type)));
  }

  function finalizeYearSelection() {
    if (yearScopeMode === "custom") return;
    if (!areAllYearsSelected() && selectedYears.size === currentVisibleYears.length) {
      allYearsMode = true;
      selectedYears.clear();
    }
  }

  function setCardScrollKey(card, key) {
    if (!card || !card.dataset) return;
    card.dataset.scrollKey = String(key || "");
  }

  function refreshDashboard(options = {}) {
    if (options.menuOnly) {
      update(options);
      return;
    }
    runDashboardTransition(() => {
      update(options);
    });
  }

  function update(options = {}) {
    const keepTypeMenuOpen = Boolean(options.keepTypeMenuOpen);
    const keepYearMenuOpen = Boolean(options.keepYearMenuOpen);
    const resetTypeMenuScroll = Boolean(options.resetTypeMenuScroll);
    const resetYearMenuScroll = Boolean(options.resetYearMenuScroll);
    const menuOnly = Boolean(options.menuOnly);
    const resetCardScroll = Boolean(options.resetCardScroll);
    const resetViewport = Boolean(options.resetViewport);
    const allTypesSelected = areAllTypesSelected();
    const types = selectedTypesList();
    const baseVisibleYears = getVisibleYears(payload.years);
    currentVisibleYears = baseVisibleYears.slice();
    if (yearScopeMode !== "custom" && !areAllYearsSelected()) {
      const visibleSet = new Set(baseVisibleYears.map(Number));
      Array.from(selectedYears).forEach((year) => {
        if (!visibleSet.has(Number(year))) {
          selectedYears.delete(year);
        }
      });
    }
    const activeCustomRange = normalizeCustomDateRange(
      yearScopeMode === "custom" ? customDateRange.start : "",
      yearScopeMode === "custom" ? customDateRange.end : "",
      payloadDateBounds,
    );
    const scopedPayload = yearScopeMode === "custom"
      ? buildDateScopedPayload(payload, activeCustomRange.start, activeCustomRange.end)
      : payload;
    const visibleYears = getVisibleYears(scopedPayload.years);
    const allYearsSelected = areAllYearsSelected();
    const yearOptions = [
      { value: "all", label: "All Years" },
      ...baseVisibleYears.map((year) => ({ value: String(year), label: String(year) })),
      { value: CUSTOM_RANGE_VALUE, label: "Custom Range" },
    ];
    const typeMenuSelection = draftTypeMenuSelection || { allMode: allTypesMode, selectedValues: selectedTypes };
    const yearMenuSelection = draftYearMenuSelection || { allMode: allYearsMode, selectedValues: selectedYears };
    const typeMenuTypes = selectedTypesListForState(typeMenuSelection, scopedPayload.types || payload.types);
    const yearMenuYears = draftYearScopeMode === "custom"
      ? visibleYears.slice()
      : selectedYearsListForState(yearMenuSelection, baseVisibleYears);
    yearMenuYears.sort((a, b) => b - a);

    renderFilterButtons(yearButtons, yearOptions, (value) => {
      draftYearMenuSelection = null;
      setMenuOpenState(yearMenu, yearMenuButton, false);
      toggleYear(value);
      refreshDashboard();
    });
    renderFilterMenuOptions(
      typeMenuOptions,
      typeOptions,
      typeMenuSelection.selectedValues,
      typeMenuSelection.allMode,
      (value) => {
        toggleTypeMenu(value);
        update({ keepTypeMenuOpen: true, menuOnly: true });
      },
    );
    renderFilterMenuDoneButton(typeMenuOptions, () => {
      commitTypeMenuSelection();
      finalizeTypeSelection();
      setMenuOpenState(typeMenu, typeMenuButton, false);
      refreshDashboard();
    });
    renderYearMenuOptions(
      yearMenuOptions,
      baseVisibleYears,
      yearMenuSelection,
      draftYearScopeMode === "custom",
      (value) => {
        toggleYearMenu(value);
        update({ keepYearMenuOpen: true, menuOnly: true });
      },
      () => {
        toggleYearMenu(CUSTOM_RANGE_VALUE);
        update({ keepYearMenuOpen: true, menuOnly: true });
      },
    );
    renderFilterMenuDoneButton(yearMenuOptions, () => {
      commitYearMenuSelection();
      finalizeYearSelection();
      setMenuOpenState(yearMenu, yearMenuButton, false);
      refreshDashboard();
    });
    syncCustomDateRangePanel(
      draftYearScopeMode === "custom",
      draftYearScopeMode === "custom" ? draftCustomDateRange : activeCustomRange,
      payloadDateBounds,
    );

    syncFilterControlState({
      typeButtons,
      yearButtons,
      selectedTypes,
      selectedYears,
      allTypeValues: payload.types,
      allYearValues: baseVisibleYears,
      allTypesSelected,
      allYearsSelected,
      typeMenuTypes,
      yearMenuYears,
      typeMenuSelection,
      yearMenuSelection,
      typeMenuLabel,
      yearMenuLabel,
      typeClearButton,
      yearClearButton,
      keepTypeMenuOpen,
      keepYearMenuOpen,
      typeMenu,
      yearMenu,
      typeMenuButton,
      yearMenuButton,
      yearMenuCustomActive: draftYearScopeMode === "custom",
      customRange: draftYearScopeMode === "custom" ? draftCustomDateRange : activeCustomRange,
    });

    syncOpenFilterMenuMaxHeights();
    if (resetTypeMenuScroll) {
      resetFilterMenuScroll(typeMenuOptions);
    }
    if (resetYearMenuScroll) {
      resetFilterMenuScroll(yearMenuOptions);
    }

    if (menuOnly) {
      return;
    }
    clearPinnedTooltipCell();
    hideTooltip();

    const years = selectedYearsList(visibleYears);
    years.sort((a, b) => b - a);
    const previousSummaryYearMetricKey = getActiveSummaryYearMetricKey();
    const initialFrequencyMetricKey = selectedFrequencyMetricKey;
    const frequencyCardColor = getActivityFrequencyCardColor(types);
    const activeSummaryTypeCards = allTypesSelected ? new Set() : new Set(types);
    const nextVisibleYearMetricYears = new Set();
    const nextFilterableYearMetricsByYear = new Map();
    const nextVisibleFrequencyFilterableFactKeys = new Set();
    const nextVisibleFrequencyFilterableMetricKeys = new Set();
    const onFrequencyFactStateChange = ({ factKey, filterableFactKeys }) => {
      nextVisibleFrequencyFilterableFactKeys.clear();
      toStringSet(filterableFactKeys).forEach((key) => {
        nextVisibleFrequencyFilterableFactKeys.add(key);
      });
      selectedFrequencyFactKey = typeof factKey === "string" && nextVisibleFrequencyFilterableFactKeys.has(factKey)
        ? factKey
        : null;
      syncResetAllButtonState();
    };
    const onFrequencyMetricStateChange = ({ metricKey, filterableMetricKeys, source }) => {
      nextVisibleFrequencyFilterableMetricKeys.clear();
      toStringSet(filterableMetricKeys).forEach((key) => {
        nextVisibleFrequencyFilterableMetricKeys.add(key);
      });
      const normalizedMetricKey = typeof metricKey === "string" && nextVisibleFrequencyFilterableMetricKeys.has(metricKey)
        ? metricKey
        : null;
      if (source === "card") {
        selectedFrequencyMetricKey = normalizedMetricKey;
        syncSummaryYearMetricButtons();
      }
      syncResetAllButtonState();
    };

    const previousCardScrollOffsets = resetCardScroll
      ? new Map()
      : captureCardScrollOffsets(heatmaps);

    if (heatmaps) {
      heatmaps.innerHTML = "";
      const showMoreStats = true;
      const {
        typeLabelsByDate,
        typeBreakdownsByDate,
        activityLinksByDateType,
      } = buildCombinedTypeDetailsByDate(scopedPayload, types, years);
      const section = document.createElement("div");
      section.className = "type-section chronicle-stage-section";
      const list = document.createElement("div");
      list.className = "type-list";
      const yearTotals = getTypesYearTotals(scopedPayload, types, years);
      const cardYears = years.filter((year) => (yearTotals.get(year) || 0) > 0);
      const combinedSelectionKey = `combined:${types.join("|")}`;
      const activeLensAccent = getChronicleLensMeta(
        previousSummaryYearMetricKey,
        frequencyCardColor,
      ).accent;
      const chronicleStage = buildCombinedChronicleCard(scopedPayload, types, cardYears, currentUnits, {
        metricHeatmapColor: frequencyCardColor,
        weekStart: setupWeekStart,
        initialMetricKey: previousSummaryYearMetricKey,
        intervalsEnabled: dashboardIntervalsEnabled,
        selectedTypes: types,
        typeBreakdownsByDate,
        typeLabelsByDate,
        activityLinksByDateType,
        onLensChange: (metricKey) => {
          hoverClearedSummaryYearMetricKey = null;
          selectedFrequencyFactKey = null;
          visibleYearMetricYears.forEach((year) => {
            const filterableSet = filterableYearMetricsByYear.get(year) || new Set();
            setYearMetricSelection(year, metricKey && filterableSet.has(metricKey) ? metricKey : null);
          });
          selectedFrequencyMetricKey = metricKey && visibleFrequencyFilterableMetricKeys.has(metricKey)
            ? metricKey
            : null;
          refreshDashboard();
        },
      });
      setCardScrollKey(chronicleStage.card, `${combinedSelectionKey}:stage`);
      list.appendChild(chronicleStage.card);
      cardYears.forEach((year) => {
        nextVisibleYearMetricYears.add(Number(year));
        nextFilterableYearMetricsByYear.set(Number(year), new Set(chronicleStage.filterableMetricKeys));
      });
      if (showMoreStats) {
        const frequencyCard = buildStatsOverview(scopedPayload, types, cardYears, activeLensAccent, {
          units: currentUnits,
          initialFactKey: selectedFrequencyFactKey,
          initialMetricKey: initialFrequencyMetricKey,
          onFactStateChange: onFrequencyFactStateChange,
          onMetricStateChange: onFrequencyMetricStateChange,
        });
        setCardScrollKey(frequencyCard, `${combinedSelectionKey}:frequency`);
        if (typeof chronicleStage.attachStoryPatterns === "function") {
          chronicleStage.attachStoryPatterns(frequencyCard);
        } else {
          list.appendChild(frequencyCard);
        }
      }
      section.appendChild(list);
      heatmaps.appendChild(section);
    }
    filterableYearMetricsByYear = nextFilterableYearMetricsByYear;
    visibleYearMetricYears = nextVisibleYearMetricYears;
    visibleFrequencyFilterableFactKeys = nextVisibleFrequencyFilterableFactKeys;
    visibleFrequencyFilterableMetricKeys = nextVisibleFrequencyFilterableMetricKeys;
    if (!visibleFrequencyFilterableFactKeys.has(selectedFrequencyFactKey)) {
      selectedFrequencyFactKey = null;
    }
    if (!visibleFrequencyFilterableMetricKeys.has(selectedFrequencyMetricKey)) {
      selectedFrequencyMetricKey = null;
    }
    pruneYearMetricSelectionsByFilterability(selectedYearMetricByYear, filterableYearMetricsByYear);

    const activeSummaryLensKey = getActiveSummaryYearMetricKey();
    const activeSummaryYearMetricKey = activeSummaryLensKey;
    if (activeSummaryYearMetricKey && hoverClearedSummaryYearMetricKey === activeSummaryYearMetricKey) {
      hoverClearedSummaryYearMetricKey = null;
    }
    syncResetAllButtonState();
    syncDashboardUrlState({
      types: allTypesSelected ? [] : types.slice(),
      years: yearScopeMode === "custom" || allYearsSelected ? [] : years.slice(),
      units: currentUnitSystem,
      lens: activeSummaryLensKey,
      start: yearScopeMode === "custom" ? activeCustomRange.start : "",
      end: yearScopeMode === "custom" ? activeCustomRange.end : "",
    });
    persistDashboardScopeState({
      types: allTypesSelected ? [] : types.slice(),
      years: yearScopeMode === "custom" || allYearsSelected ? [] : years.slice(),
      scopeMode: yearScopeMode === "custom" ? "custom" : "preset",
      start: yearScopeMode === "custom" ? activeCustomRange.start : "",
      end: yearScopeMode === "custom" ? activeCustomRange.end : "",
    });

    const showTypeBreakdown = payload.types.length > 0;
    const showActiveDays = Boolean(heatmaps);
    buildSummary(
      scopedPayload,
      types,
      years,
      currentUnits,
      showTypeBreakdown,
      showActiveDays,
      payload.types,
      activeSummaryTypeCards,
      hoverClearedSummaryType,
      (type, wasActiveTypeCard) => {
        hoverClearedSummaryType = wasActiveTypeCard ? type : null;
        toggleTypeFromSummaryCard(type);
        refreshDashboard();
      },
      (type) => {
        if (hoverClearedSummaryType === type) {
          hoverClearedSummaryType = null;
        }
      },
      activeSummaryYearMetricKey,
      hoverClearedSummaryYearMetricKey,
      (metricKey, wasActiveMetricCard) => {
        hoverClearedSummaryYearMetricKey = wasActiveMetricCard ? metricKey : null;
        selectedFrequencyFactKey = null;
        if (wasActiveMetricCard) {
          visibleYearMetricYears.forEach((year) => {
            setYearMetricSelection(year, null);
          });
          selectedFrequencyMetricKey = null;
        } else {
          hoverClearedSummaryYearMetricKey = null;
          visibleYearMetricYears.forEach((year) => {
            const filterableSet = filterableYearMetricsByYear.get(year) || new Set();
            setYearMetricSelection(year, filterableSet.has(metricKey) ? metricKey : null);
          });
          selectedFrequencyMetricKey = visibleFrequencyFilterableMetricKeys.has(metricKey)
            ? metricKey
            : null;
        }
        refreshDashboard();
      },
      (metricKey) => {
        if (hoverClearedSummaryYearMetricKey === metricKey) {
          hoverClearedSummaryYearMetricKey = null;
        }
      },
    );
    requestLayoutAlignment();
    if (previousCardScrollOffsets.size) {
      window.requestAnimationFrame(() => {
        restoreCardScrollOffsets(heatmaps, previousCardScrollOffsets);
      });
    }
    if (resetViewport && isNarrowLayoutViewport()) {
      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: "auto",
        });
      });
    }
  }

  renderFilterButtons(typeButtons, typeOptions, (value) => {
    draftTypeMenuSelection = null;
    setMenuOpenState(typeMenu, typeMenuButton, false);
    toggleType(value);
    refreshDashboard();
  });
  if (dashboardFilterDrawerToggle) {
    dashboardFilterDrawerToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = dashboardFilterDrawer?.getAttribute("aria-hidden") === "true";
      if (!open) {
        draftTypeMenuSelection = null;
        draftYearMenuSelection = null;
        setMenuOpenState(typeMenu, typeMenuButton, false);
        setMenuOpenState(yearMenu, yearMenuButton, false);
        update({ menuOnly: true });
      }
      setDashboardFilterDrawerOpen(open);
    });
  }
  if (typeMenuButton) {
    typeMenuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setDashboardFilterDrawerOpen(true);
      const open = !typeMenu?.classList.contains("open");
      if (open) {
        draftTypeMenuSelection = cloneSelectionState(allTypesMode, selectedTypes);
      } else {
        draftTypeMenuSelection = null;
      }
      draftYearMenuSelection = null;
      setMenuOpenState(typeMenu, typeMenuButton, open);
      setMenuOpenState(yearMenu, yearMenuButton, false);
      update({ keepTypeMenuOpen: open, menuOnly: true, resetTypeMenuScroll: open });
    });
  }
  if (yearMenuButton) {
    yearMenuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setDashboardFilterDrawerOpen(true);
      const open = !yearMenu?.classList.contains("open");
      if (open) {
        draftYearMenuSelection = cloneSelectionState(allYearsMode, selectedYears);
      } else {
        draftYearMenuSelection = null;
      }
      draftTypeMenuSelection = null;
      setMenuOpenState(yearMenu, yearMenuButton, open);
      setMenuOpenState(typeMenu, typeMenuButton, false);
      update({ keepYearMenuOpen: open, menuOnly: true, resetYearMenuScroll: open });
    });
  }
  if (typeClearButton) {
    typeClearButton.addEventListener("click", () => {
      if (areAllTypesSelected()) return;
      draftTypeMenuSelection = null;
      setMenuOpenState(typeMenu, typeMenuButton, false);
      allTypesMode = true;
      selectedTypes.clear();
      refreshDashboard();
    });
  }
  if (yearClearButton) {
    yearClearButton.addEventListener("click", () => {
      if (yearScopeMode !== "custom" && areAllYearsSelected()) return;
      draftYearMenuSelection = null;
      draftYearScopeMode = "preset";
      draftCustomDateRange = { ...normalizeCustomDateRange(payloadDateBounds.start, payloadDateBounds.end, payloadDateBounds) };
      setMenuOpenState(yearMenu, yearMenuButton, false);
      yearScopeMode = "preset";
      allYearsMode = true;
      selectedYears.clear();
      refreshDashboard();
    });
  }
  if (customDateStartInput) {
    customDateStartInput.addEventListener("change", () => {
      draftYearScopeMode = "custom";
      draftCustomDateRange = normalizeCustomDateRange(
        customDateStartInput.value,
        customDateEndInput?.value || draftCustomDateRange.end,
        payloadDateBounds,
      );
      yearScopeMode = "custom";
      customDateRange = { ...draftCustomDateRange };
      refreshDashboard();
    });
  }
  if (customDateEndInput) {
    customDateEndInput.addEventListener("change", () => {
      draftYearScopeMode = "custom";
      draftCustomDateRange = normalizeCustomDateRange(
        customDateStartInput?.value || draftCustomDateRange.start,
        customDateEndInput.value,
        payloadDateBounds,
      );
      yearScopeMode = "custom";
      customDateRange = { ...draftCustomDateRange };
      refreshDashboard();
    });
  }
  if (dashboardScopeResetButton) {
    dashboardScopeResetButton.addEventListener("click", () => {
      if (resetAllButton) {
        resetAllButton.click();
      }
      setDashboardFilterDrawerOpen(false);
    });
  }
  if (imperialUnitsButton) {
    imperialUnitsButton.addEventListener("click", () => {
      setUnitSystem("imperial");
    });
  }
  if (metricUnitsButton) {
    metricUnitsButton.addEventListener("click", () => {
      setUnitSystem("metric");
    });
  }
  if (resetAllButton) {
    resetAllButton.addEventListener("click", () => {
      if (isDefaultFilterState()) {
        return;
      }
      draftTypeMenuSelection = null;
      draftYearMenuSelection = null;
      draftYearScopeMode = "preset";
      draftCustomDateRange = { ...normalizeCustomDateRange(payloadDateBounds.start, payloadDateBounds.end, payloadDateBounds) };
      setMenuOpenState(typeMenu, typeMenuButton, false);
      setMenuOpenState(yearMenu, yearMenuButton, false);
      allTypesMode = true;
      selectedTypes.clear();
      yearScopeMode = "preset";
      allYearsMode = true;
      selectedYears.clear();
      selectedYearMetricByYear.clear();
      visibleYearMetricYears.clear();
      filterableYearMetricsByYear.clear();
      selectedFrequencyFactKey = null;
      visibleFrequencyFilterableFactKeys.clear();
      selectedFrequencyMetricKey = null;
      visibleFrequencyFilterableMetricKeys.clear();
      hoverClearedSummaryType = null;
      hoverClearedSummaryYearMetricKey = null;
      refreshDashboard({
        resetCardScroll: true,
        resetViewport: true,
      });
    });
  }

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    let shouldRefreshMenus = false;
    if (
      dashboardFilterDrawer
      && dashboardFilterDrawer.getAttribute("aria-hidden") === "false"
      && dashboardFilterDrawerToggle
      && !dashboardFilterDrawer.contains(target)
      && !dashboardFilterDrawerToggle.contains(target)
    ) {
      setDashboardFilterDrawerOpen(false);
    }
    if (typeMenu && !typeMenu.contains(target)) {
      if (typeMenu.classList.contains("open")) {
        setMenuOpenState(typeMenu, typeMenuButton, false);
        shouldRefreshMenus = true;
      }
      if (draftTypeMenuSelection) {
        draftTypeMenuSelection = null;
        shouldRefreshMenus = true;
      }
    }
    if (yearMenu && !yearMenu.contains(target)) {
      if (yearMenu.classList.contains("open")) {
        setMenuOpenState(yearMenu, yearMenuButton, false);
        shouldRefreshMenus = true;
      }
      if (draftYearMenuSelection) {
        draftYearMenuSelection = null;
        shouldRefreshMenus = true;
      }
    }
    if (shouldRefreshMenus) {
      update({ menuOnly: true });
    }
  });
  syncUnitToggleState();
  setDashboardFilterDrawerOpen(false);
  update();
  const activityCount = Array.isArray(payload.activities) ? payload.activities.length : 0;
  if (loadedFromCache && payloadRevalidating) {
    setDashboardTopStatus(
      `Ready (${activityCount} activities) • Cached snapshot (${cacheFallbackReason || "refreshing live data"})`,
      "ok",
    );
  } else if (loadedFromCache) {
    setDashboardTopStatus(
      `Ready (${activityCount} activities) • Cached snapshot (${cacheFallbackReason || "live refresh failed"})`,
      "ok",
    );
  } else if (payloadRevalidating) {
    setDashboardTopStatus(`Ready (${activityCount} activities) • Refreshing in background`, "ok");
  } else {
    setDashboardTopStatus(`Ready (${activityCount} activities)`, "ok");
  }

  if (!useTouchInteractions && typeof window.ResizeObserver === "function" && !tooltipResizeObserver) {
    tooltipResizeObserver = new window.ResizeObserver(() => {
      if (!tooltip.classList.contains("visible")) return;
      if (!pendingTooltipPoint) return;
      positionTooltip(pendingTooltipPoint.x, pendingTooltipPoint.y);
    });
    tooltipResizeObserver.observe(tooltip);
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      requestLayoutAlignment();
      if (!useTouchInteractions && tooltip.classList.contains("visible") && pendingTooltipPoint) {
        positionTooltip(pendingTooltipPoint.x, pendingTooltipPoint.y);
      }
    }).catch(() => {});
  }

  if (loadedFromCache) {
    void fetchLiveDashboardPayload()
      .then((livePayload) => {
        const liveActivityCount = Array.isArray(livePayload.activities) ? livePayload.activities.length : 0;
        const liveRevision = dashboardPayloadRevision(livePayload);
        if (liveRevision && liveRevision !== cachedRevision) {
          setDashboardTopStatus(`Ready (${liveActivityCount} activities) • New dashboard data cached. Reload to update`, "ok");
          return;
        }
        setDashboardTopStatus(`Ready (${liveActivityCount} activities)`, "ok");
      })
      .catch((error) => {
        const detail = String(error && error.message ? error.message : "Live refresh failed.");
        setDashboardTopStatus(
          `Ready (${activityCount} activities) • Cached snapshot (${detail})`,
          "ok",
        );
      });
  }

  window.addEventListener("resize", () => {
    requestSummaryTypeTailCentering();
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(() => {
      const width = window.innerWidth;
      const isNarrowLayout = isNarrowLayoutViewport();
      const widthChanged = Math.abs(width - lastViewportWidth) >= 1;
      const layoutModeChanged = isNarrowLayout !== lastIsNarrowLayout;
      syncOpenFilterMenuMaxHeights();
      if (!widthChanged && !layoutModeChanged) {
        return;
      }
      lastViewportWidth = width;
      lastIsNarrowLayout = isNarrowLayout;
      syncProfileLinkNavigationTarget();
      syncHeaderLinkPlacement();
      resetPersistentSideStatSizing();
      requestLayoutAlignment();
    }, 150);
  });

  if (!useTouchInteractions) {
    tooltip.addEventListener("click", (event) => {
      handleTooltipLinkActivation(event);
    });

    document.addEventListener("pointerdown", (event) => {
      if (!isTooltipPinned()) return;
      const target = event.target;
      if (tooltip.contains(target)) {
        return;
      }
      if (pinnedTooltipCell && pinnedTooltipCell.contains(target)) {
        return;
      }
      dismissTooltipState();
    });

    const dismissTooltipOnDesktopViewportShift = () => {
      if (!isTooltipPinned()) return;
      dismissTooltipState();
    };

    document.addEventListener(
      "scroll",
      dismissTooltipOnDesktopViewportShift,
      { passive: true, capture: true },
    );

    window.addEventListener(
      "scroll",
      dismissTooltipOnDesktopViewportShift,
      { passive: true },
    );

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") {
        dismissTooltipState();
      }
    });

    window.addEventListener("pagehide", () => {
      dismissTooltipState();
    });
  } else {
    tooltip.addEventListener(
      "touchstart",
      (event) => {
        rememberTooltipPointerType(event);
        event.stopPropagation();
        markTouchTooltipInteractionBlock(1200);
      },
      { passive: true },
    );
    tooltip.addEventListener("pointerdown", (event) => {
      rememberTooltipPointerType(event);
      event.stopPropagation();
      if (isTouchTooltipActivationEvent(event)) {
        markTouchTooltipInteractionBlock(1200);
      }
    });
    tooltip.addEventListener("click", (event) => {
      if (!handleTooltipLinkActivation(event)) {
        markTouchTooltipInteractionBlock(1200);
        event.stopPropagation();
        return;
      }
    });

    document.addEventListener("pointerdown", (event) => {
      if (!tooltip.classList.contains("visible")) return;
      const target = event.target;
      if (tooltip.contains(target)) {
        return;
      }
      if (!target.classList.contains("cell")) {
        dismissTooltipState();
      }
    });

    let lastTouchViewportScrollX = window.scrollX || window.pageXOffset || 0;
    let lastTouchViewportScrollY = window.scrollY || window.pageYOffset || 0;

    const dismissTooltipOnTouchScroll = (event) => {
      const scrollTarget = event?.target;
      const targetElement = scrollTarget?.nodeType === Node.TEXT_NODE
        ? scrollTarget.parentElement
        : scrollTarget;
      const cardScrollEvent = Boolean(
        targetElement
        && targetElement !== document
        && targetElement !== window
        && typeof targetElement.closest === "function"
        && targetElement.closest(".card"),
      );

      if (cardScrollEvent && tooltip.classList.contains("visible")) {
        dismissTooltipState();
        return;
      }

      const currentScrollX = window.scrollX || window.pageXOffset || 0;
      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      const viewportMoved = Math.abs(currentScrollX - lastTouchViewportScrollX) >= 2
        || Math.abs(currentScrollY - lastTouchViewportScrollY) >= 2;
      lastTouchViewportScrollX = currentScrollX;
      lastTouchViewportScrollY = currentScrollY;

      if (!tooltip.classList.contains("visible")) {
        return;
      }

      // Always dismiss on actual page movement so touch pan/scroll never leaves stale tooltips.
      if (viewportMoved) {
        dismissTooltipState();
        return;
      }

      if (nowMs() <= touchTooltipInteractionBlockUntil || shouldIgnoreTouchTooltipDismiss()) {
        return;
      }
      dismissTooltipState();
    };

    document.addEventListener(
      "scroll",
      dismissTooltipOnTouchScroll,
      { passive: true, capture: true },
    );

    window.addEventListener(
      "scroll",
      dismissTooltipOnTouchScroll,
      { passive: true },
    );

    window.addEventListener(
      "resize",
      () => {
        dismissTooltipOnTouchScroll();
      },
      { passive: true },
    );

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") {
        dismissTooltipState();
      }
    });

    window.addEventListener("pagehide", () => {
      dismissTooltipState();
    });
  }
}

init().catch((error) => {
  console.error(error);
  renderLoadError(error);
});
