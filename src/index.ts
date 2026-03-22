import { loadAssignmentFromFile, enqueueAssignment, parseAssignmentBrief } from "./pipeline/intake.js";
import { promptForAssignmentBrief } from "./interactive/intake-wizard.js";
import { syncAristotle } from "./pipeline/sync.js";
import { listTasks, updateTaskStatus } from "./pipeline/tasks.js";
import {
  getCanvasConfig,
  getDataDir,
  getGoogleCalendarConfig,
  getGoogleTasksConfig,
  getMicrosoftGraphConfig,
  getNotionConfig,
  getTrelloConfig,
  getTodoistConfig,
  loadLocalEnv,
} from "./config.js";
import { parseArgs, readBooleanFlag, readNumberFlag, readStringFlag } from "./cli.js";
import { readState, runDemo } from "./demo.js";
import { FileAristotleStore } from "./memory/file-store.js";
import type { AssignmentBrief, TaskStatus } from "./types.js";
import { createId, nowIso } from "./utils.js";
import { CanvasClient } from "./connectors/canvas.js";
import { syncCanvasAssignments } from "./pipeline/canvas-sync.js";
import { listCourses, renderPrepReport, renderUpdatesReport } from "./pipeline/reports.js";
import { GoogleCalendarClient } from "./connectors/google-calendar.js";
import { TrelloClient } from "./connectors/trello.js";
import { TodoistClient } from "./connectors/todoist.js";
import { NotionClient } from "./connectors/notion.js";
import { GoogleTasksClient } from "./connectors/google-tasks.js";
import { MicrosoftGraphClient } from "./connectors/microsoft-graph.js";
import { buildExternalCalendarDraft, buildExternalTaskDraft, getTaskById } from "./pipeline/publish.js";

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

  if (command === "google") {
    await runGoogleCalendarCommand(args, store);
    return;
  }

  if (command === "google-tasks") {
    await runGoogleTasksCommand(args, store);
    return;
  }

  if (command === "trello") {
    await runTrelloCommand(args, store);
    return;
  }

  if (command === "todoist") {
    await runTodoistCommand(args, store);
    return;
  }

  if (command === "notion") {
    await runNotionCommand(args, store);
    return;
  }

  if (command === "microsoft") {
    await runMicrosoftCommand(args, store);
    return;
  }

  if (command === "state") {
    console.log(JSON.stringify(await readState(store), null, 2));
    return;
  }

  console.error(
    "Unknown command. Use `demo`, `intake`, `tasks`, `task`, `sync`, `updates`, `prep`, `courses`, `canvas`, `google`, `google-tasks`, `trello`, `todoist`, `notion`, `microsoft`, or `state`.",
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

async function runGoogleCalendarCommand(
  args: ReturnType<typeof parseArgs>,
  store: FileAristotleStore,
): Promise<void> {
  const subcommand = args.positionals[0] ?? "preview";
  const client = new GoogleCalendarClient(getGoogleCalendarConfig());

  if (subcommand === "auth") {
    await client.authorize();
    console.log("Google Calendar authorization completed.");
    return;
  }

  if (subcommand === "preview") {
    const limit = readNumberFlag(args, "limit") ?? 10;
    console.log(JSON.stringify(await client.listUpcomingEvents(limit), null, 2));
    return;
  }

  if (subcommand === "create") {
    const summary = readStringFlag(args, "summary") ?? readStringFlag(args, "title");
    const startAt = readStringFlag(args, "start");
    const endAt = readStringFlag(args, "end");
    const description = readStringFlag(args, "desc") ?? readStringFlag(args, "description");
    const location = readStringFlag(args, "location");
    const timeZone = readStringFlag(args, "time-zone");
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!summary || !startAt || !endAt) {
      throw new Error(
        "Use `npm run google:create -- --summary \"...\" --start <ISO> --end <ISO> [--desc \"...\"] [--location \"...\"] [--time-zone \"...\"] [--dry-run]`.",
      );
    }

    const payload = {
      summary,
      startAt,
      endAt,
      ...(description ? { description } : {}),
      ...(location ? { location } : {}),
      ...(timeZone ? { timeZone } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createEvent(payload), null, 2));
    return;
  }

  if (subcommand === "from-task") {
    const taskId = readStringFlag(args, "id");
    const startAt = readStringFlag(args, "start");
    const endAt = readStringFlag(args, "end");
    const durationHours = readNumberFlag(args, "hours");
    const location = readStringFlag(args, "location");
    const timeZone = readStringFlag(args, "time-zone");
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!taskId || !startAt) {
      throw new Error(
        "Use `npm run google:from-task -- --id <task_id> --start <ISO> [--end <ISO> | --hours <n>] [--location \"...\"] [--time-zone \"...\"] [--dry-run]`.",
      );
    }

    const task = getTaskById(await store.load(), taskId);
    const draft = buildExternalCalendarDraft(task, {
      startAt,
      ...(endAt ? { endAt } : {}),
      ...(durationHours !== undefined ? { durationHours } : {}),
    });
    const payload = {
      summary: draft.summary,
      startAt: draft.startAt,
      endAt: draft.endAt,
      description: draft.description,
      ...(location ? { location } : {}),
      ...(timeZone ? { timeZone } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createEvent(payload), null, 2));
    return;
  }

  throw new Error(
    "Use `npm run google:auth`, `npm run google:preview`, `npm run google:create`, or `npm run google:from-task`.",
  );
}

