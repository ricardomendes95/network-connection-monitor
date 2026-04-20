import Module from "node:module";
import { join } from "node:path";
import { writeMainLog } from "../utils/logger";

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

  writeMainLog("speedtest: registering fallback paths", { fallbackPaths, globalPathsBefore: [...globalPaths] });

  for (const fallbackPath of fallbackPaths) {
    if (!globalPaths.includes(fallbackPath)) {
      globalPaths.unshift(fallbackPath);
    }
  }

  writeMainLog("speedtest: global paths after registration", { globalPaths: [...globalPaths] });
}

async function getSpeedTest() {
  writeMainLog("speedtest: starting module load", {
    resourcesPath: process.resourcesPath,
    platform: process.platform,
    execPath: process.execPath,
  });

  registerPackagedFallbackPaths();

  writeMainLog("speedtest: importing speedtest-net");
  speedTestLoader ??= import("speedtest-net");
  const module = await speedTestLoader;
  writeMainLog("speedtest: speedtest-net loaded successfully");
  return module.default;
}

export async function runSpeedTest(): Promise<SpeedResult> {
  writeMainLog("speedtest: runSpeedTest called");
  try {
    const speedTest = await getSpeedTest();
    writeMainLog("speedtest: running test...");
    const result = await speedTest({ acceptLicense: true, acceptGdpr: true });
    writeMainLog("speedtest: test complete", {
      download: result.download.bandwidth,
      upload: result.upload.bandwidth,
      ping: result.ping.latency,
    });

    return {
      download: result.download.bandwidth / 125000,
      upload: result.upload.bandwidth / 125000,
      ping: result.ping.latency,
      jitter: result.ping.jitter ?? 0,
      serverHost: result.server.host ?? "unknown",
      testedAt: new Date().toISOString(),
    };
  } catch (err) {
    writeMainLog("speedtest: runSpeedTest threw", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }
}
