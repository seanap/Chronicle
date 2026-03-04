import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AppRoutes } from "./app-routes";
import { AppShell } from "./components/app-shell";
import { appTheme } from "./theme/app-theme";

describe("app smoke", () => {
  afterEach(() => {
    cleanup();
  });

  const expectedRoutes = [
    { path: "/sources", heading: "Sources" },
    { path: "/build", heading: "Build" },
    { path: "/plan", heading: "Plan" },
    { path: "/view", heading: "View" },
    { path: "/control", heading: "Control" },
    { path: "/status", heading: "Health" },
    { path: "/troubleshooting", heading: "Troubleshooting" }
  ];

  expectedRoutes.forEach(({ path, heading }) => {
    it(`renders route placeholder for ${path}`, () => {
      render(
        <ThemeProvider theme={appTheme}>
          <CssBaseline />
          <MemoryRouter initialEntries={[path]}>
            <AppShell>
              <AppRoutes />
            </AppShell>
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      expect(screen.getByRole("link", { current: "page", name: heading })).toBeInTheDocument();
    });
  });

  it("redirects unknown routes to the default scaffold route", () => {
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <MemoryRouter initialEntries={["/unknown-route"]}>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(screen.getByRole("heading", { name: "Sources" })).toBeInTheDocument();
    expect(screen.getByRole("link", { current: "page", name: "Sources" })).toBeInTheDocument();
  });

  it("marks nested paths under a feature route as active in navigation", () => {
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <MemoryRouter initialEntries={["/build/deep-link"]}>
          <AppShell>
            <div>Nested route placeholder</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(screen.getByRole("link", { current: "page", name: "Build" })).toBeInTheDocument();
  });

  it("navigates to another scaffold route when nav link is clicked", () => {
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <MemoryRouter initialEntries={["/sources"]}>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole("link", { name: "Build" }));
    expect(screen.getByRole("heading", { name: "Build" })).toBeInTheDocument();
  });
});
