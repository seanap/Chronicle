import { getJson } from "./http-client";

export type EditorContextMode = "latest" | "sample" | "latest_or_sample" | "fixture";

export interface EditorTemplateResponse {
  status: string;
  template: string;
  profile_id?: string;
  profile_label?: string;
  name?: string;
  source?: string;
  current_version?: {
    version_id?: string;
  };
  metadata?: Record<string, unknown>;
  updated_at_utc?: string;
  updated_by?: string;
}

export interface SaveEditorTemplateRequest {
  template: string;
  name?: string;
  author?: string;
  source?: string;
  context_mode?: EditorContextMode;
  fixture_name?: string;
  profile_id?: string;
  notes?: string;
}

export interface SaveEditorTemplateResponse {
  status: string;
  profile_id?: string;
  context_source?: string;
  saved_version?: {
    version_id?: string;
  };
  active?: {
    template?: string;
    current_version?: {
      version_id?: string;
    };
    [key: string]: unknown;
  };
  validation?: {
    valid?: boolean;
    errors?: Array<unknown>;
  };
}

export interface ValidateEditorTemplateRequest {
  template: string;
  context_mode?: EditorContextMode;
  fixture_name?: string;
  profile_id?: string;
}

export interface ValidateEditorTemplateResponse {
  status: string;
  profile_id?: string;
  has_context?: boolean;
  context_source?: string;
  validation?: {
    valid?: boolean;
    errors?: unknown[];
    warnings?: unknown[];
    undeclared_variables?: unknown[];
  };
}

export interface EditorSnippet {
  id: string;
  category: string;
  label: string;
  template: string;
  description: string;
}

export interface EditorSnippetsResponse {
  status: string;
  snippets: EditorSnippet[];
  context_modes: EditorContextMode[];
}

export interface PreviewEditorTemplateRequest {
  template?: string;
  context_mode?: EditorContextMode;
  fixture_name?: string;
  profile_id?: string;
}

export interface PreviewEditorTemplateResponse {
  status: string;
  profile_id?: string;
  context_source?: string;
  preview: string;
  length: number;
}

export interface PreviewEditorProfileRequest {
  context_mode?: EditorContextMode;
  fixture_name?: string;
}

export interface EditorProfileMatchResult {
  profile_id: string;
  profile_label?: string;
  reasons?: string[];
  criteria?: Record<string, unknown>;
  enabled?: boolean;
  priority?: number;
}

export interface PreviewEditorProfileResponse {
  status: string;
  context_source?: string;
  profile_match?: EditorProfileMatchResult;
}

export interface EditorFixture {
  name: string;
  label: string;
  description: string;
}

export interface EditorFixturesResponse {
  status: string;
  fixtures: EditorFixture[];
}

export interface EditorTemplateVersion {
  version_id: string;
  name?: string;
  author?: string;
  source?: string;
  operation?: string;
  notes?: string;
  rolled_back_from?: string;
  created_at_utc?: string;
  template_sha256?: string;
}

export interface EditorTemplateVersionsResponse {
  status: string;
  profile_id?: string;
  versions: EditorTemplateVersion[];
}

export interface EditorProfile {
  profile_id: string;
  label: string;
  enabled: boolean;
  locked?: boolean;
  priority?: number;
  criteria?: Record<string, unknown>;
  template_name?: string;
  current_version?: {
    version_id?: string;
  };
  updated_at_utc?: string;
  updated_by?: string;
  source?: string;
}

export interface EditorProfilesResponse {
  status: string;
  working_profile_id?: string;
  profiles: EditorProfile[];
}

export interface EditorProfileBundleRecord {
  profile_id: string;
  label?: string;
  enabled?: boolean;
  locked?: boolean;
  priority?: number;
  criteria?: Record<string, unknown>;
}

export interface GetEditorProfilesExportRequest {
  profile_ids?: string[];
}

