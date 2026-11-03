import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { exists } from "./io.mjs";
import { cleanupExternal, sandboxArgs } from "./browser-lifecycle.mjs";
export { blockAssets } from "./browser-basic.mjs";
export function detectBrowsers(env = process.env) {
  const rows = [];
  if (env.DFS_BROWSER && env.DFS_BROWSER !== "chromium")
    rows.push({ name: "override", path: env.DFS_BROWSER });
  if (env.DFS_BROWSER !== "chromium") {
    const candidates =
      process.platform === "darwin"
        ? ["/Applications/ego lite.app/Contents/MacOS/ego lite"]
        : process.platform === "win32"
          ? [
              path.join(
                env.LOCALAPPDATA || "",
                "Programs",
                "ego lite",
                "ego lite.exe",
              ),
              path.join(env.PROGRAMFILES || "", "ego lite", "ego lite.exe"),
            ]
          : [
              "/usr/bin/ego-lite",
              "/opt/ego-lite/ego-lite",
              "/usr/local/bin/ego-lite",
            ];
    for (const p of candidates) rows.push({ name: "ego lite", path: p });
  }
  rows.push({
    name: "chromium",
    path: chromium.executablePath(),
    builtin: true,
  });
  return rows;
}
async function external(candidate, headless) {
  const profile = await fs.mkdtemp(
    path.join(os.tmpdir(), "dfs-browser-profile-"),
  );
  let child,
    browser,
    stderr = "";
  let disposal;
  const dispose = () => (disposal ||= cleanupExternal(child, profile));
  try {
    const args = [
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      ...sandboxArgs(),
      ...(headless
        ? ["--headless=new"]
        : [
            "--start-minimized",
            "--window-position=-32000,-32000",
            "--window-size=200,200",
          ]),
      "about:blank",
    ];
    child = spawn(candidate.path, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let error;
    child.on("error", (e) => (error = e));
    child.stderr.on("data", (d) => {
      stderr = (stderr + d).slice(-2000);
    });
    const portFile = path.join(profile, "DevToolsActivePort"),
      deadline = Date.now() + 8000;
    while (!(await exists(portFile))) {
      if (error) throw error;
      if (child.exitCode !== null || child.signalCode)
        throw Error("Alternate browser exited before CDP");
      if (Date.now() > deadline) throw Error("CDP endpoint timed out");
      await delay(50);
    }
    const [port, endpoint] = String(await fs.readFile(portFile))
      .trim()
      .split("\n");
    browser = await chromium.connectOverCDP(
      `ws://127.0.0.1:${port}${endpoint}`,
      { timeout: 5000 },
    );
    const original = browser.close.bind(browser);
    browser.close = async () => {
      try {
        await original();
      } finally {
        await dispose();
      }
    };
    return browser;
  } catch (e) {
    await browser?.close().catch(() => {});
    await dispose();
    throw Error(
      e.message + (stderr ? " — " + stderr.split("\n").find(Boolean) : ""),
    );
  }
}
async function launch(candidate) {
  if (candidate.builtin)
    return {
      browser: await chromium.launch({
        headless: true,
        chromiumSandbox: sandboxArgs().length === 0,
      }),
      headless: true,
    };
  try {
    return { browser: await external(candidate, true), headless: true };
  } catch (first) {
    try {
      return { browser: await external(candidate, false), headless: false };
    } catch {
      throw first;
    }
  }
}
async function capabilities(browser, candidate, headless) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage(),
      session = await context.newCDPSession(page);
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    await page.goto("data:text/html,<style>p{color:blue}</style><p>probe</p>");
    await session.send("DOM.getDocument");
    const { result } = await session.send("Runtime.evaluate", {
      expression: 'document.querySelector("p")',
    });
    const { nodeId } = await session.send("DOM.requestNode", {
      objectId: result.objectId,
    });
    const matched = await session.send("CSS.getMatchedStylesForNode", {
      nodeId,
    });
    return {
      name: candidate.name,
      path: candidate.path,
      version: browser.version(),
      cdp: true,
      headless,
      cssDomain: (matched.matchedCSSRules || []).length > 0,
    };
  } finally {
    await context.close();
  }
}
export async function probe(candidate) {
  if (!candidate) {
    for (const c of detectBrowsers()) {
      if (!(await exists(c.path))) continue;
      const p = await probe(c);
      if (p.cdp) return p;
    }
    return {
      name: "none",
      path: "",
      version: "",
      cdp: false,
      headless: false,
      cssDomain: false,
    };
  }
  let browser;
  try {
    const launched = await launch(candidate);
    browser = launched.browser;
    return await capabilities(browser, candidate, launched.headless);
  } catch (e) {
    return {
      name: candidate.name,
      path: candidate.path,
      version: "",
      cdp: false,
      headless: false,
      cssDomain: false,
      reason: e.message.split("\n")[0],
    };
  } finally {
    await browser?.close();
  }
}
export async function openBrowser(options = {}) {
  const steps = [];
  for (const candidate of options.candidates || detectBrowsers(options.env)) {
    if (!(await exists(candidate.path))) continue;
    let browser;
    try {
      const launched = await launch(candidate);
      browser = launched.browser;
      let p;
      try {
        p = await capabilities(browser, candidate, launched.headless);
      } catch (e) {
        if (options.css) throw e;
        p = {
          name: candidate.name,
          version: browser.version(),
          cdp: true,
          headless: launched.headless,
          cssDomain: false,
        };
      }
      if (options.css && !p.cssDomain) throw Error("CSS domain unavailable");
      return {
        browser,
        info: { name: candidate.name, version: browser.version() },
        steps,
        probe: p,
      };
    } catch (e) {
      await browser?.close().catch(() => {});
      steps.push({
        name: candidate.name,
        status: "fallback",
        detail: e.message.split("\n")[0],
      });
    }
  }
  throw Error(
    "No usable browser: " +
      steps.map((s) => s.name + ": " + s.detail).join("; "),
  );
}
