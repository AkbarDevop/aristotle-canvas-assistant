import type { AgentResult, Alert, PlanItem, Task } from "../types.js";
import { createId, daysUntil, nowIso, sortByUrgency } from "../utils.js";
import { NAPOLEON_PROFILE } from "./profiles.js";

export interface NapoleonOutput extends AgentResult {
  topTasks: Task[];
}

export function runNapoleon(tasks: Task[]): NapoleonOutput {
  const currentTime = nowIso();
  const openTasks = sortByUrgency(tasks.filter((task) => task.status !== "done"));
  const topTasks = openTasks.slice(0, 6);
  const plan = topTasks.map((task, index) => createPlanItem(task, index));
  const alerts = buildAlerts(topTasks, currentTime);

  return {
    topTasks,
    plan,
    alerts,
    summary: `${NAPOLEON_PROFILE.displayName} prioritized ${topTasks.length} open tasks and surfaced ${alerts.length} alert(s).`,
  };
}

function createPlanItem(task: Task, index: number): PlanItem {
  const days = task.dueAt ? daysUntil(task.dueAt) : 99;
  const plannedFor =
    days <= 1 || index < 2 ? "today" : days <= 7 || index < 5 ? "this_week" : "later";

  return {
    id: createId("plan"),
    label: task.title,
    taskId: task.id,
    plannedFor,
    rationale: task.dueAt
      ? `${describeDeadline(task.dueAt)} with priority ${task.priority}.`
      : `Priority ${task.priority} with no explicit deadline.`,
  };
}

function buildAlerts(tasks: Task[], createdAt: string): Alert[] {
  const alerts: Alert[] = [];
  const nextThreeDays = tasks.filter((task) => task.dueAt && daysUntil(task.dueAt) <= 3);
  const estimatedHours = nextThreeDays.reduce((sum, task) => sum + task.estimateHours, 0);

  for (const task of tasks) {
    if (!task.dueAt) {
      continue;
    }

    const days = daysUntil(task.dueAt);
    if (days < 0) {
      alerts.push({
        id: createId("alert"),
        severity: "critical",
        message: `${task.title} is overdue.`,
        taskId: task.id,
        createdAt,
      });
    } else if (days <= 1) {
      alerts.push({
        id: createId("alert"),
        severity: "warning",
        message: `${task.title} is due within 24 hours.`,
        taskId: task.id,
        createdAt,
      });
    }
  }

  if (estimatedHours >= 8) {
    alerts.push({
      id: createId("alert"),
      severity: "warning",
      message: `Upcoming workload is heavy: ${estimatedHours} estimated hours due within the next three days.`,
      createdAt,
    });
  }

  return alerts;
}

function describeDeadline(dueAt: string): string {
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  if (due < now) {
    return "Overdue";
  }

  if (due - now < dayMs) {
    return "Due today";
  }

  if (due - now < 2 * dayMs) {
    return "Due tomorrow";
  }

  return `Due in ${Math.max(daysUntil(dueAt), 0)} day(s)`;
}