export interface EditorProfilesExportResponse {
  status: string;
  bundle_version?: number;
  exported_at_utc?: string;
  working_profile_id?: string;
  profiles: EditorProfileBundleRecord[];
}

export interface ImportEditorProfilesRequest {
  bundle: {
    bundle_version?: number;
    exported_at_utc?: string;
    working_profile_id?: string;
    profiles: unknown[];
    [key: string]: unknown;
  };
}

export interface ImportEditorProfilesResponse {
  status: string;
  imported_count?: number;
  imported_profile_ids?: string[];
  errors?: string[];
  working_profile_id?: string;
  profiles?: EditorProfile[];
}

export interface SetEditorWorkingProfileRequest {
  profile_id: string;
}

export interface SetEditorWorkingProfileResponse {
  status: string;
  working_profile_id?: string;
  profile?: EditorProfile;
}

export interface CreateEditorProfileRequest {
  profile_id: string;
  label?: string;
  criteria?: Record<string, unknown>;
}

export interface UpdateEditorProfileRequest {
  enabled?: boolean | number | string;
  priority?: number;
  label?: string;
  criteria?: Record<string, unknown>;
}

export interface UpsertEditorProfileResponse {
  status: string;
  profile?: EditorProfile;
  working_profile_id?: string;
  profiles?: EditorProfile[];
}

export interface GetEditorTemplateVersionsRequest {
  limit?: number;
  profile_id?: string;
}

export interface RollbackEditorTemplateRequest {
  version_id: string;
  author?: string;
  source?: string;
  notes?: string;
  profile_id?: string;
}

export interface RollbackEditorTemplateResponse {
  status: string;
  profile_id?: string;
  template_path?: string;
  saved_version?: {
    version_id?: string;
  };
  active?: {
    template?: string;
    current_version?: {
      version_id?: string;
    };
    [key: string]: unknown;
  };
}

export interface GetEditorTemplateExportRequest {
  profile_id?: string;
  template_id?: string;
  include_versions?: boolean;
  limit?: number;
}

export interface EditorTemplateExportResponse {
  status: string;
  bundle_version?: number;
  exported_at_utc?: string;
  profile_id?: string;
  template_id?: string;
  template?: string;
  name?: string;
  author?: string;
  description?: string;
  source?: string;
  is_custom?: boolean;
  is_builtin?: boolean;
  metadata?: Record<string, unknown>;
  current_version?: {
    version_id?: string;
  };
  versions?: EditorTemplateVersion[];
}

export interface EditorRepositoryTemplateSummary {
  template_id: string;
  name: string;
  author?: string;
  description?: string;
  source?: string;
  is_builtin?: boolean;
  updated_at_utc?: string;
}

export interface EditorRepositoryTemplatesResponse {
  status: string;
  templates: EditorRepositoryTemplateSummary[];
  count?: number;
}

export interface EditorTemplateImportBundle {
  template: string;
  profile_id?: string;
  template_id?: string;
  name?: string;
  author?: string;
  source?: string;
  notes?: string;
  description?: string;
  exported_at_utc?: string;
  bundle_version?: number;
  metadata?: Record<string, unknown>;
  current_version?: {
    version_id?: string;
  };
  versions?: EditorTemplateVersion[];
  [key: string]: unknown;
}

export interface EditorTemplateImportValidation {
  valid?: boolean;
  errors?: unknown[];
  warnings?: unknown[];
  undeclared_variables?: unknown[];
}

export interface ImportEditorTemplateRequest {
  bundle?: EditorTemplateImportBundle;
  template?: string;
  context_mode?: EditorContextMode;
  fixture_name?: string;
  profile_id?: string;
  author?: string;
  source?: string;
  name?: string;
  notes?: string;
}

export interface ImportEditorTemplateResponse {
  status: string;
  profile_id?: string;
  context_source?: string;
  template_path?: string;
  saved_version?: {
    version_id?: string;
  };
  active?: {
    template?: string;
    current_version?: {
      version_id?: string;
    };
    [key: string]: unknown;
  };
  validation?: EditorTemplateImportValidation;
}

