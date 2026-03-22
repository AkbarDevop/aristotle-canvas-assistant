import type { MicrosoftGraphConfig } from "../config.js";

export interface MicrosoftGraphProfile {
  id: string;
  displayName?: string;
  userPrincipalName?: string;
}

export interface MicrosoftCalendarEvent {
  id: string;
  subject: string;
  startAt: string;
  endAt: string;
  webLink?: string;
  location?: string;
  body?: string;
}

export interface MicrosoftCalendarEventInput {
  subject: string;
  startAt: string;
  endAt: string;
  body?: string;
  location?: string;
  timeZone?: string;
}

export interface MicrosoftTodoList {
  id: string;
  displayName: string;
}

export interface MicrosoftTodoTask {
  id: string;
  title: string;
  body?: string;
  dueAt?: string;
  status?: string;
  listId: string;
}

export interface MicrosoftTodoTaskInput {
  title: string;
  body?: string;
  dueAt?: string;
  listId?: string;
}

interface MicrosoftGraphUser {
  id: string;
  displayName?: string;
  userPrincipalName?: string;
}

interface MicrosoftGraphListResponse<T> {
  value: T[];
}

interface MicrosoftGraphDateTimeTimeZone {
  dateTime: string;
  timeZone: string;
}

interface MicrosoftGraphEventApi {
  id: string;
  subject?: string;
  webLink?: string;
  location?: {
    displayName?: string;
  };
  bodyPreview?: string;
  start?: MicrosoftGraphDateTimeTimeZone;
  end?: MicrosoftGraphDateTimeTimeZone;
}

interface MicrosoftGraphTodoListApi {
  id: string;
  displayName?: string;
}

interface MicrosoftGraphTodoTaskApi {
  id: string;
  title?: string;
  status?: string;
  body?: {
    content?: string;
  };
  dueDateTime?: MicrosoftGraphDateTimeTimeZone;
}

export class MicrosoftGraphClient {
  constructor(private readonly config: MicrosoftGraphConfig) {}

  async getProfile(): Promise<MicrosoftGraphProfile> {
    const user = await this.requestJson<MicrosoftGraphUser>("/v1.0/me");
    const profile: MicrosoftGraphProfile = {
      id: user.id,
    };

    if (user.displayName?.trim()) {
      profile.displayName = user.displayName.trim();
    }
    if (user.userPrincipalName?.trim()) {
      profile.userPrincipalName = user.userPrincipalName.trim();
    }

    return profile;
  }

  async listUpcomingEvents(limit = 20): Promise<MicrosoftCalendarEvent[]> {
    const calendarPath = this.config.calendarId?.trim()
      ? `/v1.0/me/calendars/${this.config.calendarId}/events?$top=${limit}&$orderby=start/dateTime`
      : `/v1.0/me/events?$top=${limit}&$orderby=start/dateTime`;
    const response = await this.requestJson<MicrosoftGraphListResponse<MicrosoftGraphEventApi>>(calendarPath);

    return response.value.map((item) => {
      const event: MicrosoftCalendarEvent = {
        id: item.id,
        subject: item.subject?.trim() || "Calendar event",
        startAt: normalizeGraphDateTime(item.start),
        endAt: normalizeGraphDateTime(item.end),
      };

      if (item.webLink) {
        event.webLink = item.webLink;
      }
      if (item.location?.displayName?.trim()) {
        event.location = item.location.displayName.trim();
      }
      if (item.bodyPreview?.trim()) {
        event.body = item.bodyPreview.trim();
      }

      return event;
    });
  }

  async createCalendarEvent(input: MicrosoftCalendarEventInput): Promise<MicrosoftCalendarEvent> {
    const calendarPath = this.config.calendarId?.trim()
      ? `/v1.0/me/calendars/${this.config.calendarId}/events`
      : "/v1.0/me/events";
    const timeZone = input.timeZone?.trim() || this.config.timeZone;
    const response = await this.requestJson<MicrosoftGraphEventApi>(calendarPath, {
      method: "POST",
      body: {
        subject: input.subject,
        ...(input.body
          ? {
              body: {
                contentType: "Text",
                content: input.body,
              },
            }
          : {}),
        ...(input.location
          ? {
              location: {
                displayName: input.location,
              },
            }
          : {}),
        start: buildGraphDateTime(input.startAt, timeZone),
        end: buildGraphDateTime(input.endAt, timeZone),
      },
    });

    const event: MicrosoftCalendarEvent = {
      id: response.id,
      subject: response.subject?.trim() || input.subject,
      startAt: normalizeGraphDateTime(response.start, input.startAt),
      endAt: normalizeGraphDateTime(response.end, input.endAt),
    };

    if (response.webLink) {
      event.webLink = response.webLink;
    }
    const location = response.location?.displayName?.trim() || input.location;
    if (location) {
      event.location = location;
    }
    const body = response.bodyPreview?.trim() || input.body;
    if (body) {
      event.body = body;
    }

    return event;
  }

