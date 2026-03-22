import { writeFile } from "node:fs/promises";

import { getLatestDashboardPath } from "../config.js";
import type { AlexandriaState, Task } from "../types.js";
import { formatDate, sortByUrgency } from "../utils.js";

export function renderDashboard(state: AlexandriaState, now = new Date()): string {
  const activeTasks = sortByUrgency(state.tasks.filter((task) => task.status !== "done"));
  const inProgress = activeTasks.filter((task) => task.status === "in_progress");
  const planningTasks = activeTasks.filter((task) => task.domain === "planning");
  const universityTasks = activeTasks.filter((task) => task.domain === "university");
  const overdue = activeTasks.filter((task) => isOverdue(task, now));
  const today = activeTasks.filter((task) => isToday(task, now));
  const tomorrow = activeTasks.filter((task) => isTomorrow(task, now));
  const thisWeek = activeTasks.filter((task) => isLaterThisWeek(task, now));
  const commitments = planningTasks.filter((task) => isWithinDays(task, now, 7)).slice(0, 6);
  const latestDrafts = state.drafts.slice(0, 4);

  return [
    "Aristotle dashboard",
    `Updated: ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(now)}`,
    "",
    "Snapshot",
    `- Active tasks: ${activeTasks.length}`,
    `- In progress: ${inProgress.length}`,
    `- University tasks: ${universityTasks.length}`,
    `- Planning items: ${planningTasks.length}`,
    `- Alerts: ${state.alerts.length}`,
    `- Drafts: ${state.drafts.length}`,
    "",
    "Overdue",
    renderTaskGroup(overdue, 5, "No overdue tasks."),
    "",
    "Today",
    renderTaskGroup(today, 8, "Nothing due today."),
    "",
    "Tomorrow",
    renderTaskGroup(tomorrow, 6, "Nothing due tomorrow."),
    "",
    "This Week",
    renderTaskGroup(thisWeek, 8, "Nothing else due this week."),
    "",
    "Commitments",
    renderTaskGroup(commitments, 6, "No upcoming planning items."),
    "",
    "Alerts",
    renderAlerts(state.alerts.map((alert) => alert.message)),
    "",
    "Latest Drafts",
    renderLines(latestDrafts.map((draft) => `${draft.title} (${draft.domain})`), "No drafts yet."),
  ].join("\n");
}

export async function writeDashboardFile(dataDir: string, state: AlexandriaState): Promise<string> {
  const dashboardText = renderDashboard(state);
  await writeFile(getLatestDashboardPath(dataDir), dashboardText);
  return dashboardText;
}

function renderTaskGroup(tasks: Task[], limit: number, emptyMessage: string): string {
  const lines = tasks
    .slice(0, limit)
    .map((task) => `${task.title} [${task.domain}] (${formatDate(task.dueAt)}, ${task.estimateHours}h)`);

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
