import type { AlexandriaState, AssignmentBrief } from "./types.js";
import { FileAlexandriaStore } from "./memory/file-store.js";
import { writeDashboardFile } from "./pipeline/dashboard.js";
import { enqueueAssignment } from "./pipeline/intake.js";
import { syncAlexandria } from "./pipeline/sync.js";
import { writeTodayFile } from "./pipeline/today.js";

export async function runDemo(store: FileAlexandriaStore, dataDir: string): Promise<string> {
  const assignment = sampleAssignment();
  await enqueueAssignment(dataDir, assignment);
  const result = await syncAlexandria(store, dataDir, {
    trigger: "demo",
  });
  return result.briefText;
}

export async function buildCurrentBrief(store: FileAlexandriaStore, dataDir: string): Promise<string> {
  const result = await syncAlexandria(store, dataDir, {
    trigger: "brief",
  });
  return result.briefText;
}

export async function readState(store: FileAlexandriaStore): Promise<AlexandriaState> {
  return store.load();
}

export async function buildDashboard(
  store: FileAlexandriaStore,
  dataDir: string,
): Promise<string> {
  const state = await store.load();
  return writeDashboardFile(dataDir, state);
}

export async function buildTodayView(
  store: FileAlexandriaStore,
  dataDir: string,
): Promise<string> {
  const state = await store.load();
  return writeTodayFile(dataDir, state);
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
