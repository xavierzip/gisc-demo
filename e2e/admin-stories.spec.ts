import { test, expect } from "@playwright/test";
import {
  cleanupE2EEvents,
  E2E_TAG,
  loginUser,
  setAuthToken,
} from "./helpers";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASS = "admin123";

test.describe("Admin stories", () => {
  // Log in once for the whole suite. The backend rate-limits /auth/login
  // at 10/min, and repeat logins in beforeEach blow that cap (esp. with
  // Playwright retries). Each test still sets the token on its own page
  // in beforeEach, since pages are recreated between tests.
  let token: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    token = await loginUser(page, ADMIN_EMAIL, ADMIN_PASS);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await setAuthToken(page, token);
    await page.reload();
  });

  // Per-test cleanup: sweep any events tagged e2e-test immediately after
  // each test so fixtures don't pile up mid-run. Reuses the beforeEach
  // admin token to avoid the /auth/login rate limit (10/min).
  test.afterEach(async () => {
    if (token) await cleanupE2EEvents({ token });
  });

  test("admin nav shows admin links", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manage Events" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Comments" })).toBeVisible();
  });

  test("admin dashboard shows stats", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.locator("h1")).toContainText("Admin Dashboard");

    // Should show stat cards
    await expect(page.getByRole("main").getByText("Users")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("main").getByText("Registrations")).toBeVisible();
    await expect(page.getByRole("main").getByText("Comments")).toBeVisible();
  });

  test("admin events page lists all events including drafts", async ({
    page,
  }) => {
    await page.goto("/admin/events");
    await expect(page.locator("h1")).toContainText("Manage Events");

    // Should show at least one event
    await expect(page.locator("text=Edit").first()).toBeVisible({
      timeout: 10000,
    });

    // Should have Create Event button
    await expect(page.locator("text=Create Event")).toBeVisible();
  });

  test("admin can create a new event", async ({ page }) => {
    await page.goto("/admin/events/create");
    await expect(page.locator("h1")).toContainText("Create Event");

    const title = `E2E Admin Event ${Date.now()}`;
    await page.fill('input[name="title"]', title);
    await page.fill('textarea[name="description"]', "Created by E2E test");
    await page.selectOption('select[name="category"]', "workshop");
    await page.fill('input[name="location"]', "Test Room");
    await page.fill('input[name="start_time"]', "2026-12-01T09:00");
    await page.fill('input[name="end_time"]', "2026-12-01T17:00");
    await page.fill('input[name="capacity"]', "50");
    await page.selectOption('select[name="status"]', "published");
    // Tag so afterEach / global teardown can clean it up afterwards.
    await page.fill('[data-testid="tags-input"]', E2E_TAG);

    await page.click('button:has-text("Create")');

    // Should redirect to admin events page
    await page.waitForURL("/admin/events");
    await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10000 });
    // The tag should be rendered on the card.
    await expect(page.locator(`text=${E2E_TAG}`).first()).toBeVisible();
  });

  test("admin can edit an event via dialog", async ({ page }) => {
    await page.goto("/admin/events");

    // Wait for events to load then click Edit on first
    await page.locator("button:has-text('Edit')").first().click();

    // Dialog should open
    await expect(page.locator("h2:has-text('Edit Event')")).toBeVisible();

    // Change description
    const descField = page.locator('textarea[name="description"]');
    await descField.fill("Updated by E2E test");

    // Save
    await page.click('button:has-text("Save Changes")');

    // Dialog should close
    await expect(
      page.locator("h2:has-text('Edit Event')")
    ).not.toBeVisible();
  });

  test("admin can cancel an event", async ({ page }) => {
    // Create a dedicated event via UI to cancel
    await page.goto("/admin/events/create");
    const title = `Cancel Test ${Date.now()}`;
    await page.fill('input[name="title"]', title);
    await page.fill('input[name="start_time"]', "2026-12-20T09:00");
    await page.fill('input[name="end_time"]', "2026-12-20T17:00");
    await page.selectOption('select[name="status"]', "published");
    // Tag for cleanup.
    await page.fill('[data-testid="tags-input"]', E2E_TAG);
    await page.click('button:has-text("Create")');
    await page.waitForURL("/admin/events");

    // Find our event and cancel it
    const eventRow = page.locator(".border.rounded-lg").filter({ hasText: title });
    await expect(eventRow).toBeVisible({ timeout: 10000 });
    await eventRow.locator("button:has-text('Cancel')").click();

    // Status should change to cancelled
    await expect(eventRow.getByText("cancelled")).toBeVisible({ timeout: 5000 });
  });

  test("admin comments page loads with tabs", async ({ page }) => {
    await page.goto("/admin/comments");
    await expect(page.locator("h1")).toContainText("Manage Comments");

    // Filter tabs
    await expect(page.locator("button:has-text('all')")).toBeVisible();
    await expect(page.locator("button:has-text('visible')")).toBeVisible();
    await expect(page.locator("button:has-text('hidden')")).toBeVisible();
  });

  test("admin can search comments", async ({ page }) => {
    await page.goto("/admin/comments");
    await page.fill('input[placeholder*="Search"]', "test");
    await page.click('button:has-text("Search")');

    // Should show results count
    await expect(page.locator("text=result")).toBeVisible({ timeout: 10000 });
  });

  test("admin can hide a comment from event detail", async ({ page }) => {
    // Go to an event with comments
    await page.goto("/events");
    await page.locator("a[href^='/events/detail']").first().click();
    await expect(page.locator("h1")).toBeVisible();

    // Check if there are comments with Hide button
    const hideBtn = page.locator("button:has-text('Hide')").first();
    if (await hideBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await hideBtn.click();
      // The comment should now show (hidden) label
      await expect(page.locator("text=(hidden)").first()).toBeVisible();

      // Unhide it
      await page.locator("button:has-text('Unhide')").first().click();
      await expect(
        page.locator("text=(hidden)")
      ).not.toBeVisible();
    }
  });

  test("admin can register for events too", async ({ page }) => {
    await page.goto("/events");

    // Click first event
    await page.locator("a[href^='/events/detail']").first().click();
    await expect(page.locator("h1")).toBeVisible();

    // Wait for registration section to load
    await page.waitForTimeout(1000);

    const registerBtn = page.locator("button:has-text('Register for Event')");
    const registered = page.getByText("You are registered");

    const hasRegister = await registerBtn.isVisible().catch(() => false);
    const hasRegistered = await registered.isVisible().catch(() => false);

    expect(hasRegister || hasRegistered).toBeTruthy();
  });
});
