import { getJson } from "./http-client";

export type SourceStatusKind = "connected" | "warning" | "error" | "disconnected";

export interface SourceConnectionStatus {
  providerId: string;
  providerLabel: string;
  status: SourceStatusKind;
  message: string;
  stravaOauthCredentialsPresent?: boolean;
  stravaClientConfigured?: boolean;
}

export interface SetupConfigResponse {
  status: string;
  provider_fields: Record<string, string[]>;
  values: Record<string, unknown>;
  masked_values?: Record<string, string>;
  provider_links?: Record<string, string>;
  secret_keys?: string[];
  secret_presence?: Record<string, boolean>;
  provider_statuses?: Partial<Record<string, SourceStatusKind>>;
  strava?: {
    client_configured?: boolean;
    connected?: boolean;
    has_refresh_token?: boolean;
    has_access_token?: boolean;
  };
}

interface SetupStravaStatusResponse {
  status: string;
  strava: {
    client_configured?: boolean;
    connected?: boolean;
    has_refresh_token?: boolean;
    has_access_token?: boolean;
  };
}

export interface StartStravaOauthResponse {
  status: string;
  authorize_url: string;
  state: string;
  redirect_uri: string;
}

export interface DisconnectStravaResponse {
  status: string;
  strava: {
    client_configured?: boolean;
    connected?: boolean;
    has_refresh_token?: boolean;
    has_access_token?: boolean;
  };
  env_write_path?: string;
}

function normalizeStatusKind(value: unknown): SourceStatusKind | undefined {
  if (value === "connected" || value === "warning" || value === "error" || value === "disconnected") {
    return value;
  }
  return undefined;
}

const PROVIDER_LABELS: Record<string, string> = {
  strava: "Strava",
  garmin: "Garmin",
  intervals: "Intervals.icu",
  weather: "WeatherAPI",
  smashrun: "Smashrun",
  crono: "Crono API"
};

function toTitleCase(input: string): string {
  return input
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isConfiguredValue(
  key: string,
  values: Record<string, unknown>,
  secretPresence: Record<string, boolean>
): boolean {
  const raw = values[key];
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "string") {
    return raw.trim().length > 0;
  }
  if (secretPresence[key]) {
    return true;
  }
  return false;
}

function statusWithMessage(status: SourceStatusKind): { status: SourceStatusKind; message: string } {
  if (status === "connected") {
    return { status, message: "Connection is healthy." };
  }
  if (status === "warning") {
    return { status, message: "Partially configured; action is needed." };
  }
  if (status === "error") {
    return { status, message: "Status could not be loaded." };
  }
  return { status, message: "Source is not configured." };
}

function mapProviderStatus(
  providerId: string,
  fields: string[],
  values: Record<string, unknown>,
  secretPresence: Record<string, boolean>,
  providerStatuses: SetupConfigResponse["provider_statuses"],
  strava: SetupConfigResponse["strava"]
): SourceConnectionStatus {
  const providerLabel = PROVIDER_LABELS[providerId] ?? toTitleCase(providerId);

  if (providerId === "strava") {
    const hasOauthCredentials = Boolean(strava?.has_refresh_token || strava?.has_access_token);
    const clientConfigured = Boolean(strava?.client_configured);
    if (strava?.connected) {
      return {
        providerId,
        providerLabel,
        ...statusWithMessage("connected"),
        stravaOauthCredentialsPresent: hasOauthCredentials,
        stravaClientConfigured: clientConfigured
      };
    }
    if (strava?.client_configured) {
      return {
        providerId,
        providerLabel,
        ...statusWithMessage("warning"),
        stravaOauthCredentialsPresent: hasOauthCredentials,
        stravaClientConfigured: clientConfigured
      };
    }
    return {
      providerId,
      providerLabel,
      ...statusWithMessage("disconnected"),
      stravaOauthCredentialsPresent: hasOauthCredentials,
      stravaClientConfigured: clientConfigured
    };
  }

  const relevantFields = fields.filter((key) => !key.startsWith("ENABLE_"));
  const configuredCount = relevantFields.filter((key) =>
    isConfiguredValue(key, values, secretPresence)
  ).length;
  const declaredStatus = normalizeStatusKind(providerStatuses?.[providerId]);
  if (declaredStatus) {
    return {
      providerId,
      providerLabel,
      ...statusWithMessage(declaredStatus)
    };
  }

  const status: SourceStatusKind = configuredCount > 0 ? "warning" : "disconnected";

  return {
    providerId,
    providerLabel,
    ...statusWithMessage(status)
  };
}

export function mapSetupConfigToSourceStatuses(payload: SetupConfigResponse): SourceConnectionStatus[] {
  const providerFields = payload.provider_fields ?? {};
  const values = payload.values ?? {};
  const secretPresence = payload.secret_presence ?? {};

  return Object.entries(providerFields)
    .filter(([providerId]) => providerId !== "general")
    .map(([providerId, fields]) =>
      mapProviderStatus(
        providerId,
        fields,
        values,
        secretPresence,
        payload.provider_statuses,
        payload.strava
      )
    );
}

export async function getSourceStatuses(): Promise<SourceConnectionStatus[]> {
  const setupConfig = await getJson<SetupConfigResponse>("/setup/api/config");
  let stravaStatusUnavailable = false;

  try {
    const stravaStatus = await getJson<SetupStravaStatusResponse>("/setup/api/strava/status");
    if (stravaStatus?.strava) {
      setupConfig.strava = stravaStatus.strava;
    }
  } catch {
    stravaStatusUnavailable = true;
  }

  const statuses = mapSetupConfigToSourceStatuses(setupConfig);
  if (!stravaStatusUnavailable) {
    return statuses;
  }

  return statuses.map((item) =>
    item.providerId === "strava"
      ? {
          ...item,
          status: "error",
          message: "Latest Strava connection status is unavailable."
        }
      : item
  );
}

export async function getSetupConfig(): Promise<SetupConfigResponse> {
  return getJson<SetupConfigResponse>("/setup/api/config");
}

export async function updateSetupConfig(
  values: Record<string, unknown>
): Promise<SetupConfigResponse> {
  return getJson<SetupConfigResponse>("/setup/api/config", {
    method: "PUT",
    body: {
      values
    }
  });
}

export async function startStravaOauth(
  redirectUri?: string
): Promise<StartStravaOauthResponse> {
  const body = redirectUri ? { redirect_uri: redirectUri } : {};
  return getJson<StartStravaOauthResponse>("/setup/api/strava/oauth/start", {
    method: "POST",
    body
  });
}

export async function disconnectStrava(): Promise<DisconnectStravaResponse> {
  return getJson<DisconnectStravaResponse>("/setup/api/strava/disconnect", {
    method: "POST",
    body: {}
  });
}
