import { FileAristotleStore } from "../memory/file-store.js";
import { syncAristotle, type SyncResult } from "./sync.js";
import { enqueueAssignment } from "./intake.js";
import type { AssignmentBrief } from "../types.js";
import { createId, nowIso } from "../utils.js";

export interface CanvasEnqueueResult {
  enqueuedCount: number;
}

export interface CanvasSyncResult extends CanvasEnqueueResult {
  fetchedCount: number;
  pipeline: SyncResult;
}

export async function enqueueCanvasAssignments(
  store: FileAristotleStore,
  dataDir: string,
  assignments: AssignmentBrief[],
): Promise<CanvasEnqueueResult> {
  let enqueuedCount = 0;

  for (const assignment of assignments) {
    const queuedPath = await enqueueAssignment(dataDir, assignment);
    await recordEnqueuedAssignment(store, assignment, queuedPath, "Canvas");
    enqueuedCount += 1;
  }

  return { enqueuedCount };
}

export async function syncCanvasAssignments(
  store: FileAristotleStore,
  dataDir: string,
  assignments: AssignmentBrief[],
): Promise<CanvasSyncResult> {
  const enqueueResult = await enqueueCanvasAssignments(store, dataDir, assignments);
  const pipeline = await syncAristotle(store, dataDir, {
    trigger: "sync",
  });

  return {
    fetchedCount: assignments.length,
    enqueuedCount: enqueueResult.enqueuedCount,
    pipeline,
  };
}

async function recordEnqueuedAssignment(
  store: FileAristotleStore,
  assignment: AssignmentBrief,
  queuedPath: string,
  actor: string,
): Promise<void> {
  const state = await store.load();
  state.events.push({
    id: createId("event"),
    type: "intake.enqueued",
    actor,
    summary: `Queued ${assignment.title} for Aristotle intake.`,
    createdAt: nowIso(),
    metadata: {
      path: queuedPath,
      title: assignment.title,
      course: assignment.course,
    },
  });
  await store.save(state);
}
