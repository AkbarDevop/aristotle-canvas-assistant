import type { TodoistConfig } from "../config.js";

export interface TodoistProject {
  id: string;
  name: string;
  isInboxProject?: boolean;
}

export interface TodoistProfile {
  id: string;
  name?: string;
  email?: string;
  projects: TodoistProject[];
}

export interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  dueAt?: string;
  projectId?: string;
  url?: string;
}

export interface TodoistTaskInput {
  content: string;
  description?: string;
  dueAt?: string;
  projectId?: string;
}

interface TodoistApiUser {
  id: string;
  full_name?: string;
  email?: string;
}

interface TodoistApiProject {
  id: string;
  name: string;
  is_inbox_project?: boolean;
}

interface TodoistApiTask {
  id: string;
  content: string;
  description?: string;
  due?: {
    datetime?: string;
    date?: string;
  };
  project_id?: string;
  url?: string;
}

export class TodoistClient {
  constructor(private readonly config: TodoistConfig) {}

  async getProfile(projectLimit = 10): Promise<TodoistProfile> {
    const user = await this.requestJson<TodoistApiUser>("/sync/v9/user/");
    const projects = await this.listProjects(projectLimit);
    const profile: TodoistProfile = {
      id: user.id,
      projects,
    };

    if (user.full_name?.trim()) {
      profile.name = user.full_name.trim();
    }
    if (user.email?.trim()) {
      profile.email = user.email.trim();
    }

    return profile;
  }

  async listProjects(limit = 20): Promise<TodoistProject[]> {
    const projects = await this.requestJson<TodoistApiProject[]>("/rest/v2/projects");
    return projects.slice(0, limit).map((project) => ({
      id: project.id,
      name: project.name.trim(),
      ...(project.is_inbox_project ? { isInboxProject: true } : {}),
    }));
  }

  async listTasks(limit = 20, projectId?: string): Promise<TodoistTask[]> {
    const query: Record<string, string> = {};
    const resolvedProjectId = projectId?.trim() || this.config.defaultProjectId?.trim();
    if (resolvedProjectId) {
      query.project_id = resolvedProjectId;
    }

    const tasks = await this.requestJson<TodoistApiTask[]>("/rest/v2/tasks", {
      query,
    });

    return tasks.slice(0, limit).map((task) => {
      const result: TodoistTask = {
        id: task.id,
        content: task.content.trim(),
      };

      if (task.description?.trim()) {
        result.description = task.description.trim();
      }
      if (task.due?.datetime) {
        result.dueAt = task.due.datetime;
      } else if (task.due?.date) {
        result.dueAt = task.due.date;
      }
      if (task.project_id) {
        result.projectId = task.project_id;
      }
      if (task.url) {
        result.url = task.url;
      }

      return result;
    });
  }

  async createTask(input: TodoistTaskInput): Promise<TodoistTask> {
    const payload = {
      content: input.content,
      ...(input.description ? { description: input.description } : {}),
      ...(input.dueAt ? { due_datetime: input.dueAt } : {}),
      ...(input.projectId?.trim() || this.config.defaultProjectId?.trim()
        ? { project_id: input.projectId?.trim() || this.config.defaultProjectId?.trim() }
        : {}),
    };

    const task = await this.requestJson<TodoistApiTask>("/rest/v2/tasks", {
      method: "POST",
      body: payload,
    });

    const result: TodoistTask = {
      id: task.id,
      content: task.content.trim(),
    };

    if (task.description?.trim()) {
      result.description = task.description.trim();
    }
    if (task.due?.datetime) {
      result.dueAt = task.due.datetime;
    } else if (task.due?.date) {
      result.dueAt = task.due.date;
    } else if (input.dueAt) {
      result.dueAt = input.dueAt;
    }
    if (task.project_id) {
      result.projectId = task.project_id;
    }
    if (task.url) {
      result.url = task.url;
    }

    return result;
  }

  private async requestJson<T>(
    pathname: string,
    options?: {
      method?: string;
      query?: Record<string, string | undefined>;
      body?: unknown;
    },
  ): Promise<T> {
    const url = new URL(pathname, "https://api.todoist.com");
    for (const [key, value] of Object.entries(options?.query ?? {})) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url, {
      method: options?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
    });

    if (!response.ok) {
      throw new Error(`Todoist request failed with ${response.status} ${response.statusText}.`);
    }

    return (await response.json()) as T;
  }
}
