import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { renderTodayView, writeTodayFile } from "../src/pipeline/today.js";
import type { AlexandriaState, PlanItem } from "../src/types.js";

test("today view surfaces focus tasks, commitments, and risks", () => {
  const now = new Date("2026-03-13T12:00:00.000-05:00");
  const examTask = buildTask("Prepare for exam", "university", "2026-03-13T18:00:00.000-05:00");
  const labTask = buildTask("Finish lab", "university", "2026-03-14T10:00:00.000-05:00");
  const standupTask = buildTask("Attend: Standup", "planning", "2026-03-13T15:00:00.000-05:00");

  const state: AlexandriaState = {
    sources: [],
    tasks: [standupTask, examTask, labTask],
    drafts: [],
    alerts: [
      {
        id: "alert_1",
        severity: "warning",
        message: "Prepare for exam is due within 24 hours.",
        taskId: examTask.id,
        createdAt: "2026-03-13T10:00:00.000Z",
      },
    ],
    plan: [
      buildPlanItem(examTask.id, examTask.title, "today"),
      buildPlanItem(labTask.id, labTask.title, "this_week"),
      buildPlanItem(standupTask.id, standupTask.title, "today"),
    ],
    runs: [],
    events: [],
    briefs: [],
  };

  const view = renderTodayView(state, now);

  assert.match(view, /Aristotle today/);
  assert.match(view, /Focus now/);
  assert.match(view, /Prepare for exam/);
  assert.match(view, /Today's commitments/);
  assert.match(view, /Attend: Standup/);
  assert.match(view, /Next up/);
  assert.match(view, /Finish lab/);
  assert.match(view, /Risk watch/);
});

test("today view writes the latest focused snapshot to disk", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "alexandria-today-"));
  const state: AlexandriaState = {
    sources: [],
    tasks: [buildTask("Prepare for exam", "university", "2026-03-13T18:00:00.000-05:00")],
    drafts: [],
    alerts: [],
    plan: [],
    runs: [],
    events: [],
    briefs: [],
  };

  const output = await writeTodayFile(dataDir, state);
  const written = await readFile(path.join(dataDir, "latest-today.txt"), "utf8");

  assert.equal(written, output);
  assert.match(written, /Aristotle today/);
});

function buildTask(title: string, domain: "planning" | "university", dueAt: string) {
  return {
    id: `${domain}_${title}`,
    domain,
    title,
    notes: title,
    status: "todo" as const,
    priority: 4,
    estimateHours: 1,
    dueAt,
    sourceIds: [],
    createdAt: "2026-03-13T10:00:00.000Z",
    updatedAt: "2026-03-13T10:00:00.000Z",
  };
}

function buildPlanItem(
  taskId: string,
  label: string,
  plannedFor: "today" | "this_week" | "later",
): PlanItem {
  return {
    id: `plan_${taskId}`,
    taskId,
    label,
    plannedFor,
    rationale: "Due soon.",
  };
}
