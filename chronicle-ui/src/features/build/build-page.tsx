import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YAML from "yaml";
import { ApiRequestError } from "../../api/http-client";
import {
  createEditorProfile,
  getEditorFixtures,
  getEditorProfilesExport,
  getEditorProfiles,
  getEditorRepositoryTemplateExport,
  getEditorRepositoryTemplates,
  getEditorSnippets,
  getEditorTemplate,
  getEditorTemplateExport,
  getEditorTemplateVersions,
  importEditorProfiles,
  importEditorRepositoryTemplate,
  importEditorTemplate,
  previewEditorProfile,
  previewEditorTemplate,
  rollbackEditorTemplate,
  saveEditorTemplate,
  setEditorWorkingProfile,
  updateEditorProfile,
  validateEditorTemplate,
  type EditorFixture,
  type EditorProfile,
  type EditorProfileMatchResult,
  type EditorRepositoryTemplateSummary,
  type EditorSnippet,
  type EditorTemplateImportBundle,
  type EditorTemplateResponse,
  type EditorTemplateVersion
} from "../../api/template-editor-api";
import { timeBuildOperation } from "./template-editor-timing";

const TEMPLATE_HELPER_ID = "template-editor-help";
const TEMPLATE_ERROR_LIST_ID = "template-validation-errors";
const TEMPLATE_WARNING_LIST_ID = "template-validation-warnings";
const TEMPLATE_HINTS_ID = "template-validation-hints";

const FALLBACK_JINJA_HINTS: EditorSnippet[] = [
  {
    id: "fallback-if-block",
    category: "logic",
    label: "Conditional Block",
    template: "{% if activity.distance_miles %}\n{{ activity.distance_miles }} mi\n{% endif %}",
    description: "Wrap optional values in an if block to avoid undefined-variable errors."
  },
  {
    id: "fallback-default-filter",
    category: "filters",
    label: "Default Fallback",
    template: "{{ activity.run_type | default('Run') }}",
    description: "Use `default(...)` when a field may be missing in some activities."
  },
  {
    id: "fallback-loop",
    category: "loops",
    label: "Safe Loop Pattern",
    template: "{% for lap in activity.laps | default([]) %}\n- {{ lap.distance_miles }} mi\n{% endfor %}",
    description: "Provide a safe fallback list before iterating."
  }
];

function apiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiRequestError) {
    const details = error.details;
    if (details && typeof details === "object" && "errors" in (details as Record<string, unknown>)) {
      const validationErrors = (details as { errors?: unknown[] }).errors;
      if (Array.isArray(validationErrors)) {
        const firstError = validationErrors.find((item) => typeof item === "string" && item.trim().length > 0);
        if (typeof firstError === "string") {
          return firstError;
        }
      }
    }
    return error.message;
  }
  return error instanceof Error ? error.message : fallbackMessage;
}

function saveErrorMessage(error: unknown): string {
  return apiErrorMessage(error, "Unable to save template.");
}

function isFeedbackSuppressedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (error as { suppress_additional_feedback?: boolean }).suppress_additional_feedback === true;
}

function stringList(values: unknown[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeProfileId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : "";
}

function normalizeTemplateId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "";
}

function toFilenameToken(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized;
}

function findEnabledProfileId(profiles: EditorProfile[]): string {
  const enabledProfile = profiles.find((profile) => profile.enabled !== false);
  return normalizeProfileId(enabledProfile?.profile_id);
}

type PreviewContextMode = "sample" | "latest";
type ExportSource = "active" | "repository";
type ImportTarget = "active" | "repository";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseProfileCriteriaJson(rawValue: string): Record<string, unknown> {
  const text = rawValue.trim();
  if (text.length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Classification rules must be a valid JSON object.");
  }
  if (!isRecord(parsed)) {
    throw new Error("Classification rules must be a valid JSON object.");
  }
  return parsed;
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read import file."));
    reader.readAsText(file);
  });
}

function parseImportBundle(rawPayload: unknown): EditorTemplateImportBundle {
  if (!isRecord(rawPayload)) {
    throw new Error("Import bundle must be a JSON object.");
  }
  const candidate = isRecord(rawPayload.bundle) ? rawPayload.bundle : rawPayload;
  const template = candidate.template;
  if (typeof template !== "string" || template.trim().length === 0) {
    throw new Error("Import bundle must include a non-empty `template` field.");
  }
  return candidate as EditorTemplateImportBundle;
}

function parseProfileImportBundle(rawPayload: unknown): {
  bundle_version?: number;
  exported_at_utc?: string;
  working_profile_id?: string;
  profiles: unknown[];
  [key: string]: unknown;
} {
  if (!isRecord(rawPayload)) {
    throw new Error("Profile import bundle must be a YAML object.");
  }
  const candidate = isRecord(rawPayload.bundle) ? rawPayload.bundle : rawPayload;
  const profiles = candidate.profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new Error("Profile import bundle must include a non-empty `profiles` list.");
  }
  return {
    ...candidate,
    profiles
  };
}

function importErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.details && typeof error.details === "object") {
    const details = error.details as Record<string, unknown>;
    const validationErrors = details.validation && typeof details.validation === "object"
      ? stringList((details.validation as { errors?: unknown[] }).errors)
      : [];
    if (validationErrors.length > 0) {
      return validationErrors[0] ?? error.message;
    }
  }
  return apiErrorMessage(error, "Unable to import template bundle.");
}

function downloadJsonBundle(payload: unknown, fileName: string): void {
  downloadTextBundle(JSON.stringify(payload, null, 2), fileName, "application/json");
}

