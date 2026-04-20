import { app } from "electron";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export function writeMainLog(message: string, details?: unknown): void {
  const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
  const line = `[${new Date().toISOString()}] ${message}${suffix}\n`;

  try {
    const logDir = app.isReady() ? app.getPath("userData") : process.cwd();
    mkdirSync(logDir, { recursive: true });
    appendFileSync(join(logDir, "main.log"), line, "utf8");
  } catch {}

  console.log(message, details ?? "");
}
