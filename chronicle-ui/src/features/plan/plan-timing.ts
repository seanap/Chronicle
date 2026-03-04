const UI_TIMING_EVENT = "chronicle:ui-timing";

interface UiTimingDetail {
  source: "plan-grid";
  metric: string;
  duration_ms: number;
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export function recordPlanTiming(metric: string, durationMs: number): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }
  const detail: UiTimingDetail = {
    source: "plan-grid",
    metric,
    duration_ms: Math.round(durationMs * 100) / 100
  };
  window.dispatchEvent(new CustomEvent(UI_TIMING_EVENT, { detail }));
}

export async function timePlanOperation<T>(metric: string, action: () => Promise<T>): Promise<T> {
  const startedAt = nowMs();
  try {
    return await action();
  } finally {
    recordPlanTiming(metric, nowMs() - startedAt);
  }
}
