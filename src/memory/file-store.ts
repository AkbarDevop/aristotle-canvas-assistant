import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AristotleState, Draft, RunLog, SourceRecord, Task } from "../types.js";

const EMPTY_STATE: AristotleState = {
  sources: [],
  tasks: [],
  drafts: [],
  runs: [],
  events: [],
};

export class FileAristotleStore {
  constructor(private readonly dataDir: string) {}

  private get statePath(): string {
    return path.join(this.dataDir, "state.json");
  }

  async load(): Promise<AristotleState> {
    await mkdir(this.dataDir, { recursive: true });

    try {
      const raw = await readFile(this.statePath, "utf8");
      return normalizeState(JSON.parse(raw) as Partial<AristotleState>);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return structuredClone(EMPTY_STATE);
      }

      throw error;
    }
  }

  async save(state: AristotleState): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.statePath, JSON.stringify(state, null, 2));
  }
}

function normalizeState(raw: Partial<AristotleState>): AristotleState {
  return {
    sources: (raw.sources ?? []).map(normalizeSource),
    tasks: (raw.tasks ?? []).map(normalizeTask),
    drafts: (raw.drafts ?? []).map(normalizeDraft),
    runs: (raw.runs ?? []).map(normalizeRun),
    events: raw.events ?? [],
  };
}

function normalizeSource(raw: Partial<SourceRecord>): SourceRecord {
  const inferred = inferAssignmentLabel(raw.title);
  const course = raw.course ?? inferred.course;
  const assignmentTitle = raw.assignmentTitle ?? inferred.assignmentTitle;

  return {
    id: raw.id ?? `src_legacy_${sanitizeIdPart(assignmentTitle)}`,
    domain: "university",
    course,
    assignmentTitle,
    title: raw.title ?? `${course}: ${assignmentTitle}`,
    content: raw.content ?? "",
    capturedAt: raw.capturedAt ?? new Date(0).toISOString(),
    ...(raw.link ? { link: raw.link } : {}),
    ...(raw.externalKey ? { externalKey: raw.externalKey } : {}),
  };
}

function normalizeTask(raw: Partial<Task>): Task {
  const inferred = inferAssignmentLabel(raw.assignmentTitle ? `${raw.course}: ${raw.assignmentTitle}` : raw.title);
  const course = raw.course ?? inferred.course;
  const assignmentTitle = raw.assignmentTitle ?? inferred.assignmentTitle;

  return {
    id: raw.id ?? `task_legacy_${sanitizeIdPart(assignmentTitle)}`,
    domain: "university",
    course,
    assignmentTitle,
    title: raw.title ?? assignmentTitle,
    notes: raw.notes ?? "",
    status: raw.status ?? "todo",
    priority: raw.priority ?? 3,
    estimateHours: raw.estimateHours ?? 1,
    sourceIds: raw.sourceIds ?? [],
    createdAt: raw.createdAt ?? new Date(0).toISOString(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date(0).toISOString(),
    ...(raw.dueAt ? { dueAt: raw.dueAt } : {}),
    ...(raw.externalKey ? { externalKey: raw.externalKey } : {}),
  };
}

function normalizeDraft(raw: Partial<Draft>): Draft {
  const inferred = inferAssignmentLabel(raw.assignmentTitle ? `${raw.course}: ${raw.assignmentTitle}` : raw.title);
  const course = raw.course ?? inferred.course;
  const assignmentTitle = raw.assignmentTitle ?? inferred.assignmentTitle;

  return {
    id: raw.id ?? `draft_legacy_${sanitizeIdPart(assignmentTitle)}`,
    domain: "university",
    course,
    assignmentTitle,
    type: raw.type ?? "outline",
    title: raw.title ?? assignmentTitle,
    body: raw.body ?? "",
    sourceIds: raw.sourceIds ?? [],
    createdAt: raw.createdAt ?? new Date(0).toISOString(),
  };
}

function normalizeRun(raw: Partial<RunLog>): RunLog {
  return {
    id: raw.id ?? `run_legacy_${Date.now()}`,
    step: raw.step ?? "sync",
    summary: raw.summary ?? "",
    createdAt: raw.createdAt ?? new Date(0).toISOString(),
  };
}

function inferAssignmentLabel(input?: string): { course: string; assignmentTitle: string } {
  const value = input?.trim();
  if (!value) {
    return {
      course: "Unknown course",
      assignmentTitle: "Untitled assignment",
    };
  }

  const separatorIndex = value.indexOf(":");
  if (separatorIndex < 0) {
    return {
      course: "Unknown course",
      assignmentTitle: value,
    };
  }

  return {
    course: value.slice(0, separatorIndex).trim() || "Unknown course",
    assignmentTitle: value.slice(separatorIndex + 1).trim() || value,
  };
}

function sanitizeIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}
