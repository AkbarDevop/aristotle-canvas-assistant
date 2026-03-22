import type { CanvasConfig } from "../config.js";
import { CanvasClient } from "../connectors/canvas.js";
import { FileAlexandriaStore } from "../memory/file-store.js";
import { enqueueCanvasAssignments } from "./canvas-sync.js";
import { syncAlexandria } from "./sync.js";

export interface LiveSyncOptions {
  store: FileAlexandriaStore;
  dataDir: string;
  canvasConfig?: CanvasConfig;
  canvasLimit?: number;
  includeCanvas?: boolean;
}

export interface LiveSyncResult {
  briefText: string;
  summary: string;
  canvasFetched: number;
}

export async function runLiveSyncCycle(options: LiveSyncOptions): Promise<LiveSyncResult> {
  const includeCanvas = options.includeCanvas ?? true;
  let canvasFetched = 0;

  if (includeCanvas && options.canvasConfig) {
    const canvasClient = new CanvasClient(options.canvasConfig);
    const assignments = await canvasClient.listUpcomingAssignments(options.canvasLimit ?? 15);
    canvasFetched = assignments.length;
    await enqueueCanvasAssignments(options.store, options.dataDir, assignments);
  }

  const pipeline = await syncAlexandria(options.store, options.dataDir, {
    trigger: "scheduler",
  });

  return {
    briefText: pipeline.briefText,
    summary: `Canvas ${includeCanvas && options.canvasConfig ? `fetched ${canvasFetched}` : "skipped"}, Inbox ${pipeline.processedCount} processed`,
    canvasFetched,
  };
}
