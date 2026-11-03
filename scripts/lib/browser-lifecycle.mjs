import fs from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export function sandboxArgs(
  platform = process.platform,
  uid = process.getuid?.(),
) {
  return platform === "linux" && uid === 0 ? ["--no-sandbox"] : [];
}

function waitForExit(child, signal, timeoutMs) {
  if (child.exitCode !== null || child.signalCode || !child.pid)
    return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (exited) => {
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
    try {
      child.kill(signal);
    } catch {
      finish(false);
    }
  });
}

// Never let disposal mask the result of doctor, collect or fallback launch.
export async function cleanupExternal(
  child,
  profile,
  {
    remove = fs.rm,
    warn = console.warn,
    timeoutMs = 2000,
    retryDelay = 100,
  } = {},
) {
  try {
    if (
      child &&
      !(await waitForExit(child, "SIGTERM", timeoutMs)) &&
      !(await waitForExit(child, "SIGKILL", timeoutMs))
    )
      throw Error("browser exit not confirmed; profile retained");
    for (let attempt = 0; ; attempt++) {
      try {
        await remove(profile, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        await delay(retryDelay * (attempt + 1));
      }
    }
  } catch (error) {
    warn(
      `Warning: temporary browser profile cleanup failed (${profile}): ${error.message}`,
    );
  }
}
