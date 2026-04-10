import { test, expect } from "@playwright/test";
import { registerUser, setAuthToken, loginViaUI } from "./helpers";

const TEST_USER_EMAIL = `e2e_user_${Date.now()}@test.com`;
const TEST_USER_PASS = "testpass123";
const TEST_USER_NAME = "E2E Test User";

test.describe("Public pages", () => {
  test("home page loads with heading and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("GISC Event Management");
    await expect(page.getByRole("link", { name: "Browse Events" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Search", exact: true }).first()).toBeVisible();
  });

  test("events page shows event cards", async ({ page }) => {
    await page.goto("/events");
    await expect(page.locator("h1")).toContainText("Events");
    // Wait for at least one event card to load
    await expect(page.locator("a[href^='/events/detail']").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("event detail page shows event info", async ({ page }) => {
    await page.goto("/events");
    // Click first event
    await page.locator("a[href^='/events/detail']").first().click();
    await expect(page.locator("h1")).toBeVisible();
    // Should show registration prompt for anonymous user
    await expect(page.getByText("Log in to register")).toBeVisible();
  });

  test("search page works", async ({ page }) => {
    await page.goto("/search");
    await page.fill('input[placeholder*="Search"]', "E2E Admin Event");
    await page.click('button:has-text("Search")');
    await expect(page.locator("text=result(s) found")).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("User registration and login", () => {
  test("register a new user via UI", async ({ page }) => {
    await page.goto("/login");
    // Switch to register form
    await page.click("button:has-text('Register')");
    await expect(page.locator("h1")).toContainText("Create Account");

    await page.fill('input[placeholder="Full Name"]', TEST_USER_NAME);
    await page.fill('input[placeholder="Email"]', TEST_USER_EMAIL);
    await page.fill('input[placeholder="Password"]', TEST_USER_PASS);
    await page.click('button[type="submit"]');

    // Should redirect to home
    await page.waitForURL("/");
    // Nav should show user links
    await expect(page.locator("text=My Events")).toBeVisible();
    await expect(page.locator("text=Logout")).toBeVisible();
  });

  test("login with existing user via UI", async ({ page }) => {
    // Ensure user exists
    await registerUser(page, TEST_USER_EMAIL, TEST_USER_PASS, TEST_USER_NAME);

    await loginViaUI(page, TEST_USER_EMAIL, TEST_USER_PASS);
    await expect(page.locator("text=My Events")).toBeVisible();
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[placeholder="Email"]', "nobody@test.com");
    await page.fill('input[placeholder="Password"]', "wrongpass");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Invalid credentials")).toBeVisible();
  });
});

test.describe("User event interactions", () => {
  let token: string;

  test.beforeEach(async ({ page }) => {
    token = await registerUser(
      page,
      TEST_USER_EMAIL,
      TEST_USER_PASS,
      TEST_USER_NAME
    );
  });

  test("register for an event", async ({ page }) => {
    // Set auth token and go to events
    await page.goto("/events");
    await setAuthToken(page, token);
    await page.reload();

    // Click first event
    await page.locator("a[href^='/events/detail']").first().click();
    await expect(page.locator("h1")).toBeVisible();

    // Wait for either "Register for Event" button or "You are registered" to appear
    await expect(
      page.locator("button:has-text('Register for Event'), :text('You are registered')").first()
    ).toBeVisible({ timeout: 10000 });

    const registerBtn = page.locator("button:has-text('Register for Event')");
    if (await registerBtn.isVisible().catch(() => false)) {
      await registerBtn.click();
      await expect(page.locator("h3:has-text('Confirm Registration')")).toBeVisible();
      await page.locator(".fixed button:has-text('Register')").click();
      await expect(page.getByText("Successfully registered")).toBeVisible();
    } else {
      await expect(page.getByText("You are registered")).toBeVisible();
    }
  });

  test("my events page shows registered events", async ({ page }) => {
    await page.goto("/my-events");
    await setAuthToken(page, token);
    await page.reload();

    await expect(page.locator("h1")).toContainText("My Events");
    // Either shows events or "haven't registered" message
    const content = await page.textContent("body");
    expect(
      content?.includes("haven't registered") ||
        content?.includes("Registered")
    ).toBeTruthy();
  });

  test("post a comment on an event", async ({ page }) => {
    await page.goto("/events");
    await setAuthToken(page, token);
    await page.reload();

    // Go to first event detail
    await page.locator("a[href^='/events/detail']").first().click();
    await expect(page.locator("h1")).toBeVisible();

    // Post a comment
    const commentText = `E2E test comment ${Date.now()}`;
    await page.fill('textarea[placeholder="Leave a comment..."]', commentText);
    await page.click("button:has-text('Comment')");

    // Verify comment appears (may need to expand replies)
    await expect(page.locator(`text=${commentText}`)).toBeVisible({
      timeout: 5000,
    });
  });

  test("notifications page loads", async ({ page }) => {
    await page.goto("/notifications");
    await setAuthToken(page, token);
    await page.reload();

    await expect(page.locator("h1")).toContainText("Notifications");
  });
});
