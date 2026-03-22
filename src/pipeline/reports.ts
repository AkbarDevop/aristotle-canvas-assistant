import type { AristotleState, Draft, SourceRecord, Task } from "../types.js";
import { daysUntil, formatDate, sortByUrgency } from "../utils.js";

export interface ReportOptions {
  course?: string;
  days?: number;
  limit?: number;
  includeDone?: boolean;
  now?: Date;
}

export function listCourses(state: AristotleState): string {
  const stats = buildCourseStats(state);

  if (stats.length === 0) {
    return "No courses tracked yet. Run `npm run canvas:sync` or `npm run intake -- --interactive --sync` first.";
  }

  return [
    "Tracked courses",
    ...stats.map(
      (course) =>
        `- ${course.name} | ${course.openTasks} open task(s) | ${course.assignments} assignment(s) | next due ${course.nextDue ? formatDate(course.nextDue) : "none"}`,
    ),
  ].join("\n");
}

export function renderUpdatesReport(state: AristotleState, options: ReportOptions = {}): string {
  const now = options.now ?? new Date();
  const courseName = resolveCourseName(state, options.course);
  const days = options.days ?? 14;
  const limit = options.limit ?? 12;
  const includeDone = options.includeDone ?? false;
  const filteredTasks = filterTasks(state.tasks, courseName, includeDone);
  const queue = sortByUrgency(filteredTasks).filter((task) => isWithinWindow(task, now, days)).slice(0, limit);
  const drafts = filterDrafts(state.drafts, courseName).slice(0, 6);
  const recentEvents = filterEvents(state.events, courseName).slice(0, 6);
  const courseStats = courseName
    ? buildCourseStats(state).filter((entry) => entry.name === courseName)
    : buildCourseStats(state);
  const openTasks = filterTasks(state.tasks, courseName, false);
  const overdueTasks = openTasks.filter((task) => isOverdue(task, now));

  const lines = [
    "Aristotle terminal report",
    `Generated: ${formatDate(now.toISOString())}`,
    courseName ? `Course: ${courseName}` : `Courses tracked: ${courseStats.length}`,
    `Open tasks: ${openTasks.length}`,
    `Overdue tasks: ${overdueTasks.length}`,
  ];

  lines.push("");
  lines.push(courseName ? "Course summary" : "Course summary");
  if (courseStats.length === 0) {
    lines.push("- No matching course state yet.");
  } else {
    for (const course of courseStats) {
      lines.push(
        `- ${course.name} | ${course.openTasks} open task(s) | ${course.assignments} assignment(s) | next due ${course.nextDue ? formatDate(course.nextDue) : "none"}`,
      );
    }
  }

  lines.push("");
  lines.push(`Priority queue (${days}-day window)`);
  if (queue.length === 0) {
    lines.push("- No open tasks in this window.");
  } else {
    queue.forEach((task, index) => {
      lines.push(
        `${index + 1}. [${task.status}] ${formatDueLabel(task.dueAt, now)} | ${task.course} | ${task.title} (${task.estimateHours}h)`,
      );
    });
  }

  lines.push("");
  lines.push("Drafts");
  if (drafts.length === 0) {
    lines.push("- No drafts available.");
  } else {
    for (const draft of drafts) {
      lines.push(`- ${draft.course} | ${draft.title}`);
    }
  }

  lines.push("");
  lines.push("Recent activity");
  if (recentEvents.length === 0) {
    lines.push("- No recent activity.");
  } else {
    for (const event of recentEvents) {
      lines.push(`- ${formatDate(event.createdAt)} | ${event.summary}`);
    }
  }

  return lines.join("\n");
}

export function renderPrepReport(state: AristotleState, courseQuery?: string): string {
  const courseName = resolveCourseName(state, courseQuery);
  if (!courseName) {
    const availableCourses = buildCourseStats(state).map((entry) => entry.name);
    if (availableCourses.length === 0) {
      return "No courses tracked yet. Run `npm run canvas:sync` first.";
    }

    return [
      "Course not found.",
      "Available courses:",
      ...availableCourses.map((course) => `- ${course}`),
    ].join("\n");
  }

  const tasks = sortByUrgency(filterTasks(state.tasks, courseName, false));
  const drafts = filterDrafts(state.drafts, courseName);
  const sources = filterSources(state.sources, courseName);
  const assignments = buildAssignmentStats(tasks, sources);

  const lines = [
    `Aristotle prep report: ${courseName}`,
    `Assignments tracked: ${assignments.length}`,
    `Open tasks: ${tasks.length}`,
    "",
    "Assignments",
  ];

  if (assignments.length === 0) {
    lines.push("- No assignments tracked for this course yet.");
  } else {
    for (const assignment of assignments) {
      lines.push(
        `- ${assignment.assignmentTitle} | ${assignment.openTasks} open task(s) | next due ${assignment.nextDue ? formatDate(assignment.nextDue) : "none"}`,
      );
    }
  }

  lines.push("");
  lines.push("Suggested attack order");
  if (tasks.length === 0) {
    lines.push("- No open tasks.");
  } else {
    tasks.slice(0, 10).forEach((task, index) => {
      lines.push(
        `${index + 1}. ${task.title} | ${formatDueLabel(task.dueAt, new Date())} | ${task.estimateHours}h`,
      );
    });
  }

  lines.push("");
  lines.push("Drafts and checklists");
  if (drafts.length === 0) {
    lines.push("- No drafts available.");
  } else {
    for (const draft of drafts) {
      lines.push(`- ${draft.title}`);
    }
  }

  lines.push("");
  lines.push("Recommended terminal flow");
  lines.push("1. Run `npm run tasks` and pick the first two open items for this course.");
  lines.push("2. Open the draft/checklist for the assignment before touching Canvas.");
  lines.push("3. Mark progress with `npm run task -- --id <task_id> --status in_progress`.");
  lines.push("4. Re-run `npm run prep -- --course \"<course>\"` after each sync.");

  return lines.join("\n");
}

