"use client";

const TOKEN_KEY = "gisc_token";

// Custom event name dispatched whenever the token changes in the current
// tab. The `storage` event only fires in *other* tabs, so components that
// subscribe to auth state (nav, admin layout guard) listen to this event
// too for same-tab login/logout reactivity.
export const AUTH_CHANGE_EVENT = "gisc:auth-change";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isTokenExpired(token)) {
    localStorage.removeItem(TOKEN_KEY);
    notifyAuthChange();
    return null;
  }
  return token;
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  notifyAuthChange();
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  notifyAuthChange();
}

export function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// NOTE: this inspects the `exp` claim without verifying the JWT signature.
// It is safe for client-side UX (auto-logout on stale tokens), but must
// never be used for authorization — the backend validates every request.
export function isTokenExpired(token: string): boolean {
  const claims = parseJwt(token);
  const exp = claims?.exp;
  if (typeof exp !== "number") return false; // no exp claim -> treat as valid
  return Date.now() >= exp * 1000;
}

function notifyAuthChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
}

// Validate a `?next=` redirect target so attackers can't craft a login
// link that bounces the user to a third-party origin after auth. Only
// same-origin absolute paths are accepted.
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  // Reject protocol-relative URLs ("//evil.com"), backslash tricks
  // ("/\\evil.com"), and anything not starting with a single "/".
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return "/";
  }
  return next;
}
