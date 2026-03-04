import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TroubleshootingPage } from "./troubleshooting-page";

describe("troubleshooting page", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders common issues with actionable steps", () => {
    render(
      <MemoryRouter>
        <TroubleshootingPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Troubleshooting" })).toBeInTheDocument();
    expect(screen.getByTestId("troubleshooting-issue-token-expired")).toBeInTheDocument();
    expect(screen.getByTestId("troubleshooting-issue-docker-runtime")).toBeInTheDocument();
    expect(screen.getByTestId("troubleshooting-issue-network-connectivity")).toBeInTheDocument();

    expect(screen.getByText(/Open Sources and confirm Strava client configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/docker compose ps/i)).toBeInTheDocument();
    expect(screen.getByText(/Verify local network and Tailscale connectivity/i)).toBeInTheDocument();
  });

  it("references known fixes for tokens, Docker, and connectivity", () => {
    render(
      <MemoryRouter>
        <TroubleshootingPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Tokens")).toBeInTheDocument();
    expect(screen.getByText("Docker")).toBeInTheDocument();
    expect(screen.getByText("Connectivity")).toBeInTheDocument();
  });

  it("includes quick links to related pages for next actions", () => {
    render(
      <MemoryRouter>
        <TroubleshootingPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Open Sources" })).toHaveAttribute("href", "/sources");
    expect(screen.getByRole("link", { name: "Open Control" })).toHaveAttribute("href", "/control");
    expect(screen.getAllByRole("link", { name: "Open Health" }).length).toBeGreaterThan(0);
  });
});
