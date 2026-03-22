import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getLatestBriefPath } from "../src/config.js";
import { FileAlexandriaStore } from "../src/memory/file-store.js";
import { enqueueAssignment } from "../src/pipeline/intake.js";
import { syncAlexandria } from "../src/pipeline/sync.js";

test("Aristotle sync processes inbox assignments into tasks, events, and a brief", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "alexandria-"));
  const store = new FileAlexandriaStore(dataDir);

  await enqueueAssignment(dataDir, {
    course: "BIO 210",
    title: "Lab Report",
    summary: "Summarize the experiment design, results, and discussion.",
    deliverable: "Lab report",
    dueAt: "2026-03-21T23:00:00.000Z",
    effortHours: 5,
  });

  const result = await syncAlexandria(store, dataDir, {
    trigger: "manual",
  });

  const state = await store.load();
  const latestBrief = await readFile(getLatestBriefPath(dataDir), "utf8");

  assert.equal(result.processedCount, 1);
  assert.equal(state.tasks.length, 4);
  assert.ok(state.events.some((event) => event.type === "aristotle.completed"));
  assert.ok(state.briefs.length >= 1);
  assert.match(latestBrief, /Aristotle command brief/);
});
