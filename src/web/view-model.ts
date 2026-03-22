import type { AlexandriaState, Domain, PlanItem, SourceRecord, Task, TaskStatus } from "../types.js";
import { formatDate, sortByUrgency } from "../utils.js";

export interface WebTaskView {
  id: string;
  title: string;
  domain: Domain;
  status: TaskStatus;
  courseLabel?: string;
  priority: number;
  estimateHours: number;
  dueAt?: string;
  dueLabel: string;
  urgencyLabel: string;
  notes: string;
  plannedFor?: PlanItem["plannedFor"];
  rationale?: string;
  sources: Array<{
    title: string;
    link?: string;
  }>;
}

export interface AlexandriaWebView {
  generatedAt: string;
  courses: string[];
  snapshot: {
    activeTasks: number;
    inProgress: number;
    universityTasks: number;
    planningItems: number;
    alerts: number;
    drafts: number;
  };
  focus: WebTaskView[];
  commitmentsToday: WebTaskView[];
  nextUp: WebTaskView[];
  buckets: {
    today: WebTaskView[];
    tomorrow: WebTaskView[];
    thisWeek: WebTaskView[];
  };
  alerts: AlexandriaState["alerts"];
  latestDrafts: AlexandriaState["drafts"];
  latestBrief?: AlexandriaState["briefs"][number];
  recentRuns: AlexandriaState["runs"];
  tasks: WebTaskView[];
}

export function buildAlexandriaWebView(
  state: AlexandriaState,
  now = new Date(),
): AlexandriaWebView {
  const activeTasks = sortByUrgency(state.tasks.filter((task) => task.status !== "done"));
  const inProgress = activeTasks.filter((task) => task.status === "in_progress");
  const planningTasks = activeTasks.filter((task) => task.domain === "planning");
  const universityTasks = activeTasks.filter((task) => task.domain === "university");
  const workTasks = activeTasks.filter((task) => task.domain !== "planning");
  const planByTaskId = new Map(state.plan.map((item) => [item.taskId, item]));
  const sourceIndex = new Map(state.sources.map((source) => [source.id, source]));
  const courses = Array.from(
    new Set(
      activeTasks
        .map((task) => deriveCourseLabel(task, sourceIndex))
        .filter((courseLabel): courseLabel is string => Boolean(courseLabel)),
    ),
  ).sort((left, right) => left.localeCompare(right));

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

  const commitmentsToday = takeUniqueTasks(
    planningTasks.filter((task) => isToday(task, now)),
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
    6,
    new Set(focus.map((task) => task.id)),
  );

  const view: AlexandriaWebView = {
    generatedAt: now.toISOString(),
    courses,
    snapshot: {
      activeTasks: activeTasks.length,
      inProgress: inProgress.length,
      universityTasks: universityTasks.length,
      planningItems: planningTasks.length,
      alerts: state.alerts.length,
      drafts: state.drafts.length,
    },
    focus: focus.map((task) => toWebTaskView(task, planByTaskId, sourceIndex, now)),
    commitmentsToday: commitmentsToday.map((task) =>
      toWebTaskView(task, planByTaskId, sourceIndex, now),
    ),
    nextUp: nextUp.map((task) => toWebTaskView(task, planByTaskId, sourceIndex, now)),
    buckets: {
      today: activeTasks
        .filter((task) => isToday(task, now))
        .slice(0, 10)
        .map((task) => toWebTaskView(task, planByTaskId, sourceIndex, now)),
      tomorrow: activeTasks
        .filter((task) => isTomorrow(task, now))
        .slice(0, 10)
        .map((task) => toWebTaskView(task, planByTaskId, sourceIndex, now)),
      thisWeek: activeTasks
        .filter((task) => isLaterThisWeek(task, now))
        .slice(0, 10)
        .map((task) => toWebTaskView(task, planByTaskId, sourceIndex, now)),
    },
    alerts: state.alerts.slice(0, 8),
    latestDrafts: state.drafts.slice(0, 6),
    recentRuns: state.runs.slice(0, 6),
    tasks: activeTasks.map((task) => toWebTaskView(task, planByTaskId, sourceIndex, now)),
  };

  if (state.briefs[0]) {
    view.latestBrief = state.briefs[0];
  }

  return view;
}

function toWebTaskView(
  task: Task,
  planByTaskId: Map<string, PlanItem>,
  sourceIndex: Map<string, SourceRecord>,
  now: Date,
): WebTaskView {
  const planItem = planByTaskId.get(task.id);

  const view: WebTaskView = {
    id: task.id,
    title: task.title,
    domain: task.domain,
    status: task.status,
    priority: task.priority,
    estimateHours: task.estimateHours,
    dueLabel: formatDate(task.dueAt),
    urgencyLabel: describeUrgency(task, now),
    notes: task.notes,
    sources: task.sourceIds
      .map((sourceId) => sourceIndex.get(sourceId))
      .filter(isSource)
      .map((source) => ({
        title: source.title,
        ...(source.link ? { link: source.link } : {}),
      })),
  };

  if (task.dueAt) {
    view.dueAt = task.dueAt;
  }

  if (planItem?.plannedFor) {
    view.plannedFor = planItem.plannedFor;
  }

  if (planItem?.rationale) {
    view.rationale = planItem.rationale;
  }

  const courseLabel = deriveCourseLabel(task, sourceIndex);
  if (courseLabel) {
    view.courseLabel = courseLabel;
  }

  return view;
}

function findTask(tasks: Task[], taskId: string): Task | undefined {
  return tasks.find((task) => task.id === taskId);
}

function isTask(task: Task | undefined): task is Task {
  return task !== undefined;
}

function isSource(source: SourceRecord | undefined): source is SourceRecord {
  return source !== undefined;
}

function deriveCourseLabel(
  task: Task,
  sourceIndex: Map<string, SourceRecord>,
): string | undefined {
  for (const sourceId of task.sourceIds) {
    const source = sourceIndex.get(sourceId);
    if (!source) {
      continue;
    }

    if (task.domain === "university") {
      const separatorIndex = source.title.indexOf(":");
      if (separatorIndex > 0) {
        return source.title.slice(0, separatorIndex).trim();
      }
    }

  }

  return undefined;
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

function describeUrgency(task: Task, now: Date): string {
  if (!task.dueAt) {
    return "No deadline";
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
