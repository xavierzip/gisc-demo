import { APIRequestContext, Page, expect, request } from "@playwright/test";

const API = "http://localhost/api";

/** Tag applied to every event created by the E2E test suite. The global
 * teardown and per-test afterEach use this to find and hard-delete test
 * fixtures so they don't accumulate in the demo database across runs.
 */
export const E2E_TAG = "e2e-test";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASS = "admin123";

/** Register a new user via API and return the JWT token. */
export async function registerUser(
  page: Page,
  email: string,
  password: string,
  fullName: string
): Promise<string> {
  const res = await page.request.post(`${API}/auth/register`, {
    data: { email, password, full_name: fullName },
  });
  // 201 = new, 409 = already exists (login instead)
  if (res.status() === 409) {
    return loginUser(page, email, password);
  }
  const body = await res.json();
  return body.token;
}

/** Login via API and return the JWT token. */
export async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<string> {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.token;
}

/** Set JWT token in localStorage so the app recognises the user. */
export async function setAuthToken(page: Page, token: string) {
  await page.evaluate((t) => localStorage.setItem("gisc_token", t), token);
}

/** Login via the UI login form. */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string
) {
  await page.goto("/login");
  await page.fill('input[placeholder="Email"]', email);
  await page.fill('input[placeholder="Password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
}

// --- E2E fixture cleanup ---

interface EventWithTags {
  id: number;
  tags?: string[] | null;
}

interface EventListPayload {
  items: EventWithTags[];
}

/** Admin login using a standalone APIRequestContext (no browser page
 * needed). Used from global teardown where there's no test fixture.
 */
export async function loginAdminViaApi(
  ctx: APIRequestContext,
): Promise<string> {
  const res = await ctx.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
  });
  if (!res.ok()) {
    throw new Error(
      `Admin login failed (${res.status()}): ${await res.text()}`,
    );
  }
  const body = await res.json();
  return body.token as string;
}

/** Hard-delete every event tagged with {@link E2E_TAG}. Safe to call
 * multiple times and idempotent — events that were already deleted are
 * simply absent from the list. Uses a standalone APIRequestContext so it
 * can run outside of a test fixture (global teardown, afterAll, etc.).
 *
 * Pass a pre-fetched admin token when available (e.g. from beforeEach) to
 * skip the extra login hop — the backend rate-limits /auth/login at
 * 10/min and running it in afterEach blows that cap with a full suite.
 */
export async function cleanupE2EEvents(
  opts: { token?: string; ctx?: APIRequestContext } = {},
): Promise<number> {
  const { ctx } = opts;
  const owned = ctx === undefined;
  const reqCtx = ctx ?? (await request.newContext());
  try {
    const token = opts.token ?? (await loginAdminViaApi(reqCtx));
    const listRes = await reqCtx.get(
      `${API}/events?all=true&per_page=1000`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!listRes.ok()) return 0;
    const list = (await listRes.json()) as EventListPayload;
    const targets = (list.items || []).filter((e) =>
      (e.tags || []).includes(E2E_TAG),
    );
    let deleted = 0;
    for (const e of targets) {
      const del = await reqCtx.delete(`${API}/events/${e.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (del.ok()) deleted += 1;
    }
    return deleted;
  } finally {
    if (owned) await reqCtx.dispose();
  }
}