function buildCourseStats(state: AristotleState): CourseStat[] {
  const stats = new Map<string, CourseStat>();

  for (const source of state.sources) {
    const existing = stats.get(source.course) ?? createCourseStat(source.course);

    existing.assignments += 1;
    stats.set(source.course, existing);
  }

  for (const task of state.tasks) {
    const existing = stats.get(task.course) ?? createCourseStat(task.course);

    if (task.status !== "done") {
      existing.openTasks += 1;
      if (task.dueAt && (!existing.nextDue || task.dueAt < existing.nextDue)) {
        existing.nextDue = task.dueAt;
      }
    }

    stats.set(task.course, existing);
  }

  return [...stats.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function buildAssignmentStats(tasks: Task[], sources: SourceRecord[]): AssignmentStat[] {
  const stats = new Map<string, AssignmentStat>();

  for (const source of sources) {
    stats.set(source.assignmentTitle, createAssignmentStat(source.assignmentTitle));
  }

  for (const task of tasks) {
    const existing = stats.get(task.assignmentTitle) ?? createAssignmentStat(task.assignmentTitle);

    existing.openTasks += 1;
    if (task.dueAt && (!existing.nextDue || task.dueAt < existing.nextDue)) {
      existing.nextDue = task.dueAt;
    }

    stats.set(task.assignmentTitle, existing);
  }

  return [...stats.values()].sort((left, right) => {
    const leftDue = left.nextDue ?? "9999-12-31T23:59:59.000Z";
    const rightDue = right.nextDue ?? "9999-12-31T23:59:59.000Z";
    return leftDue.localeCompare(rightDue);
  });
}

function filterTasks(tasks: Task[], courseName?: string, includeDone = false): Task[] {
  return tasks.filter((task) => {
    if (!includeDone && task.status === "done") {
      return false;
    }

    return !courseName || task.course === courseName;
  });
}

function filterDrafts(drafts: Draft[], courseName?: string): Draft[] {
  return drafts.filter((draft) => !courseName || draft.course === courseName);
}

function filterSources(sources: SourceRecord[], courseName?: string): SourceRecord[] {
  return sources.filter((source) => !courseName || source.course === courseName);
}

function filterEvents(
  events: AristotleState["events"],
  courseName?: string,
): AristotleState["events"] {
  const filtered = courseName
    ? events.filter((event) => {
        const metadataCourse = event.metadata?.course;
        return !metadataCourse || metadataCourse === courseName;
      })
    : events;

  return filtered
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function resolveCourseName(state: AristotleState, query?: string): string | undefined {
  if (!query) {
    return undefined;
  }

  const normalized = query.trim().toLowerCase();
  const courses = buildCourseStats(state).map((entry) => entry.name);

  return (
    courses.find((course) => course.toLowerCase() === normalized) ??
    courses.find((course) => course.toLowerCase().includes(normalized))
  );
}

function isWithinWindow(task: Task, now: Date, days: number): boolean {
  if (!task.dueAt) {
    return true;
  }

  return daysUntil(task.dueAt, now) <= days;
}

function isOverdue(task: Task, now: Date): boolean {
  return Boolean(task.dueAt && new Date(task.dueAt).getTime() < now.getTime());
}

function formatDueLabel(dueAt: string | undefined, now: Date): string {
  if (!dueAt) {
    return "No due date";
  }

  const dayDelta = daysUntil(dueAt, now);
  if (new Date(dueAt).getTime() < now.getTime()) {
    return `Overdue | ${formatDate(dueAt)}`;
  }
  if (dayDelta <= 0) {
    return `Due today | ${formatDate(dueAt)}`;
  }
  if (dayDelta === 1) {
    return `Due tomorrow | ${formatDate(dueAt)}`;
  }

  return `Due in ${dayDelta}d | ${formatDate(dueAt)}`;
}

interface CourseStat {
  name: string;
  assignments: number;
  openTasks: number;
  nextDue?: string;
}

interface AssignmentStat {
  assignmentTitle: string;
  openTasks: number;
  nextDue?: string;
}

function createCourseStat(name: string): CourseStat {
  return {
    name,
    assignments: 0,
    openTasks: 0,
  };
}

function createAssignmentStat(assignmentTitle: string): AssignmentStat {
  return {
    assignmentTitle,
    openTasks: 0,
  };
}
