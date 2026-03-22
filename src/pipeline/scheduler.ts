import type { CanvasConfig } from "../config.js";
import { sleep } from "../utils.js";
import { FileAlexandriaStore } from "../memory/file-store.js";
import { runLiveSyncCycle } from "./live-sync.js";

export interface SchedulerOptions {
  dataDir: string;
  store: FileAlexandriaStore;
  intervalSeconds: number;
  canvasConfig?: CanvasConfig;
  canvasLimit?: number;
  includeCanvas?: boolean;
  ticks?: number;
}

export async function runScheduler(options: SchedulerOptions): Promise<void> {
  const totalTicks = options.ticks ?? Number.POSITIVE_INFINITY;
  let tick = 0;

  while (tick < totalTicks) {
    tick += 1;
    const liveSyncOptions = {
      store: options.store,
      dataDir: options.dataDir,
      ...(options.canvasConfig ? { canvasConfig: options.canvasConfig } : {}),
      ...(options.canvasLimit !== undefined ? { canvasLimit: options.canvasLimit } : {}),
      ...(options.includeCanvas !== undefined ? { includeCanvas: options.includeCanvas } : {}),
    };

    const result = await runLiveSyncCycle(liveSyncOptions);

    console.log(`[Aristotle scheduler] tick ${tick}: ${result.summary}`);
    console.log(result.briefText);

    if (tick >= totalTicks) {
      break;
    }

    await sleep(options.intervalSeconds * 1000);
  }
}
