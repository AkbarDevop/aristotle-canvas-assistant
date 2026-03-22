import test from "node:test";
import assert from "node:assert/strict";

import { buildAlexandriaWebView } from "../src/web/view-model.js";
import type { AlexandriaState } from "../src/types.js";

test("web view model prioritizes focus and exposes active tasks", () => {
  const now = new Date("2026-03-13T12:00:00.000-05:00");
  const state: AlexandriaState = {
    sources: [
      {
        id: "src_1",
        domain: "university",
        title: "Canvas: Assignment-10",
        content: "demo",
        link: "https://example.com/assignment",
        capturedAt: "2026-03-13T10:00:00.000Z",
      },
    ],
    tasks: [
      buildTask("Clarify scope for Assignment-10", "2026-03-13T13:00:00.000-05:00", "todo", ["src_1"]),
      buildTask("Attend: Standup", "2026-03-13T15:00:00.000-05:00", "todo", [], "planning"),
      buildTask("Prepare for quiz", "2026-03-14T10:00:00.000-05:00", "in_progress", ["src_1"]),
    ],
    drafts: [],
    alerts: [
      {
        id: "alert_1",
        severity: "warning",
        message: "Clarify scope for Assignment-10 is due within 24 hours.",
        createdAt: "2026-03-13T10:00:00.000Z",
      },
    ],
    plan: [
      {
        id: "plan_1",
        label: "Clarify scope for Assignment-10",
        taskId: "task_Clarify scope for Assignment-10",
        plannedFor: "today",
        rationale: "Due today.",
      },
    ],
    runs: [],
    events: [],
    briefs: [],
  };

  const view = buildAlexandriaWebView(state, now);

  assert.equal(view.snapshot.activeTasks, 3);
  assert.deepEqual(view.courses, ["Canvas"]);
  assert.equal(view.focus[0]?.title, "Prepare for quiz");
  assert.equal(view.commitmentsToday[0]?.title, "Attend: Standup");
  assert.equal(view.tasks[0]?.courseLabel, "Canvas");
  assert.equal(view.tasks[0]?.sources[0]?.title, "Canvas: Assignment-10");
});

function buildTask(
  title: string,
  dueAt: string,
  status: "todo" | "in_progress" | "done" | "blocked",
  sourceIds: string[],
  domain: "planning" | "university" = "university",
) {
  return {
    id: `task_${title}`,
    domain,
    title,
    notes: `${title} notes`,
    status,
    priority: 4,
    estimateHours: 1,
    dueAt,
    sourceIds,
    createdAt: "2026-03-13T10:00:00.000Z",
    updatedAt: "2026-03-13T10:00:00.000Z",
  };
}
