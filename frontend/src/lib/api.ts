import { clearToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    // 401 from an authenticated request means the token was rejected
    // (expired, revoked, or the backend rotated its signing key). Clear
    // it so route guards redirect to login instead of letting the caller
    // keep rendering stale data. We only clear when a token was actually
    // sent — public endpoints can legitimately return 401 for other
    // reasons without implying the current session is bad.
    if (res.status === 401 && token) {
      clearToken();
    }
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string, token?: string, signal?: AbortSignal) =>
    request<T>(path, { token, signal }),
  post: <T>(path: string, body: unknown, token?: string, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", body, token, signal }),
  put: <T>(path: string, body: unknown, token?: string, signal?: AbortSignal) =>
    request<T>(path, { method: "PUT", body, token, signal }),
};

// AbortError is the standard signal cancellation. Callers that abort on
// unmount can use this to silently swallow canceled requests:
//   .catch((err) => { if (!isAbortError(err)) throw err; })
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
