interface ApiErrorEnvelope {
  status?: string;
  message?: string;
  error?:
    | string
    | {
        code?: string;
        message?: string;
        details?: unknown;
      };
  validation?: {
    valid?: boolean;
    errors?: unknown[];
    warnings?: unknown[];
  };
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(params: { message: string; status: number; code?: string; details?: unknown }) {
    super(params.message);
    this.name = "ApiRequestError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }
}

interface JsonRequestInit {
  method?: "GET" | "PUT" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function getJson<T>(path: string, init?: JsonRequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json"
  };
  const requestInit: RequestInit = {
    method: init?.method ?? "GET",
    headers
  };
  if (init?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestInit.body = JSON.stringify(init.body);
  }

  const response = await fetch(path, requestInit);

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    let errorCode: string | undefined;
    let errorDetails: unknown;
    try {
      const payload = (await response.json()) as ApiErrorEnvelope;
      const apiError = payload?.error;
      if (typeof apiError === "string") {
        if (apiError.trim().length > 0) {
          errorMessage = apiError;
        }
      } else if (apiError && typeof apiError === "object") {
        const apiMessage = apiError?.message;
        const apiCode = apiError?.code;
        errorCode = apiCode;
        errorDetails = apiError?.details;
        if (apiMessage && apiCode) {
          errorMessage = `${apiCode}: ${apiMessage}`;
        } else if (apiMessage) {
          errorMessage = apiMessage;
        }
      }
      if (errorMessage === `Request failed: ${response.status}`) {
        const validationErrors = payload?.validation?.errors;
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
          const firstError = validationErrors.find((item) => typeof item === "string" && item.trim().length > 0);
          if (typeof firstError === "string") {
            errorMessage = firstError;
            errorDetails = payload.validation;
          }
        } else if (typeof payload?.message === "string" && payload.message.trim().length > 0) {
          errorMessage = payload.message;
        }
      }
      if (errorDetails === undefined && payload && typeof payload === "object") {
        errorDetails = payload;
      }
    } catch {
      // Ignore non-JSON error payloads and keep status-based fallback.
    }
    throw new ApiRequestError({
      message: errorMessage,
      status: response.status,
      code: errorCode,
      details: errorDetails
    });
  }

  return (await response.json()) as T;
}
