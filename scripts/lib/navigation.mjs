// Persistent analytics/streaming requests must not prevent evidence collection.
export async function navigateForCollection(page, url, timeout = 25000) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  try {
    await page.waitForLoadState("networkidle", { timeout: 3000 });
  } catch (error) {
    if (error.name !== "TimeoutError") throw error;
  }
}
