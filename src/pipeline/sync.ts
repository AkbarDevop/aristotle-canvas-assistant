import { writeFile } from "node:fs/promises";

import { runAristotle } from "../agents/aristotle.js";
import { getLatestReportPath } from "../config.js";
import { FileAristotleStore } from "../memory/file-store.js";
import type {
  AristotleEvent,
  AristotleEventType,
  Draft,
  RunLog,
  SourceRecord,
  SyncTrigger,
  Task,
} from "../types.js";
import { createId, nowIso } from "../utils.js";
import { renderUpdatesReport } from "./reports.js";
import {
  archivePendingAssignment,
  failPendingAssignment,
  readPendingAssignments,
  type PendingAssignment,
} from "./intake.js";

export interface SyncOptions {
  trigger: SyncTrigger;
  processPending?: boolean;
}

export interface SyncResult {
  processedCount: number;
  failedCount: number;
  reportText: string;
  summary: string;
}

export async function syncAristotle(
  store: FileAristotleStore,
  dataDir: string,
  options: SyncOptions,
): Promise<SyncResult> {
  const state = await store.load();
  const pendingAssignments = options.processPending === false ? [] : await readPendingAssignments(dataDir);
  let processedCount = 0;
  let failedCount = 0;

  for (const pending of pendingAssignments) {
    if (!pending.assignment) {
      failedCount += 1;
      await handlePendingFailure(state.events, dataDir, pending.fileName, pending.filePath, pending.errorMessage ?? "Unknown intake parsing failure.");
      continue;
    }

    try {
      const existingSource = findExistingAssignmentSource(state.sources, pending.assignment);
      const aristotle = existingSource
        ? runAristotle(pending.assignment, { sourceId: existingSource.id })
        : runAristotle(pending.assignment);

      if (existingSource) {
        refreshAssignmentArtifacts(state, aristotle.source, aristotle.tasks ?? [], aristotle.drafts ?? []);
      } else {
        state.sources.push(aristotle.source);
        state.tasks.push(...(aristotle.tasks ?? []));
        state.drafts.unshift(...(aristotle.drafts ?? []));
      }

      state.runs.push(createRun("aristotle", aristotle.summary));
      state.events.push(
        createEvent(
          "intake.processed",
          "Intake",
          existingSource
            ? `Refreshed assignment ${pending.assignment.title} in Aristotle.`
            : `Queued assignment ${pending.assignment.title} was accepted into Aristotle.`,
          {
            file: pending.fileName,
            title: pending.assignment.title,
            course: pending.assignment.course,
            mode: existingSource ? "refresh" : "new",
          },
        ),
        createEvent("aristotle.completed", "Aristotle", aristotle.summary, {
          sourceId: aristotle.source.id,
          course: pending.assignment.course,
          assignmentTitle: pending.assignment.title,
        }),
      );
      await archivePendingAssignment(dataDir, pending);
      processedCount += 1;
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : "Unknown intake failure.";
      await handlePendingFailure(state.events, dataDir, pending.fileName, pending.filePath, message);
    }
  }

  const summary =
    state.tasks.length === 0
      ? `No tasks available. ${processedCount} intake item(s) processed, ${failedCount} failed.`
      : `Processed ${processedCount} intake item(s) with ${failedCount} failure(s).`;

  const reportText =
    state.tasks.length === 0
      ? "Aristotle has no tasks yet. Run `npm run canvas:sync` or `npm run intake -- --interactive --sync` to seed the workspace."
      : renderUpdatesReport(state);

  state.runs.push(createRun("sync", summary));
  state.events.push(
    createEvent("sync.completed", "Sync", `Aristotle sync finished. ${processedCount} intake item(s) processed, ${failedCount} failed.`, {
      processed: String(processedCount),
      failed: String(failedCount),
      trigger: options.trigger,
    }),
  );

  await writeFile(getLatestReportPath(dataDir), reportText);
  await store.save(trimState(state));

  return {
    processedCount,
    failedCount,
    reportText,
    summary,
  };
}