async function runGoogleTasksCommand(
  args: ReturnType<typeof parseArgs>,
  store: FileAristotleStore,
): Promise<void> {
  const subcommand = args.positionals[0] ?? "preview";
  const client = new GoogleTasksClient(getGoogleTasksConfig());

  if (subcommand === "auth") {
    await client.authorize();
    console.log("Google Tasks authorization completed.");
    return;
  }

  if (subcommand === "preview") {
    const limit = readNumberFlag(args, "limit") ?? 10;
    const listId = readStringFlag(args, "list-id");
    console.log(JSON.stringify(await client.listTasks(limit, listId), null, 2));
    return;
  }

  if (subcommand === "lists") {
    const limit = readNumberFlag(args, "limit") ?? 20;
    console.log(JSON.stringify(await client.listTaskLists(limit), null, 2));
    return;
  }

  if (subcommand === "create") {
    const title = readStringFlag(args, "title");
    const notes = readStringFlag(args, "notes") ?? readStringFlag(args, "desc");
    const dueAt = readStringFlag(args, "due");
    const taskListId = readStringFlag(args, "list-id");
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!title) {
      throw new Error(
        "Use `npm run google-tasks:create -- --title \"...\" [--notes \"...\"] [--due <ISO>] [--list-id <id>] [--dry-run]`.",
      );
    }

    const payload = {
      title,
      ...(notes ? { notes } : {}),
      ...(dueAt ? { dueAt } : {}),
      ...(taskListId ? { taskListId } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createTask(payload), null, 2));
    return;
  }

  if (subcommand === "from-task") {
    const taskId = readStringFlag(args, "id");
    const taskListId = readStringFlag(args, "list-id");
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!taskId) {
      throw new Error(
        "Use `npm run google-tasks:from-task -- --id <task_id> [--list-id <id>] [--dry-run]`.",
      );
    }

    const task = getTaskById(await store.load(), taskId);
    const draft = buildExternalTaskDraft(task);
    const payload = {
      title: draft.title,
      notes: draft.description,
      ...(draft.dueAt ? { dueAt: draft.dueAt } : {}),
      ...(taskListId ? { taskListId } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createTask(payload), null, 2));
    return;
  }

  throw new Error(
    "Use `npm run google-tasks:auth`, `npm run google-tasks:lists`, `npm run google-tasks:preview`, `npm run google-tasks:create`, or `npm run google-tasks:from-task`.",
  );
}

