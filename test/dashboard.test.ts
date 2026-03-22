import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { renderDashboard, writeDashboardFile } from "../src/pipeline/dashboard.js";
import type { AlexandriaState } from "../src/types.js";

test("dashboard groups work into daily buckets", () => {
  const now = new Date("2026-03-13T12:00:00.000-05:00");

  const state: AlexandriaState = {
    sources: [],
    tasks: [
      buildTask("Attend: Standup", "planning", "2026-03-13T15:00:00.000-05:00"),
      buildTask("Finish lab", "university", "2026-03-14T16:00:00.000-05:00"),
      buildTask("Submit report", "university", "2026-03-16T16:00:00.000-05:00"),
    ],
    drafts: [
      {
        id: "draft_1",
        domain: "university",
        type: "outline",
        title: "Outline for lab",
        body: "demo",
        sourceIds: [],
        createdAt: "2026-03-13T10:00:00.000Z",
      },
    ],
    alerts: [
      {
        id: "alert_1",
        severity: "warning",
        message: "Attend: Standup is due within 24 hours.",
        createdAt: "2026-03-13T10:00:00.000Z",
      },
    ],
    plan: [],
    runs: [],
    events: [],
    briefs: [],
  };

  const dashboard = renderDashboard(state, now);

  assert.match(dashboard, /Snapshot/);
  assert.match(dashboard, /Today/);
  assert.match(dashboard, /Tomorrow/);
  assert.match(dashboard, /This Week/);
  assert.match(dashboard, /Attend: Standup/);
  assert.match(dashboard, /Finish lab/);
  assert.match(dashboard, /Submit report/);
});

test("dashboard writes the latest snapshot to disk", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "alexandria-dashboard-"));
  const state: AlexandriaState = {
    sources: [],
    tasks: [buildTask("Attend: Standup", "planning", "2026-03-13T15:00:00.000-05:00")],
    drafts: [],
    alerts: [],
    plan: [],
    runs: [],
    events: [],
    briefs: [],
  };

  const dashboard = await writeDashboardFile(dataDir, state);
  const written = await readFile(path.join(dataDir, "latest-dashboard.txt"), "utf8");

  assert.equal(written, dashboard);
  assert.match(written, /Aristotle dashboard/);
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