function downloadTextBundle(payload: string, fileName: string, mimeType: string): void {
  if (typeof window === "undefined") {
    return;
  }
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return;
  }
  const blob = new Blob([payload], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export function BuildPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPreviewingProfile, setIsPreviewingProfile] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingProfiles, setIsExportingProfiles] = useState(false);
  const [isImportingProfiles, setIsImportingProfiles] = useState(false);
  const [templateText, setTemplateText] = useState("");
  const [committedTemplateText, setCommittedTemplateText] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{ severity: "success" | "error"; message: string } | null>(null);
  const [validationFeedback, setValidationFeedback] = useState<{ severity: "success" | "error"; message: string } | null>(null);
  const [previewFeedback, setPreviewFeedback] = useState<{ severity: "success" | "error"; message: string } | null>(null);
  const [rollbackFeedback, setRollbackFeedback] = useState<{ severity: "success" | "error"; message: string } | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<{ severity: "success" | "error"; message: string } | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{ severity: "success" | "error"; message: string } | null>(null);
  const [importFeedback, setImportFeedback] = useState<{ severity: "success" | "error"; message: string } | null>(null);
  const [fixturesLoadWarning, setFixturesLoadWarning] = useState<string | null>(null);
  const [versionsLoadWarning, setVersionsLoadWarning] = useState<string | null>(null);
  const [repositoryLoadWarning, setRepositoryLoadWarning] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validationContextSource, setValidationContextSource] = useState<string | null>(null);
  const [previewContextMode, setPreviewContextMode] = useState<PreviewContextMode>("sample");
  const [previewFixtures, setPreviewFixtures] = useState<EditorFixture[]>([]);
  const [editorProfiles, setEditorProfiles] = useState<EditorProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("default");
  const [workingProfileId, setWorkingProfileId] = useState("default");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [newProfileId, setNewProfileId] = useState("");
  const [newProfileLabel, setNewProfileLabel] = useState("");
  const [newProfileCriteriaJson, setNewProfileCriteriaJson] = useState("{}");
  const [editProfileLabel, setEditProfileLabel] = useState("");
  const [editProfileCriteriaJson, setEditProfileCriteriaJson] = useState("{}");
  const [editProfileEnabled, setEditProfileEnabled] = useState(true);
  const [editProfilePriority, setEditProfilePriority] = useState("0");
  const [templateVersions, setTemplateVersions] = useState<EditorTemplateVersion[]>([]);
  const [selectedFixtureName, setSelectedFixtureName] = useState("");
  const [selectedProfileExportIds, setSelectedProfileExportIds] = useState<string[]>([]);
  const [selectedProfileImportFile, setSelectedProfileImportFile] = useState<File | null>(null);
  const [exportSource, setExportSource] = useState<ExportSource>("active");
  const [importTarget, setImportTarget] = useState<ImportTarget>("active");
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [repositoryTemplates, setRepositoryTemplates] = useState<EditorRepositoryTemplateSummary[]>([]);
  const [selectedRepositoryTemplateIds, setSelectedRepositoryTemplateIds] = useState<string[]>([]);
  const [previewOutput, setPreviewOutput] = useState<string | null>(null);
  const [previewContextSource, setPreviewContextSource] = useState<string | null>(null);
  const [profilePreviewResult, setProfilePreviewResult] = useState<EditorProfileMatchResult | null>(null);
  const [profilePreviewContextSource, setProfilePreviewContextSource] = useState<string | null>(null);
  const [editorSnippets, setEditorSnippets] = useState<EditorSnippet[]>([]);
  const [templateMetadata, setTemplateMetadata] = useState<EditorTemplateResponse | null>(null);
  const previewRequestIdRef = useRef(0);
  const rollbackRequestIdRef = useRef(0);
  const importRequestIdRef = useRef(0);
  const profileImportRequestIdRef = useRef(0);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const profileImportFileInputRef = useRef<HTMLInputElement | null>(null);
  const draftTemplateByProfileRef = useRef<Record<string, string>>({});
  const committedTemplateByProfileRef = useRef<Record<string, string>>({});

  const hasUnsavedChanges = useMemo(
    () => templateText !== committedTemplateText,
    [committedTemplateText, templateText]
  );

  const describedByIds = useMemo(() => {
    const ids = [TEMPLATE_HELPER_ID];
    if (validationErrors.length > 0) {
      ids.push(TEMPLATE_ERROR_LIST_ID, TEMPLATE_HINTS_ID);
    }
    if (validationWarnings.length > 0) {
      ids.push(TEMPLATE_WARNING_LIST_ID);
    }
    return ids.join(" ");
  }, [validationErrors.length, validationWarnings.length]);

  const hintSnippets = useMemo(() => {
    if (validationErrors.length === 0) {
      return [];
    }
    return editorSnippets.length > 0 ? editorSnippets : FALLBACK_JINJA_HINTS;
  }, [editorSnippets, validationErrors.length]);

  const usingFallbackHints = validationErrors.length > 0 && editorSnippets.length === 0;
  const activeVersionId = templateMetadata?.current_version?.version_id ?? "";
  const selectedProfile = useMemo(
    () =>
      editorProfiles.find(
        (candidate) => normalizeProfileId(candidate.profile_id) === normalizeProfileId(selectedProfileId)
      ) ?? null,
    [editorProfiles, selectedProfileId]
  );
  const selectedProfileLocked = selectedProfile?.locked === true;
  const selectedProfileLabel = useMemo(() => {
    if (selectedProfile && typeof selectedProfile.label === "string" && selectedProfile.label.trim().length > 0) {
      return selectedProfile.label;
    }
    if (typeof templateMetadata?.profile_label === "string" && templateMetadata.profile_label.trim().length > 0) {
      return templateMetadata.profile_label;
    }
    return null;
  }, [selectedProfile, templateMetadata?.profile_label]);
  const activeTemplateProfileId = useMemo(
    () => normalizeProfileId(workingProfileId) || normalizeProfileId(selectedProfileId) || "default",
    [selectedProfileId, workingProfileId]
  );

  const loadTemplate = useCallback(async (options?: { throwOnError?: boolean; profileId?: string; preserveCurrentOnError?: boolean }) => {
    previewRequestIdRef.current += 1;
    setIsLoading(true);
    if (!options?.preserveCurrentOnError) {
      setLoadError(null);
    }
    setValidationFeedback(null);
    setPreviewFeedback(null);
    setRollbackFeedback(null);
    setProfileFeedback(null);
    setExportFeedback(null);
    setImportFeedback(null);
    setFixturesLoadWarning(null);
    setVersionsLoadWarning(null);
    setRepositoryLoadWarning(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    setValidationContextSource(null);
    setPreviewOutput(null);
    setPreviewContextSource(null);
    setProfilePreviewResult(null);
    setProfilePreviewContextSource(null);
    try {
      const profilesResponse = await timeBuildOperation("template.profiles.load", () => getEditorProfiles());
      const profiles = Array.isArray(profilesResponse.profiles)
        ? profilesResponse.profiles.filter(
            (profile): profile is EditorProfile =>
              typeof profile?.profile_id === "string" && profile.profile_id.trim().length > 0
          )
        : [];

      const requestedProfileId = normalizeProfileId(options?.profileId);
      const responseWorkingProfileId = normalizeProfileId(profilesResponse.working_profile_id);
      const fallbackProfileId = findEnabledProfileId(profiles) || normalizeProfileId(profiles[0]?.profile_id) || "default";
      const effectiveProfileId = requestedProfileId || responseWorkingProfileId || fallbackProfileId;

      const templateResponse = await timeBuildOperation("template.load", () => getEditorTemplate(effectiveProfileId));
      const [snippetsResult, fixturesResult, versionsResult, repositoryResult] = await Promise.all([
        timeBuildOperation("template.snippets.load", async () => {
          try {
            const snippetsResponse = await getEditorSnippets();
            return {
              snippets: Array.isArray(snippetsResponse.snippets) ? snippetsResponse.snippets : []
            };
          } catch {
            return { snippets: [] as EditorSnippet[] };
          }
        }),
        timeBuildOperation("template.fixtures.load", async () => {
          try {
            const fixturesResponse = await getEditorFixtures();
            return {
              fixtures: Array.isArray(fixturesResponse.fixtures) ? fixturesResponse.fixtures : [],
              warning: null as string | null
            };
          } catch {
            return {
              fixtures: [] as EditorFixture[],
              warning: "Sample fixtures unavailable; preview currently supports latest activity context only."
            };
          }
        }),
        timeBuildOperation("template.versions.load", async () => {
          try {
            const versionsResponse = await getEditorTemplateVersions({ profile_id: effectiveProfileId });
            return {
              versions: Array.isArray(versionsResponse.versions)
                ? versionsResponse.versions.filter(
                    (version): version is EditorTemplateVersion =>
                      typeof version?.version_id === "string" && version.version_id.trim().length > 0
                  )
                : [],
              warning: null as string | null
            };
          } catch {
            return {
              versions: [] as EditorTemplateVersion[],
              warning: "Template version history unavailable; rollback is currently disabled."
            };
          }
        }),
        timeBuildOperation("template.repository.list.load", async () => {
          try {
            const repositoryResponse = await getEditorRepositoryTemplates();
            const templates = Array.isArray(repositoryResponse.templates)
              ? repositoryResponse.templates.filter(
                  (template): template is EditorRepositoryTemplateSummary =>
                    typeof template?.template_id === "string" &&
                    template.template_id.trim().length > 0 &&
                    typeof template?.name === "string" &&
                    template.name.trim().length > 0
                )
              : [];
            return {
              templates,
              warning: null as string | null
            };
          } catch {
            return {
              templates: [] as EditorRepositoryTemplateSummary[],
              warning: "Template repository unavailable; export currently supports active template only."
            };
          }
        })
      ]);

      const responseProfileId = normalizeProfileId(templateResponse.profile_id) || effectiveProfileId;
      const nextTemplate = templateResponse.template ?? "";
      committedTemplateByProfileRef.current[responseProfileId] = nextTemplate;
      const profileDraft = draftTemplateByProfileRef.current[responseProfileId];
      const nextProfileDraft = typeof profileDraft === "string" ? profileDraft : nextTemplate;
      draftTemplateByProfileRef.current[responseProfileId] = nextProfileDraft;

      const workingProfileForState = responseWorkingProfileId || fallbackProfileId || responseProfileId;
      setEditorProfiles(profiles);
      setSelectedProfileExportIds((currentIds) => {
        const availableIds = profiles
          .map((profile) => normalizeProfileId(profile.profile_id))
          .filter((profileId): profileId is string => profileId.length > 0);
        if (availableIds.length === 0) {
          return [];
        }
        const retained = currentIds
          .map((profileId) => normalizeProfileId(profileId))
          .filter((profileId, index, allValues) => profileId.length > 0 && allValues.indexOf(profileId) === index)
          .filter((profileId) => availableIds.includes(profileId));
        if (retained.length > 0) {
          return retained;
        }
        return [...availableIds];
      });
      setWorkingProfileId(workingProfileForState);
      setSelectedProfileId(responseProfileId);
      setTemplateText(nextProfileDraft);
      setCommittedTemplateText(nextTemplate);
      setTemplateMetadata({
        ...templateResponse,
        profile_id: responseProfileId,
        profile_label:
          templateResponse.profile_label ??
          profiles.find((profile) => normalizeProfileId(profile.profile_id) === responseProfileId)?.label
      });
      setEditorSnippets(snippetsResult.snippets);
      setPreviewFixtures(fixturesResult.fixtures);
      setPreviewContextMode(fixturesResult.fixtures.length > 0 ? "sample" : "latest");
      setSelectedFixtureName(fixturesResult.fixtures[0]?.name ?? "");
      setFixturesLoadWarning(fixturesResult.warning);
      setTemplateVersions(versionsResult.versions);
      setVersionsLoadWarning(versionsResult.warning);
      setRepositoryTemplates(repositoryResult.templates);
      setRepositoryLoadWarning(repositoryResult.warning);
      setSelectedRepositoryTemplateIds((currentIds) =>
        currentIds.filter((templateId) =>
          repositoryResult.templates.some(
            (template) => normalizeTemplateId(template.template_id) === normalizeTemplateId(templateId)
          )
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load template.";
      if (!options?.preserveCurrentOnError) {
        setLoadError(message);
        setPreviewFixtures([]);
        setTemplateVersions([]);
        setSelectedFixtureName("");
        setFixturesLoadWarning(null);
        setVersionsLoadWarning(null);
        setRepositoryTemplates([]);
        setRepositoryLoadWarning(null);
      }
      if (options?.throwOnError) {
        const thrownError = error instanceof Error ? error : new Error(message);
        (thrownError as Error & { suppress_additional_feedback?: boolean }).suppress_additional_feedback = true;
        throw thrownError;
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  useEffect(() => {
    if (!selectedProfile) {
      setEditProfileLabel("");
      setEditProfileCriteriaJson("{}");
      setEditProfileEnabled(true);
      setEditProfilePriority("0");
      return;
    }
    setEditProfileLabel(typeof selectedProfile.label === "string" ? selectedProfile.label : "");
    setEditProfileCriteriaJson(JSON.stringify(selectedProfile.criteria ?? {}, null, 2));
    setEditProfileEnabled(selectedProfile.enabled !== false);
    setEditProfilePriority(String(typeof selectedProfile.priority === "number" ? selectedProfile.priority : 0));
  }, [selectedProfile]);

  const saveTemplate = useCallback(async () => {
    if (loadError || !hasUnsavedChanges || isSaving || isRollingBack || isImporting) {
      return;
    }
    const currentProfileId = activeTemplateProfileId;
    setSaveFeedback(null);
    setExportFeedback(null);
    setImportFeedback(null);
    setIsSaving(true);
    try {
      const response = await timeBuildOperation("template.save", () =>
        saveEditorTemplate({
          template: templateText,
          source: "editor-ui",
          profile_id: currentProfileId
        })
      );
      const savedTemplate = response.active?.template;
      if (typeof savedTemplate === "string") {
        setTemplateText(savedTemplate);
        setCommittedTemplateText(savedTemplate);
        draftTemplateByProfileRef.current[currentProfileId] = savedTemplate;
        committedTemplateByProfileRef.current[currentProfileId] = savedTemplate;
      } else {
        setCommittedTemplateText(templateText);
        draftTemplateByProfileRef.current[currentProfileId] = templateText;
        committedTemplateByProfileRef.current[currentProfileId] = templateText;
      }
      setSaveFeedback({
        severity: "success",
        message: "Template saved."
      });
    } catch (error) {
      setSaveFeedback({
        severity: "error",
        message: saveErrorMessage(error)
      });
    } finally {
      setIsSaving(false);
    }
  }, [activeTemplateProfileId, hasUnsavedChanges, isImporting, isRollingBack, isSaving, loadError, templateText]);

  const validateTemplate = useCallback(async () => {
    if (loadError || isLoading || isSaving || isValidating || isRollingBack || isImporting) {
      return;
    }
    setSaveFeedback(null);
    setExportFeedback(null);
    setImportFeedback(null);
    setValidationFeedback(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    setValidationContextSource(null);
    setIsValidating(true);
    try {
      const response = await timeBuildOperation("template.validate", () =>
        validateEditorTemplate({
          template: templateText,
          profile_id: activeTemplateProfileId
        })
      );
      const errors = stringList(response.validation?.errors);
      const warnings = stringList(response.validation?.warnings);
      setValidationErrors(errors);
      setValidationWarnings(warnings);
      setValidationContextSource(response.context_source ?? null);

      if (response.status === "ok" || response.validation?.valid === true) {
        setValidationFeedback({
          severity: "success",
          message: "Template validation passed."
        });
      } else {
        setValidationFeedback({
          severity: "error",
          message: errors[0] ?? "Template validation failed. Review errors and hint snippets."
        });
      }
    } catch (error) {
      const message = apiErrorMessage(error, "Unable to validate template.");
      let errors: string[] = [];
      if (error instanceof ApiRequestError && error.details && typeof error.details === "object") {
        const details = error.details as Record<string, unknown>;
        if (Array.isArray(details.errors)) {
          errors = stringList(details.errors);
        } else if (
          details.validation &&
          typeof details.validation === "object" &&
          Array.isArray((details.validation as Record<string, unknown>).errors)
        ) {
          errors = stringList((details.validation as { errors?: unknown[] }).errors);
        }
        if (typeof details.context_source === "string") {
          setValidationContextSource(details.context_source);
        }
      }
      setValidationErrors(errors);
      setValidationFeedback({
        severity: "error",
        message
      });
    } finally {
      setIsValidating(false);
    }
  }, [activeTemplateProfileId, isImporting, isLoading, isRollingBack, isSaving, isValidating, loadError, templateText]);

  const previewTemplate = useCallback(async () => {
    if (loadError || isLoading || isSaving || isValidating || isPreviewing || isRollingBack || isImporting) {
      return;
    }
    if (previewContextMode === "sample" && selectedFixtureName.trim().length === 0) {
      setPreviewFeedback({
        severity: "error",
        message: "Choose a sample fixture before previewing."
      });
      return;
    }
    setSaveFeedback(null);
    setExportFeedback(null);
    setImportFeedback(null);
    setValidationFeedback(null);
    setPreviewFeedback(null);
    setPreviewOutput(null);
    setPreviewContextSource(null);
    setIsPreviewing(true);
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    try {
      const payload: {
        template: string;
        context_mode: PreviewContextMode;
        fixture_name?: string;
        profile_id?: string;
      } = {
        template: templateText,
        context_mode: previewContextMode,
        profile_id: activeTemplateProfileId
      };
      if (previewContextMode === "sample") {
        payload.fixture_name = selectedFixtureName;
      }
      const response = await timeBuildOperation("template.preview", () => previewEditorTemplate(payload));
      if (previewRequestIdRef.current !== requestId) {
        return;
      }
      setPreviewOutput(response.preview ?? "");
      setPreviewContextSource(response.context_source ?? null);
      setPreviewFeedback({
        severity: "success",
        message: "Preview generated."
      });
    } catch (error) {
      if (previewRequestIdRef.current !== requestId) {
        return;
      }
      setPreviewFeedback({
        severity: "error",
        message: apiErrorMessage(error, "Unable to preview template.")
      });
    } finally {
      setIsPreviewing(false);
    }
  }, [
    isLoading,
    isImporting,
    isPreviewing,
    isRollingBack,
    isSaving,
    isValidating,
    loadError,
    previewContextMode,
    activeTemplateProfileId,
    selectedFixtureName,
    templateText
  ]);

  const rollbackTemplateToVersion = useCallback(
    async (versionId: string) => {
      if (
        versionId.trim().length === 0 ||
        loadError ||
        isLoading ||
        isSaving ||
        isValidating ||
        isPreviewing ||
        isRollingBack ||
        isImporting
      ) {
        return;
      }
      if (activeVersionId === versionId) {
        return;
      }

      const confirmationMessage = hasUnsavedChanges
        ? `You have unsaved edits that will be replaced. Roll back to ${versionId}?`
        : `Roll back the active template to ${versionId}?`;
      if (typeof window !== "undefined" && !window.confirm(confirmationMessage)) {
        return;
      }

      setRollbackFeedback(null);
      setSaveFeedback(null);
      setExportFeedback(null);
      setImportFeedback(null);
      setValidationFeedback(null);
      setPreviewFeedback(null);
      setValidationErrors([]);
      setValidationWarnings([]);
      setValidationContextSource(null);
      setPreviewOutput(null);
      setPreviewContextSource(null);
      setProfilePreviewResult(null);
      setProfilePreviewContextSource(null);
      setIsRollingBack(true);
      const requestId = rollbackRequestIdRef.current + 1;
      rollbackRequestIdRef.current = requestId;
      try {
        await timeBuildOperation("template.rollback", async () => {
          await rollbackEditorTemplate({
            version_id: versionId,
            source: "editor-ui-rollback",
            profile_id: activeTemplateProfileId
          });
          await loadTemplate({ throwOnError: true, profileId: activeTemplateProfileId });
        });
        if (rollbackRequestIdRef.current !== requestId) {
          return;
        }
        setRollbackFeedback({
          severity: "success",
          message: "Template rolled back."
        });
      } catch (error) {
        if (rollbackRequestIdRef.current !== requestId) {
          return;
        }
        if (isFeedbackSuppressedError(error)) {
          return;
        }
        setRollbackFeedback({
          severity: "error",
          message: apiErrorMessage(error, "Unable to roll back template.")
        });
      } finally {
        setIsRollingBack(false);
      }
    },
    [
      activeVersionId,
      hasUnsavedChanges,
      isLoading,
      isImporting,
      isPreviewing,
      isRollingBack,
      isSaving,
      isValidating,
      loadError,
      loadTemplate,
      activeTemplateProfileId
    ]
  );

  const switchWorkingProfile = useCallback(
    async (nextProfileId: string) => {
      const normalizedNextProfileId = normalizeProfileId(nextProfileId);
      const normalizedCurrentProfileId = normalizeProfileId(selectedProfileId) || "default";
      if (
        normalizedNextProfileId.length === 0 ||
        normalizedNextProfileId === normalizedCurrentProfileId ||
        loadError ||
        isLoading ||
        isSaving ||
        isValidating ||
        isPreviewing ||
        isRollingBack ||
        isImporting
      ) {
        return;
      }

      draftTemplateByProfileRef.current[normalizedCurrentProfileId] = templateText;
      committedTemplateByProfileRef.current[normalizedCurrentProfileId] = committedTemplateText;

      setProfileFeedback(null);
      setExportFeedback(null);
      setImportFeedback(null);
      setSaveFeedback(null);
      setValidationFeedback(null);
      setPreviewFeedback(null);
      setRollbackFeedback(null);
      setValidationErrors([]);
      setValidationWarnings([]);
      setValidationContextSource(null);
      setPreviewOutput(null);
      setPreviewContextSource(null);

      try {
        await timeBuildOperation("template.profile.switch", async () => {
          const workingProfileResponse = await setEditorWorkingProfile({
            profile_id: normalizedNextProfileId
          });
          const resolvedWorkingProfileId =
            normalizeProfileId(workingProfileResponse.working_profile_id) || normalizedNextProfileId;
          await loadTemplate({
            throwOnError: true,
            profileId: resolvedWorkingProfileId,
            preserveCurrentOnError: true
          });
          setWorkingProfileId(resolvedWorkingProfileId);
        });
      } catch (error) {
        setProfileFeedback({
          severity: "error",
          message: apiErrorMessage(error, "Unable to switch working profile.")
        });
      }
    },
    [
      committedTemplateText,
      isLoading,
      isImporting,
      isPreviewing,
      isRollingBack,
      isSaving,
      isValidating,
      loadError,
      loadTemplate,
      selectedProfileId,
      templateText
    ]
  );

  const createProfile = useCallback(async () => {
    if (
      loadError ||
      isLoading ||
      isSaving ||
      isValidating ||
      isPreviewing ||
      isRollingBack ||
      isImporting ||
      isSavingProfile
    ) {
      return;
    }

    const profileId = normalizeProfileId(newProfileId);
    if (profileId.length === 0) {
      setProfileFeedback({
        severity: "error",
        message: "Profile ID is required."
      });
      return;
    }
    if (editorProfiles.some((profile) => normalizeProfileId(profile.profile_id) === profileId)) {
      setProfileFeedback({
        severity: "error",
        message: `profile_id already exists: ${profileId}`
      });
      return;
    }

    const label = newProfileLabel.trim();
    if (label.length === 0) {
      setProfileFeedback({
        severity: "error",
        message: "Profile label is required."
      });
      return;
    }

    let criteria: Record<string, unknown>;
    try {
      criteria = parseProfileCriteriaJson(newProfileCriteriaJson);
    } catch (error) {
      setProfileFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "Classification rules must be a valid JSON object."
      });
      return;
    }

    setProfileFeedback(null);
    setExportFeedback(null);
    setImportFeedback(null);
    setIsSavingProfile(true);
    try {
      await createEditorProfile({
        profile_id: profileId,
        label,
        criteria
      });
      setNewProfileId("");
      setNewProfileLabel("");
      setNewProfileCriteriaJson("{}");
      try {
        await loadTemplate({
          throwOnError: true,
          profileId: normalizeProfileId(selectedProfileId) || "default",
          preserveCurrentOnError: true
        });
        setProfileFeedback({
          severity: "success",
          message: "Profile created."
        });
      } catch {
        setProfileFeedback({
          severity: "success",
          message: "Profile created, but profile list refresh failed. Use Reload Template to sync."
        });
      }
    } catch (error) {
      setProfileFeedback({
        severity: "error",
        message: apiErrorMessage(error, "Unable to create profile.")
      });
    } finally {
      setIsSavingProfile(false);
    }
  }, [
    editorProfiles,
    isImporting,
    isLoading,
    isPreviewing,
    isRollingBack,
    isSaving,
    isSavingProfile,
    isValidating,
    loadError,
    loadTemplate,
    newProfileCriteriaJson,
    newProfileId,
    newProfileLabel,
    selectedProfileId
  ]);

  const updateSelectedProfile = useCallback(async () => {
    const currentProfileId = normalizeProfileId(selectedProfileId);
    if (
      currentProfileId.length === 0 ||
      loadError ||
      isLoading ||
      isSaving ||
      isValidating ||
      isPreviewing ||
      isRollingBack ||
      isImporting ||
      isSavingProfile
    ) {
      return;
    }
    if (selectedProfileLocked) {
      setProfileFeedback({
        severity: "error",
        message: "Default profile cannot be edited."
      });
      return;
    }

    const label = editProfileLabel.trim();
    if (label.length === 0) {
      setProfileFeedback({
        severity: "error",
        message: "Profile label is required."
      });
      return;
    }

    let criteria: Record<string, unknown>;
    try {
      criteria = parseProfileCriteriaJson(editProfileCriteriaJson);
    } catch (error) {
      setProfileFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "Classification rules must be a valid JSON object."
      });
      return;
    }
    const priorityText = editProfilePriority.trim();
    if (!/^-?\d+$/.test(priorityText)) {
      setProfileFeedback({
        severity: "error",
        message: "Profile priority must be an integer."
      });
      return;
    }
    const priority = Number.parseInt(priorityText, 10);

    setProfileFeedback(null);
    setExportFeedback(null);
    setImportFeedback(null);
    setIsSavingProfile(true);
    try {
      await updateEditorProfile(currentProfileId, {
        label,
        criteria,
        enabled: editProfileEnabled,
        priority
      });
      try {
        await loadTemplate({
          throwOnError: true,
          profileId: currentProfileId,
          preserveCurrentOnError: true
        });
        setProfileFeedback({
          severity: "success",
          message: "Profile updated."
        });
      } catch {
        setProfileFeedback({
          severity: "success",
          message: "Profile updated, but profile list refresh failed. Use Reload Template to sync."
        });
      }
    } catch (error) {
      setProfileFeedback({
        severity: "error",
        message: apiErrorMessage(error, "Unable to update profile.")
      });
    } finally {
      setIsSavingProfile(false);
    }
  }, [
    editProfileCriteriaJson,
    editProfileEnabled,
    editProfileLabel,
    editProfilePriority,
    isImporting,
    isLoading,
    isPreviewing,
    isRollingBack,
    isSaving,
    isSavingProfile,
    isValidating,
    loadError,
    loadTemplate,
    selectedProfileId,
    selectedProfileLocked
  ]);

  const previewMatchingProfile = useCallback(async () => {
    if (
      loadError ||
      isLoading ||
      isSaving ||
      isValidating ||
      isPreviewing ||
      isRollingBack ||
      isImporting ||
      isSavingProfile ||
      isPreviewingProfile
    ) {
      return;
    }
    if (previewContextMode === "sample" && selectedFixtureName.trim().length === 0) {
      setProfileFeedback({
        severity: "error",
        message: "Choose a sample fixture before previewing profile match."
      });
      return;
    }

    setProfileFeedback(null);
    setProfilePreviewResult(null);
    setProfilePreviewContextSource(null);
    setIsPreviewingProfile(true);
    try {
      const payload: { context_mode: PreviewContextMode; fixture_name?: string } = {
        context_mode: previewContextMode
      };
      if (previewContextMode === "sample") {
        payload.fixture_name = selectedFixtureName;
      }
      const response = await timeBuildOperation("template.profile.preview", () => previewEditorProfile(payload));
      setProfilePreviewResult(response.profile_match ?? null);
      setProfilePreviewContextSource(response.context_source ?? null);
      setProfileFeedback({
        severity: "success",
        message: "Profile preview generated."
      });
    } catch (error) {
      setProfileFeedback({
        severity: "error",
        message: apiErrorMessage(error, "Unable to preview matching profile.")
      });
    } finally {
      setIsPreviewingProfile(false);
    }
  }, [
    isImporting,
    isLoading,
    isPreviewing,
    isPreviewingProfile,
    isRollingBack,
    isSaving,
    isSavingProfile,
    isValidating,
    loadError,
    previewContextMode,
    selectedFixtureName
  ]);

  const exportProfilesBundle = useCallback(async () => {
    if (
      loadError ||
      isLoading ||
      isSaving ||
      isValidating ||
      isPreviewing ||
      isRollingBack ||
      isImporting ||
      isSavingProfile ||
      isPreviewingProfile ||
      isExporting ||
      isImportingProfiles ||
      isExportingProfiles
    ) {
      return;
    }

    const profileIds = selectedProfileExportIds
      .map((profileId) => normalizeProfileId(profileId))
      .filter((profileId, index, allValues) => profileId.length > 0 && allValues.indexOf(profileId) === index);
    if (profileIds.length === 0) {
      setProfileFeedback({
        severity: "error",
        message: "Select at least one profile to export."
      });
      return;
    }

    setProfileFeedback(null);
    setIsExportingProfiles(true);
    try {
      const bundleResponse = await timeBuildOperation("template.profile.export", () =>
        getEditorProfilesExport({
          profile_ids: profileIds
        })
      );
      const { status: _ignoredStatus, ...bundle } = bundleResponse;
      const yamlText = YAML.stringify(bundle);
      const timestampSafe = new Date().toISOString().replace(/[:.]/g, "-");
      downloadTextBundle(
        yamlText,
        `chronicle-profiles-${timestampSafe}.yaml`,
        "application/yaml"
      );
      setProfileFeedback({
        severity: "success",
        message: `Exported ${profileIds.length} profile bundle item${profileIds.length === 1 ? "" : "s"}.`
      });
    } catch (error) {
      setProfileFeedback({
        severity: "error",
        message: apiErrorMessage(error, "Unable to export profiles.")
      });
    } finally {
      setIsExportingProfiles(false);
    }
  }, [
    isExporting,
    isExportingProfiles,
    isImporting,
    isImportingProfiles,
    isLoading,
    isPreviewing,
    isPreviewingProfile,
    isRollingBack,
    isSaving,
    isSavingProfile,
    isValidating,
    loadError,
    selectedProfileExportIds
  ]);

  const importProfilesBundle = useCallback(async () => {
    if (
      loadError ||
      isLoading ||
      isSaving ||
      isValidating ||
      isPreviewing ||
      isRollingBack ||
      isImporting ||
      isSavingProfile ||
      isPreviewingProfile ||
      isExporting ||
      isExportingProfiles ||
      isImportingProfiles
    ) {
      return;
    }
    if (!selectedProfileImportFile) {
      setProfileFeedback({
        severity: "error",
        message: "Choose a YAML profile bundle file before importing."
      });
      return;
    }

    setProfileFeedback(null);
    setIsImportingProfiles(true);
    const requestId = profileImportRequestIdRef.current + 1;
    profileImportRequestIdRef.current = requestId;
    try {
      const parsedBundle = await timeBuildOperation("template.profile.import.parse", async () => {
        const rawText = await readFileText(selectedProfileImportFile);
        const parsed = YAML.parse(rawText) as unknown;
        return parseProfileImportBundle(parsed);
      });
      const response = await timeBuildOperation("template.profile.import", () =>
        importEditorProfiles({
          bundle: parsedBundle
        })
      );
      if (profileImportRequestIdRef.current !== requestId) {
        return;
      }

      let successMessage = `Imported ${response.imported_count ?? 0} profile${response.imported_count === 1 ? "" : "s"}.`;
      const importErrors = Array.isArray(response.errors) ? response.errors.filter((item) => typeof item === "string") : [];
      if (importErrors.length > 0) {
        successMessage += ` ${importErrors.length} warning${importErrors.length === 1 ? "" : "s"} reported.`;
      }

      try {
        await loadTemplate({
          throwOnError: true,
          profileId: normalizeProfileId(response.working_profile_id) || activeTemplateProfileId,
          preserveCurrentOnError: true
        });
      } catch {
        successMessage += " Profile refresh failed; use Reload Template to sync.";
      }

      setProfileFeedback({
        severity: "success",
        message: successMessage
      });
      setSelectedProfileImportFile(null);
      if (profileImportFileInputRef.current) {
        profileImportFileInputRef.current.value = "";
      }
    } catch (error) {
      if (profileImportRequestIdRef.current !== requestId) {
        return;
      }
      const message = error instanceof Error &&
          (error.message.startsWith("Profile import bundle must") || error.message.startsWith("Unable to read import file"))
        ? error.message
        : apiErrorMessage(error, "Unable to import profile bundle.");
      setProfileFeedback({
        severity: "error",
        message
      });
    } finally {
      setIsImportingProfiles(false);
    }
  }, [
    activeTemplateProfileId,
    isExporting,
    isExportingProfiles,
    isImporting,
    isImportingProfiles,
    isLoading,
    isPreviewing,
    isPreviewingProfile,
    isRollingBack,
    isSaving,
    isSavingProfile,
    isValidating,
    loadError,
    loadTemplate,
    selectedProfileImportFile
  ]);

  const exportTemplates = useCallback(async () => {
    if (
      loadError ||
      isLoading ||
      isSaving ||
      isValidating ||
      isPreviewing ||
      isRollingBack ||
      isExporting ||
      isImporting
    ) {
      return;
    }

    const currentProfileId = activeTemplateProfileId;
    const selectedTemplateIds = selectedRepositoryTemplateIds
      .map((templateId) => normalizeTemplateId(templateId))
      .filter((templateId, index, allValues) => templateId.length > 0 && allValues.indexOf(templateId) === index);

    if (exportSource === "repository" && selectedTemplateIds.length === 0) {
      setExportFeedback({
        severity: "error",
        message: "Select at least one repository template to export."
      });
      return;
    }

    setSaveFeedback(null);
    setValidationFeedback(null);
    setPreviewFeedback(null);
    setRollbackFeedback(null);
    setProfileFeedback(null);
    setExportFeedback(null);
    setImportFeedback(null);
    setIsExporting(true);
    try {
      const bundles = await timeBuildOperation("template.export", async () => {
        if (exportSource === "repository") {
          return Promise.all(selectedTemplateIds.map((templateId) => getEditorRepositoryTemplateExport(templateId)));
        }
        return [
          await getEditorTemplateExport({
            profile_id: currentProfileId
          })
        ];
      });

      const timestampSafe = new Date().toISOString().replace(/[:.]/g, "-");
      if (exportSource === "repository") {
        bundles.forEach((bundle, index) => {
          const templateToken =
            toFilenameToken(bundle.template_id) || toFilenameToken(bundle.name) || `template-${index + 1}`;
          downloadJsonBundle(bundle, `chronicle-template-${templateToken}-${timestampSafe}.json`);
        });
      } else {
        downloadJsonBundle(bundles[0], `chronicle-template-${currentProfileId}-${timestampSafe}.json`);
      }
      setExportFeedback({
        severity: "success",
        message: `Exported ${bundles.length} template bundle${bundles.length === 1 ? "" : "s"}.`
      });
    } catch (error) {
      setExportFeedback({
        severity: "error",
        message: apiErrorMessage(error, "Unable to export templates.")
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    exportSource,
    isExporting,
    isImporting,
    isLoading,
    isPreviewing,
    isRollingBack,
    isSaving,
    isValidating,
    loadError,
    activeTemplateProfileId,
    selectedRepositoryTemplateIds
  ]);

  const importTemplateBundle = useCallback(async () => {
    if (
      loadError ||
      isLoading ||
      isSaving ||
      isValidating ||
      isPreviewing ||
      isRollingBack ||
      isExporting ||
      isImporting
    ) {
      return;
    }
    if (!selectedImportFile) {
      setImportFeedback({
        severity: "error",
        message: "Choose a JSON bundle file before importing."
      });
      return;
    }

    const currentProfileId = activeTemplateProfileId;
    if (importTarget === "active" && hasUnsavedChanges) {
      const confirmMessage =
        "You have unsaved edits that will be replaced by the imported template. Continue importing?";
      if (typeof window !== "undefined" && !window.confirm(confirmMessage)) {
        return;
      }
    }

    setSaveFeedback(null);
    setValidationFeedback(null);
    setPreviewFeedback(null);
    setRollbackFeedback(null);
    setProfileFeedback(null);
    setExportFeedback(null);
    setImportFeedback(null);
    setIsImporting(true);
    const requestId = importRequestIdRef.current + 1;
    importRequestIdRef.current = requestId;
    try {
      const parsedBundle = await timeBuildOperation("template.import.parse", async () => {
        const jsonText = await readFileText(selectedImportFile);
        const parsed = JSON.parse(jsonText) as unknown;
        return parseImportBundle(parsed);
      });

      let importSuccessMessage = "";
      await timeBuildOperation("template.import", async () => {
        const contextMode: PreviewContextMode = previewFixtures.length > 0 ? "sample" : "latest";
        const fixtureName = contextMode === "sample" ? (selectedFixtureName || previewFixtures[0]?.name) : undefined;

        if (importTarget === "repository") {
          await importEditorRepositoryTemplate({
            bundle: parsedBundle,
            context_mode: contextMode,
            fixture_name: fixtureName,
            source: "editor-ui-repository-import"
          });
          importSuccessMessage = "Template bundle imported into repository catalog.";
          try {
            const repositoryResponse = await getEditorRepositoryTemplates();
            const templates = Array.isArray(repositoryResponse.templates)
              ? repositoryResponse.templates.filter(
                  (template): template is EditorRepositoryTemplateSummary =>
                    typeof template?.template_id === "string" &&
                    template.template_id.trim().length > 0 &&
                    typeof template?.name === "string" &&
                    template.name.trim().length > 0
                )
              : [];
            setRepositoryTemplates(templates);
            setRepositoryLoadWarning(null);
            setSelectedRepositoryTemplateIds((currentIds) =>
              currentIds.filter((templateId) =>
                templates.some(
                  (template) => normalizeTemplateId(template.template_id) === normalizeTemplateId(templateId)
                )
              )
            );
          } catch {
            setRepositoryLoadWarning("Template imported, but repository list refresh failed. Use Reload Template to sync catalog.");
            importSuccessMessage = "Template bundle imported into repository catalog. Repository refresh failed.";
          }
          return;
        }

        const explicitProfileId = normalizeProfileId(parsedBundle.profile_id);
        const targetProfileId = explicitProfileId || currentProfileId;
        const importedResponse = await importEditorTemplate({
          bundle: parsedBundle,
          context_mode: contextMode,
          fixture_name: fixtureName,
          profile_id: targetProfileId,
          source: "editor-ui-import"
        });
        importSuccessMessage = "Template bundle imported into active profile.";
        const importedTemplate = typeof importedResponse.active?.template === "string"
          ? importedResponse.active.template
          : parsedBundle.template;
        delete draftTemplateByProfileRef.current[targetProfileId];
        delete committedTemplateByProfileRef.current[targetProfileId];
        try {
          await loadTemplate({
            throwOnError: true,
            profileId: targetProfileId,
            preserveCurrentOnError: true
          });
        } catch {
          setSelectedProfileId(targetProfileId);
          setTemplateText(importedTemplate);
          setCommittedTemplateText(importedTemplate);
          draftTemplateByProfileRef.current[targetProfileId] = importedTemplate;
          committedTemplateByProfileRef.current[targetProfileId] = importedTemplate;
          setTemplateMetadata((current) => ({
            ...(current ?? { status: "ok", template: importedTemplate }),
            status: importedResponse.status || "ok",
            template: importedTemplate,
            profile_id: targetProfileId,
            current_version: importedResponse.saved_version?.version_id
              ? { version_id: importedResponse.saved_version.version_id }
              : current?.current_version
          }));
          setVersionsLoadWarning(
            "Template imported, but editor metadata refresh failed. Use Reload Template to sync versions."
          );
          importSuccessMessage = "Template bundle imported into active profile. Metadata refresh failed.";
        }
      });

      if (importRequestIdRef.current !== requestId) {
        return;
      }
      setImportFeedback({
        severity: "success",
        message: importSuccessMessage
      });
      setSelectedImportFile(null);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
    } catch (error) {
      if (importRequestIdRef.current !== requestId) {
        return;
      }
      const message = error instanceof SyntaxError
        ? "Import bundle JSON is malformed. Verify the file contains valid JSON."
        : error instanceof Error &&
            (error.message.startsWith("Import bundle must") || error.message.startsWith("Unable to read import file"))
          ? error.message
          : importErrorMessage(error);
      setImportFeedback({
        severity: "error",
        message
      });
    } finally {
      setIsImporting(false);
    }
  }, [
    hasUnsavedChanges,
    importTarget,
    isExporting,
    isImporting,
    isLoading,
    isPreviewing,
    isRollingBack,
    isSaving,
    isValidating,
    loadError,
    loadTemplate,
    previewFixtures,
    selectedFixtureName,
    selectedImportFile,
    activeTemplateProfileId
  ]);

  const selectedRepositoryTemplateSummary = useMemo(() => {
    if (selectedRepositoryTemplateIds.length === 0) {
      return "";
    }
    const idLookup = new Set(selectedRepositoryTemplateIds.map((templateId) => normalizeTemplateId(templateId)));
    const selectedNames = repositoryTemplates
      .filter((template) => idLookup.has(normalizeTemplateId(template.template_id)))
      .map((template) => template.name);
    return selectedNames.join(", ");
  }, [repositoryTemplates, selectedRepositoryTemplateIds]);

  const selectedProfileExportSummary = useMemo(() => {
    if (selectedProfileExportIds.length === 0) {
      return "";
    }
    const idLookup = new Set(selectedProfileExportIds.map((profileId) => normalizeProfileId(profileId)));
    const selectedLabels = editorProfiles
      .filter((profile) => idLookup.has(normalizeProfileId(profile.profile_id)))
      .map((profile) => profile.label);
    return selectedLabels.join(", ");
  }, [editorProfiles, selectedProfileExportIds]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography component="h1" variant="h4">
        Build
      </Typography>

      {loadError ? (
        <Alert severity="error" role="alert">
          {loadError}
        </Alert>
      ) : null}

      {saveFeedback ? (
        <Alert severity={saveFeedback.severity} role={saveFeedback.severity === "error" ? "alert" : "status"}>
          {saveFeedback.message}
        </Alert>
      ) : null}
      {validationFeedback ? (
        <Alert
          severity={validationFeedback.severity}
          role={validationFeedback.severity === "error" ? "alert" : "status"}
        >
          {validationFeedback.message}
        </Alert>
      ) : null}
      {previewFeedback ? (
        <Alert severity={previewFeedback.severity} role={previewFeedback.severity === "error" ? "alert" : "status"}>
          {previewFeedback.message}
        </Alert>
      ) : null}
      {rollbackFeedback ? (
        <Alert severity={rollbackFeedback.severity} role={rollbackFeedback.severity === "error" ? "alert" : "status"}>
          {rollbackFeedback.message}
        </Alert>
      ) : null}
      {profileFeedback ? (
        <Alert severity={profileFeedback.severity} role={profileFeedback.severity === "error" ? "alert" : "status"}>
          {profileFeedback.message}
        </Alert>
      ) : null}
      {exportFeedback ? (
        <Alert severity={exportFeedback.severity} role={exportFeedback.severity === "error" ? "alert" : "status"}>
          {exportFeedback.message}
        </Alert>
      ) : null}
      {importFeedback ? (
        <Alert severity={importFeedback.severity} role={importFeedback.severity === "error" ? "alert" : "status"}>
          {importFeedback.message}
        </Alert>
      ) : null}
      {fixturesLoadWarning ? (
        <Alert severity="warning" role="status">
          {fixturesLoadWarning}
        </Alert>
      ) : null}
      {versionsLoadWarning ? (
        <Alert severity="warning" role="status">
          {versionsLoadWarning}
        </Alert>
      ) : null}
      {repositoryLoadWarning ? (
        <Alert severity="warning" role="status">
          {repositoryLoadWarning}
        </Alert>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: "grid", gap: 1.5 }}>
            {isLoading ? <Typography>Loading template...</Typography> : null}
            {!isLoading && loadError ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  Resolve the template load error before editing.
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button type="button" variant="outlined" onClick={() => void loadTemplate()}>
                    Retry loading template
                  </Button>
                </Box>
              </>
            ) : null}
            {!isLoading && !loadError ? (
              <>
                <TextField
                  select
                  label="Working Profile"
                  value={selectedProfileId}
                  disabled={isLoading || isSaving || isValidating || isPreviewing || isRollingBack || isImporting}
                  onChange={(event) => {
                    void switchWorkingProfile(event.target.value);
                  }}
                >
                  {editorProfiles.length > 0 ? (
                    editorProfiles.map((profile) => (
                      <MenuItem
                        key={profile.profile_id}
                        value={profile.profile_id}
                        disabled={profile.enabled === false}
                      >
                        {profile.label}
                        {normalizeProfileId(profile.profile_id) === normalizeProfileId(workingProfileId)
                          ? " (Working)"
                          : ""}
                        {profile.enabled === false ? " (Disabled)" : ""}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value={selectedProfileId} disabled>
                      No profiles available
                    </MenuItem>
                  )}
                </TextField>
                <Typography variant="body2" color="text.secondary">
                  {selectedProfileLabel
                    ? `Editing ${selectedProfileLabel} template`
                    : "Edit your active Jinja template and save changes."}
                </Typography>
                <Typography component="h2" variant="h6">
                  Profiles
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create profiles and edit classification rules before selecting the working profile template.
                </Typography>
                <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
                  <TextField
                    label="New Profile ID"
                    value={newProfileId}
                    disabled={
                      isLoading ||
                      isSaving ||
                      isValidating ||
                      isPreviewing ||
                      isRollingBack ||
                      isImporting ||
                      isSavingProfile
                    }
                    onChange={(event) => {
                      setNewProfileId(event.target.value);
                      setProfileFeedback(null);
                    }}
                  />
                  <TextField
                    label="New Profile Label"
                    value={newProfileLabel}
                    disabled={
                      isLoading ||
                      isSaving ||
                      isValidating ||
                      isPreviewing ||
                      isRollingBack ||
                      isImporting ||
                      isSavingProfile
                    }
                    onChange={(event) => {
                      setNewProfileLabel(event.target.value);
                      setProfileFeedback(null);
                    }}
                  />
                </Box>
                <TextField
                  label="New Classification Rules (JSON)"
                  multiline
                  minRows={4}
                  value={newProfileCriteriaJson}
                  disabled={
                    isLoading ||
                    isSaving ||
                    isValidating ||
                    isPreviewing ||
                    isRollingBack ||
                    isImporting ||
                    isSavingProfile
                  }
                  onChange={(event) => {
                    setNewProfileCriteriaJson(event.target.value);
                    setProfileFeedback(null);
                  }}
                />
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={
                      isLoading ||
                      isSaving ||
                      isValidating ||
                      isPreviewing ||
                      isRollingBack ||
                      isImporting ||
                      isSavingProfile
                    }
                    onClick={() => void createProfile()}
                  >
                    Create Profile
                  </Button>
                </Box>
                <TextField
                  label="Edit Profile Label"
                  value={editProfileLabel}
                  disabled={
                    selectedProfileLocked ||
                    isLoading ||
                    isSaving ||
                    isValidating ||
                    isPreviewing ||
                    isRollingBack ||
                    isImporting ||
                    isSavingProfile
                  }
                  onChange={(event) => {
                    setEditProfileLabel(event.target.value);
                    setProfileFeedback(null);
                  }}
                />
                <TextField
                  label="Edit Classification Rules (JSON)"
                  multiline
                  minRows={4}
                  value={editProfileCriteriaJson}
                  disabled={
                    selectedProfileLocked ||
                    isLoading ||
                    isSaving ||
                    isValidating ||
                    isPreviewing ||
                    isRollingBack ||
                    isImporting ||
                    isSavingProfile
                  }
                  onChange={(event) => {
                    setEditProfileCriteriaJson(event.target.value);
                    setProfileFeedback(null);
                  }}
                />
                <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
                  <TextField
                    select
                    label="Edit Profile Enabled"
                    value={editProfileEnabled ? "enabled" : "disabled"}
                    disabled={
                      selectedProfileLocked ||
                      isLoading ||
                      isSaving ||
                      isValidating ||
                      isPreviewing ||
                      isRollingBack ||
                      isImporting ||
                      isSavingProfile
                    }
                    onChange={(event) => {
                      setEditProfileEnabled(event.target.value === "enabled");
                      setProfileFeedback(null);
                    }}
                  >
                    <MenuItem value="enabled">Enabled</MenuItem>
                    <MenuItem value="disabled">Disabled</MenuItem>
                  </TextField>
                  <TextField
                    label="Edit Profile Priority"
                    type="number"
                    value={editProfilePriority}
                    disabled={
                      selectedProfileLocked ||
                      isLoading ||
                      isSaving ||
                      isValidating ||
                      isPreviewing ||
                      isRollingBack ||
                      isImporting ||
                      isSavingProfile
                    }
                    onChange={(event) => {
                      setEditProfilePriority(event.target.value);
                      setProfileFeedback(null);
                    }}
                  />
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={
                      selectedProfileLocked ||
                      isLoading ||
                      isSaving ||
                      isValidating ||
                      isPreviewing ||
                      isRollingBack ||
                      isImporting ||
                      isSavingProfile
                    }
                    onClick={() => void updateSelectedProfile()}
                  >
                    Update Profile
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={
                      isLoading ||
                      isSaving ||
                      isValidating ||
                      isPreviewing ||
                      isRollingBack ||
                      isImporting ||
                      isSavingProfile ||
                      isPreviewingProfile ||
                      (previewContextMode === "sample" && selectedFixtureName.trim().length === 0)
                    }
                    onClick={() => void previewMatchingProfile()}
                  >
                    Preview Matching Profile
                  </Button>
                </Box>
                {selectedProfileLocked ? (
                  <Typography variant="caption" color="text.secondary">
                    Default profile classification rules are locked.
                  </Typography>
                ) : null}
                {profilePreviewResult ? (
                  <Box
                    sx={{
                      display: "grid",
                      gap: 0.75,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      padding: 1.5
                    }}
                  >
                    <Typography variant="subtitle2">Profile Match Preview</Typography>
                    <Typography variant="body2">
                      Matched Profile: {profilePreviewResult.profile_label ?? profilePreviewResult.profile_id}
                    </Typography>
                    {profilePreviewResult.reasons && profilePreviewResult.reasons.length > 0 ? (
                      <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
                        {profilePreviewResult.reasons.map((reason) => (
                          <li key={reason}>
                            <Typography variant="body2">{reason}</Typography>
                          </li>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No explicit match reasons were returned.
                      </Typography>
                    )}
                    <Box
                      component="pre"
                      sx={{
                        margin: 0,
                        padding: 1,
                        borderRadius: 1,
                        overflowX: "auto",
                        fontSize: 12,
                        backgroundColor: "action.hover"
                      }}
                    >
                      {JSON.stringify(profilePreviewResult.criteria ?? {}, null, 2)}
                    </Box>
                    {profilePreviewContextSource ? (
                      <Typography variant="caption" color="text.secondary">
                        Profile preview context: {profilePreviewContextSource}
                      </Typography>
                    ) : null}
                  </Box>
                ) : null}
                <Box
                  sx={{
                    display: "grid",
                    gap: 1,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    padding: 1.5
                  }}
                >
                  <Typography variant="subtitle2">Profile YAML Sharing</Typography>
                  <TextField
                    select
                    SelectProps={{
                      multiple: true,
                      renderValue: () =>
                        selectedProfileExportSummary.length > 0
                          ? selectedProfileExportSummary
                          : "Select profiles"
                    }}
                    label="Profiles to Export"
                    value={selectedProfileExportIds}
                    disabled={
                      editorProfiles.length === 0 ||
                      isLoading ||
                      isSaving ||
                      isValidating ||
                      isPreviewing ||
                      isRollingBack ||
                      isImporting ||
                      isSavingProfile ||
                      isPreviewingProfile ||
                      isExporting ||
                      isExportingProfiles ||
                      isImportingProfiles
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      const selectedValues = Array.isArray(value) ? value : [value];
                      const normalizedValues = selectedValues
                        .map((profileId) => normalizeProfileId(profileId))
                        .filter(
                          (profileId, index, allValues) =>
                            profileId.length > 0 && allValues.indexOf(profileId) === index
                        );
                      setSelectedProfileExportIds(normalizedValues);
                      setProfileFeedback(null);
                    }}
                  >
                    {editorProfiles.length > 0 ? (
                      editorProfiles.map((profile) => (
                        <MenuItem key={profile.profile_id} value={profile.profile_id}>
                          {profile.label}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem value="" disabled>
                        No profiles available
                      </MenuItem>
                    )}
                  </TextField>
                  <Box sx={{ display: "grid", gap: 0.5 }}>
                    <Button
                      component="label"
                      variant="outlined"
                      disabled={
                        isLoading ||
                        isSaving ||
                        isValidating ||
                        isPreviewing ||
                        isRollingBack ||
                        isImporting ||
                        isSavingProfile ||
                        isPreviewingProfile ||
                        isExporting ||
                        isExportingProfiles ||
                        isImportingProfiles
                      }
                    >
                      Choose Profile Bundle File
                      <input
                        ref={profileImportFileInputRef}
                        hidden
                        aria-label="Import Profile Bundle File"
                        type="file"
                        accept=".yaml,.yml,application/yaml,text/yaml,text/plain"
                        onClick={(event) => {
                          event.currentTarget.value = "";
                        }}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0] ?? null;
                          setSelectedProfileImportFile(file);
                          setProfileFeedback(null);
                        }}
                      />
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      {selectedProfileImportFile ? selectedProfileImportFile.name : "No profile bundle file selected."}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      type="button"
                      variant="outlined"
                      disabled={
                        isLoading ||
                        isSaving ||
                        isValidating ||
                        isPreviewing ||
                        isRollingBack ||
                        isImporting ||
                        isSavingProfile ||
                        isPreviewingProfile ||
                        isExporting ||
                        isExportingProfiles ||
                        isImportingProfiles ||
                        selectedProfileExportIds.length === 0
                      }
                      onClick={() => void exportProfilesBundle()}
                    >
                      Export Profiles YAML
                    </Button>
                    <Button
                      type="button"
                      variant="outlined"
                      disabled={
                        isLoading ||
                        isSaving ||
                        isValidating ||
                        isPreviewing ||
                        isRollingBack ||
                        isImporting ||
                        isSavingProfile ||
                        isPreviewingProfile ||
                        isExporting ||
                        isExportingProfiles ||
                        isImportingProfiles ||
                        !selectedProfileImportFile
                      }
                      onClick={() => void importProfilesBundle()}
                    >
                      Import Profiles YAML
                    </Button>
                  </Box>
                </Box>
                <TextField
                  label="Template (Jinja)"
                  multiline
                  minRows={12}
                  maxRows={24}
                  disabled={isRollingBack || isImporting}
                  value={templateText}
                  onChange={(event) => {
                    setTemplateText(event.target.value);
                    draftTemplateByProfileRef.current[normalizeProfileId(selectedProfileId) || "default"] =
                      event.target.value;
                    setSaveFeedback(null);
                    setValidationFeedback(null);
                    setPreviewFeedback(null);
                    setRollbackFeedback(null);
                    setProfileFeedback(null);
                    setExportFeedback(null);
                    setImportFeedback(null);
                    setValidationErrors([]);
                    setValidationWarnings([]);
                    setValidationContextSource(null);
                    setPreviewOutput(null);
                    setPreviewContextSource(null);
                    setProfilePreviewResult(null);
                    setProfilePreviewContextSource(null);
                    previewRequestIdRef.current += 1;
                  }}
                  helperText="Use Jinja syntax and validate before saving."
                  FormHelperTextProps={{ id: TEMPLATE_HELPER_ID }}
                  inputProps={{ "aria-describedby": describedByIds }}
                />
                <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
                  <TextField
                    select
                    label="Preview Context"
                    value={previewContextMode}
                    disabled={isRollingBack || isImporting}
                    onChange={(event) => {
                      setPreviewContextMode(event.target.value as PreviewContextMode);
                      setPreviewFeedback(null);
                      setPreviewOutput(null);
                      setPreviewContextSource(null);
                      setProfilePreviewResult(null);
                      setProfilePreviewContextSource(null);
                      previewRequestIdRef.current += 1;
                    }}
                  >
                    <MenuItem value="sample" disabled={previewFixtures.length === 0}>
                      Sample fixture
                    </MenuItem>
                    <MenuItem value="latest">Latest activity</MenuItem>
                  </TextField>
                  {previewContextMode === "sample" ? (
                    <TextField
                      select
                      label="Sample Fixture"
                      value={selectedFixtureName}
                      disabled={previewFixtures.length === 0 || isRollingBack || isImporting}
                      onChange={(event) => {
                        setSelectedFixtureName(event.target.value);
                        setPreviewFeedback(null);
                        setPreviewOutput(null);
                        setPreviewContextSource(null);
                        setProfilePreviewResult(null);
                        setProfilePreviewContextSource(null);
                        previewRequestIdRef.current += 1;
                      }}
                    >
                      {previewFixtures.length > 0 ? (
                        previewFixtures.map((fixture) => (
                          <MenuItem key={fixture.name} value={fixture.name}>
                            {fixture.label}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem value="" disabled>
                          No fixtures available
                        </MenuItem>
                      )}
                    </TextField>
                  ) : (
                    <Box />
                  )}
                </Box>
                <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
                  <TextField
                    select
                    label="Export Source"
                    value={exportSource}
                    disabled={
                      isLoading || isSaving || isValidating || isPreviewing || isRollingBack || isExporting || isImporting
                    }
                    onChange={(event) => {
                      const nextValue = event.target.value === "repository" ? "repository" : "active";
                      setExportSource(nextValue);
                      setExportFeedback(null);
                    }}
                  >
                    <MenuItem value="active">Active profile template</MenuItem>
                    <MenuItem value="repository">Repository templates</MenuItem>
                  </TextField>
                  {exportSource === "repository" ? (
                    <TextField
                      select
                      SelectProps={{
                        multiple: true,
                        renderValue: () =>
                          selectedRepositoryTemplateSummary.length > 0
                            ? selectedRepositoryTemplateSummary
                            : "Select templates"
                      }}
                      label="Repository Templates"
                      value={selectedRepositoryTemplateIds}
                      disabled={
                        repositoryTemplates.length === 0 ||
                        isLoading ||
                        isSaving ||
                        isValidating ||
                        isPreviewing ||
                        isRollingBack ||
                        isExporting ||
                        isImporting
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        const selectedValues = Array.isArray(value) ? value : [value];
                        const normalizedValues = selectedValues
                          .map((templateId) => normalizeTemplateId(templateId))
                          .filter(
                            (templateId, index, allValues) => templateId.length > 0 && allValues.indexOf(templateId) === index
                          );
                        setSelectedRepositoryTemplateIds(normalizedValues);
                        setExportFeedback(null);
                      }}
                    >
                      {repositoryTemplates.length > 0 ? (
                        repositoryTemplates.map((template) => (
                          <MenuItem key={template.template_id} value={template.template_id}>
                            {template.name}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem value="" disabled>
                          No repository templates available
                        </MenuItem>
                      )}
                    </TextField>
                  ) : (
                    <Box />
                  )}
                </Box>
                <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
                  <TextField
                    select
                    label="Import Target"
                    value={importTarget}
                    disabled={
                      isLoading || isSaving || isValidating || isPreviewing || isRollingBack || isExporting || isImporting
                    }
                    onChange={(event) => {
                      setImportTarget(event.target.value === "repository" ? "repository" : "active");
                      setImportFeedback(null);
                    }}
                  >
                    <MenuItem value="active">Active profile</MenuItem>
                    <MenuItem value="repository">Repository catalog</MenuItem>
                  </TextField>
                  <Box sx={{ display: "grid", gap: 0.5 }}>
                    <Button
                      component="label"
                      variant="outlined"
                      disabled={
                        isLoading || isSaving || isValidating || isPreviewing || isRollingBack || isExporting || isImporting
                      }
                    >
                      Choose Bundle File
                      <input
                        ref={importFileInputRef}
                        hidden
                        aria-label="Import Bundle File"
                        type="file"
                        accept="application/json,.json"
                        onClick={(event) => {
                          event.currentTarget.value = "";
                        }}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0] ?? null;
                          setSelectedImportFile(file);
                          setImportFeedback(null);
                        }}
                      />
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      {selectedImportFile ? selectedImportFile.name : "No file selected."}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    type="button"
                    variant="contained"
                    disabled={isSaving || isValidating || isPreviewing || isRollingBack || isImporting || !hasUnsavedChanges}
                    onClick={() => void saveTemplate()}
                  >
                    Save Template
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={isLoading || isSaving || isValidating || isPreviewing || isRollingBack || isImporting}
                    onClick={() => void validateTemplate()}
                  >
                    Validate Template
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={
                      isLoading ||
                      isSaving ||
                      isValidating ||
                      isPreviewing ||
                      isRollingBack ||
                      isImporting ||
                      (previewContextMode === "sample" && selectedFixtureName.trim().length === 0)
                    }
                    onClick={() => void previewTemplate()}
                  >
                    Preview Template
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={isLoading || isSaving || isValidating || isPreviewing || isRollingBack || isExporting || isImporting}
                    onClick={() => void loadTemplate()}
                  >
                    Reload Template
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={
                      isLoading ||
                      isSaving ||
                      isValidating ||
                      isPreviewing ||
                      isRollingBack ||
                      isExporting ||
                      isImporting ||
                      (exportSource === "repository" && selectedRepositoryTemplateIds.length === 0)
                    }
                    onClick={() => void exportTemplates()}
                  >
                    Export Templates
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={
                      isLoading ||
                      isSaving ||
                      isValidating ||
                      isPreviewing ||
                      isRollingBack ||
                      isExporting ||
                      isImporting ||
                      !selectedImportFile
                    }
                    onClick={() => void importTemplateBundle()}
                  >
                    Import Bundle
                  </Button>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    padding: 1.5
                  }}
                >
                  <Typography variant="subtitle2">Template Version History</Typography>
                  {templateVersions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No saved template versions available yet.
                    </Typography>
                  ) : (
                    templateVersions.map((version) => {
                      const isActiveVersion = version.version_id === activeVersionId;
                      const operationLabel = version.operation ?? "save";
                      const createdLabel = version.created_at_utc ?? "Unknown time";
                      const authorLabel = version.author ? ` • ${version.author}` : "";
                      return (
                        <Box
                          key={version.version_id}
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 1,
                            alignItems: "center",
                            justifyContent: "space-between"
                          }}
                        >
                          <Box sx={{ minWidth: 200 }}>
                            <Typography variant="body2">
                              {isActiveVersion
                                ? `Version: ${version.version_id} (Active)`
                                : `Version: ${version.version_id}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {`Operation: ${operationLabel} • ${createdLabel}${authorLabel}`}
                            </Typography>
                          </Box>
                          <Button
                            type="button"
                            size="small"
                            variant="outlined"
                            disabled={
                              isActiveVersion ||
                              isLoading ||
                              isSaving ||
                              isValidating ||
                              isPreviewing ||
                              isRollingBack ||
                              isImporting
                            }
                            onClick={() => void rollbackTemplateToVersion(version.version_id)}
                          >
                            {isActiveVersion ? "Active Version" : `Roll Back to ${version.version_id}`}
                          </Button>
                        </Box>
                      );
                    })
                  )}
                </Box>
                {validationContextSource ? (
                  <Typography variant="caption" color="text.secondary">
                    Validation context: {validationContextSource}
                  </Typography>
                ) : null}
                {previewContextSource ? (
                  <Typography variant="caption" color="text.secondary">
                    Preview context: {previewContextSource}
                  </Typography>
                ) : null}
                {previewOutput !== null ? (
                  <Box
                    component="pre"
                    sx={{
                      margin: 0,
                      padding: 1.5,
                      borderRadius: 1,
                      overflowX: "auto",
                      fontSize: 13,
                      backgroundColor: "action.hover"
                    }}
                  >
                    {previewOutput}
                  </Box>
                ) : null}
                {validationErrors.length > 0 || validationWarnings.length > 0 ? (
                  <Box sx={{ display: "grid", gap: 1 }}>
                    {validationErrors.length > 0 ? (
                      <Box id={TEMPLATE_ERROR_LIST_ID} component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
                        {validationErrors.map((errorMessage) => (
                          <li key={errorMessage}>
                            <Typography variant="body2">{errorMessage}</Typography>
                          </li>
                        ))}
                      </Box>
                    ) : null}
                    {validationWarnings.length > 0 ? (
                      <Box id={TEMPLATE_WARNING_LIST_ID} component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
                        {validationWarnings.map((warningMessage) => (
                          <li key={warningMessage}>
                            <Typography variant="body2" color="text.secondary">
                              {warningMessage}
                            </Typography>
                          </li>
                        ))}
                      </Box>
                    ) : null}
                    {hintSnippets.length > 0 ? (
                      <Box sx={{ display: "grid", gap: 1 }}>
                        <Typography id={TEMPLATE_HINTS_ID} variant="body2" color="text.secondary">
                          Jinja hints/examples
                        </Typography>
                        {usingFallbackHints ? (
                          <Typography variant="caption" color="text.secondary">
                            Showing built-in hint examples while snippet library is unavailable.
                          </Typography>
                        ) : null}
                        {hintSnippets.slice(0, 3).map((snippet) => (
                          <Box key={snippet.id} sx={{ display: "grid", gap: 0.5 }}>
                            <Typography variant="body2">{snippet.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {snippet.description}
                            </Typography>
                            <Box
                              component="pre"
                              sx={{
                                margin: 0,
                                padding: 1,
                                borderRadius: 1,
                                overflowX: "auto",
                                fontSize: 12,
                                backgroundColor: "action.hover"
                              }}
                            >
                              {snippet.template}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    ) : null}
                  </Box>
                ) : null}
              </>
            ) : null}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
