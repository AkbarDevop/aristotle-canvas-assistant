import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { FileAristotleStore } from "../src/memory/file-store.js";
import { updateTaskStatus } from "../src/pipeline/tasks.js";

test("task updates persist status changes", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "alexandria-tasks-"));
  const store = new FileAristotleStore(dataDir);
  const state = await store.load();

  state.tasks.push({
    id: "task_demo",
    domain: "university",
    course: "ENG 201",
    assignmentTitle: "Finish summary",
    title: "Finish summary",
    notes: "Demo",
    status: "todo",
    priority: 4,
    estimateHours: 2,
    dueAt: "2026-03-20T23:00:00.000Z",
    sourceIds: [],
    createdAt: "2026-03-13T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z",
  });
  await store.save(state);

  const updated = await updateTaskStatus(store, "task_demo", "done");
  const savedState = await store.load();

  assert.equal(updated.status, "done");
  assert.equal(savedState.tasks[0]?.status, "done");
});
