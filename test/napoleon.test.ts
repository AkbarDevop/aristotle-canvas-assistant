import test from "node:test";
import assert from "node:assert/strict";

import { runNapoleon } from "../src/agents/napoleon.js";
import type { Task } from "../src/types.js";

const now = new Date();

function buildTask(title: string, dueInDays: number, estimateHours: number, priority: number): Task {
  const dueAt = new Date(now);
  dueAt.setUTCDate(dueAt.getUTCDate() + dueInDays);

  return {
    id: `task_${title}`,
    domain: "university",
    title,
    notes: title,
    status: "todo",
    priority,
    estimateHours,
    dueAt: dueAt.toISOString(),
    sourceIds: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

test("Napoleon prioritizes nearer deadlines and flags heavy workload", () => {
  const result = runNapoleon([
    buildTask("Late lab", 1, 4, 5),
    buildTask("Essay", 2, 4, 5),
    buildTask("Later reading", 8, 1, 2),
  ]);

  assert.equal(result.topTasks[0]?.title, "Late lab");
  assert.ok(result.alerts?.some((alert) => /heavy/i.test(alert.message)));
});