export interface ImportEditorRepositoryRequest {
  bundle: EditorTemplateImportBundle;
  context_mode?: EditorContextMode;
  fixture_name?: string;
  author?: string;
  source?: string;
  name?: string;
}

export interface ImportEditorRepositoryResponse {
  status: string;
  context_source?: string;
  template_record?: EditorRepositoryTemplateSummary & Record<string, unknown>;
  validation?: EditorTemplateImportValidation;
}

export async function getEditorTemplate(profileId?: string): Promise<EditorTemplateResponse> {
  const query = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
  return getJson<EditorTemplateResponse>(`/editor/template${query}`);
}

export async function saveEditorTemplate(
  payload: SaveEditorTemplateRequest
): Promise<SaveEditorTemplateResponse> {
  return getJson<SaveEditorTemplateResponse>("/editor/template", {
    method: "PUT",
    body: payload
  });
}

export async function validateEditorTemplate(
  payload: ValidateEditorTemplateRequest
): Promise<ValidateEditorTemplateResponse> {
  return getJson<ValidateEditorTemplateResponse>("/editor/validate", {
    method: "POST",
    body: payload
  });
}

export async function getEditorSnippets(): Promise<EditorSnippetsResponse> {
  return getJson<EditorSnippetsResponse>("/editor/snippets");
}

export async function previewEditorTemplate(
  payload: PreviewEditorTemplateRequest
): Promise<PreviewEditorTemplateResponse> {
  return getJson<PreviewEditorTemplateResponse>("/editor/preview", {
    method: "POST",
    body: payload
  });
}

export async function previewEditorProfile(
  payload: PreviewEditorProfileRequest
): Promise<PreviewEditorProfileResponse> {
  return getJson<PreviewEditorProfileResponse>("/editor/profiles/preview", {
    method: "POST",
    body: payload
  });
}

export async function getEditorFixtures(): Promise<EditorFixturesResponse> {
  return getJson<EditorFixturesResponse>("/editor/fixtures");
}

export async function getEditorProfiles(): Promise<EditorProfilesResponse> {
  return getJson<EditorProfilesResponse>("/editor/profiles");
}

export async function getEditorProfilesExport(
  params?: GetEditorProfilesExportRequest
): Promise<EditorProfilesExportResponse> {
  const profileIds = Array.isArray(params?.profile_ids)
    ? params.profile_ids
      .map((profileId) => profileId.trim())
      .filter((profileId, index, allValues) => profileId.length > 0 && allValues.indexOf(profileId) === index)
    : [];
  const query = profileIds
    .map((profileId) => `profile_id=${encodeURIComponent(profileId)}`)
    .join("&");
  const path = query.length > 0 ? `/editor/profiles/export?${query}` : "/editor/profiles/export";
  return getJson<EditorProfilesExportResponse>(path);
}

export async function importEditorProfiles(
  payload: ImportEditorProfilesRequest
): Promise<ImportEditorProfilesResponse> {
  return getJson<ImportEditorProfilesResponse>("/editor/profiles/import", {
    method: "POST",
    body: payload
  });
}

export async function setEditorWorkingProfile(
  payload: SetEditorWorkingProfileRequest
): Promise<SetEditorWorkingProfileResponse> {
  return getJson<SetEditorWorkingProfileResponse>("/editor/profiles/working", {
    method: "POST",
    body: payload
  });
}

export async function createEditorProfile(
  payload: CreateEditorProfileRequest
): Promise<UpsertEditorProfileResponse> {
  return getJson<UpsertEditorProfileResponse>("/editor/profiles", {
    method: "POST",
    body: payload
  });
}