  async listTodoLists(limit = 20): Promise<MicrosoftTodoList[]> {
    const response = await this.requestJson<MicrosoftGraphListResponse<MicrosoftGraphTodoListApi>>(
      `/v1.0/me/todo/lists?$top=${limit}`,
    );

    return response.value.map((item) => ({
      id: item.id,
      displayName: item.displayName?.trim() || "To Do",
    }));
  }

  async listTodoTasks(limit = 20, listId?: string): Promise<MicrosoftTodoTask[]> {
    const resolvedList = await this.resolveTodoList(listId);
    const response = await this.requestJson<MicrosoftGraphListResponse<MicrosoftGraphTodoTaskApi>>(
      `/v1.0/me/todo/lists/${resolvedList.id}/tasks?$top=${limit}`,
    );

    return response.value.map((item) => {
      const task: MicrosoftTodoTask = {
        id: item.id,
        title: item.title?.trim() || "Task",
        listId: resolvedList.id,
      };

      if (item.body?.content?.trim()) {
        task.body = item.body.content.trim();
      }
      if (item.dueDateTime) {
        task.dueAt = normalizeGraphDateTime(item.dueDateTime);
      }
      if (item.status) {
        task.status = item.status;
      }

      return task;
    });
  }

  async createTodoTask(input: MicrosoftTodoTaskInput): Promise<MicrosoftTodoTask> {
    const resolvedList = await this.resolveTodoList(input.listId);
    const response = await this.requestJson<MicrosoftGraphTodoTaskApi>(
      `/v1.0/me/todo/lists/${resolvedList.id}/tasks`,
      {
        method: "POST",
        body: {
          title: input.title,
          ...(input.body
            ? {
                body: {
                  content: input.body,
                  contentType: "text",
                },
              }
            : {}),
          ...(input.dueAt
            ? {
                dueDateTime: buildGraphDateTime(input.dueAt, this.config.timeZone),
              }
            : {}),
        },
      },
    );

    const task: MicrosoftTodoTask = {
      id: response.id,
      title: response.title?.trim() || input.title,
      listId: resolvedList.id,
    };

    const body = response.body?.content?.trim() || input.body;
    if (body) {
      task.body = body;
    }
    if (response.dueDateTime || input.dueAt) {
      task.dueAt = normalizeGraphDateTime(response.dueDateTime, input.dueAt);
    }
    if (response.status) {
      task.status = response.status;
    }

    return task;
  }

  private async resolveTodoList(listId?: string): Promise<MicrosoftTodoList> {
    const configured = listId?.trim() || this.config.todoListId?.trim();
    if (configured) {
      const lists = await this.listTodoLists(100);
      return lists.find((item) => item.id === configured) ?? {
        id: configured,
        displayName: "Configured To Do list",
      };
    }

    const lists = await this.listTodoLists(20);
    const first = lists[0];
    if (!first) {
      throw new Error("No Microsoft To Do lists found.");
    }

    return first;
  }

  private async requestJson<T>(
    pathname: string,
    options?: {
      method?: string;
      body?: unknown;
    },
  ): Promise<T> {
    const response = await fetch(new URL(pathname, "https://graph.microsoft.com"), {
      method: options?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
    });

    if (!response.ok) {
      throw new Error(`Microsoft Graph request failed with ${response.status} ${response.statusText}.`);
    }

    return (await response.json()) as T;
  }
}

function buildGraphDateTime(isoString: string, timeZone: string): MicrosoftGraphDateTimeTimeZone {
  return {
    dateTime: formatDateTimeForTimeZone(isoString, timeZone),
    timeZone,
  };
}

function normalizeGraphDateTime(
  value?: MicrosoftGraphDateTimeTimeZone,
  fallback?: string,
): string {
  if (!value?.dateTime) {
    return fallback ?? "";
  }

  return value.timeZone ? `${value.dateTime} (${value.timeZone})` : value.dateTime;
}

function formatDateTimeForTimeZone(isoString: string, timeZone: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Expected a valid datetime, received: ${isoString}`);
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}
