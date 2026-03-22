import test from "node:test";
import assert from "node:assert/strict";

import { runAristotle } from "../src/agents/aristotle.js";

test("Aristotle turns an assignment into tasks and an outline", () => {
  const dueAt = new Date("2026-03-20T23:00:00.000Z").toISOString();

  const result = runAristotle({
    course: "ENG 201",
    title: "Essay Draft",
    summary: "Draft a comparative essay on two novels.",
    deliverable: "Essay",
    dueAt,
    effortHours: 5,
  });

  assert.equal(result.tasks?.length, 4);
  assert.equal(result.drafts?.length, 1);
  const firstDraft = result.drafts?.[0];
  assert.ok(firstDraft);
  assert.match(firstDraft.body, /Working outline/);
});

test("Aristotle creates a compact workflow for attendance and check-ins", () => {
  const dueAt = new Date("2026-03-20T23:00:00.000Z").toISOString();

  const result = runAristotle({
    course: "CHEM 1400",
    title: "Attendance 8",
    summary: "Mark attendance and submit the in-class check-in.",
    deliverable: "Attendance check-in",
    dueAt,
    effortHours: 1,
  });

  assert.equal(result.tasks?.length, 1);
  assert.equal(result.tasks?.[0]?.title, "Complete Attendance 8");
  assert.equal(result.drafts?.length, 0);
});

test("Aristotle creates a medium workflow for quizzes and discussions", () => {
  const dueAt = new Date("2026-03-20T23:00:00.000Z").toISOString();

  const result = runAristotle({
    course: "POL_SC 1100",
    title: "Week Eight Quiz",
    summary: "Complete the weekly quiz.",
    deliverable: "Quiz",
    dueAt,
    effortHours: 2,
  });

  assert.equal(result.tasks?.length, 2);
  assert.match(result.tasks?.[0]?.title ?? "", /Prepare/);
  assert.match(result.tasks?.[1]?.title ?? "", /Complete/);
  assert.equal(result.drafts?.length, 1);
  assert.match(result.drafts?.[0]?.title ?? "", /Prep checklist/);
});

test("Aristotle keeps checkpoints in the future for near-term assignments", () => {
  const dueAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

  const result = runAristotle({
    course: "BIO 101",
    title: "Quiz review",
    summary: "Prepare for the quiz.",
    deliverable: "Quiz",
    dueAt,
    effortHours: 2,
  });

  for (const task of result.tasks ?? []) {
    assert.ok(task.dueAt);
    assert.ok(new Date(task.dueAt).getTime() >= Date.now());
  }
});
