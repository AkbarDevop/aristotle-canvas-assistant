import { loadAssignmentFromFile, enqueueAssignment, parseAssignmentBrief } from "./pipeline/intake.js";
import { promptForAssignmentBrief } from "./interactive/intake-wizard.js";
import { syncAristotle } from "./pipeline/sync.js";
import { listTasks, updateTaskStatus } from "./pipeline/tasks.js";
import { getCanvasConfig, getDataDir, loadLocalEnv } from "./config.js";
import { parseArgs, readBooleanFlag, readNumberFlag, readStringFlag } from "./cli.js";
import { readState, runDemo } from "./demo.js";
import { FileAristotleStore } from "./memory/file-store.js";
import type { AssignmentBrief, TaskStatus } from "./types.js";
import { createId, nowIso } from "./utils.js";
import { CanvasClient } from "./connectors/canvas.js";
import { syncCanvasAssignments } from "./pipeline/canvas-sync.js";
import { listCourses, renderPrepReport, renderUpdatesReport } from "./pipeline/reports.js";

async function main(): Promise<void> {
  loadLocalEnv();
  const command = process.argv[2] ?? "demo";
  const args = parseArgs(process.argv.slice(3));
  const dataDir = getDataDir();
  const store = new FileAristotleStore(dataDir);

  if (command === "demo") {
    console.log(await runDemo(store, dataDir));
    return;
  }

  if (command === "intake") {
    const assignment = await resolveAssignmentInput(args);
    const queuedPath = await enqueueAssignment(dataDir, assignment);
    await recordEnqueuedAssignment(store, assignment, queuedPath);
    console.log(`Queued assignment in Aristotle inbox: ${queuedPath}`);

    if (readBooleanFlag(args, "sync")) {
      const result = await syncAristotle(store, dataDir, {
        trigger: "manual",
      });
      console.log("");
      console.log(result.reportText);
    }

    return;
  }

  if (command === "tasks") {
    console.log(await listTasks(store, readBooleanFlag(args, "all")));
    return;
  }

  if (command === "task") {
    const taskId = readStringFlag(args, "id");
    const status = readStringFlag(args, "status");
    if (!taskId || !status || !isTaskStatus(status)) {
      throw new Error("Use `npm run task -- --id <task_id> --status todo|in_progress|done|blocked [--sync]`.");
    }

    const updatedTask = await updateTaskStatus(store, taskId, status);
    console.log(`Updated ${updatedTask.id}: ${updatedTask.title} -> ${updatedTask.status}`);

    if (readBooleanFlag(args, "sync")) {
      const result = await syncAristotle(store, dataDir, {
        trigger: "manual",
        processPending: false,
      });
      console.log("");
      console.log(result.reportText);
    }
    return;
  }

  if (command === "sync") {
    const result = await syncAristotle(store, dataDir, {
      trigger: "sync",
    });
    console.log(result.summary);
    console.log("");
    console.log(result.reportText);
    return;
  }

  if (command === "updates") {
    const state = await readState(store);
    const course = readStringFlag(args, "course");
    const days = readNumberFlag(args, "days");
    const limit = readNumberFlag(args, "limit");
    console.log(
      renderUpdatesReport(state, {
        ...(course ? { course } : {}),
        ...(days !== undefined ? { days } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(readBooleanFlag(args, "all") ? { includeDone: true } : {}),
      }),
    );
    return;
  }

  if (command === "prep") {
    const state = await readState(store);
    const course = readStringFlag(args, "course") ?? args.positionals[0];
    console.log(renderPrepReport(state, course));
    return;
  }

  if (command === "courses") {
    const state = await readState(store);
    console.log(listCourses(state));
    return;
  }

  if (command === "canvas") {
    await runCanvasCommand(args, store, dataDir);
    return;
  }

  if (command === "state") {
    console.log(JSON.stringify(await readState(store), null, 2));
    return;
  }

  console.error(
    "Unknown command. Use `demo`, `intake`, `tasks`, `task`, `sync`, `updates`, `prep`, `courses`, `canvas`, or `state`.",
  );
  process.exitCode = 1;
}

async function resolveAssignmentInput(args: ReturnType<typeof parseArgs>): Promise<AssignmentBrief> {
  if (readBooleanFlag(args, "interactive")) {
    return promptForAssignmentBrief();
  }

  const filePath = readStringFlag(args, "file");
  if (filePath) {
    return loadAssignmentFromFile(filePath);
  }

  const rawAssignment: Partial<AssignmentBrief> = {};
  const course = readStringFlag(args, "course");
  const title = readStringFlag(args, "title");
  const summary = readStringFlag(args, "summary");
  const deliverable = readStringFlag(args, "deliverable");
  const dueAt = readStringFlag(args, "due");
  const effortHours = readNumberFlag(args, "hours");
  const sourceLink = readStringFlag(args, "link");

  if (course) rawAssignment.course = course;
  if (title) rawAssignment.title = title;
  if (summary) rawAssignment.summary = summary;
  if (deliverable) rawAssignment.deliverable = deliverable;
  if (dueAt) rawAssignment.dueAt = dueAt;
  if (effortHours !== undefined) rawAssignment.effortHours = effortHours;
  if (sourceLink) rawAssignment.sourceLink = sourceLink;

  return parseAssignmentBrief(rawAssignment);
}

function isTaskStatus(value: string): value is TaskStatus {
  return value === "todo" || value === "in_progress" || value === "done" || value === "blocked";
}

void main();

async function recordEnqueuedAssignment(
  store: FileAristotleStore,
  assignment: AssignmentBrief,
  queuedPath: string,
): Promise<void> {
  const state = await store.load();
  state.events.push({
    id: createId("event"),
    type: "intake.enqueued",
    actor: "Intake",
    summary: `Queued ${assignment.title} for Aristotle intake.`,
    createdAt: nowIso(),
    metadata: {
      path: queuedPath,
      title: assignment.title,
      course: assignment.course,
    },
  });
  await store.save(state);
}

async function runCanvasCommand(
  args: ReturnType<typeof parseArgs>,
  store: FileAristotleStore,
  dataDir: string,
): Promise<void> {
  const subcommand = args.positionals[0] ?? "preview";
  const client = new CanvasClient(getCanvasConfig());

  if (subcommand === "profile") {
    const profile = await client.getProfile();
    console.log(
      JSON.stringify(
        {
          id: profile.id,
          name: profile.name,
          primary_email: profile.primary_email ?? null,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (subcommand === "preview") {
    const limit = readNumberFlag(args, "limit") ?? 10;
    const assignments = await client.listUpcomingAssignments(limit);
    console.log(
      JSON.stringify(
        assignments.map((assignment) => ({
          course: assignment.course,
          title: assignment.title,
          dueAt: assignment.dueAt,
          sourceLink: assignment.sourceLink ?? null,
          externalKey: assignment.externalKey ?? null,
        })),
        null,
        2,
      ),
    );
    return;
  }

  if (subcommand === "sync") {
    const limit = readNumberFlag(args, "limit") ?? 15;
    const assignments = await client.listUpcomingAssignments(limit);
    const result = await syncCanvasAssignments(store, dataDir, assignments);

    console.log(
      `Canvas fetched ${result.fetchedCount} upcoming assignment(s) and queued ${result.enqueuedCount} item(s).`,
    );
    console.log(result.pipeline.summary);
    console.log("");
    console.log(result.pipeline.reportText);
    return;
  }

  throw new Error("Use `npm run canvas:profile`, `npm run canvas:preview`, or `npm run canvas:sync`.");
}
