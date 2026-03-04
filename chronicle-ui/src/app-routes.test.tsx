import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./app-routes";

function SearchEcho() {
  const location = useLocation();
  return <div>{location.search}</div>;
}

vi.mock("./config/routes", () => ({
  APP_ROUTES: [{ path: "/sources", label: "Sources", element: <SearchEcho /> }]
}));

describe("app routes", () => {
  it("preserves oauth callback query params when redirecting unknown routes to sources", async () => {
    render(
      <MemoryRouter initialEntries={["/setup?strava_oauth=connected&reason=state_mismatch"]}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText("?strava_oauth=connected&reason=state_mismatch")).toBeInTheDocument();
  });
});
