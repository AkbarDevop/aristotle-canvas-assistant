import test from "node:test";
import assert from "node:assert/strict";

import { buildExternalCalendarDraft, buildExternalTaskDraft } from "../src/pipeline/publish.js";
import type { Task } from "../src/types.js";

const SAMPLE_TASK: Task = {
  id: "task_demo",
  domain: "university",
  course: "ECE 3510",
  assignmentTitle: "Homework 3",
  title: "Clarify scope for Homework 3",
  notes: "Review the prompt and identify the hard parts first.",
  status: "todo",
  priority: 5,
  estimateHours: 2,
  dueAt: "2026-04-06T23:59:00.000Z",
  sourceIds: ["src_1"],
  createdAt: "2026-03-22T00:00:00.000Z",
  updatedAt: "2026-03-22T00:00:00.000Z",
};

test("buildExternalTaskDraft keeps course and due date context", () => {
  const draft = buildExternalTaskDraft(SAMPLE_TASK);
  assert.match(draft.title, /ECE 3510/);
  assert.match(draft.description, /Homework 3/);
  assert.equal(draft.dueAt, SAMPLE_TASK.dueAt);
});

test("buildExternalCalendarDraft converts a task into a study block", () => {
  const draft = buildExternalCalendarDraft(SAMPLE_TASK, {
    startAt: "2026-03-24T20:00:00.000Z",
    durationHours: 1.5,
  });

  assert.match(draft.summary, /study block/);
  assert.equal(draft.startAt, "2026-03-24T20:00:00.000Z");
  assert.equal(draft.endAt, "2026-03-24T21:30:00.000Z");
});
