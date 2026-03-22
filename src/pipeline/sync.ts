import { writeFile } from "node:fs/promises";

import { runAristotle } from "../agents/aristotle.js";
import { runCaesar, renderBrief } from "../agents/caesar.js";
import { runNapoleon } from "../agents/napoleon.js";
import { getLatestBriefPath } from "../config.js";
import { FileAlexandriaStore } from "../memory/file-store.js";
import type {
  AlexandriaEvent,
  AlexandriaEventType,
  Alert,
  BriefOrigin,
  Draft,
  PlanItem,
  RunLog,
  SourceRecord,
  StoredBrief,
  Task,
} from "../types.js";
import { createId, nowIso } from "../utils.js";
import { writeDashboardFile } from "./dashboard.js";
import { writeTodayFile } from "./today.js";
import {
  archivePendingAssignment,
  failPendingAssignment,
  readPendingAssignments,
  type PendingAssignment,
} from "./intake.js";

export interface SyncOptions {
  trigger: BriefOrigin;
  processPending?: boolean;
}

export interface SyncResult {
  processedCount: number;
  failedCount: number;
  briefText: string;
  summary: string;
}

export async function syncAlexandria(
  store: FileAlexandriaStore,
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
      await handlePendingFailure(
        dataDir,
        state.alerts,
        state.events,
        pending.fileName,
        pending.filePath,
        pending.errorMessage ?? "Unknown intake parsing failure.",
      );
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
        pushSource(state.sources, aristotle.source);
        pushTasks(state.tasks, aristotle.tasks ?? []);
        pushDrafts(state.drafts, aristotle.drafts ?? []);
      }

      state.runs.push(createRun("Aristotle", aristotle.summary));
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
            mode: existingSource ? "refresh" : "new",
          },
        ),
        createEvent("aristotle.completed", "Aristotle", aristotle.summary, {
          sourceId: aristotle.source.id,
        }),
      );
      await archivePendingAssignment(dataDir, pending);
      processedCount += 1;
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : "Unknown intake failure.";
      await handlePendingFailure(dataDir, state.alerts, state.events, pending.fileName, pending.filePath, message);
    }
  }

  if (state.tasks.length === 0) {
    const idleMessage =
      "Aristotle has no tasks yet. Use `npm run intake -- --file examples/assignment.json --sync` or `npm run demo` to seed the pipeline.";
    state.events.push(
      createEvent("sync.completed", "Scheduler", "Aristotle sync finished with no tasks to plan.", {
        processed: String(processedCount),
        failed: String(failedCount),
        trigger: options.trigger,
      }),
    );
    await writeFile(getLatestBriefPath(dataDir), idleMessage);
    await writeDashboardFile(dataDir, state);
    await writeTodayFile(dataDir, state);
    await store.save(trimState(state));

    return {
      processedCount,
      failedCount,
      briefText: idleMessage,
      summary: `No tasks available. ${processedCount} intake item(s) processed, ${failedCount} failed.`,
    };
  }

  const napoleon = runNapoleon(state.tasks);
  state.plan = napoleon.plan ?? [];
  state.alerts = mergeAlerts(state.alerts, napoleon.alerts ?? []);
  state.runs.push(createRun("Napoleon", napoleon.summary));
  state.events.push(
    createEvent("napoleon.completed", "Napoleon", napoleon.summary, {
      plannedItems: String(state.plan.length),
      alerts: String(state.alerts.length),
    }),
  );

  const caesar = runCaesar({
    tasks: state.tasks,
    plan: state.plan,
    drafts: state.drafts,
    alerts: state.alerts,
  });
  const briefText = renderBrief(caesar.brief);
  state.briefs.unshift(createStoredBrief(caesar.brief.headline, briefText, options.trigger));
  state.runs.push(createRun("Caesar", caesar.summary));
  state.events.push(
    createEvent("caesar.completed", "Caesar", caesar.summary, {
      headline: caesar.brief.headline,
    }),
    createEvent(
      "sync.completed",
      "Scheduler",
      `Aristotle sync finished. ${processedCount} intake item(s) processed, ${failedCount} failed.`,
      {
        processed: String(processedCount),
        failed: String(failedCount),
        trigger: options.trigger,
      },
    ),
  );

  await writeFile(getLatestBriefPath(dataDir), briefText);
  await writeDashboardFile(dataDir, state);
  await writeTodayFile(dataDir, state);
  await store.save(trimState(state));

  return {
    processedCount,
    failedCount,
    briefText,
    summary: `Processed ${processedCount} intake item(s) with ${failedCount} failure(s).`,
  };
}

function createRun(agent: string, summary: string): RunLog {
  return {
    id: createId("run"),
    agent,
    summary,
    createdAt: nowIso(),
  };
}

function createEvent(
  type: AlexandriaEventType,
  actor: string,
  summary: string,
  metadata?: Record<string, string>,
): AlexandriaEvent {
  const event: AlexandriaEvent = {
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

function createStoredBrief(headline: string, body: string, origin: BriefOrigin): StoredBrief {
  return {
    id: createId("brief"),
    headline,
    body,
    createdAt: nowIso(),
    origin,
  };
}

function pushSource(collection: SourceRecord[], source: SourceRecord): void {
  collection.push(source);
}

function pushTasks(collection: Task[], tasks: Task[]): void {
  collection.push(...tasks);
}

function pushDrafts(collection: Draft[], drafts: Draft[]): void {
  collection.unshift(...drafts);
}

function mergeAlerts(existing: Alert[], latest: Alert[]): Alert[] {
  return latest.length > 0 ? latest : existing.filter((alert) => alert.severity === "critical");
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

    return source.title === `${assignment.course}: ${assignment.title}`;
  });
}

async function handlePendingFailure(
  dataDir: string,
  alerts: Alert[],
  events: AlexandriaEvent[],
  fileName: string,
  filePath: string,
  message: string,
): Promise<void> {
  alerts.push({
    id: createId("alert"),
    severity: "critical",
    message: `Aristotle failed to process ${fileName}: ${message}`,
    createdAt: nowIso(),
  });
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
  alerts: Alert[];
  plan: PlanItem[];
  runs: RunLog[];
  events: AlexandriaEvent[];
  briefs: StoredBrief[];
}): typeof state {
  state.runs = trimItemsByCreatedAt(state.runs, 200);
  state.events = trimItemsByCreatedAt(state.events, 200);
  state.briefs = trimItemsByCreatedAt(state.briefs, 30);
  state.drafts = trimItemsByCreatedAt(state.drafts, 50);
  state.alerts = trimItemsByCreatedAt(state.alerts, 50);
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
