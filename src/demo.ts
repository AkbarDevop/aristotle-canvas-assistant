import type { AristotleState, AssignmentBrief } from "./types.js";
import { FileAristotleStore } from "./memory/file-store.js";
import { enqueueAssignment } from "./pipeline/intake.js";
import { syncAristotle } from "./pipeline/sync.js";

export async function runDemo(store: FileAristotleStore, dataDir: string): Promise<string> {
  const assignment = sampleAssignment();
  await enqueueAssignment(dataDir, assignment);
  const result = await syncAristotle(store, dataDir, {
    trigger: "demo",
  });
  return result.reportText;
}

export async function readState(store: FileAristotleStore): Promise<AristotleState> {
  return store.load();
}

function sampleAssignment(): AssignmentBrief {
  const dueAt = new Date();
  dueAt.setUTCDate(dueAt.getUTCDate() + 5);
  dueAt.setUTCHours(23, 0, 0, 0);

  return {
    course: "CS 330",
    title: "Distributed Systems Reading Memo",
    summary:
      "Write a short memo comparing two distributed systems papers and extract practical design lessons.",
    deliverable: "2-3 page memo with citations",
    dueAt: dueAt.toISOString(),
    effortHours: 6,
    sourceLink: "https://canvas.example.edu/courses/cs330/assignments/reading-memo",
  };
}
