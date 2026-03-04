import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, getJson } from "./http-client";

describe("http client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws ApiRequestError with status, code, and details from error envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: "INVALID_INPUT",
          message: "Bad request payload",
          details: { field: "name" }
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const requestPromise = getJson("/setup");
    await expect(requestPromise).rejects.toBeInstanceOf(ApiRequestError);
    await expect(requestPromise).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "INVALID_INPUT: Bad request payload",
      status: 400,
      code: "INVALID_INPUT",
      details: { field: "name" }
    });
  });

  it("falls back to status-based message for non-json errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error("non-json");
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson("/setup")).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "Request failed: 503",
      status: 503
    });
  });

  it("returns parsed json for successful responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson<{ ok: boolean }>("/setup")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/setup", {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });
  });

  it("uses plain error text when backend returns string error envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        status: "error",
        error: "Invalid or expired credentials."
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson("/setup/api/config")).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "Invalid or expired credentials.",
      status: 400
    });
  });

  it("uses validation details when backend omits error field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        status: "error",
        validation: {
          valid: false,
          errors: ["Unexpected end of template block."]
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson("/editor/template")).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "Unexpected end of template block.",
      status: 400,
      details: {
        valid: false,
        errors: ["Unexpected end of template block."]
      }
    });
  });
});
