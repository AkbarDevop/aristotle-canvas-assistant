import type { AristotleState, Task } from "../types.js";
import { formatDate } from "../utils.js";

export type PublishTarget =
  | "google-calendar"
  | "google-tasks"
  | "trello"
  | "todoist"
  | "notion"
  | "microsoft-calendar"
  | "microsoft-todo";

export interface ExternalTaskDraft {
  title: string;
  description: string;
  dueAt?: string;
}

export interface ExternalCalendarDraft {
  summary: string;
  description: string;
  startAt: string;
  endAt: string;
}

export function getTaskById(state: AristotleState, taskId: string): Task {
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  return task;
}

export function buildExternalTaskDraft(task: Task): ExternalTaskDraft {
  const descriptionLines = [
    `Course: ${task.course}`,
    `Assignment: ${task.assignmentTitle}`,
    `Status: ${task.status}`,
    `Estimate: ${task.estimateHours}h`,
    task.dueAt ? `Due: ${formatDate(task.dueAt)}` : null,
    "",
    task.notes,
  ].filter(Boolean);

  return {
    title: `${task.course} | ${task.title}`,
    description: descriptionLines.join("\n"),
    ...(task.dueAt ? { dueAt: task.dueAt } : {}),
  };
}

export function buildExternalCalendarDraft(
  task: Task,
  options: { startAt: string; endAt?: string; durationHours?: number },
): ExternalCalendarDraft {
  const startDate = new Date(options.startAt);
  if (Number.isNaN(startDate.getTime())) {
    throw new Error(`Expected a valid --start value, received: ${options.startAt}`);
  }

  const endAt =
    options.endAt ??
    new Date(
      startDate.getTime() +
        Math.max(1, Math.round((options.durationHours ?? task.estimateHours) * 60)) * 60 * 1000,
    ).toISOString();
  const endDate = new Date(endAt);
  if (Number.isNaN(endDate.getTime())) {
    throw new Error(`Expected a valid end datetime, received: ${endAt}`);
  }
  if (endDate.getTime() <= startDate.getTime()) {
    throw new Error("Expected the event end time to be after the start time.");
  }

  const descriptionLines = [
    `Course: ${task.course}`,
    `Assignment: ${task.assignmentTitle}`,
    `Task ID: ${task.id}`,
    task.dueAt ? `Task due: ${formatDate(task.dueAt)}` : null,
    `Estimated work: ${task.estimateHours}h`,
    "",
    task.notes,
  ].filter(Boolean);

  return {
    summary: `${task.course} study block | ${task.title}`,
    description: descriptionLines.join("\n"),
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
  };
}

export function resolvePublishTarget(input: string): PublishTarget {
  const normalized = input.trim().toLowerCase();

  if (
    normalized === "google-calendar" ||
    normalized === "google" ||
    normalized === "gcal" ||
    normalized === "calendar"
  ) {
    return "google-calendar";
  }

  if (
    normalized === "google-tasks" ||
    normalized === "gtasks" ||
    normalized === "tasks"
  ) {
    return "google-tasks";
  }

  if (normalized === "trello") {
    return "trello";
  }

  if (normalized === "todoist") {
    return "todoist";
  }

  if (normalized === "notion") {
    return "notion";
  }

  if (
    normalized === "microsoft-calendar" ||
    normalized === "outlook-calendar" ||
    normalized === "outlook" ||
    normalized === "ms-calendar"
  ) {
    return "microsoft-calendar";
  }

  if (
    normalized === "microsoft-todo" ||
    normalized === "ms-todo" ||
    normalized === "todo"
  ) {
    return "microsoft-todo";
  }

  throw new Error(
    `Unknown publish target: ${input}. Use one of: google-calendar, google-tasks, trello, todoist, notion, microsoft-calendar, microsoft-todo.`,
  );
}

export function listPublishTargets(): PublishTarget[] {
  return [
    "google-calendar",
    "google-tasks",
    "trello",
    "todoist",
    "notion",
    "microsoft-calendar",
    "microsoft-todo",
  ];
}
