import Module from "node:module";
import { join } from "node:path";

export interface SpeedResult {
  download: number;
  upload: number;
  ping: number;
  jitter: number;
  serverHost: string;
  testedAt: string;
}

let speedTestLoader: Promise<typeof import("speedtest-net")> | null = null;

function registerPackagedFallbackPaths() {
  const globalPaths = (Module as typeof Module & { globalPaths: string[] })
    .globalPaths;
  const fallbackPaths = [
    join(
      process.resourcesPath,
      "app.asar",
      "node_modules",
      "call-bind",
      "node_modules",
    ),
    join(
      process.resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "call-bind",
      "node_modules",
    ),
  ];

  for (const fallbackPath of fallbackPaths) {
    if (!globalPaths.includes(fallbackPath)) {
      globalPaths.unshift(fallbackPath);
    }
  }
}

async function getSpeedTest() {
  registerPackagedFallbackPaths();
  speedTestLoader ??= import("speedtest-net");
  const module = await speedTestLoader;
  return module.default;
}

export async function runSpeedTest(): Promise<SpeedResult> {
  const speedTest = await getSpeedTest();
  const result = await speedTest({ acceptLicense: true, acceptGdpr: true });

  return {
    download: result.download.bandwidth / 125000,
    upload: result.upload.bandwidth / 125000,
    ping: result.ping.latency,
    jitter: result.ping.jitter ?? 0,
    serverHost: result.server.host ?? "unknown",
    testedAt: new Date().toISOString(),
  };
}