function createRun(step: string, summary: string): RunLog {
  return {
    id: createId("run"),
    step,
    summary,
    createdAt: nowIso(),
  };
}

function createEvent(
  type: AristotleEventType,
  actor: string,
  summary: string,
  metadata?: Record<string, string>,
): AristotleEvent {
  const event: AristotleEvent = {
    id: createId("event"),
    type,
    actor,
    summary,
    createdAt: nowIso(),
  };

  if (metadata) {
    event.metadata = metadata;
  }

  return event;
}

function findExistingAssignmentSource(
  sources: SourceRecord[],
  assignment: { course: string; title: string; sourceLink?: string; externalKey?: string },
): SourceRecord | undefined {
  return sources.find((source) => {
    if (assignment.externalKey && source.externalKey === assignment.externalKey) {
      return true;
    }

    if (assignment.sourceLink && source.link === assignment.sourceLink) {
      return true;
    }

    return source.course === assignment.course && source.assignmentTitle === assignment.title;
  });
}

async function handlePendingFailure(
  events: AristotleEvent[],
  dataDir: string,
  fileName: string,
  filePath: string,
  message: string,
): Promise<void> {
  events.push(
    createEvent("intake.failed", "Intake", `Failed to process ${fileName}.`, {
      file: fileName,
      error: message,
    }),
  );
  await failPendingAssignment(dataDir, fileName, filePath);
}

function trimItemsByCreatedAt<T extends { createdAt: string }>(items: T[], limit: number): T[] {
  return items
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

function trimState(state: {
  sources: SourceRecord[];
  tasks: Task[];
  drafts: Draft[];
  runs: RunLog[];
  events: AristotleEvent[];
}): typeof state {
  state.runs = trimItemsByCreatedAt(state.runs, 200);
  state.events = trimItemsByCreatedAt(state.events, 200);
  state.drafts = trimItemsByCreatedAt(state.drafts, 50);
  return state;
}

function refreshAssignmentArtifacts(
  state: {
    sources: SourceRecord[];
    tasks: Task[];
    drafts: Draft[];
  },
  source: SourceRecord,
  nextTasks: Task[],
  nextDrafts: Draft[],
): void {
  const existingSourceIndex = state.sources.findIndex((entry) => entry.id === source.id);
  const previousTasks = state.tasks.filter((task) => task.sourceIds.includes(source.id));
  const previousDrafts = state.drafts.filter((draft) => draft.sourceIds.includes(source.id));
  const preservedTasks = nextTasks.map((task) => preserveTaskState(task, previousTasks));
  const preservedDrafts = nextDrafts.map((draft) => preserveDraftCreatedAt(draft, previousDrafts));

  if (existingSourceIndex >= 0) {
    state.sources[existingSourceIndex] = source;
  } else {
    state.sources.push(source);
  }

  state.tasks = state.tasks.filter((task) => !task.sourceIds.includes(source.id));
  state.tasks.push(...preservedTasks);

  state.drafts = state.drafts.filter((draft) => !draft.sourceIds.includes(source.id));
  state.drafts.unshift(...preservedDrafts);
}

function preserveTaskState(task: Task, previousTasks: Task[]): Task {
  const previousTask =
    previousTasks.find((entry) => task.externalKey && entry.externalKey === task.externalKey) ??
    previousTasks.find((entry) => entry.title === task.title);

  if (!previousTask) {
    return task;
  }

  return {
    ...task,
    status: previousTask.status,
    createdAt: previousTask.createdAt,
  };
}

function preserveDraftCreatedAt(draft: Draft, previousDrafts: Draft[]): Draft {
  const previousDraft = previousDrafts.find((entry) => entry.title === draft.title);

  if (!previousDraft) {
    return draft;
  }

  return {
    ...draft,
    createdAt: previousDraft.createdAt,
  };
}
