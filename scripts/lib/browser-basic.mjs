import { chromium } from "playwright";
export async function openBrowser() {
  const browser = await chromium.launch({ headless: true });
  return {
    browser,
    info: { name: "chromium", version: browser.version() },
    steps: [],
  };
}
export async function blockAssets(context) {
  const blocked = { image: 0, font: 0, media: 0 };
  await context.route("**/*", (route) => {
    const req = route.request();
    let kind = req.resourceType();
    if (/\.(svg|ico)(?:[?#]|$)|\/favicon(?:[./?]|$)/i.test(req.url()))
      kind = "image";
    if (["image", "font", "media"].includes(kind)) {
      blocked[kind]++;
      return route.abort();
    }
    return route.continue();
  });
  return blocked;
}
