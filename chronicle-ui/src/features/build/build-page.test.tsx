import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../api/http-client";
import { BuildPage } from "./build-page";

const getEditorTemplate = vi.fn();
const getEditorTemplateVersions = vi.fn();
const getEditorProfiles = vi.fn();
const createEditorProfile = vi.fn();
const updateEditorProfile = vi.fn();
const saveEditorTemplate = vi.fn();
const validateEditorTemplate = vi.fn();
const previewEditorTemplate = vi.fn();
const previewEditorProfile = vi.fn();
const rollbackEditorTemplate = vi.fn();
const setEditorWorkingProfile = vi.fn();
const getEditorSnippets = vi.fn();
const getEditorFixtures = vi.fn();
const getEditorTemplateExport = vi.fn();
const getEditorProfilesExport = vi.fn();
const getEditorRepositoryTemplates = vi.fn();
const getEditorRepositoryTemplateExport = vi.fn();
const importEditorTemplate = vi.fn();
const importEditorRepositoryTemplate = vi.fn();
const importEditorProfiles = vi.fn();

vi.mock("../../api/template-editor-api", () => ({
  getEditorTemplate: (...args: unknown[]) => getEditorTemplate(...args),
  getEditorTemplateVersions: (...args: unknown[]) => getEditorTemplateVersions(...args),
  getEditorProfiles: (...args: unknown[]) => getEditorProfiles(...args),
  createEditorProfile: (...args: unknown[]) => createEditorProfile(...args),
  updateEditorProfile: (...args: unknown[]) => updateEditorProfile(...args),
  saveEditorTemplate: (...args: unknown[]) => saveEditorTemplate(...args),
  validateEditorTemplate: (...args: unknown[]) => validateEditorTemplate(...args),
  previewEditorTemplate: (...args: unknown[]) => previewEditorTemplate(...args),
  previewEditorProfile: (...args: unknown[]) => previewEditorProfile(...args),
  rollbackEditorTemplate: (...args: unknown[]) => rollbackEditorTemplate(...args),
  setEditorWorkingProfile: (...args: unknown[]) => setEditorWorkingProfile(...args),
  getEditorSnippets: (...args: unknown[]) => getEditorSnippets(...args),
  getEditorFixtures: (...args: unknown[]) => getEditorFixtures(...args),
  getEditorTemplateExport: (...args: unknown[]) => getEditorTemplateExport(...args),
  getEditorProfilesExport: (...args: unknown[]) => getEditorProfilesExport(...args),
  getEditorRepositoryTemplates: (...args: unknown[]) => getEditorRepositoryTemplates(...args),
  getEditorRepositoryTemplateExport: (...args: unknown[]) => getEditorRepositoryTemplateExport(...args),
  importEditorTemplate: (...args: unknown[]) => importEditorTemplate(...args),
  importEditorRepositoryTemplate: (...args: unknown[]) => importEditorRepositoryTemplate(...args),
  importEditorProfiles: (...args: unknown[]) => importEditorProfiles(...args)
}));

function p95(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
}

async function readExportPayloads(
  createObjectUrlMock: { mock: { calls: unknown[][] } }
): Promise<Array<Record<string, unknown>>> {
  const toText = async (blob: Blob): Promise<string> => {
    const blobWithReaders = blob as Blob & {
      text?: () => Promise<string>;
      arrayBuffer?: () => Promise<ArrayBuffer>;
    };
    if (typeof blobWithReaders.text === "function") {
      return blobWithReaders.text();
    }
    if (typeof blobWithReaders.arrayBuffer === "function") {
      const buffer = await blobWithReaders.arrayBuffer();
      return new TextDecoder().decode(buffer);
    }
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("Unable to read blob payload."));
      reader.readAsText(blob);
    });
  };

  const payloads: Array<Record<string, unknown>> = [];
  for (const call of createObjectUrlMock.mock.calls) {
    const blob = call[0];
    if (!(blob instanceof Blob)) {
      continue;
    }
    payloads.push(JSON.parse(await toText(blob)) as Record<string, unknown>);
  }
  return payloads;
}

async function readBlobPayload(blob: Blob): Promise<string> {
  const blobWithReaders = blob as Blob & {
    text?: () => Promise<string>;
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };
  if (typeof blobWithReaders.text === "function") {
    return blobWithReaders.text();
  }
  if (typeof blobWithReaders.arrayBuffer === "function") {
    const buffer = await blobWithReaders.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read blob payload."));
    reader.readAsText(blob);
  });
}

