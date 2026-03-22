import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { FileAristotleStore } from "../src/memory/file-store.js";
import { enqueueAssignment } from "../src/pipeline/intake.js";
import { syncAristotle } from "../src/pipeline/sync.js";

test("Aristotle skips duplicate external assignments during sync", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "alexandria-dedupe-"));
  const store = new FileAristotleStore(dataDir);

  const assignment = {
    course: "ECE 3830",
    title: "Assignment-10",
    summary: "Canvas assignment",
    deliverable: "Canvas assignment submission",
    dueAt: "2026-03-14T04:30:00.000Z",
    effortHours: 1,
    sourceLink: "https://umsystem.instructure.com/courses/369362/assignments/3490779",
    externalKey: "canvas:assignment_3490779",
  };

  await enqueueAssignment(dataDir, assignment);
  await syncAristotle(store, dataDir, { trigger: "sync" });

  await enqueueAssignment(dataDir, assignment);
  await syncAristotle(store, dataDir, { trigger: "sync" });

  const state = await store.load();
  assert.equal(state.sources.length, 1);
  assert.equal(state.tasks.length, 4);
});

test("Aristotle refreshes existing external assignments when workflow rules change", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "alexandria-refresh-"));
  const store = new FileAristotleStore(dataDir);

  const assignment = {
    course: "CHEM 1400",
    title: "Attendance 8",
    summary: "Canvas attendance item",
    deliverable: "Attendance check-in",
    dueAt: "2026-03-14T04:59:59.000Z",
    effortHours: 1,
    sourceLink: "https://umsystem.instructure.com/courses/367157/assignments/3593346",
    externalKey: "canvas:assignment_3593346",
  };

  await enqueueAssignment(dataDir, assignment);
  await syncAristotle(store, dataDir, { trigger: "sync" });
  await enqueueAssignment(dataDir, assignment);
  await syncAristotle(store, dataDir, { trigger: "sync" });

  const state = await store.load();
  assert.equal(state.sources.length, 1);
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0]?.title, "Complete Attendance 8");
});
