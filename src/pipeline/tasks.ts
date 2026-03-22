import { FileAristotleStore } from "../memory/file-store.js";
import type { AristotleState, Task, TaskStatus } from "../types.js";
import { createId, formatDate, sortByUrgency } from "../utils.js";

export async function listTasks(store: FileAristotleStore, includeDone = false): Promise<string> {
  const state = await store.load();
  const tasks = sortByUrgency(
    state.tasks.filter((task) => includeDone || task.status !== "done"),
  );

  if (tasks.length === 0) {
    return "Aristotle has no matching tasks yet.";
  }

  return tasks
    .map(
      (task) =>
        `${task.id} | ${task.status.padEnd(11)} | ${formatDate(task.dueAt)} | ${task.course.padEnd(20)} | ${task.title}`,
    )
    .join("\n");
}

export async function updateTaskStatus(
  store: FileAristotleStore,
  taskId: string,
  status: TaskStatus,
): Promise<Task> {
  const state = await store.load();
  const task = state.tasks.find((entry) => entry.id === taskId);

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  task.status = status;
  task.updatedAt = new Date().toISOString();
  pushTaskEvent(state, task, status);
  await store.save(state);

  return task;
}

function pushTaskEvent(state: AristotleState, task: Task, status: TaskStatus): void {
  state.events.push({
    id: createId("event"),
    type: "task.updated",
    actor: "Task",
    summary: `Task ${task.title} marked as ${status}.`,
    createdAt: new Date().toISOString(),
    metadata: {
      taskId: task.id,
      status,
      course: task.course,
      assignmentTitle: task.assignmentTitle,
    },
  });
}
