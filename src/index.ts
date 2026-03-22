import { loadAssignmentFromFile, enqueueAssignment, parseAssignmentBrief } from "./pipeline/intake.js";
import { promptForAssignmentBrief } from "./interactive/intake-wizard.js";
import { syncAlexandria } from "./pipeline/sync.js";
import { runScheduler } from "./pipeline/scheduler.js";
import { listTasks, updateTaskStatus } from "./pipeline/tasks.js";
import { getCanvasConfig, getDataDir, loadLocalEnv } from "./config.js";
import { parseArgs, readBooleanFlag, readNumberFlag, readStringFlag } from "./cli.js";
import { buildCurrentBrief, buildDashboard, buildTodayView, readState, runDemo } from "./demo.js";
import { FileAlexandriaStore } from "./memory/file-store.js";
import type { AssignmentBrief, TaskStatus } from "./types.js";
import { createId, nowIso } from "./utils.js";
import { CanvasClient } from "./connectors/canvas.js";
import { syncCanvasAssignments } from "./pipeline/canvas-sync.js";
import { runAristotleWebServer } from "./web/server.js";

async function main(): Promise<void> {
  loadLocalEnv();
  const command = process.argv[2] ?? "demo";
  const args = parseArgs(process.argv.slice(3));
  const dataDir = getDataDir();
  const store = new FileAlexandriaStore(dataDir);

  if (command === "demo") {
    console.log(await runDemo(store, dataDir));
    return;
  }

  if (command === "brief") {
    console.log(await buildCurrentBrief(store, dataDir));
    return;
  }

  if (command === "dashboard") {
    console.log(await buildDashboard(store, dataDir));
    return;
  }

  if (command === "today") {
    console.log(await buildTodayView(store, dataDir));
    return;
  }

  if (command === "intake") {
    const assignment = await resolveAssignmentInput(args);
    const queuedPath = await enqueueAssignment(dataDir, assignment);
    await recordEnqueuedAssignment(store, assignment.title, queuedPath);
    console.log(`Queued assignment in Aristotle inbox: ${queuedPath}`);

    if (readBooleanFlag(args, "sync")) {
      const result = await syncAlexandria(store, dataDir, {
        trigger: "manual",
      });
      console.log("");
      console.log(result.briefText);
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
      const result = await syncAlexandria(store, dataDir, {
        trigger: "manual",
        processPending: false,
      });
      console.log("");
      console.log(result.briefText);
    }
    return;
  }

  if (command === "sync") {
    const result = await syncAlexandria(store, dataDir, {
      trigger: "sync",
    });
    console.log(result.summary);
    console.log("");
    console.log(result.briefText);
    return;
  }

  if (command === "canvas") {
    await runCanvasCommand(args, store, dataDir);
    return;
  }

  if (command === "daemon") {
    const intervalSeconds = readNumberFlag(args, "interval") ?? 300;
    const ticks = readNumberFlag(args, "ticks");
    const includeCanvas = !readBooleanFlag(args, "skip-canvas");
    const canvasLimit = readNumberFlag(args, "canvas-limit") ?? 15;
    const schedulerOptions = {
      dataDir,
      store,
      intervalSeconds,
      canvasLimit,
      includeCanvas,
    };

    if (includeCanvas) {
      try {
        Object.assign(schedulerOptions, { canvasConfig: getCanvasConfig() });
      } catch {
        // Canvas is optional for the daemon. Skip if not configured.
      }
    }

    if (ticks !== undefined) {
      Object.assign(schedulerOptions, { ticks });
    }

    await runScheduler(schedulerOptions);
    return;
  }

  if (command === "web") {
    const port = readNumberFlag(args, "port") ?? 4177;
    const host = readStringFlag(args, "host") ?? "127.0.0.1";
    const includeCanvas = !readBooleanFlag(args, "skip-canvas");
    const canvasLimit = readNumberFlag(args, "canvas-limit") ?? 15;
    const serverOptions = {
      dataDir,
      store,
      host,
      port,
      includeCanvas,
      canvasLimit,
      syncOnStart: readBooleanFlag(args, "sync"),
    };

    if (includeCanvas) {
      try {
        Object.assign(serverOptions, { canvasConfig: getCanvasConfig() });
      } catch {
        // Canvas is optional for the web dashboard. Skip if not configured.
      }
    }

    await runAristotleWebServer(serverOptions);
    return;
  }

  if (command === "state") {
    console.log(JSON.stringify(await readState(store), null, 2));
    return;
  }

  console.error(
    "Unknown command. Use `demo`, `dashboard`, `today`, `intake`, `tasks`, `task`, `sync`, `canvas`, `brief`, `daemon`, `web`, or `state`.",
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
  store: FileAlexandriaStore,
  title: string,
  queuedPath: string,
): Promise<void> {
  const state = await store.load();
  state.events.push({
    id: createId("event"),
    type: "intake.enqueued",
    actor: "Intake",
    summary: `Queued ${title} for Aristotle intake.`,
    createdAt: nowIso(),
    metadata: {
      path: queuedPath,
      title,
    },
  });
  await store.save(state);
}

async function runCanvasCommand(
  args: ReturnType<typeof parseArgs>,
  store: FileAlexandriaStore,
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
    console.log(result.pipeline.briefText);
    return;
  }

  throw new Error("Use `npm run canvas:profile`, `npm run canvas:preview`, or `npm run canvas:sync`.");
}
