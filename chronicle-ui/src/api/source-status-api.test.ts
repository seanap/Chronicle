import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disconnectStrava,
  getSourceStatuses,
  getSetupConfig,
  mapSetupConfigToSourceStatuses,
  startStravaOauth,
  updateSetupConfig,
  type SetupConfigResponse,
  type SourceConnectionStatus
} from "./source-status-api";

const getJson = vi.fn();

vi.mock("./http-client", () => ({
  getJson: (...args: unknown[]) => getJson(...args)
}));

function findStatus(
  statuses: SourceConnectionStatus[],
  providerId: string
): SourceConnectionStatus | undefined {
  return statuses.find((item) => item.providerId === providerId);
}

describe("source status api mapping", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("maps setup payload to warning/disconnected statuses when provider status is not declared", () => {
    const payload: SetupConfigResponse = {
      status: "ok",
      provider_fields: {
        general: [],
        strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"],
        garmin: ["GARMIN_EMAIL", "GARMIN_PASSWORD"],
        intervals: ["INTERVALS_USER_ID"]
      },
      values: {
        STRAVA_CLIENT_ID: "abc",
        STRAVA_CLIENT_SECRET: "",
        GARMIN_EMAIL: "user@example.com",
        INTERVALS_USER_ID: ""
      },
      secret_presence: {
        GARMIN_PASSWORD: true
      },
      strava: {
        client_configured: true,
        connected: false,
        has_refresh_token: false,
        has_access_token: false
      }
    };

    const result = mapSetupConfigToSourceStatuses(payload);

    expect(findStatus(result, "strava")).toMatchObject({ status: "warning" });
    expect(findStatus(result, "garmin")).toMatchObject({ status: "warning" });
    expect(findStatus(result, "intervals")).toMatchObject({ status: "disconnected" });
  });

  it("marks strava as connected when oauth is connected", () => {
    const payload: SetupConfigResponse = {
      status: "ok",
      provider_fields: {
        strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "STRAVA_REFRESH_TOKEN"]
      },
      values: {
        STRAVA_CLIENT_ID: "abc",
        STRAVA_CLIENT_SECRET: "def",
        STRAVA_REFRESH_TOKEN: ""
      },
      strava: {
        client_configured: true,
        connected: true,
        has_refresh_token: true,
        has_access_token: true
      }
    };

    const result = mapSetupConfigToSourceStatuses(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ providerId: "strava", status: "connected" });
  });

  it("marks strava as disconnected when oauth client is not configured", () => {
    const payload: SetupConfigResponse = {
      status: "ok",
      provider_fields: {
        strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"]
      },
      values: {
        STRAVA_CLIENT_ID: "",
        STRAVA_CLIENT_SECRET: ""
      },
      strava: {
        client_configured: false,
        connected: false,
        has_refresh_token: false,
        has_access_token: false
      }
    };

    const result = mapSetupConfigToSourceStatuses(payload);
    expect(result[0]).toMatchObject({ providerId: "strava", status: "disconnected" });
  });

  it("loads setup and strava status endpoints", async () => {
    getJson
      .mockResolvedValueOnce({
        status: "ok",
        provider_fields: { strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"] },
        values: { STRAVA_CLIENT_ID: "abc", STRAVA_CLIENT_SECRET: "def" },
        secret_presence: {},
        strava: {
          client_configured: true,
          connected: false,
          has_refresh_token: false,
          has_access_token: false
        }
      })
      .mockResolvedValueOnce({
        status: "ok",
        strava: {
          client_configured: true,
          connected: true,
          has_refresh_token: true,
          has_access_token: true
        }
      });

    const result = await getSourceStatuses();

    expect(getJson).toHaveBeenNthCalledWith(1, "/setup/api/config");
    expect(getJson).toHaveBeenNthCalledWith(2, "/setup/api/strava/status");
    expect(result[0]).toMatchObject({ providerId: "strava", status: "connected" });
  });

  it("loads setup config for credential editing", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      provider_fields: { strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"] },
      values: { STRAVA_CLIENT_ID: "abc", STRAVA_CLIENT_SECRET: "" },
      masked_values: { STRAVA_CLIENT_ID: "abc", STRAVA_CLIENT_SECRET: "****" },
      secret_presence: { STRAVA_CLIENT_SECRET: true },
      provider_links: { strava: "https://example.com/strava" },
      secret_keys: ["STRAVA_CLIENT_SECRET"]
    });

    const result = await getSetupConfig();
    expect(getJson).toHaveBeenCalledWith("/setup/api/config");
    expect(result.provider_fields.strava).toEqual(["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"]);
  });

  it("saves setup config values under the expected request shape", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      provider_fields: { strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"] },
      values: { STRAVA_CLIENT_ID: "updated", STRAVA_CLIENT_SECRET: "" }
    });

    const result = await updateSetupConfig({
      STRAVA_CLIENT_ID: "updated",
      STRAVA_CLIENT_SECRET: ""
    });

    expect(getJson).toHaveBeenCalledWith("/setup/api/config", {
      method: "PUT",
      body: {
        values: {
          STRAVA_CLIENT_ID: "updated",
          STRAVA_CLIENT_SECRET: ""
        }
      }
    });
    expect(result.values.STRAVA_CLIENT_ID).toBe("updated");
  });

  it("marks strava status as error when live status endpoint is unavailable", async () => {
    getJson
      .mockResolvedValueOnce({
        status: "ok",
        provider_fields: { strava: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"] },
        values: { STRAVA_CLIENT_ID: "abc", STRAVA_CLIENT_SECRET: "def" },
        secret_presence: {},
        strava: {
          client_configured: true,
          connected: false,
          has_refresh_token: false,
          has_access_token: false
        }
      })
      .mockRejectedValueOnce(new Error("status unavailable"));

    const result = await getSourceStatuses();

    expect(result[0]).toMatchObject({
      providerId: "strava",
      status: "error",
      message: "Latest Strava connection status is unavailable."
    });
  });

  it("uses provider_statuses from backend when available", () => {
    const payload: SetupConfigResponse = {
      status: "ok",
      provider_fields: {
        garmin: ["GARMIN_EMAIL", "GARMIN_PASSWORD"]
      },
      values: {
        GARMIN_EMAIL: "user@example.com"
      },
      secret_presence: {
        GARMIN_PASSWORD: false
      },
      provider_statuses: {
        garmin: "error"
      }
    };

    const result = mapSetupConfigToSourceStatuses(payload);
    expect(result[0]).toMatchObject({ providerId: "garmin", status: "error" });
  });

  it("ignores invalid provider_statuses values", () => {
    const payload = {
      status: "ok",
      provider_fields: {
        garmin: ["GARMIN_EMAIL", "GARMIN_PASSWORD"]
      },
      values: {
        GARMIN_EMAIL: "user@example.com"
      },
      secret_presence: {
        GARMIN_PASSWORD: true
      },
      provider_statuses: {
        garmin: "healthy"
      }
    } as unknown as SetupConfigResponse;

    const result = mapSetupConfigToSourceStatuses(payload);
    expect(result[0]).toMatchObject({ providerId: "garmin", status: "warning" });
  });

  it("skips the reserved general provider section when mapping statuses", () => {
    const payload: SetupConfigResponse = {
      status: "ok",
      provider_fields: {
        general: ["TIMEZONE"],
        garmin: ["GARMIN_EMAIL", "GARMIN_PASSWORD"]
      },
      values: {
        TIMEZONE: "UTC",
        GARMIN_EMAIL: "runner@example.com"
      },
      secret_presence: {
        GARMIN_PASSWORD: true
      }
    };

    const result = mapSetupConfigToSourceStatuses(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ providerId: "garmin", status: "warning" });
  });

  it("starts strava oauth and returns authorize payload", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      authorize_url: "https://www.strava.com/oauth/authorize?client_id=123",
      state: "state-token",
      redirect_uri: "http://localhost/setup/strava/callback"
    });

    const result = await startStravaOauth();

    expect(getJson).toHaveBeenCalledWith("/setup/api/strava/oauth/start", {
      method: "POST",
      body: {}
    });
    expect(result.authorize_url).toContain("strava.com/oauth/authorize");
  });

  it("starts strava oauth with explicit redirect uri override", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      authorize_url: "https://www.strava.com/oauth/authorize?client_id=123",
      state: "state-token",
      redirect_uri: "https://example.com/setup/strava/callback"
    });

    await startStravaOauth("https://example.com/setup/strava/callback");

    expect(getJson).toHaveBeenCalledWith("/setup/api/strava/oauth/start", {
      method: "POST",
      body: {
        redirect_uri: "https://example.com/setup/strava/callback"
      }
    });
  });

  it("disconnects strava under the expected request shape", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      strava: {
        client_configured: true,
        connected: false,
        has_refresh_token: false,
        has_access_token: false
      },
      env_write_path: "/tmp/.env"
    });

    const result = await disconnectStrava();

    expect(getJson).toHaveBeenCalledWith("/setup/api/strava/disconnect", {
      method: "POST",
      body: {}
    });
    expect(result.strava.connected).toBe(false);
  });

  it("propagates disconnect errors from transport layer", async () => {
    const disconnectError = new Error("disconnect failed");
    getJson.mockRejectedValueOnce(disconnectError);

    await expect(disconnectStrava()).rejects.toThrow("disconnect failed");
    expect(getJson).toHaveBeenCalledWith("/setup/api/strava/disconnect", {
      method: "POST",
      body: {}
    });
  });
});
