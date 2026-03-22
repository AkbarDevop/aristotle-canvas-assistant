import { existsSync } from "node:fs";
import path from "node:path";

let envLoaded = false;

export function getDataDir(): string {
  const configured = process.env.ARISTOTLE_DATA_DIR;
  if (configured && configured.trim().length > 0) {
    return path.resolve(configured);
  }

  return path.resolve(process.cwd(), "aristotle-data");
}

export function getInboxDir(dataDir = getDataDir()): string {
  return path.join(dataDir, "inbox");
}

export function getArchiveDir(dataDir = getDataDir()): string {
  return path.join(dataDir, "archive");
}

export function getFailedDir(dataDir = getDataDir()): string {
  return path.join(dataDir, "failed");
}

export function getLatestReportPath(dataDir = getDataDir()): string {
  return path.join(dataDir, "latest-report.txt");
}

export interface CanvasConfig {
  baseUrl: string;
  accessToken: string;
}

export function loadLocalEnv(): void {
  if (envLoaded) {
    return;
  }

  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
  ];

  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      process.loadEnvFile(candidatePath);
    }
  }

  envLoaded = true;
}

export function getCanvasConfig(): CanvasConfig {
  loadLocalEnv();

  const baseUrl = process.env.CANVAS_BASE_URL?.trim();
  const accessToken = process.env.CANVAS_ACCESS_TOKEN?.trim();

  if (!baseUrl) {
    throw new Error("Missing CANVAS_BASE_URL in .env.");
  }

  if (!accessToken) {
    throw new Error("Missing CANVAS_ACCESS_TOKEN in .env.");
  }

  return {
    baseUrl,
    accessToken,
  };
}
