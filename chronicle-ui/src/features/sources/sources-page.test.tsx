import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../api/http-client";
import { SourcesPage } from "./sources-page";

const getSourceStatuses = vi.fn();
const getSetupConfig = vi.fn();
const updateSetupConfig = vi.fn();
const startStravaOauth = vi.fn();
const disconnectStrava = vi.fn();

vi.mock("../../api/source-status-api", () => ({
  getSourceStatuses: (...args: unknown[]) => getSourceStatuses(...args),
  getSetupConfig: (...args: unknown[]) => getSetupConfig(...args),
  updateSetupConfig: (...args: unknown[]) => updateSetupConfig(...args),
  startStravaOauth: (...args: unknown[]) => startStravaOauth(...args),
  disconnectStrava: (...args: unknown[]) => disconnectStrava(...args)
}));

describe("sources page", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    window.history.pushState({}, "", "/sources");
  });

  it("loads and renders connection statuses for each source", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "error", message: "Status unavailable" },
      { providerId: "garmin", providerLabel: "Garmin", status: "warning", message: "Needs credential update" },
      { providerId: "intervals", providerLabel: "Intervals.icu", status: "connected", message: "Connected" },
      { providerId: "smashrun", providerLabel: "Smashrun", status: "disconnected", message: "Not configured" }
    ]);

    render(<SourcesPage />);

    expect(screen.getByText("Loading source connection status...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Sources" })).toBeInTheDocument();
    expect(await screen.findByText("Status: connected")).toBeInTheDocument();
    expect(await screen.findByText("Status: warning")).toBeInTheDocument();
    expect(await screen.findByText("Status: error")).toBeInTheDocument();
    expect(await screen.findByText("Status: disconnected")).toBeInTheDocument();
  });

  it("shows fetch failure state and retries on refresh", async () => {
    getSourceStatuses
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce([
        { providerId: "strava", providerLabel: "Strava", status: "connected", message: "Connected" }
      ]);

    render(<SourcesPage />);

    expect(await screen.findByText("Failed to load source connection status.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh Status" }));

    await waitFor(() => {
      expect(screen.getByText("Status: connected")).toBeInTheDocument();
    });
  });

  it("disables refresh while loading and re-enables after response", async () => {
    let resolveStatuses: ((value: unknown) => void) | undefined;
    getSourceStatuses.mockReturnValue(
      new Promise((resolve) => {
        resolveStatuses = resolve;
      })
    );

    render(<SourcesPage />);

    const refreshButton = screen.getByRole("button", { name: "Refresh Status" });
    expect(refreshButton).toBeDisabled();

    resolveStatuses?.([
      { providerId: "strava", providerLabel: "Strava", status: "connected", message: "Connected" }
    ]);

    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });
  });

  it("keeps the newest in-flight result when older effect request resolves later", async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    let resolveSecond: ((value: unknown) => void) | undefined;

    getSourceStatuses
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecond = resolve;
        })
      );

    render(
      <StrictMode>
        <SourcesPage />
      </StrictMode>
    );

    resolveSecond?.([
      { providerId: "strava", providerLabel: "Strava", status: "connected", message: "Connected" }
    ]);
    await waitFor(() => {
      expect(screen.getByText("Status: connected")).toBeInTheDocument();
    });

    resolveFirst?.([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Outdated" }
    ]);

    await waitFor(() => {
      expect(screen.queryByText("Status: warning")).not.toBeInTheDocument();
    });
  });

  it("shows empty-state guidance when no providers are returned", async () => {
    getSourceStatuses.mockResolvedValue([]);

    render(<SourcesPage />);

    expect(await screen.findByText("No source configuration was found yet.")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load source connection status.")).not.toBeInTheDocument();
  });

  it("opens provider credentials panel and saves updated values", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig.mockResolvedValue({
      status: "ok",
      provider_fields: {
        strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "ENABLE_STRAVA"]
      },
      values: {
        STRAVA_CLIENT_ID: "old-client",
        STRAVA_CLIENT_SECRET: "",
        ENABLE_STRAVA: true
      },
      masked_values: {
        STRAVA_CLIENT_ID: "old-client",
        STRAVA_CLIENT_SECRET: "********"
      },
      secret_presence: {
        STRAVA_CLIENT_SECRET: true
      },
      provider_links: {
        strava: "https://developers.strava.com/"
      },
      secret_keys: ["STRAVA_CLIENT_SECRET"]
    });
    updateSetupConfig.mockResolvedValue({
      status: "ok"
    });

    render(<SourcesPage />);

    await screen.findAllByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Configure Strava" }));

    expect(await screen.findByLabelText("Strava Client ID")).toHaveValue("old-client");
    expect(screen.getByLabelText("Strava Client Secret")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Strava Client ID"), { target: { value: "new-client" } });
    fireEvent.change(screen.getByLabelText("Strava Client Secret"), { target: { value: "new-secret" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Strava Credentials" }));

    await waitFor(() => {
      expect(updateSetupConfig).toHaveBeenCalledWith({
        STRAVA_CLIENT_ID: "new-client",
        STRAVA_CLIENT_SECRET: "new-secret"
      });
    });

    expect(await screen.findByText("Saved Strava credentials.")).toBeInTheDocument();
    expect(getSourceStatuses).toHaveBeenCalledTimes(2);
  });

  it("updates expanded accessibility semantics when toggling provider configuration", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig.mockResolvedValue({
      status: "ok",
      provider_fields: {
        strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"]
      },
      values: {
        STRAVA_CLIENT_ID: "old-client",
        STRAVA_CLIENT_SECRET: ""
      },
      masked_values: {},
      secret_presence: {},
      provider_links: {},
      secret_keys: ["STRAVA_CLIENT_SECRET"]
    });

    render(<SourcesPage />);

    const configureButton = await screen.findByRole("button", { name: "Configure Strava" });
    expect(configureButton).toHaveAttribute("aria-expanded", "false");
    expect(configureButton).toHaveAttribute("aria-controls", "provider-config-strava");

    fireEvent.click(configureButton);
    expect(await screen.findByLabelText("Strava Client ID")).toBeInTheDocument();
    expect(configureButton).toHaveAttribute("aria-expanded", "true");
    const configRegion = screen.getByRole("region");
    expect(configRegion).toHaveAttribute("id", "provider-config-strava");
    expect(configRegion).toHaveAttribute("aria-labelledby", "provider-config-label-strava");

    fireEvent.click(configureButton);
    await waitFor(() => {
      expect(screen.queryByLabelText("Strava Client ID")).not.toBeInTheDocument();
    });
    expect(configureButton).toHaveAttribute("aria-expanded", "false");
  });

  it("reloads provider configuration when reopening a panel", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig.mockResolvedValue({
      status: "ok",
      provider_fields: {
        strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"]
      },
      values: {
        STRAVA_CLIENT_ID: "old-client",
        STRAVA_CLIENT_SECRET: ""
      },
      masked_values: {},
      secret_presence: {},
      provider_links: {},
      secret_keys: ["STRAVA_CLIENT_SECRET"]
    });

    render(<SourcesPage />);

    const configureButton = await screen.findByRole("button", { name: "Configure Strava" });
    fireEvent.click(configureButton);
    await screen.findByLabelText("Strava Client ID");
    fireEvent.click(configureButton);
    await waitFor(() => {
      expect(screen.queryByLabelText("Strava Client ID")).not.toBeInTheDocument();
    });
    fireEvent.click(configureButton);
    await screen.findByLabelText("Strava Client ID");

    expect(getSetupConfig).toHaveBeenCalledTimes(2);
  });

  it("keeps loading state bound to the active provider during rapid provider switching", async () => {
    let resolveStravaConfig: ((value: unknown) => void) | undefined;
    let resolveGarminConfig: ((value: unknown) => void) | undefined;

    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" },
      { providerId: "garmin", providerLabel: "Garmin", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStravaConfig = resolve;
        })
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveGarminConfig = resolve;
        })
      );

    render(<SourcesPage />);

    await screen.findAllByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Configure Strava" }));
    expect(await screen.findByText("Loading credential fields...")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Configure Garmin" }));

    resolveStravaConfig?.({
      status: "ok",
      provider_fields: { strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"] },
      values: { STRAVA_CLIENT_ID: "abc", STRAVA_CLIENT_SECRET: "" },
      masked_values: {},
      secret_presence: {},
      provider_links: {},
      secret_keys: ["STRAVA_CLIENT_SECRET"]
    });

    await waitFor(() => {
      expect(screen.getByText("Loading credential fields...")).toBeInTheDocument();
    });

    resolveGarminConfig?.({
      status: "ok",
      provider_fields: { garmin: ["GARMIN_EMAIL", "GARMIN_PASSWORD"] },
      values: { GARMIN_EMAIL: "runner@example.com", GARMIN_PASSWORD: "" },
      masked_values: {},
      secret_presence: {},
      provider_links: {},
      secret_keys: ["GARMIN_PASSWORD"]
    });

    await waitFor(() => {
      expect(screen.queryByText("Loading credential fields...")).not.toBeInTheDocument();
    });
    expect(await screen.findByLabelText("Garmin Email")).toBeInTheDocument();
  });

  it("keeps existing secret when secret input remains blank", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig.mockResolvedValue({
      status: "ok",
      provider_fields: {
        strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"]
      },
      values: {
        STRAVA_CLIENT_ID: "old-client",
        STRAVA_CLIENT_SECRET: ""
      },
      masked_values: {
        STRAVA_CLIENT_SECRET: "********"
      },
      secret_presence: {
        STRAVA_CLIENT_SECRET: true
      },
      provider_links: {},
      secret_keys: ["STRAVA_CLIENT_SECRET"]
    });
    updateSetupConfig.mockResolvedValue({ status: "ok" });

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Configure Strava" }));
    fireEvent.change(await screen.findByLabelText("Strava Client ID"), {
      target: { value: "updated-client" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Strava Credentials" }));

    await waitFor(() => {
      expect(updateSetupConfig).toHaveBeenCalledWith({
        STRAVA_CLIENT_ID: "updated-client"
      });
    });
  });

  it("blocks save when required identifier remains empty even if unchanged", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "intervals", providerLabel: "Intervals.icu", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig.mockResolvedValue({
      status: "ok",
      provider_fields: {
        intervals: ["ENABLE_INTERVALS", "INTERVALS_USER_ID", "INTERVALS_API_KEY"]
      },
      values: {
        ENABLE_INTERVALS: true,
        INTERVALS_USER_ID: "",
        INTERVALS_API_KEY: ""
      },
      masked_values: {},
      secret_presence: {},
      provider_links: {},
      secret_keys: ["INTERVALS_API_KEY"]
    });

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Configure Intervals.icu" }));
    fireEvent.change(await screen.findByLabelText("Intervals API Key"), {
      target: { value: "new-api-key" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Intervals.icu Credentials" }));

    expect(await screen.findByText("Enter Intervals User ID before saving.")).toBeInTheDocument();
    expect(updateSetupConfig).not.toHaveBeenCalled();
  });

  it("shows email shape validation guidance before save", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "garmin", providerLabel: "Garmin", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig.mockResolvedValue({
      status: "ok",
      provider_fields: {
        garmin: ["ENABLE_GARMIN", "GARMIN_EMAIL", "GARMIN_PASSWORD"]
      },
      values: {
        ENABLE_GARMIN: true,
        GARMIN_EMAIL: "runner@example.com",
        GARMIN_PASSWORD: ""
      },
      masked_values: {},
      secret_presence: {},
      provider_links: {},
      secret_keys: ["GARMIN_PASSWORD"]
    });

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Configure Garmin" }));
    fireEvent.change(await screen.findByLabelText("Garmin Email"), {
      target: { value: "invalid-email" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Garmin Credentials" }));

    expect(await screen.findByText("Enter a valid Garmin Email before saving.")).toBeInTheDocument();
    expect(updateSetupConfig).not.toHaveBeenCalled();
  });

  it("shows URL shape validation guidance before save", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "crono", providerLabel: "Crono API", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig.mockResolvedValue({
      status: "ok",
      provider_fields: {
        crono: ["ENABLE_CRONO_API", "CRONO_API_BASE_URL", "CRONO_API_KEY"]
      },
      values: {
        ENABLE_CRONO_API: true,
        CRONO_API_BASE_URL: "https://example.com",
        CRONO_API_KEY: ""
      },
      masked_values: {},
      secret_presence: {},
      provider_links: {},
      secret_keys: ["CRONO_API_KEY"]
    });

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Configure Crono API" }));
    fireEvent.change(await screen.findByLabelText("Crono API Base URL"), {
      target: { value: "example.com/no-protocol" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Crono API Credentials" }));

    expect(
      await screen.findByText("Crono API Base URL must start with http:// or https://.")
    ).toBeInTheDocument();
    expect(updateSetupConfig).not.toHaveBeenCalled();
  });

  it("shows corrective guidance for invalid credentials and does not refresh statuses", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig.mockResolvedValue({
      status: "ok",
      provider_fields: {
        strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"]
      },
      values: {
        STRAVA_CLIENT_ID: "old-client",
        STRAVA_CLIENT_SECRET: ""
      },
      masked_values: {},
      secret_presence: {},
      provider_links: {},
      secret_keys: ["STRAVA_CLIENT_SECRET"]
    });
    updateSetupConfig.mockRejectedValue(
      new ApiRequestError({
        message: "Invalid or expired credentials. Verify Client ID/Secret and try again.",
        status: 400
      })
    );

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Configure Strava" }));
    fireEvent.change(await screen.findByLabelText("Strava Client ID"), {
      target: { value: "bad-client" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Strava Credentials" }));

    expect(
      await screen.findByText("Invalid or expired credentials. Verify Client ID/Secret and try again.")
    ).toBeInTheDocument();
    expect(getSourceStatuses).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Strava Client ID")).toHaveValue("bad-client");
  });

  it("allows disabling provider without requiring non-secret fields", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "intervals", providerLabel: "Intervals.icu", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig.mockResolvedValue({
      status: "ok",
      provider_fields: {
        intervals: ["ENABLE_INTERVALS", "INTERVALS_USER_ID", "INTERVALS_API_KEY"]
      },
      values: {
        ENABLE_INTERVALS: true,
        INTERVALS_USER_ID: "",
        INTERVALS_API_KEY: ""
      },
      masked_values: {},
      secret_presence: {},
      provider_links: {},
      secret_keys: ["INTERVALS_API_KEY"]
    });
    updateSetupConfig.mockResolvedValue({ status: "ok" });

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Configure Intervals.icu" }));
    fireEvent.click(await screen.findByRole("switch", { name: "Enable Intervals" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Intervals.icu Credentials" }));

    await waitFor(() => {
      expect(updateSetupConfig).toHaveBeenCalledWith({
        ENABLE_INTERVALS: false
      });
    });
  });

  it("hides save controls when provider configuration fails to load", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig.mockRejectedValue(new Error("Unable to load source configuration."));

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Configure Strava" }));

    expect(await screen.findByText("Unable to load source configuration.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Strava Credentials" })).not.toBeInTheDocument();
  });

  it("shows no-op guidance and does not submit when no credential changes were made", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);
    getSetupConfig.mockResolvedValue({
      status: "ok",
      provider_fields: {
        strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"]
      },
      values: {
        STRAVA_CLIENT_ID: "existing-client",
        STRAVA_CLIENT_SECRET: ""
      },
      masked_values: {
        STRAVA_CLIENT_SECRET: "********"
      },
      secret_presence: {
        STRAVA_CLIENT_SECRET: true
      },
      provider_links: {},
      secret_keys: ["STRAVA_CLIENT_SECRET"]
    });

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Configure Strava" }));
    await screen.findByLabelText("Strava Client ID");
    fireEvent.click(screen.getByRole("button", { name: "Save Strava Credentials" }));

    expect(await screen.findByText("No credential changes to save.")).toBeInTheDocument();
    expect(updateSetupConfig).not.toHaveBeenCalled();
  });

  it("shows a guided strava api app walkthrough with required setup values", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Strava Setup Walkthrough" }));

    const walkthroughRegion = await screen.findByRole("region", { name: "Strava setup walkthrough" });
    expect(within(walkthroughRegion).getByRole("link", { name: "Strava Developers" })).toHaveAttribute(
      "href",
      "https://developers.strava.com/"
    );
    expect(await screen.findByText(/Authorization Callback Domain/)).toBeInTheDocument();
    expect(within(walkthroughRegion).getByText(window.location.hostname)).toBeInTheDocument();
    expect(await screen.findByText(/Authorization Callback URL/)).toBeInTheDocument();
    expect(
      await screen.findByText(`${window.location.origin}/setup/strava/callback`)
    ).toBeInTheDocument();
    expect(await screen.findByText(/Client ID and Client Secret/)).toBeInTheDocument();
    expect(screen.queryByText("Strava OAuth completed successfully. Connection status has been refreshed.")).not.toBeInTheDocument();
  });

  it("continues from walkthrough into the existing oauth start flow", async () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);
    startStravaOauth.mockResolvedValue({
      status: "ok",
      authorize_url: "https://www.strava.com/oauth/authorize?client_id=123",
      state: "state-token",
      redirect_uri: "http://localhost/setup/strava/callback"
    });

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Strava Setup Walkthrough" }));
    expect(screen.getByRole("region", { name: "Strava setup walkthrough" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue to OAuth" }));

    expect(screen.queryByRole("region", { name: "Strava setup walkthrough" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(startStravaOauth).toHaveBeenCalledTimes(1);
      expect(windowOpen).toHaveBeenCalledWith(
        "https://www.strava.com/oauth/authorize?client_id=123",
        "_self"
      );
    });
  });

  it("starts strava oauth and opens the authorize url", async () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);
    startStravaOauth.mockResolvedValue({
      status: "ok",
      authorize_url: "https://www.strava.com/oauth/authorize?client_id=123",
      state: "state-token",
      redirect_uri: "http://localhost/setup/strava/callback"
    });

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Connect Strava OAuth" }));

    await waitFor(() => {
      expect(startStravaOauth).toHaveBeenCalledTimes(1);
      expect(windowOpen).toHaveBeenCalledWith(
        "https://www.strava.com/oauth/authorize?client_id=123",
        "_self"
      );
    });
  });

  it("shows callback success message and refreshes statuses", async () => {
    window.history.pushState({}, "", "/sources?strava_oauth=connected");
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "connected", message: "Connection is healthy." }
    ]);

    render(<SourcesPage />);

    expect(
      await screen.findByText("Strava OAuth completed successfully. Connection status has been refreshed.")
    ).toBeInTheDocument();
    await screen.findByText("Status: connected");
    expect(getSourceStatuses).toHaveBeenCalledTimes(2);
    expect(window.location.search).toBe("");
  });

  it("shows not-verified guidance when callback says connected but refreshed status is not connected", async () => {
    window.history.pushState({}, "", "/sources?strava_oauth=connected");
    getSourceStatuses
      .mockResolvedValueOnce([
        { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
      ])
      .mockResolvedValueOnce([
        { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
      ]);

    render(<SourcesPage />);

    expect(
      await screen.findByText(
        "Strava OAuth callback returned, but the connection is not verified yet. Check credentials and try again."
      )
    ).toBeInTheDocument();
    expect(await screen.findByText("Status: warning")).toBeInTheDocument();
    expect(screen.queryByText("Status: connected")).not.toBeInTheDocument();
  });

  it("shows callback error reason guidance and does not report connected state", async () => {
    window.history.pushState({}, "", "/sources?strava_oauth=error&reason=state_mismatch");
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);

    render(<SourcesPage />);

    expect(
      await screen.findByText("OAuth verification failed due to a state mismatch. Start Strava OAuth again.")
    ).toBeInTheDocument();
    expect(await screen.findByText("Status: warning")).toBeInTheDocument();
    expect(screen.queryByText("Status: connected")).not.toBeInTheDocument();
  });

  it("shows fallback callback error guidance for unknown reason codes", async () => {
    window.history.pushState({}, "", "/sources?strava_oauth=error&reason=unexpected_gateway_issue");
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);

    render(<SourcesPage />);

    expect(await screen.findByText("Strava OAuth failed: unexpected_gateway_issue.")).toBeInTheDocument();
    expect(await screen.findByText("Status: warning")).toBeInTheDocument();
  });

  it("surfaces oauth start errors as actionable feedback", async () => {
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);
    startStravaOauth.mockRejectedValue(
      new ApiRequestError({
        message: "Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET before starting OAuth.",
        status: 400
      })
    );

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Connect Strava OAuth" }));

    expect(
      await screen.findByText("Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET before starting OAuth.")
    ).toBeInTheDocument();
  });

  it("rejects unexpected authorize urls returned by oauth start endpoint", async () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    getSourceStatuses.mockResolvedValue([
      { providerId: "strava", providerLabel: "Strava", status: "warning", message: "Needs setup" }
    ]);
    startStravaOauth.mockResolvedValue({
      status: "ok",
      authorize_url: "https://evil.example.com/oauth/authorize?client_id=123",
      state: "state-token",
      redirect_uri: "http://localhost/setup/strava/callback"
    });

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    fireEvent.click(screen.getByRole("button", { name: "Connect Strava OAuth" }));

    expect(
      await screen.findByText("Received an invalid Strava authorization URL. Verify setup and try again.")
    ).toBeInTheDocument();
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it("disconnects strava and refreshes status without losing reconnect action", async () => {
    getSourceStatuses
      .mockResolvedValueOnce([
        {
          providerId: "strava",
          providerLabel: "Strava",
          status: "connected",
          message: "Connected",
          stravaOauthCredentialsPresent: true
        }
      ])
      .mockResolvedValueOnce([
        {
          providerId: "strava",
          providerLabel: "Strava",
          status: "warning",
          message: "Needs setup",
          stravaOauthCredentialsPresent: false
        }
      ]);
    disconnectStrava.mockResolvedValue({
      status: "ok",
      strava: {
        client_configured: true,
        connected: false,
        has_refresh_token: false,
        has_access_token: false
      }
    });

    render(<SourcesPage />);

    await screen.findByText("Status: connected");
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Strava" }));

    await waitFor(() => {
      expect(disconnectStrava).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText(
        "Strava has been disconnected. Client settings were kept so you can reconnect anytime."
      )
    ).toBeInTheDocument();
    expect(await screen.findByText("Status: warning")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Strava OAuth" })).toBeInTheDocument();
  });

  it("shows disconnect failure guidance and keeps existing status view", async () => {
    getSourceStatuses.mockResolvedValue([
      {
        providerId: "strava",
        providerLabel: "Strava",
        status: "connected",
        message: "Connected",
        stravaOauthCredentialsPresent: true
      }
    ]);
    disconnectStrava.mockRejectedValue(
      new ApiRequestError({
        message: "Failed to update env file at /tmp/.env: permission denied",
        status: 500
      })
    );

    render(<SourcesPage />);

    await screen.findByText("Status: connected");
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Strava" }));

    expect(
      await screen.findByText("Failed to update env file at /tmp/.env: permission denied")
    ).toBeInTheDocument();
    expect(screen.getByText("Status: connected")).toBeInTheDocument();
  });

  it("hides disconnect action when oauth credentials are not present", async () => {
    getSourceStatuses.mockResolvedValue([
      {
        providerId: "strava",
        providerLabel: "Strava",
        status: "warning",
        message: "Needs setup",
        stravaOauthCredentialsPresent: false
      }
    ]);

    render(<SourcesPage />);

    await screen.findByText("Status: warning");
    expect(screen.getByRole("button", { name: "Connect Strava OAuth" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disconnect Strava" })).not.toBeInTheDocument();
  });

  it("shows disconnect verification guidance when refreshed status stays connected", async () => {
    getSourceStatuses
      .mockResolvedValueOnce([
        {
          providerId: "strava",
          providerLabel: "Strava",
          status: "connected",
          message: "Connected",
          stravaOauthCredentialsPresent: true
        }
      ])
      .mockResolvedValueOnce([
        {
          providerId: "strava",
          providerLabel: "Strava",
          status: "connected",
          message: "Connected",
          stravaOauthCredentialsPresent: true
        }
      ]);
    disconnectStrava.mockResolvedValue({
      status: "ok",
      strava: {
        client_configured: true,
        connected: false,
        has_refresh_token: false,
        has_access_token: false
      }
    });

    render(<SourcesPage />);

    await screen.findByText("Status: connected");
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Strava" }));

    expect(await screen.findByText("Unable to confirm Strava disconnect. Refresh status and try again.")).toBeInTheDocument();
    expect(screen.queryByText("Strava has been disconnected. Client settings were kept so you can reconnect anytime.")).not.toBeInTheDocument();
    expect(screen.getByText("Status: connected")).toBeInTheDocument();
  });

  it("shows disconnect verification guidance when status refresh fails after disconnect", async () => {
    getSourceStatuses
      .mockResolvedValueOnce([
        {
          providerId: "strava",
          providerLabel: "Strava",
          status: "connected",
          message: "Connected",
          stravaOauthCredentialsPresent: true
        }
      ])
      .mockRejectedValueOnce(new Error("refresh failed"));
    disconnectStrava.mockResolvedValue({
      status: "ok",
      strava: {
        client_configured: true,
        connected: false,
        has_refresh_token: false,
        has_access_token: false
      }
    });

    render(<SourcesPage />);

    await screen.findByText("Status: connected");
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Strava" }));

    expect(await screen.findByText("Unable to confirm Strava disconnect. Refresh status and try again.")).toBeInTheDocument();
    expect(screen.queryByText("Strava has been disconnected. Client settings were kept so you can reconnect anytime.")).not.toBeInTheDocument();
    expect(await screen.findByText("Failed to load source connection status.")).toBeInTheDocument();
  });

  it("prevents duplicate disconnect submissions while request is in progress", async () => {
    let resolveDisconnect:
      | ((value: {
          status: string;
          strava: {
            client_configured: boolean;
            connected: boolean;
            has_refresh_token: boolean;
            has_access_token: boolean;
          };
        }) => void)
      | undefined;

    getSourceStatuses
      .mockResolvedValueOnce([
        {
          providerId: "strava",
          providerLabel: "Strava",
          status: "connected",
          message: "Connected",
          stravaOauthCredentialsPresent: true
        }
      ])
      .mockResolvedValueOnce([
        {
          providerId: "strava",
          providerLabel: "Strava",
          status: "warning",
          message: "Needs setup",
          stravaOauthCredentialsPresent: false
        }
      ]);
    disconnectStrava.mockReturnValue(
      new Promise((resolve) => {
        resolveDisconnect = resolve;
      })
    );

    render(<SourcesPage />);

    await screen.findByText("Status: connected");
    const disconnectButton = screen.getByRole("button", { name: "Disconnect Strava" });
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(disconnectButton).toBeDisabled();
    });
    fireEvent.click(disconnectButton);
    expect(disconnectStrava).toHaveBeenCalledTimes(1);

    resolveDisconnect?.({
      status: "ok",
      strava: {
        client_configured: true,
        connected: false,
        has_refresh_token: false,
        has_access_token: false
      }
    });

    expect(
      await screen.findByText(
        "Strava has been disconnected. Client settings were kept so you can reconnect anytime."
      )
    ).toBeInTheDocument();
  });
});
