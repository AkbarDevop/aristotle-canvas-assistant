import { google } from "googleapis";

import type { GoogleTasksConfig } from "../config.js";
import { authorizeGoogleClient } from "./google-auth.js";

export interface GoogleTaskList {
  id: string;
  title: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  dueAt?: string;
  status: string;
  listId: string;
  listTitle: string;
}

export interface GoogleTaskInput {
  title: string;
  notes?: string;
  dueAt?: string;
  taskListId?: string;
}

const GOOGLE_TASKS_SCOPES = ["https://www.googleapis.com/auth/tasks"];

export class GoogleTasksClient {
  constructor(private readonly config: GoogleTasksConfig) {}

  async authorize(): Promise<void> {
    await this.getAuthorizedClient();
  }

  async listTaskLists(limit = 20): Promise<GoogleTaskList[]> {
    const auth = await this.getAuthorizedClient();
    const tasks = google.tasks({ version: "v1", auth });
    const response = await tasks.tasklists.list({
      maxResults: limit,
    });

    return (response.data.items ?? []).map((item) => ({
      id: item.id ?? `tasklist_${Math.random().toString(36).slice(2)}`,
      title: item.title?.trim() || "Task list",
    }));
  }

  async listTasks(limit = 20, taskListId?: string): Promise<GoogleTask[]> {
    const auth = await this.getAuthorizedClient();
    const tasks = google.tasks({ version: "v1", auth });
    const resolved = await this.resolveTaskList(taskListId);
    const response = await tasks.tasks.list({
      tasklist: resolved.id,
      showCompleted: false,
      showHidden: false,
      maxResults: limit,
    });

    return (response.data.items ?? []).map((item) => {
      const task: GoogleTask = {
        id: item.id ?? `gtask_${Math.random().toString(36).slice(2)}`,
        title: item.title?.trim() || "Task",
        status: item.status ?? "needsAction",
        listId: resolved.id,
        listTitle: resolved.title,
      };

      if (item.notes?.trim()) {
        task.notes = item.notes.trim();
      }
      if (item.due) {
        task.dueAt = item.due;
      }

      return task;
    });
  }

  async createTask(input: GoogleTaskInput): Promise<GoogleTask> {
    const auth = await this.getAuthorizedClient();
    const tasks = google.tasks({ version: "v1", auth });
    const resolved = await this.resolveTaskList(input.taskListId);
    const response = await tasks.tasks.insert({
      tasklist: resolved.id,
      requestBody: {
        title: input.title,
        ...(input.notes ? { notes: input.notes } : {}),
        ...(input.dueAt ? { due: input.dueAt } : {}),
      },
    });

    const item = response.data;
    const task: GoogleTask = {
      id: item.id ?? `gtask_${Math.random().toString(36).slice(2)}`,
      title: item.title?.trim() || input.title,
      status: item.status ?? "needsAction",
      listId: resolved.id,
      listTitle: resolved.title,
    };

    const notes = item.notes?.trim() || input.notes;
    if (notes) {
      task.notes = notes;
    }
    const dueAt = item.due ?? input.dueAt;
    if (dueAt) {
      task.dueAt = dueAt;
    }

    return task;
  }

  private async resolveTaskList(taskListId?: string): Promise<GoogleTaskList> {
    const requestedId = taskListId?.trim() || this.config.taskListId?.trim();
    if (requestedId) {
      const taskLists = await this.listTaskLists(100);
      const matched = taskLists.find((item) => item.id === requestedId);
      return (
        matched ?? {
          id: requestedId,
          title: "Configured task list",
        }
      );
    }

    const taskLists = await this.listTaskLists(20);
    const first = taskLists[0];
    if (!first) {
      throw new Error("No Google Task lists found. Create one in Google Tasks first.");
    }

    return first;
  }

  private async getAuthorizedClient() {
    return authorizeGoogleClient(
      this.config.credentialsPath,
      this.config.tokenPath,
      GOOGLE_TASKS_SCOPES,
    );
  }
}
