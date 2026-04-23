import { app } from "electron";
import { spawn } from "node:child_process";
import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { get as httpsGet } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeMainLog } from "../utils/logger";

export interface SpeedResult {
  download: number;
  upload: number;
  ping: number;
  jitter: number;
  serverHost: string;
  serverName: string;
  packetLoss: number | null;
  resultUrl: string | null;
  testedAt: string;
}

const OOKLA_VERSION = "1.2.0";
const BASE_URL = `https://install.speedtest.net/app/cli/ookla-speedtest-${OOKLA_VERSION}`;

interface PlatformTarget {
  url: string;
  archive: "tgz" | "zip";
  binary: string;
}

function resolveTarget(): PlatformTarget {
  const { platform, arch } = process;

  if (platform === "darwin") {
    return {
      url: `${BASE_URL}-macosx-universal.tgz`,
      archive: "tgz",
      binary: "speedtest",
    };
  }

  if (platform === "linux") {
    if (arch === "arm64") {
      return {
        url: `${BASE_URL}-linux-aarch64.tgz`,
        archive: "tgz",
        binary: "speedtest",
      };
    }
    if (arch === "arm") {
      return {
        url: `${BASE_URL}-linux-armhf.tgz`,
        archive: "tgz",
        binary: "speedtest",
      };
    }
    if (arch === "ia32") {
      return {
        url: `${BASE_URL}-linux-i386.tgz`,
        archive: "tgz",
        binary: "speedtest",
      };
    }
    return {
      url: `${BASE_URL}-linux-x86_64.tgz`,
      archive: "tgz",
      binary: "speedtest",
    };
  }

  if (platform === "win32") {
    return {
      url: `${BASE_URL}-win64.zip`,
      archive: "zip",
      binary: "speedtest.exe",
    };
  }

  throw new Error(`Plataforma nao suportada: ${platform}/${arch}`);
}

function getBinaryDir(): string {
  const base = app.isReady() ? app.getPath("userData") : tmpdir();
  const dir = join(base, "speedtest-cli", OOKLA_VERSION);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destination);
    const request = httpsGet(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        file.close();
        rmSync(destination, { force: true });
        downloadFile(response.headers.location, destination).then(
          resolve,
          reject,
        );
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        file.close();
        rmSync(destination, { force: true });
        reject(
          new Error(
            `Falha ao baixar ${url}: HTTP ${response.statusCode ?? "?"}`,
          ),
        );
        return;
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    });
    request.on("error", (err) => {
      file.close();
      rmSync(destination, { force: true });
      reject(err);
    });
  });
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk) => (stdout += chunk.toString()));
    proc.stderr?.on("data", (chunk) => (stderr += chunk.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(
            `${command} saiu com codigo ${code}: ${stderr || stdout}`.trim(),
          ),
        );
    });
  });
}

function findBinaryInDir(dir: string, binaryName: string): string | null {
  if (!existsSync(dir)) return null;
  const candidate = join(dir, binaryName);
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      if (statSync(full).isDirectory()) {
        const nested = findBinaryInDir(full, binaryName);
        if (nested) return nested;
      } else if (entry === binaryName) {
        return full;
      }
    } catch {}
  }
  return null;
}

async function extractArchive(
  archivePath: string,
  destination: string,
  kind: "tgz" | "zip",
): Promise<void> {
  mkdirSync(destination, { recursive: true });

  if (kind === "tgz") {
    await runCommand("tar", ["-xzf", archivePath, "-C", destination]);
    return;
  }

  if (process.platform === "win32") {
    await runCommand("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath "${archivePath}" -DestinationPath "${destination}" -Force`,
    ]);
    return;
  }

  await runCommand("unzip", ["-o", archivePath, "-d", destination]);
}

async function ensureOoklaBinary(): Promise<string> {
  const target = resolveTarget();
  const binDir = getBinaryDir();
  const existing = findBinaryInDir(binDir, target.binary);
  if (existing) return existing;

  writeMainLog("Baixando Ookla CLI", { url: target.url, binDir });

  const archivePath = join(
    binDir,
    target.archive === "tgz" ? "speedtest.tgz" : "speedtest.zip",
  );
  await downloadFile(target.url, archivePath);

  const extractDir = join(binDir, "extracted");
  rmSync(extractDir, { recursive: true, force: true });
  await extractArchive(archivePath, extractDir, target.archive);

  const extracted = findBinaryInDir(extractDir, target.binary);
  if (!extracted) {
    throw new Error(
      `Binario speedtest nao encontrado apos extrair ${target.url}`,
    );
  }

  const finalPath = join(binDir, target.binary);
  renameSync(extracted, finalPath);
  rmSync(extractDir, { recursive: true, force: true });
  rmSync(archivePath, { force: true });

  if (process.platform !== "win32") {
    chmodSync(finalPath, 0o755);
  }

  writeMainLog("Ookla CLI instalado", { path: finalPath });
  return finalPath;
}

interface OoklaResult {
  type: string;
  ping: { jitter: number; latency: number };
  download: { bandwidth: number };
  upload: { bandwidth: number };
  server: { host?: string; name?: string };
  timestamp: string;
  packetLoss?: number;
  result?: { id?: string; url?: string; persisted?: boolean };
}

function parseOoklaOutput(raw: string): OoklaResult {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Saida vazia do speedtest CLI");

  const lines = trimmed.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(line) as OoklaResult;
      if (parsed.type === "result") return parsed;
    } catch {}
  }

  try {
    return JSON.parse(trimmed) as OoklaResult;
  } catch {
    throw new Error(`Nao foi possivel interpretar a saida: ${trimmed}`);
  }

  writeMainLog("speedtest: global paths after registration", {
    globalPaths: [...globalPaths],
  });
}

export async function runSpeedTest(): Promise<SpeedResult> {
  const binary = await ensureOoklaBinary();
  const args = ["--format=json", "--accept-license", "--accept-gdpr"];
  const stdout = await runCommand(binary, args);
  const result = parseOoklaOutput(stdout);

  return {
    download: result.download.bandwidth / 125000,
    upload: result.upload.bandwidth / 125000,
    ping: result.ping.latency,
    jitter: result.ping.jitter ?? 0,
    serverHost: result.server.host ?? "unknown",
    serverName: result.server.name ?? result.server.host ?? "unknown",
    packetLoss: result.packetLoss ?? null,
    resultUrl: result.result?.persisted && result.result.url ? result.result.url : null,
    testedAt: new Date().toISOString(),
  };
}
