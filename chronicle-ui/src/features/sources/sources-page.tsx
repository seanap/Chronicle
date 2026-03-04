import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  disconnectStrava,
  getSetupConfig,
  getSourceStatuses,
  startStravaOauth,
  updateSetupConfig,
  type SourceConnectionStatus,
  type SourceStatusKind,
  type SetupConfigResponse
} from "../../api/source-status-api";

interface StatusPalette {
  color: "success" | "warning" | "error" | "default";
  label: string;
}

function statusPalette(status: SourceStatusKind): StatusPalette {
  if (status === "connected") {
    return { color: "success", label: "Connected" };
  }
  if (status === "warning") {
    return { color: "warning", label: "Warning" };
  }
  if (status === "error") {
    return { color: "error", label: "Error" };
  }
  return { color: "default", label: "Disconnected" };
}

interface ProviderFormState {
  fields: string[];
  draft: Record<string, string | boolean>;
  committed: Record<string, string | boolean>;
  secretKeys: Set<string>;
  secretPresence: Record<string, boolean>;
  link?: string;
}

interface OAuthFeedbackState {
  severity: "success" | "error";
  message: string;
}

function toTitleCase(input: string): string {
  const preservedAcronyms = new Map<string, string>([
    ["API", "API"],
    ["ID", "ID"],
    ["URL", "URL"],
    ["OAUTH", "OAuth"]
  ]);
  return input
    .split("_")
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      const preserved = preservedAcronyms.get(upper);
      if (preserved) {
        return preserved;
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function isBooleanField(key: string): boolean {
  return key.startsWith("ENABLE_");
}

function toDraftValue(key: string, value: unknown, isSecret: boolean): string | boolean {
  if (isBooleanField(key)) {
    return value === true;
  }
  if (isSecret) {
    return "";
  }
  return typeof value === "string" ? value : "";
}

function buildProviderForm(payload: SetupConfigResponse, providerId: string): ProviderFormState | null {
  const fields = payload.provider_fields?.[providerId] ?? [];
  if (fields.length === 0) {
    return null;
  }
  const secretKeys = new Set(payload.secret_keys ?? []);
  const draft: Record<string, string | boolean> = {};
  const committed: Record<string, string | boolean> = {};
  for (const key of fields) {
    const value = toDraftValue(key, payload.values?.[key], secretKeys.has(key));
    draft[key] = value;
    committed[key] = value;
  }
  return {
    fields,
    draft,
    committed,
    secretKeys,
    secretPresence: payload.secret_presence ?? {},
    link: payload.provider_links?.[providerId]
  };
}

function hasChangedValue(providerForm: ProviderFormState, key: string): boolean {
  return providerForm.draft[key] !== providerForm.committed[key];
}

function isLikelyEmailField(key: string): boolean {
  return key.endsWith("_EMAIL");
}

function isLikelyUrlField(key: string): boolean {
  return key.endsWith("_URL") || key.endsWith("_BASE_URL");
}

function isLikelyRequiredIdentifierField(key: string): boolean {
  return key.endsWith("_ID") || key.endsWith("_EMAIL");
}

function isProviderEnabled(providerForm: ProviderFormState): boolean {
  const enableFields = providerForm.fields.filter((key) => isBooleanField(key));
  if (enableFields.length === 0) {
    return true;
  }
  return enableFields.some((key) => providerForm.draft[key] === true);
}

function isValidStravaAuthorizeUrl(urlValue: string): boolean {
  try {
    const parsed = new URL(urlValue);
    const isHttps = parsed.protocol === "https:";
    const host = parsed.hostname.toLowerCase();
    const isStravaHost = host === "strava.com" || host === "www.strava.com";
    const isExpectedPath = parsed.pathname === "/oauth/authorize";
    return isHttps && isStravaHost && isExpectedPath;
  } catch {
    return false;
  }
}

export function SourcesPage() {
  const [statuses, setStatuses] = useState<SourceConnectionStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [providerForms, setProviderForms] = useState<Record<string, ProviderFormState>>({});
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [activeConfigLoadingProviderId, setActiveConfigLoadingProviderId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStartingOauth, setIsStartingOauth] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isStravaWalkthroughOpen, setIsStravaWalkthroughOpen] = useState(false);
  const [oauthFeedback, setOauthFeedback] = useState<OAuthFeedbackState | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadStatuses = useCallback(async (): Promise<SourceConnectionStatus[] | null> => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await getSourceStatuses();
      if (requestId !== requestIdRef.current) {
        return null;
      }
      setStatuses(response);
      return response;
    } catch {
      if (requestId !== requestIdRef.current) {
        return null;
      }
      setHasError(true);
      setStatuses([]);
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("strava_oauth");
    if (!oauthStatus) {
      return;
    }

    const reasonMessages: Record<string, string> = {
      missing_code: "OAuth callback was missing an authorization code. Start Strava OAuth again.",
      state_mismatch: "OAuth verification failed due to a state mismatch. Start Strava OAuth again.",
      missing_client_credentials:
        "Strava Client ID/Secret are missing. Save credentials and start OAuth again.",
      token_exchange_failed:
        "Strava token exchange failed. Verify credentials and try OAuth again.",
      missing_refresh_token:
        "Strava did not return a refresh token. Re-run OAuth authorization.",
      missing_access_token:
        "Strava did not return an access token. Re-run OAuth authorization.",
      env_write_failed:
        "Tokens were received but could not be persisted. Check setup file permissions and retry.",
      access_denied: "Strava authorization was denied. Approve access and try again."
    };

    const reason = params.get("reason") ?? "";
    void (async () => {
      const refreshedStatuses = await loadStatuses();
      const stravaStatus = refreshedStatuses?.find((item) => item.providerId === "strava")?.status;

      if (stravaStatus === "connected") {
        setOauthFeedback({
          severity: "success",
          message: "Strava OAuth completed successfully. Connection status has been refreshed."
        });
      } else if (oauthStatus === "connected") {
        setOauthFeedback({
          severity: "error",
          message:
            "Strava OAuth callback returned, but the connection is not verified yet. Check credentials and try again."
        });
      } else {
        setOauthFeedback({
          severity: "error",
          message:
            reasonMessages[reason] ??
            (reason.trim().length > 0
              ? `Strava OAuth failed: ${reason}.`
              : "Strava OAuth failed. Verify setup details and try again.")
        });
      }

      params.delete("strava_oauth");
      params.delete("reason");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    })();
  }, [loadStatuses]);

  const openProviderConfig = useCallback(
    async (providerId: string) => {
      setActiveProviderId(providerId);
      setSaveError(null);
      setSaveSuccess(null);
      setActiveConfigLoadingProviderId(providerId);
      try {
        const payload = await getSetupConfig();
        const form = buildProviderForm(payload, providerId);
        if (!form) {
          setSaveError("No editable configuration fields are available for this source.");
          return;
        }
        setProviderForms((current) => ({
          ...current,
          [providerId]: form
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load source configuration.";
        setSaveError(message);
      } finally {
        setActiveConfigLoadingProviderId((current) => (current === providerId ? null : current));
      }
    },
    []
  );

  const updateFieldValue = useCallback((providerId: string, key: string, value: string | boolean) => {
    setProviderForms((current) => {
      const existing = current[providerId];
      if (!existing) {
        return current;
      }
      return {
        ...current,
        [providerId]: {
          ...existing,
          draft: {
            ...existing.draft,
            [key]: value
          }
        }
      };
    });
    setSaveError(null);
    setSaveSuccess(null);
  }, []);

  const saveProviderConfig = useCallback(
    async (providerId: string) => {
      const form = providerForms[providerId];
      if (!form) {
        setSaveError("Configuration is unavailable. Reload this source before saving.");
        return;
      }
      const providerEnabled = isProviderEnabled(form);

      if (providerEnabled) {
        for (const key of form.fields) {
          if (isBooleanField(key) || form.secretKeys.has(key)) {
            continue;
          }
          const value = form.draft[key];
          if (typeof value !== "string") {
            continue;
          }
          const trimmed = value.trim();
          const fieldWasChanged = hasChangedValue(form, key);
          const mustBePresent = isLikelyRequiredIdentifierField(key);
          if ((mustBePresent || fieldWasChanged) && trimmed.length === 0) {
            setSaveError(`Enter ${toTitleCase(key)} before saving.`);
            return;
          }
          if (isLikelyEmailField(key) && trimmed.length > 0 && !trimmed.includes("@")) {
            setSaveError(`Enter a valid ${toTitleCase(key)} before saving.`);
            return;
          }
          if (isLikelyUrlField(key) && trimmed.length > 0 && !/^https?:\/\//i.test(trimmed)) {
            setSaveError(`${toTitleCase(key)} must start with http:// or https://.`);
            return;
          }
        }
      }

      const changedValues: Record<string, unknown> = {};
      for (const key of form.fields) {
        if (!hasChangedValue(form, key)) {
          continue;
        }
        const value = form.draft[key];
        if (form.secretKeys.has(key) && typeof value === "string" && value.trim().length === 0) {
          continue;
        }
        changedValues[key] = value;
      }
      if (Object.keys(changedValues).length === 0) {
        setSaveError("No credential changes to save.");
        return;
      }

      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);
      try {
        await updateSetupConfig(changedValues);
        setProviderForms((current) => {
          const existing = current[providerId];
          if (!existing) {
            return current;
          }
          const nextCommitted = { ...existing.committed };
          const nextDraft = { ...existing.draft };
          for (const [key, value] of Object.entries(changedValues)) {
            if (existing.secretKeys.has(key) && typeof value === "string") {
              nextCommitted[key] = "";
              nextDraft[key] = "";
              continue;
            }
            if (typeof value === "boolean" || typeof value === "string") {
              nextCommitted[key] = value;
              nextDraft[key] = value;
            }
          }
          return {
            ...current,
            [providerId]: {
              ...existing,
              committed: nextCommitted,
              draft: nextDraft
            }
          };
        });
        const providerName = statuses.find((item) => item.providerId === providerId)?.providerLabel ?? providerId;
        setSaveSuccess(`Saved ${providerName} credentials.`);
        await loadStatuses();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Credentials could not be saved. Verify values and try again.";
        setSaveError(message);
      } finally {
        setIsSaving(false);
      }
    },
    [loadStatuses, providerForms, statuses]
  );

  const beginStravaOauth = useCallback(async () => {
    setIsStartingOauth(true);
    setOauthFeedback(null);
    try {
      const response = await startStravaOauth();
      if (!isValidStravaAuthorizeUrl(response.authorize_url)) {
        setOauthFeedback({
          severity: "error",
          message: "Received an invalid Strava authorization URL. Verify setup and try again."
        });
        return;
      }
      window.open(response.authorize_url, "_self");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to start Strava OAuth. Verify credentials and try again.";
      setOauthFeedback({
        severity: "error",
        message
      });
    } finally {
      setIsStartingOauth(false);
    }
  }, []);

  const beginStravaDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    setOauthFeedback(null);
    try {
      await disconnectStrava();
      const refreshedStatuses = await loadStatuses();
      const refreshedStravaStatus = refreshedStatuses?.find((item) => item.providerId === "strava");
      if (
        !refreshedStravaStatus ||
        refreshedStravaStatus.status === "connected" ||
        refreshedStravaStatus.stravaOauthCredentialsPresent === true
      ) {
        throw new Error("Unable to confirm Strava disconnect. Refresh status and try again.");
      }
      setOauthFeedback({
        severity: "success",
        message: "Strava has been disconnected. Client settings were kept so you can reconnect anytime."
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to disconnect Strava. Verify setup and try again.";
      setOauthFeedback({
        severity: "error",
        message
      });
    } finally {
      setIsDisconnecting(false);
    }
  }, [loadStatuses]);

  const isConfigLoading = activeConfigLoadingProviderId === activeProviderId;
  const stravaCallbackDomain = window.location.hostname;
  const stravaCallbackUrl = `${window.location.origin}/setup/strava/callback`;

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography component="h1" variant="h4">
          Sources
        </Typography>
        <Button type="button" variant="outlined" disabled={isLoading} onClick={() => void loadStatuses()}>
          Refresh Status
        </Button>
      </Box>

      {isLoading ? <Typography>Loading source connection status...</Typography> : null}

      {hasError ? (
        <Alert severity="error" role="alert">
          Failed to load source connection status.
        </Alert>
      ) : null}

      {oauthFeedback ? (
        <Alert severity={oauthFeedback.severity} role={oauthFeedback.severity === "error" ? "alert" : "status"}>
          {oauthFeedback.message}
        </Alert>
      ) : null}

      {!isLoading && !hasError && statuses.length === 0 ? (
        <Alert severity="warning" role="status">
          No source configuration was found yet.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))"
          }
        }}
      >
        {statuses.map((item) => {
          const palette = statusPalette(item.status);
          return (
            <Card key={item.providerId} variant="outlined">
              <CardContent>
                <Box sx={{ display: "grid", gap: 1 }}>
                  <Typography variant="h6">{item.providerLabel}</Typography>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Chip color={palette.color} label={palette.label} size="small" />
                    <Typography variant="body2">Status: {item.status}</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {item.message}
                  </Typography>
                  <Box>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button
                        type="button"
                        variant="text"
                        size="small"
                        id={`provider-config-label-${item.providerId}`}
                        aria-expanded={activeProviderId === item.providerId}
                        aria-controls={`provider-config-${item.providerId}`}
                        onClick={() => {
                          if (activeProviderId === item.providerId) {
                            setSaveError(null);
                            setSaveSuccess(null);
                            setActiveProviderId(null);
                            return;
                          }
                          void openProviderConfig(item.providerId);
                        }}
                      >
                        Configure {item.providerLabel}
                      </Button>
                      {item.providerId === "strava" ? (
                        <>
                          <Button
                            type="button"
                            variant="text"
                            size="small"
                            aria-expanded={isStravaWalkthroughOpen}
                            aria-controls="strava-setup-walkthrough"
                            onClick={() => setIsStravaWalkthroughOpen((current) => !current)}
                          >
                            Strava Setup Walkthrough
                          </Button>
                          <Button
                            type="button"
                            variant="outlined"
                            size="small"
                            disabled={isStartingOauth || isDisconnecting}
                            onClick={() => void beginStravaOauth()}
                          >
                            Connect Strava OAuth
                          </Button>
                          {(item.status === "connected" || item.status === "warning") &&
                          item.stravaOauthCredentialsPresent === true ? (
                            <Button
                              type="button"
                              variant="outlined"
                              size="small"
                              color="error"
                              disabled={isStartingOauth || isDisconnecting}
                              onClick={() => void beginStravaDisconnect()}
                            >
                              Disconnect Strava
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                    </Box>
                  </Box>
                  {item.providerId === "strava" && isStravaWalkthroughOpen ? (
                    <Box
                      id="strava-setup-walkthrough"
                      role="region"
                      aria-label="Strava setup walkthrough"
                      sx={{ display: "grid", gap: 1, pt: 0.5 }}
                    >
                      <Alert severity="info" role="status">
                        <Typography variant="body2">Before OAuth, complete this Strava API app setup:</Typography>
                      </Alert>
                      <Box component="ol" sx={{ pl: 2.5, m: 0, display: "grid", gap: 0.5 }}>
                        <li>
                          <Typography variant="body2">
                            Open{" "}
                            <Link href="https://developers.strava.com/" target="_blank" rel="noreferrer" underline="hover">
                              Strava Developers
                            </Link>{" "}
                            and create an API application.
                          </Typography>
                        </li>
                        <li>
                          <Typography variant="body2">
                            Authorization Callback Domain:{" "}
                            <Typography component="span" variant="body2" sx={{ fontFamily: "monospace" }}>
                              {stravaCallbackDomain}
                            </Typography>
                          </Typography>
                        </li>
                        <li>
                          <Typography variant="body2">
                            Authorization Callback URL:{" "}
                            <Typography component="span" variant="body2" sx={{ fontFamily: "monospace" }}>
                              {stravaCallbackUrl}
                            </Typography>
                          </Typography>
                        </li>
                        <li>
                          <Typography variant="body2">
                            Copy the generated Client ID and Client Secret into Configure Strava.
                          </Typography>
                        </li>
                      </Box>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <Button
                          type="button"
                          variant="contained"
                          size="small"
                          disabled={isStartingOauth || isDisconnecting}
                          onClick={() => {
                            setIsStravaWalkthroughOpen(false);
                            void beginStravaOauth();
                          }}
                        >
                          Continue to OAuth
                        </Button>
                        <Button
                          type="button"
                          variant="outlined"
                          size="small"
                          onClick={() => setIsStravaWalkthroughOpen(false)}
                        >
                          Hide Walkthrough
                        </Button>
                      </Box>
                    </Box>
                  ) : null}
                  {activeProviderId === item.providerId ? (
                    <Box
                      id={`provider-config-${item.providerId}`}
                      role="region"
                      aria-labelledby={`provider-config-label-${item.providerId}`}
                      sx={{ display: "grid", gap: 1.5, pt: 1 }}
                    >
                      {isConfigLoading ? <Typography>Loading credential fields...</Typography> : null}
                      {!isConfigLoading && saveSuccess ? (
                        <Alert severity="success" role="status">
                          {saveSuccess}
                        </Alert>
                      ) : null}
                      {!isConfigLoading && saveError ? (
                        <Alert severity="error" role="alert">
                          {saveError}
                        </Alert>
                      ) : null}
                      {!isConfigLoading && providerForms[item.providerId]?.link ? (
                        <Link
                          href={providerForms[item.providerId].link}
                          target="_blank"
                          rel="noreferrer"
                          underline="hover"
                        >
                          Source setup documentation
                        </Link>
                      ) : null}
                      {!isConfigLoading
                        ? providerForms[item.providerId]?.fields.map((key) => {
                            const providerForm = providerForms[item.providerId];
                            if (!providerForm) {
                              return null;
                            }
                            if (isBooleanField(key)) {
                              return (
                                <FormControlLabel
                                  key={key}
                                  control={
                                    <Switch
                                      checked={providerForm.draft[key] === true}
                                      onChange={(_, checked) =>
                                        updateFieldValue(item.providerId, key, checked)
                                      }
                                    />
                                  }
                                  label={toTitleCase(key)}
                                />
                              );
                            }

                            const isSecret = providerForm.secretKeys.has(key);
                            const hasStoredSecret = providerForm.secretPresence[key] === true;
                            return (
                              <TextField
                                key={key}
                                type={isSecret ? "password" : "text"}
                                label={toTitleCase(key)}
                                value={typeof providerForm.draft[key] === "string" ? providerForm.draft[key] : ""}
                                helperText={
                                  isSecret && hasStoredSecret
                                    ? "Stored secret exists. Leave blank to keep existing value."
                                    : undefined
                                }
                                onChange={(event) =>
                                  updateFieldValue(item.providerId, key, event.target.value)
                                }
                              />
                            );
                          })
                        : null}
                      {!isConfigLoading && providerForms[item.providerId] ? (
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            type="button"
                            variant="contained"
                            disabled={isSaving}
                            onClick={() => void saveProviderConfig(item.providerId)}
                          >
                            Save {item.providerLabel} Credentials
                          </Button>
                          <Button
                            type="button"
                            variant="outlined"
                            disabled={isSaving}
                            onClick={() => {
                              setSaveError(null);
                              setSaveSuccess(null);
                              setActiveProviderId(null);
                            }}
                          >
                            Close
                          </Button>
                        </Box>
                      ) : null}
                    </Box>
                  ) : null}
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
