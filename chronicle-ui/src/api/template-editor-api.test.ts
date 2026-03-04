import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEditorProfile,
  getEditorProfilesExport,
  getEditorRepositoryTemplateExport,
  getEditorRepositoryTemplates,
  getEditorProfiles,
  importEditorProfiles,
  importEditorRepositoryTemplate,
  importEditorTemplate,
  getEditorTemplateExport,
  getEditorFixtures,
  getEditorSnippets,
  previewEditorProfile,
  getEditorTemplate,
  getEditorTemplateVersions,
  previewEditorTemplate,
  rollbackEditorTemplate,
  saveEditorTemplate,
  setEditorWorkingProfile,
  updateEditorProfile,
  validateEditorTemplate
} from "./template-editor-api";

const getJson = vi.fn();

vi.mock("./http-client", () => ({
  getJson: (...args: unknown[]) => getJson(...args)
}));

describe("template editor api", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("loads active template from editor endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      template: "Miles {{ activity.distance_miles }}",
      profile_id: "default",
      name: "Default Template"
    });

    const result = await getEditorTemplate();

    expect(getJson).toHaveBeenCalledWith("/editor/template");
    expect(result.template).toContain("distance_miles");
  });

  it("loads active template for explicit profile when profile id is provided", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      template: "Trail {{ activity.distance_miles }}",
      profile_id: "trail"
    });

    await getEditorTemplate("trail");

    expect(getJson).toHaveBeenCalledWith("/editor/template?profile_id=trail");
  });

  it("encodes profile id query values", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      template: "Road {{ activity.distance_miles }}",
      profile_id: "road easy"
    });

    await getEditorTemplate("road easy/zone");

    expect(getJson).toHaveBeenCalledWith("/editor/template?profile_id=road%20easy%2Fzone");
  });

  it("saves template edits through put editor endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      profile_id: "default",
      active: {
        template: "Updated {{ activity.distance_miles }}"
      }
    });

    const result = await saveEditorTemplate({
      template: "Updated {{ activity.distance_miles }}",
      source: "editor-ui",
      context_mode: "latest_or_sample"
    });

    expect(getJson).toHaveBeenCalledWith("/editor/template", {
      method: "PUT",
      body: {
        template: "Updated {{ activity.distance_miles }}",
        source: "editor-ui",
        context_mode: "latest_or_sample"
      }
    });
    expect(result.status).toBe("ok");
  });

  it("validates template edits through post validate endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      has_context: true,
      context_source: "sample:default",
      validation: {
        valid: true,
        errors: []
      }
    });

    const result = await validateEditorTemplate({
      template: "Miles {{ activity.distance_miles }}",
      context_mode: "sample"
    });

    expect(getJson).toHaveBeenCalledWith("/editor/validate", {
      method: "POST",
      body: {
        template: "Miles {{ activity.distance_miles }}",
        context_mode: "sample"
      }
    });
    expect(result.status).toBe("ok");
  });

  it("passes optional validation context fields to validate endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      has_context: true,
      context_source: "fixture:tempo-run",
      validation: {
        valid: true,
        errors: []
      }
    });

    await validateEditorTemplate({
      template: "Miles {{ activity.distance_miles }}",
      context_mode: "fixture",
      fixture_name: "tempo-run",
      profile_id: "trail"
    });

    expect(getJson).toHaveBeenCalledWith("/editor/validate", {
      method: "POST",
      body: {
        template: "Miles {{ activity.distance_miles }}",
        context_mode: "fixture",
        fixture_name: "tempo-run",
        profile_id: "trail"
      }
    });
  });

  it("loads jinja snippets from editor snippets endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      snippets: [
        {
          id: "if-block",
          category: "logic",
          label: "If Present Block",
          template: "{% if value %}{{ value }}{% endif %}",
          description: "Render when value exists."
        }
      ],
      context_modes: ["latest", "sample", "latest_or_sample", "fixture"]
    });

    const result = await getEditorSnippets();

    expect(getJson).toHaveBeenCalledWith("/editor/snippets");
    expect(result.status).toBe("ok");
    expect(result.snippets[0]?.id).toBe("if-block");
  });

  it("previews template through post preview endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      profile_id: "default",
      context_source: "sample:default",
      preview: "Miles 7.2",
      length: 9
    });

    const result = await previewEditorTemplate({
      template: "Miles {{ activity.distance_miles }}",
      context_mode: "sample",
      fixture_name: "default",
      profile_id: "default"
    });

    expect(getJson).toHaveBeenCalledWith("/editor/preview", {
      method: "POST",
      body: {
        template: "Miles {{ activity.distance_miles }}",
        context_mode: "sample",
        fixture_name: "default",
        profile_id: "default"
      }
    });
    expect(result.status).toBe("ok");
    expect(result.preview).toContain("Miles");
  });

  it("previews latest context without optional fixture and profile fields", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      context_source: "latest",
      preview: "Miles 8.1",
      length: 9
    });

    await previewEditorTemplate({
      template: "Miles {{ activity.distance_miles }}",
      context_mode: "latest"
    });

    expect(getJson).toHaveBeenCalledWith("/editor/preview", {
      method: "POST",
      body: {
        template: "Miles {{ activity.distance_miles }}",
        context_mode: "latest"
      }
    });
  });

  it("previews which profile applies for selected context", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      context_source: "sample:strength_training",
      profile_match: {
        profile_id: "strength_training",
        profile_label: "Strength Training",
        reasons: ["sport_type=Workout"],
        criteria: {
          kind: "activity",
          description: "Strava sport type WeightTraining / Weight Training."
        }
      }
    });

    const result = await previewEditorProfile({
      context_mode: "sample",
      fixture_name: "strength_training"
    });

    expect(getJson).toHaveBeenCalledWith("/editor/profiles/preview", {
      method: "POST",
      body: {
        context_mode: "sample",
        fixture_name: "strength_training"
      }
    });
    expect(result.status).toBe("ok");
    expect(result.profile_match?.profile_id).toBe("strength_training");
  });

  it("loads available preview fixtures from editor fixtures endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      fixtures: [
        { name: "default", label: "Default", description: "Representative run." },
        { name: "winter_grind", label: "Winter Grind", description: "Cold weather run." }
      ]
    });

    const result = await getEditorFixtures();

    expect(getJson).toHaveBeenCalledWith("/editor/fixtures");
    expect(result.status).toBe("ok");
    expect(result.fixtures.length).toBeGreaterThan(1);
    expect(result.fixtures[0]?.name).toBe("default");
  });

  it("loads editor profiles with working profile metadata", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      working_profile_id: "default",
      profiles: [
        {
          profile_id: "default",
          label: "Default",
          enabled: true
        }
      ]
    });

    const result = await getEditorProfiles();

    expect(getJson).toHaveBeenCalledWith("/editor/profiles");
    expect(result.status).toBe("ok");
    expect(result.working_profile_id).toBe("default");
    expect(result.profiles[0]?.profile_id).toBe("default");
  });

  it("loads profile export bundle with selected profile ids", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      bundle_version: 1,
      exported_at_utc: "2026-03-03T12:00:00+00:00",
      working_profile_id: "trail",
      profiles: [
        {
          profile_id: "trail",
          label: "Trail",
          enabled: true,
          priority: 70,
          criteria: { kind: "activity", keywords: ["trail"] }
        }
      ]
    });

    const result = await getEditorProfilesExport({
      profile_ids: ["trail", "tempo focus", "trail"]
    });

    expect(getJson).toHaveBeenCalledWith("/editor/profiles/export?profile_id=trail&profile_id=tempo%20focus");
    expect(result.status).toBe("ok");
    expect(result.profiles[0]?.profile_id).toBe("trail");
  });

  it("imports profile bundle through profile import endpoint", async () => {
    getJson.mockResolvedValueOnce({
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

    const result = await importEditorProfiles({
      bundle: {
        bundle_version: 1,
        exported_at_utc: "2026-03-03T12:00:00+00:00",
        working_profile_id: "default",
        profiles: [
          {
            profile_id: "tempo_focus",
            label: "Tempo Focus",
            enabled: true,
            priority: 50,
            criteria: { kind: "activity", keywords: ["tempo"] }
          }
        ]
      }
    });

    expect(getJson).toHaveBeenCalledWith("/editor/profiles/import", {
      method: "POST",
      body: {
        bundle: {
          bundle_version: 1,
          exported_at_utc: "2026-03-03T12:00:00+00:00",
          working_profile_id: "default",
          profiles: [
            {
              profile_id: "tempo_focus",
              label: "Tempo Focus",
              enabled: true,
              priority: 50,
              criteria: { kind: "activity", keywords: ["tempo"] }
            }
          ]
        }
      }
    });
    expect(result.imported_count).toBe(1);
    expect(result.imported_profile_ids).toContain("tempo_focus");
  });

  it("updates working profile through post working profile endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      working_profile_id: "trail",
      profile: {
        profile_id: "trail",
        label: "Trail",
        enabled: true
      }
    });

    const result = await setEditorWorkingProfile({
      profile_id: "trail"
    });

    expect(getJson).toHaveBeenCalledWith("/editor/profiles/working", {
      method: "POST",
      body: {
        profile_id: "trail"
      }
    });
    expect(result.status).toBe("ok");
    expect(result.working_profile_id).toBe("trail");
    expect(result.profile?.profile_id).toBe("trail");
  });

  it("creates profile through post profiles endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      profile: {
        profile_id: "tempo_focus",
        label: "Tempo Focus",
        enabled: true,
        criteria: { kind: "activity", keywords: ["tempo"] }
      },
      working_profile_id: "default"
    });

    const result = await createEditorProfile({
      profile_id: "tempo_focus",
      label: "Tempo Focus",
      criteria: { kind: "activity", keywords: ["tempo"] }
    });

    expect(getJson).toHaveBeenCalledWith("/editor/profiles", {
      method: "POST",
      body: {
        profile_id: "tempo_focus",
        label: "Tempo Focus",
        criteria: { kind: "activity", keywords: ["tempo"] }
      }
    });
    expect(result.profile?.profile_id).toBe("tempo_focus");
  });

  it("updates profile through put profile endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      profile: {
        profile_id: "tempo_focus",
        label: "Tempo Builder",
        enabled: true,
        criteria: { kind: "activity", keywords: ["tempo", "threshold"] }
      },
      working_profile_id: "default"
    });

    const result = await updateEditorProfile("tempo_focus", {
      label: "Tempo Builder",
      criteria: { kind: "activity", keywords: ["tempo", "threshold"] }
    });

    expect(getJson).toHaveBeenCalledWith("/editor/profiles/tempo_focus", {
      method: "PUT",
      body: {
        label: "Tempo Builder",
        criteria: { kind: "activity", keywords: ["tempo", "threshold"] }
      }
    });
    expect(result.profile?.label).toBe("Tempo Builder");
  });

  it("updates profile enabled and priority through put profile endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      profile: {
        profile_id: "tempo_focus",
        label: "Tempo Builder",
        enabled: false,
        priority: 125
      },
      working_profile_id: "default"
    });

    const result = await updateEditorProfile("tempo_focus", {
      enabled: false,
      priority: 125
    });

    expect(getJson).toHaveBeenCalledWith("/editor/profiles/tempo_focus", {
      method: "PUT",
      body: {
        enabled: false,
        priority: 125
      }
    });
    expect(result.profile?.enabled).toBe(false);
    expect(result.profile?.priority).toBe(125);
  });

  it("rejects profile update when profile id is blank", async () => {
    await expect(
      updateEditorProfile("   ", {
        label: "Any Label",
        criteria: { kind: "activity" }
      })
    ).rejects.toThrow("profileId is required.");
    expect(getJson).not.toHaveBeenCalled();
  });

  it("loads template version history from editor template versions endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      versions: [
        {
          version_id: "ver-latest",
          operation: "save",
          created_at_utc: "2026-02-27T10:00:00+00:00"
        }
      ]
    });

    const result = await getEditorTemplateVersions();

    expect(getJson).toHaveBeenCalledWith("/editor/template/versions");
    expect(result.status).toBe("ok");
    expect(result.versions[0]?.version_id).toBe("ver-latest");
  });

  it("passes optional limit and profile id when loading template versions", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      profile_id: "trail",
      versions: []
    });

    await getEditorTemplateVersions({ limit: 15, profile_id: "trail easy/tempo" });

    expect(getJson).toHaveBeenCalledWith(
      "/editor/template/versions?limit=15&profile_id=trail%20easy%2Ftempo"
    );
  });

  it("rolls back template through post rollback endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      profile_id: "default",
      saved_version: {
        version_id: "ver-rollback"
      },
      active: {
        template: "Miles {{ activity.distance_miles }}",
        current_version: {
          version_id: "ver-rollback"
        }
      }
    });

    const result = await rollbackEditorTemplate({
      version_id: "ver-123",
      source: "editor-ui-rollback"
    });

    expect(getJson).toHaveBeenCalledWith("/editor/template/rollback", {
      method: "POST",
      body: {
        version_id: "ver-123",
        source: "editor-ui-rollback"
      }
    });
    expect(result.status).toBe("ok");
    expect(result.saved_version?.version_id).toBe("ver-rollback");
  });

  it("loads active template export bundle with profile and include_versions query", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      bundle_version: 1,
      exported_at_utc: "2026-02-27T11:10:00+00:00",
      profile_id: "trail",
      template: "Trail {{ activity.distance_miles }}",
      name: "Trail Template"
    });

    const result = await getEditorTemplateExport({
      profile_id: "trail",
      include_versions: true,
      limit: 25
    });

    expect(getJson).toHaveBeenCalledWith("/editor/template/export?profile_id=trail&include_versions=true&limit=25");
    expect(result.bundle_version).toBe(1);
    expect(result.profile_id).toBe("trail");
  });

  it("loads active template export bundle with encoded template id query", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      bundle_version: 2,
      exported_at_utc: "2026-02-27T11:10:00+00:00",
      template: "Trail {{ activity.distance_miles }}",
      name: "Trail Template"
    });

    await getEditorTemplateExport({
      template_id: "trail template/v2",
      include_versions: false
    });

    expect(getJson).toHaveBeenCalledWith(
      "/editor/template/export?template_id=trail%20template%2Fv2&include_versions=false"
    );
  });

  it("loads repository template catalog", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      templates: [
        {
          template_id: "t-1",
          name: "Tempo",
          author: "coach",
          description: "Tempo profile template"
        }
      ],
      count: 1
    });

    const result = await getEditorRepositoryTemplates();

    expect(getJson).toHaveBeenCalledWith("/editor/repository/templates");
    expect(result.status).toBe("ok");
    expect(result.templates[0]?.template_id).toBe("t-1");
  });

  it("loads repository template export by template id", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      bundle_version: 2,
      exported_at_utc: "2026-02-27T11:10:00+00:00",
      template_id: "tempo-1",
      template: "Tempo {{ activity.distance_miles }}",
      name: "Tempo"
    });

    const result = await getEditorRepositoryTemplateExport("tempo-1", {
      include_versions: true,
      limit: 10
    });

    expect(getJson).toHaveBeenCalledWith("/editor/repository/template/tempo-1/export?include_versions=true&limit=10");
    expect(result.template_id).toBe("tempo-1");
  });

  it("rejects repository template export when template id is blank", async () => {
    await expect(getEditorRepositoryTemplateExport("   ")).rejects.toThrow("templateId is required.");
    expect(getJson).not.toHaveBeenCalled();
  });

  it("imports template bundle to active profile through template import endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      profile_id: "trail",
      context_source: "sample:default",
      saved_version: {
        version_id: "ver-imported"
      },
      active: {
        template: "Imported {{ activity.distance_miles }}"
      },
      validation: {
        valid: true,
        errors: []
      }
    });

    const result = await importEditorTemplate({
      bundle: {
        template: "Imported {{ activity.distance_miles }}",
        name: "Imported Template",
        source: "shared-export"
      },
      context_mode: "sample",
      fixture_name: "default",
      profile_id: "trail",
      source: "editor-ui-import"
    });

    expect(getJson).toHaveBeenCalledWith("/editor/template/import", {
      method: "POST",
      body: {
        bundle: {
          template: "Imported {{ activity.distance_miles }}",
          name: "Imported Template",
          source: "shared-export"
        },
        context_mode: "sample",
        fixture_name: "default",
        profile_id: "trail",
        source: "editor-ui-import"
      }
    });
    expect(result.status).toBe("ok");
    expect(result.saved_version?.version_id).toBe("ver-imported");
  });

  it("imports template bundle into repository catalog through repository import endpoint", async () => {
    getJson.mockResolvedValueOnce({
      status: "ok",
      context_source: "sample:default",
      template_record: {
        template_id: "repo-import-1",
        name: "Imported Repo Template"
      },
      validation: {
        valid: true,
        errors: []
      }
    });

    const result = await importEditorRepositoryTemplate({
      bundle: {
        template: "Imported Repo {{ activity.distance_miles }}",
        name: "Imported Repo Template",
        source: "shared-export"
      },
      context_mode: "sample",
      fixture_name: "default",
      source: "editor-ui-repository-import"
    });

    expect(getJson).toHaveBeenCalledWith("/editor/repository/import", {
      method: "POST",
      body: {
        bundle: {
          template: "Imported Repo {{ activity.distance_miles }}",
          name: "Imported Repo Template",
          source: "shared-export"
        },
        context_mode: "sample",
        fixture_name: "default",
        source: "editor-ui-repository-import"
      }
    });
    expect(result.status).toBe("ok");
    expect(result.template_record?.template_id).toBe("repo-import-1");
  });
});
