import { cleanupE2EEvents } from "./helpers";

/** Playwright global teardown — runs once after the entire test run
 * completes. Sweeps every event tagged with "e2e-test" from the demo
 * database so test fixtures don't accumulate across runs. Per-test
 * afterEach hooks already clean up the common case; this is the
 * belt-and-suspenders safety net for tests that crashed before their
 * afterEach could run.
 */
export default async function globalTeardown() {
  try {
    const deleted = await cleanupE2EEvents();
    if (deleted > 0) {
      // eslint-disable-next-line no-console
      console.log(`[e2e-teardown] deleted ${deleted} test event(s)`);
    }
  } catch (err) {
    // Don't fail the test run just because cleanup didn't land. Log and
    // let the developer sweep manually if needed.
    // eslint-disable-next-line no-console
    console.warn("[e2e-teardown] cleanup failed:", err);
  }
}
