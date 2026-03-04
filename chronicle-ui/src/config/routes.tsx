import type { ReactNode } from "react";
import { SourcesPage } from "../features/sources/sources-page";
import { BuildPage } from "../features/build/build-page";
import { PlanPage } from "../features/plan/plan-page";
import { ViewPage } from "../features/view/view-page";
import { ControlPage } from "../features/control/control-page";
import { HealthPage } from "../features/health/health-page";
import { TroubleshootingPage } from "../features/health/troubleshooting-page";

export interface AppRoute {
  path: string;
  label: string;
  element: ReactNode;
}

export const APP_ROUTES: AppRoute[] = [
  { path: "/sources", label: "Sources", element: <SourcesPage /> },
  { path: "/build", label: "Build", element: <BuildPage /> },
  { path: "/plan", label: "Plan", element: <PlanPage /> },
  { path: "/view", label: "View", element: <ViewPage /> },
  { path: "/control", label: "Control", element: <ControlPage /> },
  { path: "/status", label: "Health", element: <HealthPage /> },
  { path: "/troubleshooting", label: "Troubleshooting", element: <TroubleshootingPage /> }
];
