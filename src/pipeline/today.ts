import { writeFile } from "node:fs/promises";

import { getLatestTodayPath } from "../config.js";
import type { AlexandriaState, PlanItem, Task } from "../types.js";
import { formatDate, sortByUrgency } from "../utils.js";

export function renderTodayView(state: AlexandriaState, now = new Date()): string {
  const activeTasks = sortByUrgency(state.tasks.filter((task) => task.status !== "done"));
  const workTasks = activeTasks.filter((task) => task.domain !== "planning");
  const planningTasks = activeTasks.filter((task) => task.domain === "planning");
  const planByTaskId = new Map(state.plan.map((item) => [item.taskId, item]));

  const focus = takeUniqueTasks(
    [
      ...workTasks.filter((task) => task.status === "in_progress"),
      ...state.plan
        .filter((item) => item.plannedFor === "today")
        .map((item) => findTask(activeTasks, item.taskId))
        .filter(isTask)
        .filter((task) => task.domain !== "planning"),
      ...workTasks.filter((task) => isOverdue(task, now)),
      ...workTasks.filter((task) => isToday(task, now)),
      ...workTasks.filter((task) => isTomorrow(task, now)),
      ...workTasks,
    ],
    5,
  );

  const commitments = takeUniqueTasks(
    [
      ...planningTasks.filter((task) => isToday(task, now)),
      ...planningTasks.filter((task) => isTomorrow(task, now)),
    ],
    4,
  );

  const nextUp = takeUniqueTasks(
    [
      ...state.plan
        .filter((item) => item.plannedFor === "this_week")
        .map((item) => findTask(activeTasks, item.taskId))
        .filter(isTask)
        .filter((task) => task.domain !== "planning"),
      ...workTasks.filter((task) => isTomorrow(task, now) || isLaterThisWeek(task, now)),
      ...workTasks,
    ],
    5,
    new Set(focus.map((task) => task.id)),
  );

  return [
    "Aristotle today",
    `Updated: ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(now)}`,
    "",
    "At a glance",
    `- Focus tasks: ${focus.length}`,
    `- Commitments today: ${commitments.length}`,
    `- Open alerts: ${state.alerts.length}`,
    `- Drafts ready: ${state.drafts.length}`,
    "",
    "Focus now",
    renderFocusGroup(focus, planByTaskId, now, "No urgent work items right now."),
    "",
    "Today's commitments",
    renderTaskGroup(commitments, "No planning items today."),
    "",
    "Next up",
    renderFocusGroup(nextUp, planByTaskId, now, "Nothing queued after today's focus."),
    "",
    "Risk watch",
    renderAlerts(state.alerts.map((alert) => alert.message).slice(0, 5)),
  ].join("\n");
}

export async function writeTodayFile(dataDir: string, state: AlexandriaState): Promise<string> {
  const todayText = renderTodayView(state);
  await writeFile(getLatestTodayPath(dataDir), todayText);
  return todayText;
}

function renderFocusGroup(
  tasks: Task[],
  planByTaskId: Map<string, PlanItem>,
  now: Date,
  emptyMessage: string,
): string {
  const lines = tasks.map((task) => {
    const planItem = planByTaskId.get(task.id);
    const details = [
      `[${task.domain}]`,
      formatDate(task.dueAt),
      `${task.estimateHours}h`,
      describeUrgency(task, now),
      planItem?.plannedFor === "today" ? "Planned for today" : null,
    ].filter(Boolean);

    return `${task.title} | ${details.join(" | ")}`;
  });

  return renderLines(lines, emptyMessage);
}

function renderTaskGroup(tasks: Task[], emptyMessage: string): string {
  const lines = tasks.map(
    (task) => `${task.title} [${task.domain}] (${formatDate(task.dueAt)}, ${task.estimateHours}h)`,
  );

  return renderLines(lines, emptyMessage);
}

function renderAlerts(messages: string[]): string {
  return renderLines(messages, "No active alerts.");
}

function renderLines(lines: string[], emptyMessage: string): string {
  if (lines.length === 0) {
    return `- ${emptyMessage}`;
  }

  return lines.map((line) => `- ${line}`).join("\n");
}

function takeUniqueTasks(tasks: Task[], limit: number, excludedIds = new Set<string>()): Task[] {
  const results: Task[] = [];
  const seen = new Set(excludedIds);

  for (const task of tasks) {
    if (seen.has(task.id)) {
      continue;
    }

    seen.add(task.id);
    results.push(task);

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function findTask(tasks: Task[], taskId: string): Task | undefined {
  return tasks.find((task) => task.id === taskId);
}

function isTask(task: Task | undefined): task is Task {
  return task !== undefined;
}

function describeUrgency(task: Task, now: Date): string | null {
  if (!task.dueAt) {
    return null;
  }

  const due = new Date(task.dueAt);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfDayAfterTomorrow = new Date(startOfTomorrow);
  startOfDayAfterTomorrow.setDate(startOfDayAfterTomorrow.getDate() + 1);

  if (due.getTime() < now.getTime()) {
    return "Overdue";
  }

  if (due.getTime() < startOfTomorrow.getTime()) {
    return "Due today";
  }

  if (due.getTime() < startOfDayAfterTomorrow.getTime()) {
    return "Due tomorrow";
  }

  const daysAway = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return `Due in ${daysAway} day(s)`;
}

function isOverdue(task: Task, now: Date): boolean {
  if (!task.dueAt) {
    return false;
  }

  return new Date(task.dueAt).getTime() < now.getTime();
}

function isToday(task: Task, now: Date): boolean {
  return isOnOffsetDay(task, now, 0);
}

function isTomorrow(task: Task, now: Date): boolean {
  return isOnOffsetDay(task, now, 1);
}

function isLaterThisWeek(task: Task, now: Date): boolean {
  if (!task.dueAt || isOverdue(task, now) || isToday(task, now) || isTomorrow(task, now)) {
    return false;
  }

  return isWithinDays(task, now, 7);
}

function isWithinDays(task: Task, now: Date, days: number): boolean {
  if (!task.dueAt) {
    return false;
  }

  const dueMs = new Date(task.dueAt).getTime();
  const nowMs = now.getTime();
  const maxMs = nowMs + days * 24 * 60 * 60 * 1000;

  return dueMs >= nowMs && dueMs <= maxMs;
}

function isOnOffsetDay(task: Task, now: Date, offset: number): boolean {
  if (!task.dueAt) {
    return false;
  }

  const due = new Date(task.dueAt);
  const target = new Date(now);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + offset);
  const next = new Date(target);
  next.setDate(next.getDate() + 1);

  return due.getTime() >= target.getTime() && due.getTime() < next.getTime();
}