async function runTrelloCommand(
  args: ReturnType<typeof parseArgs>,
  store: FileAristotleStore,
): Promise<void> {
  const subcommand = args.positionals[0] ?? "preview";
  const config = getTrelloConfig();
  const client = new TrelloClient(config);
  const boardId = readStringFlag(args, "board-id") ?? config.boardId;

  if (subcommand === "profile") {
    const boardLimit = readNumberFlag(args, "limit") ?? 10;
    console.log(JSON.stringify(await client.getProfile(boardLimit), null, 2));
    return;
  }

  if (subcommand === "preview") {
    const limit = readNumberFlag(args, "limit") ?? 20;
    const snapshot = await client.getBoardSnapshot(limit, boardId);
    console.log(
      JSON.stringify(
        {
          board: snapshot.board,
          cards: snapshot.cards.map((card) => ({
            id: card.id,
            name: card.name,
            listName: card.listName,
            dueAt: card.dueAt ?? null,
            labels: card.labels,
            url: card.url,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (subcommand === "create") {
    const name = readStringFlag(args, "name");
    const desc = readStringFlag(args, "desc");
    const dueAt = readStringFlag(args, "due");
    const listId = readStringFlag(args, "list-id") ?? config.defaultListId;
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!name) {
      throw new Error(
        "Use `npm run trello:create -- --name \"...\" [--desc \"...\"] [--due <ISO>] [--list-id <list_id>] [--dry-run]`.",
      );
    }

    const payload = {
      name,
      ...(desc ? { desc } : {}),
      ...(dueAt ? { dueAt } : {}),
      ...(listId ? { listId } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createCard(payload), null, 2));
    return;
  }

  if (subcommand === "from-task") {
    const taskId = readStringFlag(args, "id");
    const listId = readStringFlag(args, "list-id") ?? config.defaultListId;
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!taskId) {
      throw new Error(
        "Use `npm run trello:from-task -- --id <task_id> [--list-id <list_id>] [--dry-run]`.",
      );
    }

    const task = getTaskById(await store.load(), taskId);
    const draft = buildExternalTaskDraft(task);
    const payload = {
      name: draft.title,
      desc: draft.description,
      ...(draft.dueAt ? { dueAt: draft.dueAt } : {}),
      ...(listId ? { listId } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createCard(payload), null, 2));
    return;
  }

  throw new Error(
    "Use `npm run trello:profile`, `npm run trello:preview`, `npm run trello:create`, or `npm run trello:from-task`.",
  );
}

async function runTodoistCommand(
  args: ReturnType<typeof parseArgs>,
  store: FileAristotleStore,
): Promise<void> {
  const subcommand = args.positionals[0] ?? "preview";
  const config = getTodoistConfig();
  const client = new TodoistClient(config);

  if (subcommand === "profile") {
    const limit = readNumberFlag(args, "limit") ?? 10;
    console.log(JSON.stringify(await client.getProfile(limit), null, 2));
    return;
  }

  if (subcommand === "preview") {
    const limit = readNumberFlag(args, "limit") ?? 20;
    const projectId = readStringFlag(args, "project-id");
    console.log(JSON.stringify(await client.listTasks(limit, projectId), null, 2));
    return;
  }

  if (subcommand === "projects") {
    const limit = readNumberFlag(args, "limit") ?? 20;
    console.log(JSON.stringify(await client.listProjects(limit), null, 2));
    return;
  }

  if (subcommand === "create") {
    const content = readStringFlag(args, "content") ?? readStringFlag(args, "title");
    const description = readStringFlag(args, "desc") ?? readStringFlag(args, "description");
    const dueAt = readStringFlag(args, "due");
    const projectId = readStringFlag(args, "project-id") ?? config.defaultProjectId;
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!content) {
      throw new Error(
        "Use `npm run todoist:create -- --content \"...\" [--desc \"...\"] [--due <ISO>] [--project-id <id>] [--dry-run]`.",
      );
    }

    const payload = {
      content,
      ...(description ? { description } : {}),
      ...(dueAt ? { dueAt } : {}),
      ...(projectId ? { projectId } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createTask(payload), null, 2));
    return;
  }

  if (subcommand === "from-task") {
    const taskId = readStringFlag(args, "id");
    const projectId = readStringFlag(args, "project-id") ?? config.defaultProjectId;
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!taskId) {
      throw new Error(
        "Use `npm run todoist:from-task -- --id <task_id> [--project-id <id>] [--dry-run]`.",
      );
    }

    const task = getTaskById(await store.load(), taskId);
    const draft = buildExternalTaskDraft(task);
    const payload = {
      content: draft.title,
      description: draft.description,
      ...(draft.dueAt ? { dueAt: draft.dueAt } : {}),
      ...(projectId ? { projectId } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createTask(payload), null, 2));
    return;
  }

  throw new Error(
    "Use `npm run todoist:profile`, `npm run todoist:projects`, `npm run todoist:preview`, `npm run todoist:create`, or `npm run todoist:from-task`.",
  );
}

async function runNotionCommand(
  args: ReturnType<typeof parseArgs>,
  store: FileAristotleStore,
): Promise<void> {
  const subcommand = args.positionals[0] ?? "preview";
  const config = getNotionConfig();
  const client = new NotionClient(config);

  if (subcommand === "profile") {
    console.log(JSON.stringify(await client.getProfile(), null, 2));
    return;
  }

  if (subcommand === "preview") {
    const limit = readNumberFlag(args, "limit") ?? 20;
    const parentPageId = readStringFlag(args, "parent-page-id");
    console.log(JSON.stringify(await client.listChildPages(limit, parentPageId), null, 2));
    return;
  }

  if (subcommand === "create") {
    const title = readStringFlag(args, "title");
    const body = readStringFlag(args, "body") ?? readStringFlag(args, "desc");
    const parentPageId = readStringFlag(args, "parent-page-id") ?? config.parentPageId;
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!title) {
      throw new Error(
        "Use `npm run notion:create -- --title \"...\" [--body \"...\"] [--parent-page-id <id>] [--dry-run]`.",
      );
    }

    const payload = {
      title,
      ...(body ? { body } : {}),
      ...(parentPageId ? { parentPageId } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createPage(payload), null, 2));
    return;
  }

  if (subcommand === "from-task") {
    const taskId = readStringFlag(args, "id");
    const parentPageId = readStringFlag(args, "parent-page-id") ?? config.parentPageId;
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!taskId) {
      throw new Error(
        "Use `npm run notion:from-task -- --id <task_id> [--parent-page-id <id>] [--dry-run]`.",
      );
    }

    const task = getTaskById(await store.load(), taskId);
    const draft = buildExternalTaskDraft(task);
    const payload = {
      title: draft.title,
      body: draft.description,
      ...(parentPageId ? { parentPageId } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createPage(payload), null, 2));
    return;
  }

  throw new Error(
    "Use `npm run notion:profile`, `npm run notion:preview`, `npm run notion:create`, or `npm run notion:from-task`.",
  );
}

async function runMicrosoftCommand(
  args: ReturnType<typeof parseArgs>,
  store: FileAristotleStore,
): Promise<void> {
  const subcommand = args.positionals[0] ?? "profile";
  const config = getMicrosoftGraphConfig();
  const client = new MicrosoftGraphClient(config);

  if (subcommand === "profile") {
    console.log(JSON.stringify(await client.getProfile(), null, 2));
    return;
  }

  if (subcommand === "calendar-preview") {
    const limit = readNumberFlag(args, "limit") ?? 10;
    console.log(JSON.stringify(await client.listUpcomingEvents(limit), null, 2));
    return;
  }

  if (subcommand === "calendar-create") {
    const subject = readStringFlag(args, "subject") ?? readStringFlag(args, "title");
    const startAt = readStringFlag(args, "start");
    const endAt = readStringFlag(args, "end");
    const body = readStringFlag(args, "body") ?? readStringFlag(args, "desc");
    const location = readStringFlag(args, "location");
    const timeZone = readStringFlag(args, "time-zone");
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!subject || !startAt || !endAt) {
      throw new Error(
        "Use `npm run microsoft:calendar-create -- --subject \"...\" --start <ISO> --end <ISO> [--body \"...\"] [--location \"...\"] [--time-zone \"...\"] [--dry-run]`.",
      );
    }

    const payload = {
      subject,
      startAt,
      endAt,
      ...(body ? { body } : {}),
      ...(location ? { location } : {}),
      ...(timeZone ? { timeZone } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createCalendarEvent(payload), null, 2));
    return;
  }

  if (subcommand === "calendar-from-task") {
    const taskId = readStringFlag(args, "id");
    const startAt = readStringFlag(args, "start");
    const endAt = readStringFlag(args, "end");
    const durationHours = readNumberFlag(args, "hours");
    const location = readStringFlag(args, "location");
    const timeZone = readStringFlag(args, "time-zone");
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!taskId || !startAt) {
      throw new Error(
        "Use `npm run microsoft:calendar-from-task -- --id <task_id> --start <ISO> [--end <ISO> | --hours <n>] [--location \"...\"] [--time-zone \"...\"] [--dry-run]`.",
      );
    }

    const task = getTaskById(await store.load(), taskId);
    const draft = buildExternalCalendarDraft(task, {
      startAt,
      ...(endAt ? { endAt } : {}),
      ...(durationHours !== undefined ? { durationHours } : {}),
    });
    const payload = {
      subject: draft.summary,
      startAt: draft.startAt,
      endAt: draft.endAt,
      body: draft.description,
      ...(location ? { location } : {}),
      ...(timeZone ? { timeZone } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createCalendarEvent(payload), null, 2));
    return;
  }

  if (subcommand === "todo-preview") {
    const limit = readNumberFlag(args, "limit") ?? 10;
    const listId = readStringFlag(args, "list-id");
    console.log(JSON.stringify(await client.listTodoTasks(limit, listId), null, 2));
    return;
  }

  if (subcommand === "todo-lists") {
    const limit = readNumberFlag(args, "limit") ?? 20;
    console.log(JSON.stringify(await client.listTodoLists(limit), null, 2));
    return;
  }

  if (subcommand === "todo-create") {
    const title = readStringFlag(args, "title");
    const body = readStringFlag(args, "body") ?? readStringFlag(args, "desc");
    const dueAt = readStringFlag(args, "due");
    const listId = readStringFlag(args, "list-id");
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!title) {
      throw new Error(
        "Use `npm run microsoft:todo-create -- --title \"...\" [--body \"...\"] [--due <ISO>] [--list-id <id>] [--dry-run]`.",
      );
    }

    const payload = {
      title,
      ...(body ? { body } : {}),
      ...(dueAt ? { dueAt } : {}),
      ...(listId ? { listId } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createTodoTask(payload), null, 2));
    return;
  }

  if (subcommand === "todo-from-task") {
    const taskId = readStringFlag(args, "id");
    const listId = readStringFlag(args, "list-id");
    const dryRun = readBooleanFlag(args, "dry-run");

    if (!taskId) {
      throw new Error(
        "Use `npm run microsoft:todo-from-task -- --id <task_id> [--list-id <id>] [--dry-run]`.",
      );
    }

    const task = getTaskById(await store.load(), taskId);
    const draft = buildExternalTaskDraft(task);
    const payload = {
      title: draft.title,
      body: draft.description,
      ...(draft.dueAt ? { dueAt: draft.dueAt } : {}),
      ...(listId ? { listId } : {}),
    };

    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(await client.createTodoTask(payload), null, 2));
    return;
  }

  throw new Error(
    "Use `npm run microsoft:profile`, `npm run microsoft:calendar-preview`, `npm run microsoft:calendar-create`, `npm run microsoft:calendar-from-task`, `npm run microsoft:todo-lists`, `npm run microsoft:todo-preview`, `npm run microsoft:todo-create`, or `npm run microsoft:todo-from-task`.",
  );
}