export async function updateEditorProfile(
  profileId: string,
  payload: UpdateEditorProfileRequest
): Promise<UpsertEditorProfileResponse> {
  const normalizedProfileId = profileId.trim();
  if (normalizedProfileId.length === 0) {
    throw new Error("profileId is required.");
  }
  return getJson<UpsertEditorProfileResponse>(`/editor/profiles/${encodeURIComponent(normalizedProfileId)}`, {
    method: "PUT",
    body: payload
  });
}

export async function getEditorTemplateVersions(
  params?: GetEditorTemplateVersionsRequest
): Promise<EditorTemplateVersionsResponse> {
  const queryParts: string[] = [];
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    queryParts.push(`limit=${encodeURIComponent(String(Math.trunc(params.limit)))}`);
  }
  if (typeof params?.profile_id === "string" && params.profile_id.trim().length > 0) {
    queryParts.push(`profile_id=${encodeURIComponent(params.profile_id)}`);
  }
  const query = queryParts.join("&");
  const path = query.length > 0 ? `/editor/template/versions?${query}` : "/editor/template/versions";
  return getJson<EditorTemplateVersionsResponse>(path);
}

export async function rollbackEditorTemplate(
  payload: RollbackEditorTemplateRequest
): Promise<RollbackEditorTemplateResponse> {
  return getJson<RollbackEditorTemplateResponse>("/editor/template/rollback", {
    method: "POST",
    body: payload
  });
}

export async function getEditorTemplateExport(
  params?: GetEditorTemplateExportRequest
): Promise<EditorTemplateExportResponse> {
  const queryParts: string[] = [];
  if (typeof params?.profile_id === "string" && params.profile_id.trim().length > 0) {
    queryParts.push(`profile_id=${encodeURIComponent(params.profile_id)}`);
  }
  if (typeof params?.template_id === "string" && params.template_id.trim().length > 0) {
    queryParts.push(`template_id=${encodeURIComponent(params.template_id)}`);
  }
  if (typeof params?.include_versions === "boolean") {
    queryParts.push(`include_versions=${params.include_versions ? "true" : "false"}`);
  }
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    queryParts.push(`limit=${encodeURIComponent(String(Math.trunc(params.limit)))}`);
  }
  const query = queryParts.join("&");
  const path = query.length > 0 ? `/editor/template/export?${query}` : "/editor/template/export";
  return getJson<EditorTemplateExportResponse>(path);
}

export async function getEditorRepositoryTemplates(): Promise<EditorRepositoryTemplatesResponse> {
  return getJson<EditorRepositoryTemplatesResponse>("/editor/repository/templates");
}

export async function getEditorRepositoryTemplateExport(
  templateId: string,
  params?: Pick<GetEditorTemplateExportRequest, "include_versions" | "limit">
): Promise<EditorTemplateExportResponse> {
  const normalizedTemplateId = templateId.trim();
  if (normalizedTemplateId.length === 0) {
    throw new Error("templateId is required.");
  }
  const queryParts: string[] = [];
  if (typeof params?.include_versions === "boolean") {
    queryParts.push(`include_versions=${params.include_versions ? "true" : "false"}`);
  }
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    queryParts.push(`limit=${encodeURIComponent(String(Math.trunc(params.limit)))}`);
  }
  const query = queryParts.join("&");
  const path = query.length > 0
    ? `/editor/repository/template/${encodeURIComponent(normalizedTemplateId)}/export?${query}`
    : `/editor/repository/template/${encodeURIComponent(normalizedTemplateId)}/export`;
  return getJson<EditorTemplateExportResponse>(path);
}

export async function importEditorTemplate(
  payload: ImportEditorTemplateRequest
): Promise<ImportEditorTemplateResponse> {
  return getJson<ImportEditorTemplateResponse>("/editor/template/import", {
    method: "POST",
    body: payload
  });
}

export async function importEditorRepositoryTemplate(
  payload: ImportEditorRepositoryRequest
): Promise<ImportEditorRepositoryResponse> {
  return getJson<ImportEditorRepositoryResponse>("/editor/repository/import", {
    method: "POST",
    body: payload
  });
}