describe("build page", () => {
  beforeEach(() => {
    getEditorProfiles.mockResolvedValue({
      status: "ok",
      working_profile_id: "default",
      profiles: [
        { profile_id: "default", label: "Default", enabled: true },
        { profile_id: "trail", label: "Trail", enabled: true }
      ]
    });
    setEditorWorkingProfile.mockResolvedValue({
      status: "ok",
      working_profile_id: "default",
      profile: { profile_id: "default", label: "Default", enabled: true }
    });
    createEditorProfile.mockResolvedValue({
      status: "ok",
      profile: {
        profile_id: "tempo_focus",
        label: "Tempo Focus",
        enabled: true,
        criteria: {
          kind: "activity",
          keywords: ["tempo"]
        }
      }
    });
    updateEditorProfile.mockResolvedValue({
      status: "ok",
      profile: {
        profile_id: "trail",
        label: "Trail Updated",
        enabled: true,
        criteria: {
          kind: "activity",
          keywords: ["trail", "climb"]
        }
      }
    });
    getEditorFixtures.mockResolvedValue({
      status: "ok",
      fixtures: [{ name: "default", label: "Default", description: "Default fixture." }]
    });
    getEditorTemplateVersions.mockResolvedValue({
      status: "ok",
      versions: []
    });
    getEditorRepositoryTemplates.mockResolvedValue({
      status: "ok",
      templates: [],
      count: 0
    });
    getEditorTemplateExport.mockResolvedValue({
      status: "ok",
      bundle_version: 1,
      exported_at_utc: "2026-02-27T11:10:00+00:00",
      profile_id: "default",
      template: "Miles {{ activity.distance_miles }}",
      name: "Default Template"
    });
    getEditorProfilesExport.mockResolvedValue({
      status: "ok",
      bundle_version: 1,
      exported_at_utc: "2026-03-03T12:00:00+00:00",
      working_profile_id: "default",
      profiles: [
        { profile_id: "default", label: "Default", enabled: true, priority: 0, criteria: { kind: "fallback" } },
        { profile_id: "trail", label: "Trail", enabled: true, priority: 70, criteria: { kind: "activity" } }
      ]
    });
    getEditorRepositoryTemplateExport.mockResolvedValue({
      status: "ok",
      bundle_version: 2,
      exported_at_utc: "2026-02-27T11:10:00+00:00",
      template_id: "repo-1",
      template: "Repo {{ activity.distance_miles }}",
      name: "Repo Template"
    });
    importEditorTemplate.mockResolvedValue({
      status: "ok",
      profile_id: "default",
      context_source: "sample:default",
      validation: { valid: true, errors: [] },
      active: { template: "Imported {{ activity.distance_miles }}" }
    });
    importEditorRepositoryTemplate.mockResolvedValue({
      status: "ok",
      context_source: "sample:default",
      validation: { valid: true, errors: [] },
      template_record: { template_id: "repo-imported", name: "Imported Repo Template" }
    });
    importEditorProfiles.mockResolvedValue({
      status: "ok",
      imported_count: 1,
      imported_profile_ids: ["tempo_focus"],
      errors: [],
      working_profile_id: "default",
      profiles: [
        { profile_id: "default", label: "Default", enabled: true },
        { profile_id: "tempo_focus", label: "Tempo Focus", enabled: true }
      ]
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("loads active template and allows user to edit text", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    render(<BuildPage />);

    expect(screen.getByText("Loading template...")).toBeInTheDocument();
    const editor = await screen.findByLabelText("Template (Jinja)");
    expect(editor).toHaveValue("Miles {{ activity.distance_miles }}");

    fireEvent.change(editor, {
      target: { value: "New template {{ weather.aqi }}" }
    });
    expect(editor).toHaveValue("New template {{ weather.aqi }}");
  });

  it("loads and displays working profile context in the build editor", async () => {
    getEditorProfiles.mockResolvedValue({
      status: "ok",
      working_profile_id: "trail",
      profiles: [
        { profile_id: "default", label: "Default", enabled: true },
        { profile_id: "trail", label: "Trail", enabled: true }
      ]
    });
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Trail {{ activity.distance_miles }}",
      profile_id: "trail"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    render(<BuildPage />);

    expect(await screen.findByRole("combobox", { name: "Working Profile" })).toHaveTextContent("Trail");
    expect(getEditorTemplate).toHaveBeenCalledWith("trail");
    expect(await screen.findByText("Editing Trail template")).toBeInTheDocument();
  });

  it("creates a profile with classification rules and refreshes profile list", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Default {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorProfiles
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "default",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true }
        ]
      })
      .mockResolvedValue({
        status: "ok",
        working_profile_id: "default",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true },
          {
            profile_id: "tempo_focus",
            label: "Tempo Focus",
            enabled: true,
            criteria: { kind: "activity", keywords: ["tempo"] }
          }
        ]
      });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(screen.getByLabelText("New Profile ID"), { target: { value: "tempo_focus" } });
    fireEvent.change(screen.getByLabelText("New Profile Label"), { target: { value: "Tempo Focus" } });
    fireEvent.change(screen.getByLabelText("New Classification Rules (JSON)"), {
      target: { value: "{\"kind\":\"activity\",\"keywords\":[\"tempo\"]}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Profile" }));

    await waitFor(() => {
      expect(createEditorProfile).toHaveBeenCalledWith({
        profile_id: "tempo_focus",
        label: "Tempo Focus",
        criteria: { kind: "activity", keywords: ["tempo"] }
      });
    });
    expect(await screen.findByText("Profile created.")).toBeInTheDocument();
  });

  it("keeps create-profile success feedback when profile refresh fails after create", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Default {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorProfiles
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "default",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true }
        ]
      })
      .mockRejectedValueOnce(new Error("Unable to refresh profiles after create."));

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(screen.getByLabelText("New Profile ID"), { target: { value: "tempo_focus" } });
    fireEvent.change(screen.getByLabelText("New Profile Label"), { target: { value: "Tempo Focus" } });
    fireEvent.change(screen.getByLabelText("New Classification Rules (JSON)"), {
      target: { value: "{\"kind\":\"activity\",\"keywords\":[\"tempo\"]}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Profile" }));

    await waitFor(() => {
      expect(createEditorProfile).toHaveBeenCalledWith({
        profile_id: "tempo_focus",
        label: "Tempo Focus",
        criteria: { kind: "activity", keywords: ["tempo"] }
      });
    });
    expect(
      await screen.findByText("Profile created, but profile list refresh failed. Use Reload Template to sync.")
    ).toBeInTheDocument();
  });

  it("updates selected profile classification rules from the profile editor section", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Default {{ activity.distance_miles }}",
      profile_id: "trail"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorProfiles.mockResolvedValue({
      status: "ok",
      working_profile_id: "trail",
      profiles: [
        { profile_id: "default", label: "Default", enabled: true, locked: true, criteria: { kind: "fallback" } },
        {
          profile_id: "trail",
          label: "Trail",
          enabled: true,
          priority: 70,
          criteria: { kind: "activity", keywords: ["trail"] }
        }
      ]
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(screen.getByLabelText("Edit Profile Label"), { target: { value: "Trail Updated" } });
    fireEvent.change(screen.getByLabelText("Edit Classification Rules (JSON)"), {
      target: { value: "{\"kind\":\"activity\",\"keywords\":[\"trail\",\"climb\"]}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Profile" }));

    await waitFor(() => {
      expect(updateEditorProfile).toHaveBeenCalledWith("trail", {
        label: "Trail Updated",
        criteria: { kind: "activity", keywords: ["trail", "climb"] },
        enabled: true,
        priority: 70
      });
    });
    expect(await screen.findByText("Profile updated.")).toBeInTheDocument();
  });

  it("keeps update-profile success feedback when profile refresh fails after update", async () => {
    getEditorTemplate
      .mockResolvedValueOnce({
        status: "ok",
        template: "Default {{ activity.distance_miles }}",
        profile_id: "trail"
      })
      .mockRejectedValueOnce(new Error("Unable to refresh profiles after update."));
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorProfiles
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "trail",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true, locked: true, criteria: { kind: "fallback" } },
          {
            profile_id: "trail",
            label: "Trail",
            enabled: true,
            priority: 70,
            criteria: { kind: "activity", keywords: ["trail"] }
          }
        ]
      })
      .mockRejectedValueOnce(new Error("Unable to refresh profiles after update."));

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(screen.getByLabelText("Edit Profile Label"), { target: { value: "Trail Updated" } });
    fireEvent.change(screen.getByLabelText("Edit Classification Rules (JSON)"), {
      target: { value: "{\"kind\":\"activity\",\"keywords\":[\"trail\",\"climb\"]}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Profile" }));

    await waitFor(() => {
      expect(updateEditorProfile).toHaveBeenCalledWith("trail", {
        label: "Trail Updated",
        criteria: { kind: "activity", keywords: ["trail", "climb"] },
        enabled: true,
        priority: 70
      });
    });
    expect(
      await screen.findByText("Profile updated, but profile list refresh failed. Use Reload Template to sync.")
    ).toBeInTheDocument();
  });

  it("updates selected profile enabled state and priority and refreshes ordered profile options", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Trail {{ activity.distance_miles }}",
      profile_id: "trail"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorProfiles
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "trail",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true, locked: true, priority: 0, criteria: {} },
          { profile_id: "trail", label: "Trail", enabled: true, priority: 70, criteria: { kind: "activity" } },
          { profile_id: "tempo", label: "Tempo", enabled: true, priority: 90, criteria: { kind: "activity" } }
        ]
      })
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "default",
        profiles: [
          { profile_id: "tempo", label: "Tempo", enabled: true, priority: 90, criteria: { kind: "activity" } },
          { profile_id: "default", label: "Default", enabled: true, locked: true, priority: 0, criteria: {} },
          { profile_id: "trail", label: "Trail", enabled: false, priority: -1, criteria: { kind: "activity" } }
        ]
      });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.mouseDown(screen.getByLabelText("Edit Profile Enabled"));
    fireEvent.click(await screen.findByRole("option", { name: "Disabled" }));
    fireEvent.change(screen.getByLabelText("Edit Profile Priority"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Profile" }));

    await waitFor(() => {
      expect(updateEditorProfile).toHaveBeenCalledWith("trail", {
        label: "Trail",
        criteria: { kind: "activity" },
        enabled: false,
        priority: -1
      });
    });

    expect(await screen.findByText("Profile updated.")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText("Working Profile"));
    const options = await screen.findAllByRole("option");
    const optionLabels = options.map((option) => option.textContent ?? "");
    expect(optionLabels[0]).toContain("Tempo");
    expect(optionLabels[1]).toContain("Default");
    expect(optionLabels[1]).toContain("Working");
    expect(optionLabels[2]).toContain("Trail");
    expect(optionLabels[2]).toContain("Disabled");
    expect(optionLabels[2]).not.toContain("Working");
    expect(options[2]).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(await screen.findByRole("listbox", { name: "Working Profile" }), {
      key: "Escape",
      code: "Escape"
    });
    await waitFor(() => {
      expect(screen.queryByRole("listbox", { name: "Working Profile" })).not.toBeInTheDocument();
    });

    saveEditorTemplate.mockResolvedValueOnce({
      status: "ok",
      active: {
        template: "Saved {{ activity.distance_miles }}"
      }
    });
    validateEditorTemplate.mockResolvedValueOnce({
      status: "ok",
      has_context: true,
      context_source: "sample:default",
      validation: { valid: true, errors: [], warnings: [] }
    });
    previewEditorTemplate.mockResolvedValueOnce({
      status: "ok",
      profile_id: "default",
      context_source: "sample:default",
      preview: "Saved 10",
      length: 8
    });
    const editor = screen.getByLabelText("Template (Jinja)");
    fireEvent.change(editor, { target: { value: "Saved {{ activity.distance_miles }}" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Template" }));

    await waitFor(() => {
      expect(saveEditorTemplate).toHaveBeenCalledWith({
        template: "Saved {{ activity.distance_miles }}",
        source: "editor-ui",
        profile_id: "default"
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Validate Template" }));
    await waitFor(() => {
      expect(validateEditorTemplate).toHaveBeenCalledWith({
        template: "Saved {{ activity.distance_miles }}",
        profile_id: "default"
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview Template" }));
    await waitFor(() => {
      expect(previewEditorTemplate).toHaveBeenCalledWith({
        template: "Saved {{ activity.distance_miles }}",
        context_mode: "sample",
        profile_id: "default",
        fixture_name: "default"
      });
    });
  });

  it("previews which profile applies to the current context and shows matching criteria", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Default {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    previewEditorProfile.mockResolvedValue({
      status: "ok",
      context_source: "sample:strength_training",
      profile_match: {
        profile_id: "strength_training",
        profile_label: "Strength Training",
        reasons: ["sport_type=Workout"],
        criteria: {
          kind: "activity",
          description: "Workout classification"
        }
      }
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.click(screen.getByRole("button", { name: "Preview Matching Profile" }));

    await waitFor(() => {
      expect(previewEditorProfile).toHaveBeenCalledWith({
        context_mode: "sample",
        fixture_name: "default"
      });
    });
    expect(await screen.findByText("Matched Profile: Strength Training")).toBeInTheDocument();
    expect(screen.getByText("sport_type=Workout")).toBeInTheDocument();
    expect(screen.getByText("Profile preview context: sample:strength_training")).toBeInTheDocument();
    expect(screen.getByText(/"kind": "activity"/)).toBeInTheDocument();
  });

  it("previews matching profile with latest context without fixture payload", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Default {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    previewEditorProfile.mockResolvedValue({
      status: "ok",
      context_source: "latest",
      profile_match: {
        profile_id: "default",
        profile_label: "Default",
        reasons: ["fallback"],
        criteria: { kind: "fallback" }
      }
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.mouseDown(screen.getByLabelText("Preview Context"));
    fireEvent.click(await screen.findByRole("option", { name: "Latest activity" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview Matching Profile" }));

    await waitFor(() => {
      expect(previewEditorProfile).toHaveBeenCalledWith({
        context_mode: "latest"
      });
    });
  });

  it("shows actionable error feedback when profile preview fails", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Default {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    previewEditorProfile.mockRejectedValue(new Error("Profile preview service unavailable."));

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.click(screen.getByRole("button", { name: "Preview Matching Profile" }));

    expect(await screen.findByText("Profile preview service unavailable.")).toBeInTheDocument();
  });

  it("shows actionable validation when profile-rule JSON is invalid and avoids save", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Default {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(screen.getByLabelText("New Profile ID"), { target: { value: "tempo_focus" } });
    fireEvent.change(screen.getByLabelText("New Profile Label"), { target: { value: "Tempo Focus" } });
    fireEvent.change(screen.getByLabelText("New Classification Rules (JSON)"), {
      target: { value: "{invalid-json" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Profile" }));

    expect(await screen.findByText("Classification rules must be a valid JSON object.")).toBeInTheDocument();
    expect(createEditorProfile).not.toHaveBeenCalled();
  });

  it("blocks duplicate profile id creation client-side before API call", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Default {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(screen.getByLabelText("New Profile ID"), { target: { value: "trail" } });
    fireEvent.change(screen.getByLabelText("New Profile Label"), { target: { value: "Trail Copy" } });
    fireEvent.change(screen.getByLabelText("New Classification Rules (JSON)"), {
      target: { value: "{\"kind\":\"activity\",\"keywords\":[\"trail\"]}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Profile" }));

    expect(await screen.findByText("profile_id already exists: trail")).toBeInTheDocument();
    expect(createEditorProfile).not.toHaveBeenCalled();
  });

  it("keeps default profile edit controls disabled", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Default {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorProfiles.mockResolvedValue({
      status: "ok",
      working_profile_id: "default",
      profiles: [
        { profile_id: "default", label: "Default", enabled: true, locked: true, criteria: { kind: "fallback" } },
        { profile_id: "trail", label: "Trail", enabled: true, criteria: { kind: "activity" } }
      ]
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    expect(screen.getByLabelText("Edit Profile Label")).toBeDisabled();
    expect(screen.getByLabelText("Edit Classification Rules (JSON)")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Edit Profile Enabled" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Edit Profile Priority")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update Profile" })).toBeDisabled();
    expect(screen.getByText("Default profile classification rules are locked.")).toBeInTheDocument();
  });

  it("saves edited template and shows success feedback", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    saveEditorTemplate.mockResolvedValue({
      status: "ok",
      saved_version: {
        version_id: "ver-123"
      },
      active: {
        template: "Updated {{ activity.distance_miles }}"
      }
    });

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, {
      target: { value: "Updated {{ activity.distance_miles }}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Template" }));

    await waitFor(() => {
      expect(saveEditorTemplate).toHaveBeenCalledWith({
        template: "Updated {{ activity.distance_miles }}",
        source: "editor-ui",
        profile_id: "default"
      });
    });
    expect(await screen.findByText("Template saved.")).toBeInTheDocument();
  });

  it("shows backend validation errors and keeps editor text for correction", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    saveEditorTemplate.mockRejectedValue(
      new ApiRequestError({
        message: "template must be a non-empty string.",
        status: 400
      })
    );

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, {
      target: { value: "{% if %}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Template" }));

    expect(await screen.findByText("template must be a non-empty string.")).toBeInTheDocument();
    expect(screen.getByLabelText("Template (Jinja)")).toHaveValue("{% if %}");
  });

  it("prefers structured validation details when save returns ApiRequestError details", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    saveEditorTemplate.mockRejectedValue(
      new ApiRequestError({
        message: "Request failed: 400",
        status: 400,
        details: {
          errors: ["Unexpected end of template block."]
        }
      })
    );

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, {
      target: { value: "{% if activity.distance_miles %}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Template" }));

    expect(await screen.findByText("Unexpected end of template block.")).toBeInTheDocument();
    expect(screen.getByLabelText("Template (Jinja)")).toHaveValue("{% if activity.distance_miles %}");
  });

  it("shows load error guidance when template cannot be fetched", async () => {
    getEditorTemplate.mockRejectedValue(new Error("Unable to load template."));
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    render(<BuildPage />);

    expect(await screen.findByText("Unable to load template.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Template (Jinja)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Template" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry loading template" })).toBeInTheDocument();
  });

  it("retries loading and restores editor when transient fetch error clears", async () => {
    getEditorTemplate
      .mockRejectedValueOnce(new Error("Unable to load template."))
      .mockResolvedValueOnce({
        status: "ok",
        template: "Recovered {{ activity.distance_miles }}"
      });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    render(<BuildPage />);

    expect(await screen.findByText("Unable to load template.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading template" }));

    const editor = await screen.findByLabelText("Template (Jinja)");
    expect(editor).toHaveValue("Recovered {{ activity.distance_miles }}");
    expect(getEditorTemplate).toHaveBeenCalledTimes(2);
  });

  it("emits load and save timing telemetry with sub-second durations in tests", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    saveEditorTemplate.mockResolvedValue({
      status: "ok",
      active: {
        template: "Updated {{ activity.distance_miles }}"
      }
    });

    const timings: Array<{ metric: string; duration_ms: number }> = [];
    const onTiming = (event: Event) => {
      const detail = (event as CustomEvent).detail as { metric?: string; duration_ms?: number };
      if (typeof detail?.metric === "string" && typeof detail?.duration_ms === "number") {
        timings.push({ metric: detail.metric, duration_ms: detail.duration_ms });
      }
    };
    window.addEventListener("chronicle:ui-timing", onTiming as EventListener);

    try {
      render(<BuildPage />);

      const editor = await screen.findByLabelText("Template (Jinja)");
      await waitFor(() => {
        expect(timings.some((timing) => timing.metric === "template.load")).toBe(true);
      });

      fireEvent.change(editor, {
        target: { value: "Updated {{ activity.distance_miles }}" }
      });
      fireEvent.click(screen.getByRole("button", { name: "Save Template" }));

      await screen.findByText("Template saved.");
      await waitFor(() => {
        expect(timings.some((timing) => timing.metric === "template.save")).toBe(true);
      });
    } finally {
      window.removeEventListener("chronicle:ui-timing", onTiming as EventListener);
    }

    for (const metric of ["template.load", "template.save"]) {
      const durations = timings.filter((timing) => timing.metric === metric).map((timing) => timing.duration_ms);
      expect(durations.length).toBeGreaterThan(0);
      expect(Math.max(...durations)).toBeLessThan(1000);
    }
  });

  it("exports active profile template as downloadable bundle", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorTemplateExport.mockResolvedValue({
      status: "ok",
      bundle_version: 1,
      exported_at_utc: "2026-02-27T11:10:00+00:00",
      profile_id: "default",
      template: "Miles {{ activity.distance_miles }}",
      name: "Default Template"
    });

    const createObjectUrlMock = vi.fn(() => "blob:mock-export");
    const revokeObjectUrlMock = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlMock });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrlMock });

    try {
      render(<BuildPage />);
      await screen.findByLabelText("Template (Jinja)");
      fireEvent.click(screen.getByRole("button", { name: "Export Templates" }));

      await waitFor(() => {
        expect(getEditorTemplateExport).toHaveBeenCalledWith({
          profile_id: "default"
        });
      });
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalled();
      const payloads = await readExportPayloads(createObjectUrlMock);
      expect(payloads).toHaveLength(1);
      expect(payloads[0]?.bundle_version).toBe(1);
      expect(payloads[0]?.exported_at_utc).toBe("2026-02-27T11:10:00+00:00");
      expect(payloads[0]?.template).toBe("Miles {{ activity.distance_miles }}");
      expect(payloads[0]?.name).toBe("Default Template");
      expect(await screen.findByText("Exported 1 template bundle.")).toBeInTheDocument();
    } finally {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      clickSpy.mockRestore();
    }
  });

  it("exports active template for the selected working profile after profile switch", async () => {
    getEditorProfiles
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "default",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true }
        ]
      })
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "trail",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true }
        ]
      });
    setEditorWorkingProfile.mockResolvedValue({
      status: "ok",
      working_profile_id: "trail",
      profile: { profile_id: "trail", label: "Trail", enabled: true }
    });
    getEditorTemplate
      .mockResolvedValueOnce({
        status: "ok",
        template: "Default {{ activity.distance_miles }}",
        profile_id: "default"
      })
      .mockResolvedValueOnce({
        status: "ok",
        template: "Trail {{ activity.distance_miles }}",
        profile_id: "trail"
      });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorTemplateExport.mockResolvedValue({
      status: "ok",
      bundle_version: 1,
      exported_at_utc: "2026-02-27T11:10:00+00:00",
      profile_id: "trail",
      template: "Trail {{ activity.distance_miles }}",
      name: "Trail Template"
    });

    const createObjectUrlMock = vi.fn(() => "blob:mock-export");
    const originalCreateObjectURL = URL.createObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlMock });

    try {
      render(<BuildPage />);
      await screen.findByLabelText("Template (Jinja)");

      fireEvent.mouseDown(screen.getByLabelText("Working Profile"));
      fireEvent.click(await screen.findByRole("option", { name: /Trail/ }));

      await waitFor(() => {
        expect(setEditorWorkingProfile).toHaveBeenCalledWith({
          profile_id: "trail"
        });
      });

      fireEvent.click(screen.getByRole("button", { name: "Export Templates" }));

      await waitFor(() => {
        expect(getEditorTemplateExport).toHaveBeenCalledWith({
          profile_id: "trail"
        });
      });
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalled();
      expect(await screen.findByText("Exported 1 template bundle.")).toBeInTheDocument();
    } finally {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      clickSpy.mockRestore();
    }
  });

  it("exports selected profiles as downloadable yaml bundle", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    const createObjectUrlMock = vi.fn(() => "blob:mock-profiles-export");
    const revokeObjectUrlMock = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlMock });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrlMock });

    try {
      render(<BuildPage />);
      await screen.findByLabelText("Template (Jinja)");
      fireEvent.click(screen.getByRole("button", { name: "Export Profiles YAML" }));

      await waitFor(() => {
        expect(getEditorProfilesExport).toHaveBeenCalledWith({
          profile_ids: ["default", "trail"]
        });
      });
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalled();
      const firstCall = createObjectUrlMock.mock.calls[0] as unknown[] | undefined;
      expect(firstCall).toBeDefined();
      const exportedBlob = firstCall?.[0];
      if (!(exportedBlob instanceof Blob)) {
        throw new Error("Expected profile export blob payload.");
      }
      const yamlText = await readBlobPayload(exportedBlob);
      expect(yamlText).toContain("profiles:");
      expect(yamlText).toContain("profile_id: default");
      expect(await screen.findByText("Exported 2 profile bundle items.")).toBeInTheDocument();
    } finally {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      clickSpy.mockRestore();
    }
  });

  it("imports yaml profile bundle and refreshes profile state", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    render(<BuildPage />);
    await screen.findByLabelText("Template (Jinja)");
    const yamlBundle = [
      "bundle_version: 1",
      "working_profile_id: tempo_focus",
      "profiles:",
      "  - profile_id: tempo_focus",
      "    label: Tempo Focus",
      "    enabled: true",
      "    priority: 50",
      "    criteria:",
      "      kind: activity",
      "      keywords:",
      "        - tempo"
    ].join("\n");
    const importFile = new File([yamlBundle], "profiles.yaml", { type: "application/yaml" });
    fireEvent.change(screen.getByLabelText("Import Profile Bundle File"), {
      target: { files: [importFile] }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Profiles YAML" }));

    await waitFor(() => {
      expect(importEditorProfiles).toHaveBeenCalledWith({
        bundle: {
          bundle_version: 1,
          working_profile_id: "tempo_focus",
          profiles: [
            {
              profile_id: "tempo_focus",
              label: "Tempo Focus",
              enabled: true,
              priority: 50,
              criteria: {
                kind: "activity",
                keywords: ["tempo"]
              }
            }
          ]
        }
      });
    });
    expect(await screen.findByText("Imported 1 profile.")).toBeInTheDocument();
  });

  it("exports selected repository templates without mutating editor state", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorRepositoryTemplates.mockResolvedValue({
      status: "ok",
      templates: [
        { template_id: "tempo-a", name: "Tempo A", author: "coach" },
        { template_id: "tempo-b", name: "Tempo B", author: "coach" }
      ],
      count: 2
    });
    getEditorRepositoryTemplateExport
      .mockResolvedValueOnce({
        status: "ok",
        bundle_version: 2,
        exported_at_utc: "2026-02-27T11:10:00+00:00",
        template_id: "tempo-a",
        template: "Tempo A {{ activity.distance_miles }}",
        name: "Tempo A"
      })
      .mockResolvedValueOnce({
        status: "ok",
        bundle_version: 2,
        exported_at_utc: "2026-02-27T11:10:00+00:00",
        template_id: "tempo-b",
        template: "Tempo B {{ activity.distance_miles }}",
        name: "Tempo B"
      });

    const createObjectUrlMock = vi.fn(() => "blob:mock-export");
    const revokeObjectUrlMock = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlMock });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrlMock });

    try {
      render(<BuildPage />);

      const editor = await screen.findByLabelText("Template (Jinja)");
      fireEvent.change(editor, { target: { value: "Unsaved local export draft {{ activity.distance_miles }}" } });

      fireEvent.mouseDown(screen.getByLabelText("Export Source"));
      fireEvent.click(await screen.findByRole("option", { name: "Repository templates" }));

      fireEvent.mouseDown(screen.getByRole("combobox", { name: "Repository Templates" }));
      fireEvent.click(await screen.findByRole("option", { name: "Tempo A" }));
      fireEvent.click(await screen.findByRole("option", { name: "Tempo B" }));
      fireEvent.keyDown(await screen.findByRole("listbox", { name: "Repository Templates" }), {
        key: "Escape",
        code: "Escape"
      });
      await waitFor(() => {
        expect(screen.queryByRole("listbox", { name: "Repository Templates" })).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Export Templates" }));

      await waitFor(() => {
        expect(getEditorRepositoryTemplateExport).toHaveBeenCalledTimes(2);
      });
      expect(getEditorRepositoryTemplateExport).toHaveBeenNthCalledWith(1, "tempo-a");
      expect(getEditorRepositoryTemplateExport).toHaveBeenNthCalledWith(2, "tempo-b");
      expect(screen.getByLabelText("Template (Jinja)")).toHaveValue(
        "Unsaved local export draft {{ activity.distance_miles }}"
      );
      expect(screen.getByRole("combobox", { name: "Working Profile" })).toHaveTextContent("Default");
      expect(await screen.findByText("Exported 2 template bundles.")).toBeInTheDocument();
      expect(createObjectUrlMock).toHaveBeenCalledTimes(2);
      expect(clickSpy).toHaveBeenCalledTimes(2);
      const payloads = await readExportPayloads(createObjectUrlMock);
      expect(payloads).toHaveLength(2);
      expect(payloads.map((payload) => payload.template_id)).toEqual(["tempo-a", "tempo-b"]);
    } finally {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      clickSpy.mockRestore();
    }
  });

  it("shows export failure feedback when active export request fails", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorTemplateExport.mockRejectedValue(
      new ApiRequestError({
        message: "Export failed due to upstream timeout.",
        status: 504
      })
    );

    const createObjectUrlMock = vi.fn(() => "blob:mock-export");
    const originalCreateObjectURL = URL.createObjectURL;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlMock });

    try {
      render(<BuildPage />);
      await screen.findByLabelText("Template (Jinja)");
      fireEvent.click(screen.getByRole("button", { name: "Export Templates" }));

      expect(await screen.findByText("Export failed due to upstream timeout.")).toBeInTheDocument();
      expect(createObjectUrlMock).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
    }
  });

  it("shows export failure feedback when repository template export fails", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorRepositoryTemplates.mockResolvedValue({
      status: "ok",
      templates: [{ template_id: "tempo-a", name: "Tempo A", author: "coach" }],
      count: 1
    });
    getEditorRepositoryTemplateExport.mockRejectedValue(
      new ApiRequestError({
        message: "Unknown template_id: tempo-a",
        status: 404
      })
    );

    const createObjectUrlMock = vi.fn(() => "blob:mock-export");
    const originalCreateObjectURL = URL.createObjectURL;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlMock });

    try {
      render(<BuildPage />);
      await screen.findByLabelText("Template (Jinja)");

      fireEvent.mouseDown(screen.getByLabelText("Export Source"));
      fireEvent.click(await screen.findByRole("option", { name: "Repository templates" }));
      fireEvent.mouseDown(screen.getByRole("combobox", { name: "Repository Templates" }));
      fireEvent.click(await screen.findByRole("option", { name: "Tempo A" }));
      fireEvent.keyDown(await screen.findByRole("listbox", { name: "Repository Templates" }), {
        key: "Escape",
        code: "Escape"
      });

      fireEvent.click(screen.getByRole("button", { name: "Export Templates" }));

      expect(await screen.findByText("Unknown template_id: tempo-a")).toBeInTheDocument();
      expect(createObjectUrlMock).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
    }
  });

  it("emits repository list and export timing telemetry with sub-second p95 in tests", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorRepositoryTemplates.mockResolvedValue({
      status: "ok",
      templates: [{ template_id: "tempo-a", name: "Tempo A", author: "coach" }],
      count: 1
    });
    getEditorTemplateExport.mockResolvedValue({
      status: "ok",
      bundle_version: 1,
      exported_at_utc: "2026-02-27T11:10:00+00:00",
      profile_id: "default",
      template: "Miles {{ activity.distance_miles }}",
      name: "Default Template"
    });

    const createObjectUrlMock = vi.fn(() => "blob:mock-export");
    const revokeObjectUrlMock = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlMock });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrlMock });

    const timings: Array<{ metric: string; duration_ms: number }> = [];
    const onTiming = (event: Event) => {
      const detail = (event as CustomEvent).detail as { metric?: string; duration_ms?: number };
      if (typeof detail?.metric === "string" && typeof detail?.duration_ms === "number") {
        timings.push({ metric: detail.metric, duration_ms: detail.duration_ms });
      }
    };
    window.addEventListener("chronicle:ui-timing", onTiming as EventListener);

    try {
      render(<BuildPage />);
      await screen.findByLabelText("Template (Jinja)");
      await waitFor(() => {
        expect(timings.some((timing) => timing.metric === "template.repository.list.load")).toBe(true);
      });

      const exportButton = screen.getByRole("button", { name: "Export Templates" });
      for (let attempt = 0; attempt < 20; attempt += 1) {
        fireEvent.click(exportButton);
        await waitFor(() => {
          expect(timings.filter((timing) => timing.metric === "template.export").length).toBeGreaterThan(attempt);
        });
      }
    } finally {
      window.removeEventListener("chronicle:ui-timing", onTiming as EventListener);
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      clickSpy.mockRestore();
    }

    const listDurations = timings
      .filter((timing) => timing.metric === "template.repository.list.load")
      .map((timing) => timing.duration_ms);
    const exportDurations = timings.filter((timing) => timing.metric === "template.export").map((timing) => timing.duration_ms);
    expect(listDurations.length).toBeGreaterThan(0);
    expect(exportDurations.length).toBeGreaterThanOrEqual(20);
    expect(p95(listDurations)).toBeLessThan(1000);
    expect(p95(exportDurations)).toBeLessThan(1000);
  });

  it("imports bundle into repository catalog and refreshes repository template selection", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorRepositoryTemplates
      .mockResolvedValueOnce({
        status: "ok",
        templates: [{ template_id: "tempo-a", name: "Tempo A", author: "coach" }],
        count: 1
      })
      .mockResolvedValueOnce({
        status: "ok",
        templates: [
          { template_id: "tempo-a", name: "Tempo A", author: "coach" },
          { template_id: "repo-imported", name: "Imported Repo Template", author: "coach" }
        ],
        count: 2
      });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.mouseDown(screen.getByLabelText("Import Target"));
    fireEvent.click(await screen.findByRole("option", { name: "Repository catalog" }));

    const file = new File(
      [
        JSON.stringify({
          bundle_version: 2,
          template: "Repo imported {{ activity.distance_miles }}",
          name: "Imported Repo Template"
        })
      ],
      "repo-template.json",
      { type: "application/json" }
    );
    fireEvent.change(screen.getByLabelText("Import Bundle File"), {
      target: { files: [file] }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Bundle" }));

    await waitFor(() => {
      expect(importEditorRepositoryTemplate).toHaveBeenCalledWith({
        bundle: {
          bundle_version: 2,
          template: "Repo imported {{ activity.distance_miles }}",
          name: "Imported Repo Template"
        },
        context_mode: "sample",
        fixture_name: "default",
        source: "editor-ui-repository-import"
      });
    });
    expect(await screen.findByText("Template bundle imported into repository catalog.")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText("Export Source"));
    fireEvent.click(await screen.findByRole("option", { name: "Repository templates" }));
    fireEvent.mouseDown(screen.getByLabelText("Repository Templates"));
    expect(await screen.findByRole("option", { name: "Imported Repo Template" })).toBeInTheDocument();
  });

  it("imports bundle into active profile and confirms overwrite when unsaved changes exist", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    getEditorTemplate
      .mockResolvedValueOnce({
        status: "ok",
        template: "Original {{ activity.distance_miles }}",
        profile_id: "default"
      })
      .mockResolvedValueOnce({
        status: "ok",
        template: "Imported {{ activity.distance_miles }}",
        profile_id: "default"
      });
    getEditorTemplateVersions
      .mockResolvedValueOnce({
        status: "ok",
        versions: []
      })
      .mockResolvedValueOnce({
        status: "ok",
        versions: []
      });
    getEditorRepositoryTemplates
      .mockResolvedValueOnce({
        status: "ok",
        templates: [],
        count: 0
      })
      .mockResolvedValueOnce({
        status: "ok",
        templates: [],
        count: 0
      });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, { target: { value: "Unsaved draft {{ activity.distance_miles }}" } });

    const file = new File(
      [
        JSON.stringify({
          bundle_version: 1,
          template: "Imported {{ activity.distance_miles }}",
          name: "Imported Template"
        })
      ],
      "active-template.json",
      { type: "application/json" }
    );
    fireEvent.change(screen.getByLabelText("Import Bundle File"), {
      target: { files: [file] }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Bundle" }));

    await waitFor(() => {
      expect(importEditorTemplate).toHaveBeenCalledWith({
        bundle: {
          bundle_version: 1,
          template: "Imported {{ activity.distance_miles }}",
          name: "Imported Template"
        },
        context_mode: "sample",
        fixture_name: "default",
        profile_id: "default",
        source: "editor-ui-import"
      });
    });
    expect(confirmSpy).toHaveBeenCalled();
    expect(await screen.findByText("Template bundle imported into active profile.")).toBeInTheDocument();
    expect(screen.getByLabelText("Template (Jinja)")).toHaveValue("Imported {{ activity.distance_miles }}");
  });

  it("keeps active import success feedback when metadata refresh fails after save", async () => {
    getEditorTemplate
      .mockResolvedValueOnce({
        status: "ok",
        template: "Original {{ activity.distance_miles }}",
        profile_id: "default"
      })
      .mockRejectedValueOnce(new Error("Unable to refresh metadata."));
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    importEditorTemplate.mockResolvedValue({
      status: "ok",
      profile_id: "default",
      saved_version: { version_id: "ver-imported" },
      active: { template: "Imported {{ activity.distance_miles }}" },
      validation: { valid: true, errors: [] }
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    const file = new File(
      [
        JSON.stringify({
          template: "Imported {{ activity.distance_miles }}",
          name: "Imported Template"
        })
      ],
      "active-template-refresh-failure.json",
      { type: "application/json" }
    );
    fireEvent.change(screen.getByLabelText("Import Bundle File"), {
      target: { files: [file] }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Bundle" }));

    expect(
      await screen.findByText("Template bundle imported into active profile. Metadata refresh failed.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Template imported, but editor metadata refresh failed. Use Reload Template to sync versions.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Template (Jinja)")).toHaveValue("Imported {{ activity.distance_miles }}");
  });

  it("keeps repository import success feedback when repository refresh fails", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorRepositoryTemplates
      .mockResolvedValueOnce({
        status: "ok",
        templates: [{ template_id: "tempo-a", name: "Tempo A", author: "coach" }],
        count: 1
      })
      .mockRejectedValueOnce(new Error("Repository refresh failed."));

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.mouseDown(screen.getByLabelText("Import Target"));
    fireEvent.click(await screen.findByRole("option", { name: "Repository catalog" }));
    const file = new File(
      [
        JSON.stringify({
          template: "Repo imported {{ activity.distance_miles }}",
          name: "Repo Imported"
        })
      ],
      "repo-template-refresh-failure.json",
      { type: "application/json" }
    );
    fireEvent.change(screen.getByLabelText("Import Bundle File"), {
      target: { files: [file] }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Bundle" }));

    expect(
      await screen.findByText("Template bundle imported into repository catalog. Repository refresh failed.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Template imported, but repository list refresh failed. Use Reload Template to sync catalog.")
    ).toBeInTheDocument();
  });

  it("uses sample import context even when preview mode is switched to latest", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.mouseDown(screen.getByLabelText("Preview Context"));
    fireEvent.click(await screen.findByRole("option", { name: "Latest activity" }));
    const file = new File(
      [
        JSON.stringify({
          template: "Imported {{ activity.distance_miles }}",
          name: "Imported Template"
        })
      ],
      "active-template-latest-preview.json",
      { type: "application/json" }
    );
    fireEvent.change(screen.getByLabelText("Import Bundle File"), {
      target: { files: [file] }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Bundle" }));

    await waitFor(() => {
      expect(importEditorTemplate).toHaveBeenCalledWith({
        bundle: {
          template: "Imported {{ activity.distance_miles }}",
          name: "Imported Template"
        },
        context_mode: "sample",
        fixture_name: "default",
        profile_id: "default",
        source: "editor-ui-import"
      });
    });
  });

  it("shows actionable error feedback for malformed import bundle JSON", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    const malformedFile = new File(["{\"template\": "], "broken-template.json", {
      type: "application/json"
    });
    fireEvent.change(screen.getByLabelText("Import Bundle File"), {
      target: { files: [malformedFile] }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Bundle" }));

    expect(
      await screen.findByText("Import bundle JSON is malformed. Verify the file contains valid JSON.")
    ).toBeInTheDocument();
    expect(importEditorTemplate).not.toHaveBeenCalled();
    expect(importEditorRepositoryTemplate).not.toHaveBeenCalled();
  });

  it("shows backend validation errors on import failure without mutating unsaved editor text", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    importEditorTemplate.mockRejectedValue(
      new ApiRequestError({
        message: "Request failed: 400",
        status: 400,
        details: {
          validation: {
            errors: ["Unexpected endif in imported template."]
          },
          context_source: "sample:default"
        }
      })
    );

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, { target: { value: "Unsaved draft {{ activity.distance_miles }}" } });
    const file = new File(
      [
        JSON.stringify({
          template: "{% endif %}",
          name: "Invalid Template"
        })
      ],
      "invalid-import.json",
      { type: "application/json" }
    );
    fireEvent.change(screen.getByLabelText("Import Bundle File"), {
      target: { files: [file] }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Bundle" }));

    expect(await screen.findByText("Unexpected endif in imported template.")).toBeInTheDocument();
    expect(screen.getByLabelText("Template (Jinja)")).toHaveValue("Unsaved draft {{ activity.distance_miles }}");
    expect(screen.getByRole("combobox", { name: "Working Profile" })).toHaveTextContent("Default");
  });

  it("emits import and import-parse timing telemetry with sub-second p95 in tests", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorTemplateVersions.mockResolvedValue({
      status: "ok",
      versions: []
    });
    getEditorRepositoryTemplates.mockResolvedValue({
      status: "ok",
      templates: [],
      count: 0
    });
    importEditorTemplate.mockResolvedValue({
      status: "ok",
      profile_id: "default",
      context_source: "sample:default",
      validation: { valid: true, errors: [] },
      active: { template: "Imported {{ activity.distance_miles }}" }
    });

    const timings: Array<{ metric: string; duration_ms: number }> = [];
    const onTiming = (event: Event) => {
      const detail = (event as CustomEvent).detail as { metric?: string; duration_ms?: number };
      if (typeof detail?.metric === "string" && typeof detail?.duration_ms === "number") {
        timings.push({ metric: detail.metric, duration_ms: detail.duration_ms });
      }
    };
    window.addEventListener("chronicle:ui-timing", onTiming as EventListener);

    try {
      render(<BuildPage />);
      await screen.findByLabelText("Template (Jinja)");

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const bundleFile = new File(
          [
            JSON.stringify({
              template: `Imported ${attempt} {{ activity.distance_miles }}`,
              name: `Imported ${attempt}`
            })
          ],
          `import-${attempt}.json`,
          { type: "application/json" }
        );
        fireEvent.change(screen.getByLabelText("Import Bundle File"), {
          target: { files: [bundleFile] }
        });
        fireEvent.click(screen.getByRole("button", { name: "Import Bundle" }));

        await waitFor(() => {
          expect(timings.filter((timing) => timing.metric === "template.import").length).toBeGreaterThan(attempt);
        });
        await waitFor(() => {
          expect(timings.filter((timing) => timing.metric === "template.import.parse").length).toBeGreaterThan(attempt);
        });
      }
    } finally {
      window.removeEventListener("chronicle:ui-timing", onTiming as EventListener);
    }

    const importDurations = timings.filter((timing) => timing.metric === "template.import").map((timing) => timing.duration_ms);
    const parseDurations = timings
      .filter((timing) => timing.metric === "template.import.parse")
      .map((timing) => timing.duration_ms);
    expect(importDurations.length).toBeGreaterThanOrEqual(20);
    expect(parseDurations.length).toBeGreaterThanOrEqual(20);
    expect(p95(importDurations)).toBeLessThan(1000);
    expect(p95(parseDurations)).toBeLessThan(1000);
  });

  it("validates template and shows success feedback without saving", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [
        {
          id: "default-filter",
          category: "filters",
          label: "Default Fallback",
          template: "{{ value | default('N/A') }}",
          description: "Provide fallback."
        }
      ],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    validateEditorTemplate.mockResolvedValue({
      status: "ok",
      has_context: true,
      context_source: "sample:default",
      validation: { valid: true, errors: [], warnings: [] }
    });

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, {
      target: { value: "Updated {{ activity.distance_miles }}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate Template" }));

    await waitFor(() => {
      expect(validateEditorTemplate).toHaveBeenCalledWith({
        template: "Updated {{ activity.distance_miles }}",
        profile_id: "default"
      });
    });
    expect(saveEditorTemplate).not.toHaveBeenCalled();
    expect(await screen.findByText("Template validation passed.")).toBeInTheDocument();
  });

  it("shows validation errors with jinja hint snippets and preserves editor text", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [
        {
          id: "if-block",
          category: "logic",
          label: "If Present Block",
          template: "{% if value %}\n{{ value }}\n{% endif %}",
          description: "Render when value exists."
        }
      ],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    validateEditorTemplate.mockResolvedValue({
      status: "error",
      has_context: true,
      context_source: "sample:default",
      validation: {
        valid: false,
        errors: ["Unexpected end of template block."],
        warnings: []
      }
    });

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, {
      target: { value: "{% if activity.distance_miles %}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate Template" }));

    const validationErrorMatches = await screen.findAllByText("Unexpected end of template block.");
    expect(validationErrorMatches.length).toBeGreaterThan(0);
    expect(screen.getByText("If Present Block")).toBeInTheDocument();
    expect(screen.getByLabelText("Template (Jinja)")).toHaveValue("{% if activity.distance_miles %}");
    expect(saveEditorTemplate).not.toHaveBeenCalled();
  });

  it("shows fallback jinja hints when snippets are unavailable", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockRejectedValue(new Error("Snippets unavailable"));
    validateEditorTemplate.mockResolvedValue({
      status: "error",
      has_context: true,
      context_source: "sample:default",
      validation: {
        valid: false,
        errors: ["Unexpected end of template block."],
        warnings: []
      }
    });

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, {
      target: { value: "{% if activity.distance_miles %}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate Template" }));

    expect(await screen.findByText("Conditional Block")).toBeInTheDocument();
    expect(
      screen.getByText("Showing built-in hint examples while snippet library is unavailable.")
    ).toBeInTheDocument();
  });

  it("links template field help and validation content via aria-describedby", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    validateEditorTemplate.mockResolvedValue({
      status: "error",
      has_context: true,
      context_source: "sample:default",
      validation: {
        valid: false,
        errors: ["Unexpected end of template block."],
        warnings: []
      }
    });

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    expect(editor).toHaveAttribute("aria-describedby", expect.stringContaining("template-editor-help"));

    fireEvent.click(screen.getByRole("button", { name: "Validate Template" }));
    const validationErrorMatches = await screen.findAllByText("Unexpected end of template block.");
    expect(validationErrorMatches.length).toBeGreaterThan(0);

    const describedBy = screen.getByLabelText("Template (Jinja)").getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("template-validation-errors");
    expect(describedBy).toContain("template-validation-hints");
  });

  it("shows rejected validation details and context from ApiRequestError payload", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    validateEditorTemplate.mockRejectedValue(
      new ApiRequestError({
        message: "Request failed: 400",
        status: 400,
        details: {
          validation: {
            errors: ["Missing endif tag."]
          },
          context_source: "latest:activity"
        }
      })
    );

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.click(screen.getByRole("button", { name: "Validate Template" }));

    expect(await screen.findByText("Request failed: 400")).toBeInTheDocument();
    expect(screen.getByText("Missing endif tag.")).toBeInTheDocument();
    expect(screen.getByText("Validation context: latest:activity")).toBeInTheDocument();
  });

  it("renders validation warnings and updates aria-describedby for warning content", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    validateEditorTemplate.mockResolvedValue({
      status: "ok",
      has_context: true,
      context_source: "sample:default",
      validation: {
        valid: true,
        errors: [],
        warnings: ["Unused variable: activity.foo"]
      }
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.click(screen.getByRole("button", { name: "Validate Template" }));

    expect(await screen.findByText("Template validation passed.")).toBeInTheDocument();
    expect(screen.getByText("Unused variable: activity.foo")).toBeInTheDocument();

    const describedBy = screen.getByLabelText("Template (Jinja)").getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("template-validation-warnings");
    expect(describedBy).not.toContain("template-validation-errors");
    expect(describedBy).not.toContain("template-validation-hints");
  });

  it("emits validation timing telemetry with sub-second durations in tests", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Original {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    validateEditorTemplate.mockResolvedValue({
      status: "ok",
      has_context: true,
      context_source: "sample:default",
      validation: { valid: true, errors: [], warnings: [] }
    });

    const timings: Array<{ metric: string; duration_ms: number }> = [];
    const onTiming = (event: Event) => {
      const detail = (event as CustomEvent).detail as { metric?: string; duration_ms?: number };
      if (typeof detail?.metric === "string" && typeof detail?.duration_ms === "number") {
        timings.push({ metric: detail.metric, duration_ms: detail.duration_ms });
      }
    };
    window.addEventListener("chronicle:ui-timing", onTiming as EventListener);

    try {
      render(<BuildPage />);

      await screen.findByLabelText("Template (Jinja)");
      const validateButton = screen.getByRole("button", { name: "Validate Template" });
      for (let attempt = 0; attempt < 20; attempt += 1) {
        fireEvent.click(validateButton);
        await waitFor(() => {
          expect(timings.filter((timing) => timing.metric === "template.validate").length).toBeGreaterThan(attempt);
        });
      }
    } finally {
      window.removeEventListener("chronicle:ui-timing", onTiming as EventListener);
    }

    const durations = timings.filter((timing) => timing.metric === "template.validate").map((timing) => timing.duration_ms);
    expect(durations.length).toBeGreaterThanOrEqual(20);
    expect(p95(durations)).toBeLessThan(1000);
  });

  it("previews template with sample fixture context and keeps editor state", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorFixtures.mockResolvedValue({
      status: "ok",
      fixtures: [
        { name: "default", label: "Default", description: "Default fixture." },
        { name: "winter_grind", label: "Winter Grind", description: "Cold weather run." }
      ]
    });
    previewEditorTemplate.mockResolvedValue({
      status: "ok",
      profile_id: "default",
      context_source: "sample:winter_grind",
      preview: "Miles 7.2",
      length: 9
    });

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, { target: { value: "Miles {{ activity.distance_miles }}" } });

    fireEvent.mouseDown(screen.getByLabelText("Sample Fixture"));
    fireEvent.click(await screen.findByRole("option", { name: "Winter Grind" }));

    fireEvent.click(screen.getByRole("button", { name: "Preview Template" }));

    await waitFor(() => {
      expect(previewEditorTemplate).toHaveBeenCalledWith({
        template: "Miles {{ activity.distance_miles }}",
        context_mode: "sample",
        fixture_name: "winter_grind",
        profile_id: "default"
      });
    });
    expect(saveEditorTemplate).not.toHaveBeenCalled();
    expect(await screen.findByText("Preview generated.")).toBeInTheDocument();
    expect(screen.getByText("Miles 7.2")).toBeInTheDocument();
    expect(screen.getByText("Preview context: sample:winter_grind")).toBeInTheDocument();
    expect(screen.getByLabelText("Template (Jinja)")).toHaveValue("Miles {{ activity.distance_miles }}");
  });

  it("previews template with latest context without fixture parameter", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    previewEditorTemplate.mockResolvedValue({
      status: "ok",
      profile_id: "default",
      context_source: "latest",
      preview: "Miles 8.1",
      length: 9
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.mouseDown(screen.getByLabelText("Preview Context"));
    fireEvent.click(await screen.findByRole("option", { name: "Latest activity" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview Template" }));

    await waitFor(() => {
      expect(previewEditorTemplate).toHaveBeenCalledWith({
        template: "Miles {{ activity.distance_miles }}",
        context_mode: "latest",
        profile_id: "default"
      });
    });
    expect(await screen.findByText("Miles 8.1")).toBeInTheDocument();
  });

  it("shows preview errors clearly when preview fails", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    previewEditorTemplate.mockRejectedValue(
      new ApiRequestError({
        message: "No template context is available yet. Run one update cycle first.",
        status: 404
      })
    );

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.mouseDown(screen.getByLabelText("Preview Context"));
    fireEvent.click(await screen.findByRole("option", { name: "Latest activity" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview Template" }));

    expect(
      await screen.findByText("No template context is available yet. Run one update cycle first.")
    ).toBeInTheDocument();
  });

  it("falls back to latest preview mode and warns when sample fixtures are unavailable", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorFixtures.mockRejectedValue(new Error("Fixtures unavailable"));
    previewEditorTemplate.mockResolvedValue({
      status: "ok",
      profile_id: "default",
      context_source: "latest",
      preview: "Miles 8.4",
      length: 9
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    expect(
      await screen.findByText("Sample fixtures unavailable; preview currently supports latest activity context only.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preview Template" }));

    await waitFor(() => {
      expect(previewEditorTemplate).toHaveBeenCalledWith({
        template: "Miles {{ activity.distance_miles }}",
        context_mode: "latest",
        profile_id: "default"
      });
    });
    expect(await screen.findByText("Miles 8.4")).toBeInTheDocument();
  });

  it("switches profiles and restores unsaved draft text per profile", async () => {
    getEditorProfiles
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "default",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true }
        ]
      })
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "trail",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true }
        ]
      })
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "default",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true }
        ]
      });
    getEditorTemplate
      .mockResolvedValueOnce({
        status: "ok",
        template: "Default {{ activity.distance_miles }}",
        profile_id: "default"
      })
      .mockResolvedValueOnce({
        status: "ok",
        template: "Trail {{ activity.distance_miles }}",
        profile_id: "trail"
      })
      .mockResolvedValueOnce({
        status: "ok",
        template: "Default {{ activity.distance_miles }}",
        profile_id: "default"
      });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    setEditorWorkingProfile
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "trail",
        profile: { profile_id: "trail", label: "Trail", enabled: true }
      })
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "default",
        profile: { profile_id: "default", label: "Default", enabled: true }
      });

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, {
      target: { value: "Default unsaved {{ activity.distance_miles }}" }
    });

    fireEvent.mouseDown(screen.getByLabelText("Working Profile"));
    fireEvent.click(await screen.findByRole("option", { name: /Trail/ }));

    await waitFor(() => {
      expect(setEditorWorkingProfile).toHaveBeenCalledWith({
        profile_id: "trail"
      });
    });
    expect(await screen.findByRole("combobox", { name: "Working Profile" })).toHaveTextContent("Trail");
    expect(screen.getByLabelText("Template (Jinja)")).toHaveValue("Trail {{ activity.distance_miles }}");

    fireEvent.change(screen.getByLabelText("Template (Jinja)"), {
      target: { value: "Trail unsaved {{ activity.distance_miles }}" }
    });

    fireEvent.mouseDown(screen.getByLabelText("Working Profile"));
    fireEvent.click(await screen.findByRole("option", { name: /Default/ }));

    await waitFor(() => {
      expect(setEditorWorkingProfile).toHaveBeenCalledWith({
        profile_id: "default"
      });
    });
    expect(await screen.findByRole("combobox", { name: "Working Profile" })).toHaveTextContent("Default");
    expect(screen.getByLabelText("Template (Jinja)")).toHaveValue("Default unsaved {{ activity.distance_miles }}");
  });

  it("shows actionable feedback when working profile switch fails", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Default {{ activity.distance_miles }}",
      profile_id: "default"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    setEditorWorkingProfile.mockRejectedValue(
      new ApiRequestError({
        message: "Profile is disabled: trail",
        status: 400
      })
    );

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.mouseDown(screen.getByLabelText("Working Profile"));
    fireEvent.click(await screen.findByRole("option", { name: /Trail/ }));

    expect(await screen.findByText("Profile is disabled: trail")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Working Profile" })).toHaveTextContent("Default");
    expect(screen.getByLabelText("Template (Jinja)")).toHaveValue("Default {{ activity.distance_miles }}");
  });

  it("keeps current profile/editor state when profile switch reload fails", async () => {
    getEditorProfiles
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "default",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true }
        ]
      })
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "trail",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true }
        ]
      });
    getEditorTemplate
      .mockResolvedValueOnce({
        status: "ok",
        template: "Default {{ activity.distance_miles }}",
        profile_id: "default"
      })
      .mockRejectedValueOnce(new Error("Unable to load selected profile template."));
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    setEditorWorkingProfile.mockResolvedValue({
      status: "ok",
      working_profile_id: "trail",
      profile: { profile_id: "trail", label: "Trail", enabled: true }
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.mouseDown(screen.getByLabelText("Working Profile"));
    fireEvent.click(await screen.findByRole("option", { name: /Trail/ }));

    expect(await screen.findByText("Unable to load selected profile template.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Working Profile" })).toHaveTextContent("Default");
    expect(screen.getByLabelText("Template (Jinja)")).toHaveValue("Default {{ activity.distance_miles }}");
  });

  it("emits profile load and profile switch timing telemetry with sub-second p95 in tests", async () => {
    let currentWorkingProfileId = "default";
    getEditorProfiles.mockImplementation(async () => ({
      status: "ok",
      working_profile_id: currentWorkingProfileId,
      profiles: [
        { profile_id: "default", label: "Default", enabled: true },
        { profile_id: "trail", label: "Trail", enabled: true }
      ]
    }));
    setEditorWorkingProfile.mockImplementation(async ({ profile_id }: { profile_id: string }) => {
      currentWorkingProfileId = profile_id;
      return {
        status: "ok",
        working_profile_id: profile_id,
        profile: {
          profile_id,
          label: profile_id === "trail" ? "Trail" : "Default",
          enabled: true
        }
      };
    });
    getEditorTemplate.mockImplementation(async (profileId?: string) => ({
      status: "ok",
      template:
        profileId === "trail"
          ? "Trail {{ activity.distance_miles }}"
          : "Default {{ activity.distance_miles }}",
      profile_id: profileId ?? currentWorkingProfileId
    }));
    getEditorTemplateVersions.mockResolvedValue({
      status: "ok",
      versions: []
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    const timings: Array<{ metric: string; duration_ms: number }> = [];
    const onTiming = (event: Event) => {
      const detail = (event as CustomEvent).detail as { metric?: string; duration_ms?: number };
      if (typeof detail?.metric === "string" && typeof detail?.duration_ms === "number") {
        timings.push({ metric: detail.metric, duration_ms: detail.duration_ms });
      }
    };
    window.addEventListener("chronicle:ui-timing", onTiming as EventListener);

    try {
      render(<BuildPage />);
      await screen.findByLabelText("Template (Jinja)");

      await waitFor(() => {
        expect(timings.some((timing) => timing.metric === "template.profiles.load")).toBe(true);
      });

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const targetProfileName = attempt % 2 === 0 ? /Trail/ : /Default/;
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Working Profile" }));
        fireEvent.click(await screen.findByRole("option", { name: targetProfileName }));
        await waitFor(() => {
          expect(timings.filter((timing) => timing.metric === "template.profile.switch").length).toBeGreaterThan(
            attempt
          );
        });
      }
    } finally {
      window.removeEventListener("chronicle:ui-timing", onTiming as EventListener);
    }

    const profileLoadDurations = timings
      .filter((timing) => timing.metric === "template.profiles.load")
      .map((timing) => timing.duration_ms);
    const profileSwitchDurations = timings
      .filter((timing) => timing.metric === "template.profile.switch")
      .map((timing) => timing.duration_ms);

    expect(profileLoadDurations.length).toBeGreaterThan(0);
    expect(profileSwitchDurations.length).toBeGreaterThanOrEqual(20);
    expect(p95(profileLoadDurations)).toBeLessThan(1000);
    expect(p95(profileSwitchDurations)).toBeLessThan(1000);
  });

  it("uses selected profile id for save, validate, preview, and rollback calls after profile switch", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    getEditorProfiles
      .mockResolvedValueOnce({
        status: "ok",
        working_profile_id: "default",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true }
        ]
      })
      .mockResolvedValue({
        status: "ok",
        working_profile_id: "trail",
        profiles: [
          { profile_id: "default", label: "Default", enabled: true },
          { profile_id: "trail", label: "Trail", enabled: true }
        ]
      });
    getEditorTemplate
      .mockResolvedValueOnce({
        status: "ok",
        template: "Default {{ activity.distance_miles }}",
        profile_id: "default",
        current_version: { version_id: "ver-default-active" }
      })
      .mockResolvedValueOnce({
        status: "ok",
        template: "Trail {{ activity.distance_miles }}",
        profile_id: "trail",
        current_version: { version_id: "ver-trail-active" }
      })
      .mockResolvedValue({
        status: "ok",
        template: "Trail restored {{ activity.distance_miles }}",
        profile_id: "trail",
        current_version: { version_id: "ver-trail-prev" }
      });
    getEditorTemplateVersions
      .mockResolvedValueOnce({
        status: "ok",
        versions: [
          { version_id: "ver-default-active", operation: "save", created_at_utc: "2026-02-27T10:00:00+00:00" }
        ]
      })
      .mockResolvedValueOnce({
        status: "ok",
        versions: [
          { version_id: "ver-trail-active", operation: "save", created_at_utc: "2026-02-27T10:00:00+00:00" },
          { version_id: "ver-trail-prev", operation: "save", created_at_utc: "2026-02-27T09:00:00+00:00" }
        ]
      })
      .mockResolvedValue({
        status: "ok",
        versions: [
          { version_id: "ver-trail-prev", operation: "rollback", created_at_utc: "2026-02-27T10:05:00+00:00" },
          { version_id: "ver-trail-active", operation: "save", created_at_utc: "2026-02-27T10:00:00+00:00" }
        ]
      });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    setEditorWorkingProfile.mockResolvedValue({
      status: "ok",
      working_profile_id: "trail",
      profile: { profile_id: "trail", label: "Trail", enabled: true }
    });
    saveEditorTemplate.mockResolvedValue({
      status: "ok",
      active: { template: "Trail edited {{ activity.distance_miles }}" }
    });
    validateEditorTemplate.mockResolvedValue({
      status: "ok",
      has_context: true,
      context_source: "sample:default",
      validation: { valid: true, errors: [], warnings: [] }
    });
    previewEditorTemplate.mockResolvedValue({
      status: "ok",
      profile_id: "trail",
      context_source: "sample:default",
      preview: "Trail preview",
      length: 12
    });
    rollbackEditorTemplate.mockResolvedValue({
      status: "ok",
      profile_id: "trail",
      saved_version: { version_id: "ver-trail-prev" },
      active: { template: "Trail restored {{ activity.distance_miles }}" }
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.mouseDown(screen.getByLabelText("Working Profile"));
    fireEvent.click(await screen.findByRole("option", { name: /Trail/ }));
    await waitFor(() => {
      expect(setEditorWorkingProfile).toHaveBeenCalledWith({
        profile_id: "trail"
      });
    });

    fireEvent.change(screen.getByLabelText("Template (Jinja)"), {
      target: { value: "Trail edited {{ activity.distance_miles }}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Template" }));
    await waitFor(() => {
      expect(saveEditorTemplate).toHaveBeenCalledWith({
        template: "Trail edited {{ activity.distance_miles }}",
        source: "editor-ui",
        profile_id: "trail"
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Validate Template" }));
    await waitFor(() => {
      expect(validateEditorTemplate).toHaveBeenCalledWith({
        template: "Trail edited {{ activity.distance_miles }}",
        profile_id: "trail"
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview Template" }));
    await waitFor(() => {
      expect(previewEditorTemplate).toHaveBeenCalledWith({
        template: "Trail edited {{ activity.distance_miles }}",
        context_mode: "sample",
        profile_id: "trail",
        fixture_name: "default"
      });
    });

    const rollbackButton = await screen.findByRole("button", { name: "Roll Back to ver-trail-prev" });
    fireEvent.click(rollbackButton);
    await waitFor(() => {
      expect(rollbackEditorTemplate).toHaveBeenCalledWith({
        version_id: "ver-trail-prev",
        source: "editor-ui-rollback",
        profile_id: "trail"
      });
    });
    expect(confirmSpy).toHaveBeenCalled();
  });

  it("shows preview render failure errors clearly", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    previewEditorTemplate.mockRejectedValue(
      new ApiRequestError({
        message: "Template render failed: undefined variable activity.foo",
        status: 400
      })
    );

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    fireEvent.click(screen.getByRole("button", { name: "Preview Template" }));

    expect(await screen.findByText("Template render failed: undefined variable activity.foo")).toBeInTheDocument();
  });

  it("emits preview timing telemetry with sub-second p95 durations in tests", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    previewEditorTemplate.mockResolvedValue({
      status: "ok",
      profile_id: "default",
      context_source: "sample:default",
      preview: "Miles 7.2",
      length: 9
    });

    const timings: Array<{ metric: string; duration_ms: number }> = [];
    const onTiming = (event: Event) => {
      const detail = (event as CustomEvent).detail as { metric?: string; duration_ms?: number };
      if (typeof detail?.metric === "string" && typeof detail?.duration_ms === "number") {
        timings.push({ metric: detail.metric, duration_ms: detail.duration_ms });
      }
    };
    window.addEventListener("chronicle:ui-timing", onTiming as EventListener);

    try {
      render(<BuildPage />);

      await screen.findByLabelText("Template (Jinja)");
      const previewButton = screen.getByRole("button", { name: "Preview Template" });
      for (let attempt = 0; attempt < 20; attempt += 1) {
        fireEvent.click(previewButton);
        await waitFor(() => {
          expect(timings.filter((timing) => timing.metric === "template.preview").length).toBeGreaterThan(attempt);
        });
      }
    } finally {
      window.removeEventListener("chronicle:ui-timing", onTiming as EventListener);
    }

    const durations = timings.filter((timing) => timing.metric === "template.preview").map((timing) => timing.duration_ms);
    expect(durations.length).toBeGreaterThanOrEqual(20);
    expect(p95(durations)).toBeLessThan(1000);
  });

  it("disables save, validate, and reload actions while preview is in progress", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    let resolvePreview: ((value: unknown) => void) | undefined;
    previewEditorTemplate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreview = resolve;
        })
    );

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, {
      target: { value: "Miles {{ activity.distance_miles }} (edited)" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview Template" }));

    expect(screen.getByRole("button", { name: "Save Template" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Validate Template" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload Template" })).toBeDisabled();

    resolvePreview?.({
      status: "ok",
      context_source: "sample:default",
      preview: "Miles 7.2",
      length: 9
    });
    expect(await screen.findByText("Preview generated.")).toBeInTheDocument();
  });

  it("ignores stale preview completion after editor input changes", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}"
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    let resolvePreview: ((value: unknown) => void) | undefined;
    previewEditorTemplate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreview = resolve;
        })
    );

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.click(screen.getByRole("button", { name: "Preview Template" }));
    fireEvent.change(editor, {
      target: { value: "Updated while preview pending" }
    });

    resolvePreview?.({
      status: "ok",
      context_source: "sample:default",
      preview: "Stale preview result",
      length: 19
    });

    await waitFor(() => {
      expect(screen.queryByText("Preview generated.")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Stale preview result")).not.toBeInTheDocument();
  });

  it("renders template version history and marks active version", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      current_version: { version_id: "ver-active" }
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorTemplateVersions.mockResolvedValue({
      status: "ok",
      versions: [
        { version_id: "ver-active", operation: "save", created_at_utc: "2026-02-27T10:00:00+00:00" },
        { version_id: "ver-prev-1", operation: "save", created_at_utc: "2026-02-27T09:00:00+00:00" }
      ]
    });

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    expect(await screen.findByText("Template Version History")).toBeInTheDocument();
    expect(screen.getByText("Version: ver-active (Active)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Roll Back to ver-prev-1" })).toBeInTheDocument();
  });

  it("warns when template version history is unavailable and disables rollback actions", async () => {
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      current_version: { version_id: "ver-active" }
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorTemplateVersions.mockRejectedValue(new Error("Versions unavailable"));

    render(<BuildPage />);

    await screen.findByLabelText("Template (Jinja)");
    expect(
      await screen.findByText("Template version history unavailable; rollback is currently disabled.")
    ).toBeInTheDocument();
    expect(screen.getByText("No saved template versions available yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Roll Back to/i })).not.toBeInTheDocument();
  });

  it("rolls back to a selected template version and refreshes active metadata", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    getEditorTemplate
      .mockResolvedValueOnce({
        status: "ok",
        template: "Miles {{ activity.distance_miles }}",
        current_version: { version_id: "ver-active" }
      })
      .mockResolvedValueOnce({
        status: "ok",
        template: "Restored {{ activity.distance_miles }}",
        current_version: { version_id: "ver-prev-1" }
      });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorTemplateVersions
      .mockResolvedValueOnce({
        status: "ok",
        versions: [
          { version_id: "ver-active", operation: "save", created_at_utc: "2026-02-27T10:00:00+00:00" },
          { version_id: "ver-prev-1", operation: "save", created_at_utc: "2026-02-27T09:00:00+00:00" }
        ]
      })
      .mockResolvedValueOnce({
        status: "ok",
        versions: [
          { version_id: "ver-prev-1", operation: "rollback", created_at_utc: "2026-02-27T10:05:00+00:00" },
          { version_id: "ver-active", operation: "save", created_at_utc: "2026-02-27T10:00:00+00:00" }
        ]
      });
    rollbackEditorTemplate.mockResolvedValue({
      status: "ok",
      saved_version: { version_id: "ver-prev-1" },
      active: { template: "Restored {{ activity.distance_miles }}" }
    });

    render(<BuildPage />);

    await screen.findByRole("button", { name: "Roll Back to ver-prev-1" });
    fireEvent.click(screen.getByRole("button", { name: "Roll Back to ver-prev-1" }));

    await waitFor(() => {
      expect(rollbackEditorTemplate).toHaveBeenCalledWith({
        version_id: "ver-prev-1",
        source: "editor-ui-rollback",
        profile_id: "default"
      });
    });
    expect(confirmSpy).toHaveBeenCalled();
    expect(await screen.findByText("Template rolled back.")).toBeInTheDocument();
    expect(screen.getByText("Version: ver-prev-1 (Active)")).toBeInTheDocument();
  });

  it("does not roll back when user cancels unsaved-change confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      current_version: { version_id: "ver-active" }
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorTemplateVersions.mockResolvedValue({
      status: "ok",
      versions: [
        { version_id: "ver-active", operation: "save", created_at_utc: "2026-02-27T10:00:00+00:00" },
        { version_id: "ver-prev-1", operation: "save", created_at_utc: "2026-02-27T09:00:00+00:00" }
      ]
    });

    render(<BuildPage />);

    const editor = await screen.findByLabelText("Template (Jinja)");
    fireEvent.change(editor, {
      target: { value: "Unsaved local change {{ activity.distance_miles }}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Roll Back to ver-prev-1" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(rollbackEditorTemplate).not.toHaveBeenCalled();
  });

  it("shows rollback errors clearly when rollback fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      current_version: { version_id: "ver-active" }
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorTemplateVersions.mockResolvedValue({
      status: "ok",
      versions: [
        { version_id: "ver-active", operation: "save", created_at_utc: "2026-02-27T10:00:00+00:00" },
        { version_id: "ver-prev-1", operation: "save", created_at_utc: "2026-02-27T09:00:00+00:00" }
      ]
    });
    rollbackEditorTemplate.mockRejectedValue(
      new ApiRequestError({
        message: "Unknown template version: ver-prev-1",
        status: 400
      })
    );

    render(<BuildPage />);

    await screen.findByRole("button", { name: "Roll Back to ver-prev-1" });
    fireEvent.click(screen.getByRole("button", { name: "Roll Back to ver-prev-1" }));

    expect(await screen.findByText("Unknown template version: ver-prev-1")).toBeInTheDocument();
  });

  it("surfaces refresh failure when rollback succeeds but active template reload fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    getEditorTemplate
      .mockResolvedValueOnce({
        status: "ok",
        template: "Miles {{ activity.distance_miles }}",
        current_version: { version_id: "ver-active" }
      })
      .mockRejectedValueOnce(new Error("Unable to reload template after rollback."));
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorTemplateVersions.mockResolvedValue({
      status: "ok",
      versions: [
        { version_id: "ver-active", operation: "save", created_at_utc: "2026-02-27T10:00:00+00:00" },
        { version_id: "ver-prev-1", operation: "save", created_at_utc: "2026-02-27T09:00:00+00:00" }
      ]
    });
    rollbackEditorTemplate.mockResolvedValue({
      status: "ok",
      saved_version: { version_id: "ver-prev-1" },
      active: { template: "Restored {{ activity.distance_miles }}" }
    });

    render(<BuildPage />);

    await screen.findByRole("button", { name: "Roll Back to ver-prev-1" });
    fireEvent.click(screen.getByRole("button", { name: "Roll Back to ver-prev-1" }));

    await waitFor(() => {
      expect(rollbackEditorTemplate).toHaveBeenCalledWith({
        version_id: "ver-prev-1",
        source: "editor-ui-rollback",
        profile_id: "default"
      });
    });
    expect(await screen.findByText("Unable to reload template after rollback.")).toBeInTheDocument();
    expect(screen.queryByText("Template rolled back.")).not.toBeInTheDocument();
  });

  it("emits rollback timing telemetry with sub-second p95 durations in tests", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    getEditorTemplate.mockResolvedValue({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      current_version: { version_id: "ver-active" }
    });
    getEditorSnippets.mockResolvedValue({
      status: "ok",
      snippets: [],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });
    getEditorTemplateVersions.mockResolvedValue({
      status: "ok",
      versions: [
        { version_id: "ver-active", operation: "save", created_at_utc: "2026-02-27T10:00:00+00:00" },
        { version_id: "ver-prev-1", operation: "save", created_at_utc: "2026-02-27T09:00:00+00:00" }
      ]
    });
    rollbackEditorTemplate.mockResolvedValue({
      status: "ok",
      saved_version: { version_id: "ver-prev-1" },
      active: { template: "Restored {{ activity.distance_miles }}" }
    });

    const timings: Array<{ metric: string; duration_ms: number }> = [];
    const onTiming = (event: Event) => {
      const detail = (event as CustomEvent).detail as { metric?: string; duration_ms?: number };
      if (typeof detail?.metric === "string" && typeof detail?.duration_ms === "number") {
        timings.push({ metric: detail.metric, duration_ms: detail.duration_ms });
      }
    };
    window.addEventListener("chronicle:ui-timing", onTiming as EventListener);

    try {
      render(<BuildPage />);
      const rollbackButton = await screen.findByRole("button", { name: "Roll Back to ver-prev-1" });

      for (let attempt = 0; attempt < 20; attempt += 1) {
        fireEvent.click(rollbackButton);
        await waitFor(() => {
          expect(timings.filter((timing) => timing.metric === "template.rollback").length).toBeGreaterThan(attempt);
        });
      }
    } finally {
      window.removeEventListener("chronicle:ui-timing", onTiming as EventListener);
    }

    const durations = timings.filter((timing) => timing.metric === "template.rollback").map((timing) => timing.duration_ms);
    expect(durations.length).toBeGreaterThanOrEqual(20);
    expect(p95(durations)).toBeLessThan(1000);
  });
});
