import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { CanvasConfig } from "../config.js";
import { FileAlexandriaStore } from "../memory/file-store.js";
import { enqueueAssignment, parseAssignmentBrief } from "../pipeline/intake.js";
import { runLiveSyncCycle } from "../pipeline/live-sync.js";
import { syncAlexandria } from "../pipeline/sync.js";
import { updateTaskStatus } from "../pipeline/tasks.js";
import type { AssignmentBrief, TaskStatus } from "../types.js";
import { createId, nowIso } from "../utils.js";
import { buildAlexandriaWebView } from "./view-model.js";

const PUBLIC_DIR = path.resolve(process.cwd(), "web");

export interface AristotleWebServerOptions {
  store: FileAlexandriaStore;
  dataDir: string;
  host: string;
  port: number;
  canvasConfig?: CanvasConfig;
  canvasLimit?: number;
  includeCanvas?: boolean;
  syncOnStart?: boolean;
}

export async function runAristotleWebServer(options: AristotleWebServerOptions): Promise<void> {
  if (options.syncOnStart) {
    await refreshAristotle(options);
  }

  const server = createServer(async (request, response) => {
    try {
      await routeRequest(request, response, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Aristotle web error.";
      sendJson(response, 500, {
        error: message,
      });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port, options.host, resolve);
  });

  console.log(`Aristotle web dashboard running at http://${options.host}:${options.port}`);
  console.log("Open that URL in your browser.");

  await new Promise<void>((resolve, reject) => {
    server.on("close", resolve);
    server.on("error", reject);

    const shutdown = () => {
      server.close(() => resolve());
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: AristotleWebServerOptions,
): Promise<void> {
  const method = request.method ?? "GET";
  const requestUrl = new URL(request.url ?? "/", `http://${options.host}:${options.port}`);
  const pathname = requestUrl.pathname;

  if (method === "GET" && pathname === "/api/view") {
    const state = await options.store.load();
    const view = buildAlexandriaWebView(state);
    sendJson(response, 200, {
      view,
      capabilities: {
        canvas: Boolean(options.canvasConfig && (options.includeCanvas ?? true)),
      },
    });
    return;
  }

  if (method === "POST" && pathname === "/api/sync") {
    const syncResult = await refreshAristotle(options);
    const state = await options.store.load();
    const view = buildAlexandriaWebView(state);
    sendJson(response, 200, {
      ok: true,
      summary: syncResult.summary,
      view,
    });
    return;
  }

  if (method === "POST" && pathname === "/api/intake") {
    const body = await readJsonBody(request);
    const rawAssignment: Partial<AssignmentBrief> = {};
    const course = readStringField(body, "course");
    const title = readStringField(body, "title");
    const summary = readStringField(body, "summary");
    const deliverable = readStringField(body, "deliverable");
    const dueAt = readStringField(body, "dueAt");
    const effortHours = readNumberField(body, "effortHours");
    const sourceLink = readOptionalStringField(body, "sourceLink");

    if (course !== undefined) rawAssignment.course = course;
    if (title !== undefined) rawAssignment.title = title;
    if (summary !== undefined) rawAssignment.summary = summary;
    if (deliverable !== undefined) rawAssignment.deliverable = deliverable;
    if (dueAt !== undefined) rawAssignment.dueAt = dueAt;
    if (effortHours !== undefined) rawAssignment.effortHours = effortHours;
    if (sourceLink !== undefined) rawAssignment.sourceLink = sourceLink;

    const assignment = parseAssignmentBrief(rawAssignment);

    const queuedPath = await enqueueAssignment(options.dataDir, assignment);
    await recordEnqueuedAssignment(options.store, assignment.title, queuedPath, "Web");
    const syncResult = await syncAlexandria(options.store, options.dataDir, {
      trigger: "manual",
    });
    const state = await options.store.load();
    const view = buildAlexandriaWebView(state);

    sendJson(response, 200, {
      ok: true,
      message: `Added ${assignment.title} to Aristotle.`,
      summary: syncResult.summary,
      view,
    });
    return;
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/status$/);
  if (method === "POST" && taskMatch) {
    const taskId = decodeURIComponent(taskMatch[1] ?? "");
    const body = await readJsonBody(request);
    const status = body?.status;

    if (!isTaskStatus(status)) {
      sendJson(response, 400, {
        error: "Expected status to be one of todo, in_progress, done, or blocked.",
      });
      return;
    }

    await updateTaskStatus(options.store, taskId, status);
    await syncAlexandria(options.store, options.dataDir, {
      trigger: "manual",
      processPending: false,
    });

    const state = await options.store.load();
    const view = buildAlexandriaWebView(state);
    sendJson(response, 200, {
      ok: true,
      view,
    });
    return;
  }

  if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    await sendStatic(response, "index.html", "text/html; charset=utf-8");
    return;
  }

  if (method === "GET" && pathname === "/app.js") {
    await sendStatic(response, "app.js", "application/javascript; charset=utf-8");
    return;
  }

  if (method === "GET" && pathname === "/styles.css") {
    await sendStatic(response, "styles.css", "text/css; charset=utf-8");
    return;
  }

  sendJson(response, 404, {
    error: "Aristotle route not found.",
  });
}

async function sendStatic(
  response: ServerResponse,
  relativePath: string,
  contentType: string,
): Promise<void> {
  const filePath = path.join(PUBLIC_DIR, relativePath);
  const content = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(content);
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return null;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function refreshAristotle(options: AristotleWebServerOptions): Promise<{ summary: string }> {
  const hasLiveConfig = Boolean(options.canvasConfig);

  if (!hasLiveConfig) {
    const syncResult = await syncAlexandria(options.store, options.dataDir, {
      trigger: "manual",
    });
    return {
      summary: syncResult.summary,
    };
  }

  const result = await runLiveSyncCycle({
    store: options.store,
    dataDir: options.dataDir,
    ...(options.canvasConfig ? { canvasConfig: options.canvasConfig } : {}),
    ...(options.canvasLimit !== undefined ? { canvasLimit: options.canvasLimit } : {}),
    ...(options.includeCanvas !== undefined ? { includeCanvas: options.includeCanvas } : {}),
  });

  return {
    summary: result.summary,
  };
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "todo" || value === "in_progress" || value === "done" || value === "blocked";
}

function readStringField(
  body: Record<string, unknown> | null,
  fieldName: string,
): string | undefined {
  const value = body?.[fieldName];
  return typeof value === "string" ? value : undefined;
}

function readOptionalStringField(
  body: Record<string, unknown> | null,
  fieldName: string,
): string | undefined {
  const value = readStringField(body, fieldName)?.trim();
  return value ? value : undefined;
}

function readNumberField(
  body: Record<string, unknown> | null,
  fieldName: string,
): number | undefined {
  const value = body?.[fieldName];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

async function recordEnqueuedAssignment(
  store: FileAlexandriaStore,
  title: string,
  queuedPath: string,
  actor: string,
): Promise<void> {
  const state = await store.load();
  state.events.push({
    id: createId("event"),
    type: "intake.enqueued",
    actor,
    summary: `Queued ${title} for Aristotle intake.`,
    createdAt: nowIso(),
    metadata: {
      path: queuedPath,
      title,
    },
  });
  await store.save(state);
}
