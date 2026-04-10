// Standalone Playwright script that captures README screenshots of the
// running frontend. Run with:
//
//   docker compose up -d     # app must be reachable on http://localhost
//   node scripts/take-screenshots.mjs
//
// Output: docs/screenshots/*.png
//
// Not a Playwright test — intentionally a plain Node script so we don't
// have to pay for the test runner's config/reporting overhead for a
// one-off capture run.

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "docs", "screenshots");

const BASE = "http://localhost";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASS = "admin123";

// Wide enough to show desktop layouts cleanly, short enough to keep the
// README thumbnails readable.
const VIEWPORT = { width: 1440, height: 900 };

async function loginAdmin(page) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
  });
  if (!res.ok()) {
    throw new Error(
      `admin login failed (${res.status()}): ${await res.text()}`,
    );
  }
  const body = await res.json();
  return body.token;
}

async function shot(page, name, opts = {}) {
  const file = resolve(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: !!opts.fullPage });
  console.log(`  → ${name}.png`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  try {
    // --- Public pages (no auth needed) ---

    console.log("Capturing public events list...");
    await page.goto(`${BASE}/events`);
    // Wait for at least one event card to render.
    await page.waitForSelector("a[href^='/events/detail']", { timeout: 10000 });
    // Give images a beat to paint so screenshots aren't a wall of grey boxes.
    await page.waitForLoadState("networkidle");
    await shot(page, "public-events");

    console.log("Capturing event detail...");
    await page.goto(`${BASE}/events/detail?id=1`);
    await page.waitForSelector("h1", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await shot(page, "event-detail");

    // --- Admin pages (need JWT in localStorage) ---

    const token = await loginAdmin(page);
    // Must navigate to the origin before calling localStorage.setItem.
    await page.goto(`${BASE}/`);
    await page.evaluate((t) => localStorage.setItem("gisc_token", t), token);

    console.log("Capturing admin events list...");
    await page.goto(`${BASE}/admin/events`);
    await page.waitForSelector("h1:has-text('Manage Events')", {
      timeout: 10000,
    });
    await page.waitForLoadState("networkidle");
    await shot(page, "admin-events");

    console.log("Capturing admin create form...");
    await page.goto(`${BASE}/admin/events/create`);
    await page.waitForSelector("h1:has-text('Create Event')", {
      timeout: 10000,
    });
    // Fill in some values so the form isn't visually empty.
    await page.fill('input[name="title"]', "Kubernetes Security Workshop");
    await page.fill(
      'textarea[name="description"]',
      "Hands-on session covering pod security, network policies, and runtime threat detection.",
    );
    await page.selectOption('select[name="category"]', "workshop");
    await page.fill('input[name="location"]', "Engineering HQ, Room 3A");
    await page.fill('input[name="start_time"]', "2026-06-15T10:00");
    await page.fill('input[name="end_time"]', "2026-06-15T16:00");
    await page.fill('input[name="capacity"]', "40");
    await page.fill(
      '[data-testid="tags-input"]',
      "kubernetes, security, hands-on, intermediate",
    );
    await shot(page, "admin-create");
  } finally {
    await browser.close();
  }

  console.log(`\nDone. ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
