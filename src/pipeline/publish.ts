import type { AristotleState, Task } from "../types.js";
import { formatDate } from "../utils.js";

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
