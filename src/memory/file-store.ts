import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AlexandriaState } from "../types.js";

const EMPTY_STATE: AlexandriaState = {
  sources: [],
  tasks: [],
  drafts: [],
  alerts: [],
  plan: [],
  runs: [],
  events: [],
  briefs: [],
};

export class FileAlexandriaStore {
  constructor(private readonly dataDir: string) {}

  private get statePath(): string {
    return path.join(this.dataDir, "state.json");
  }

  async load(): Promise<AlexandriaState> {
    await mkdir(this.dataDir, { recursive: true });

    try {
      const raw = await readFile(this.statePath, "utf8");
      return normalizeState(JSON.parse(raw) as Partial<AlexandriaState>);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return structuredClone(EMPTY_STATE);
      }

      throw error;
    }
  }

  async save(state: AlexandriaState): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.statePath, JSON.stringify(state, null, 2));
  }
}

function normalizeState(raw: Partial<AlexandriaState>): AlexandriaState {
  return {
    sources: raw.sources ?? [],
    tasks: raw.tasks ?? [],
    drafts: raw.drafts ?? [],
    alerts: raw.alerts ?? [],
    plan: raw.plan ?? [],
    runs: raw.runs ?? [],
    events: raw.events ?? [],
    briefs: raw.briefs ?? [],
  };
}
