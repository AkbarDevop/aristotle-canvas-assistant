import { calendar_v3, google } from "googleapis";

import type { GoogleCalendarConfig } from "../config.js";
import { authorizeGoogleClient } from "./google-auth.js";

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  htmlLink?: string;
}

export interface GoogleCalendarEventInput {
  summary: string;
  startAt: string;
  endAt: string;
  description?: string;
  location?: string;
  timeZone?: string;
}

const GOOGLE_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar"];

export class GoogleCalendarClient {
  constructor(private readonly config: GoogleCalendarConfig) {}

  async authorize(): Promise<void> {
    await this.getAuthorizedClient();
  }

  async listUpcomingEvents(limit = 20): Promise<GoogleCalendarEvent[]> {
    const auth = await this.getAuthorizedClient();
    const calendar = google.calendar({ version: "v3", auth });
    const response = await calendar.events.list({
      calendarId: this.config.calendarId,
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: limit,
    });

    return (response.data.items ?? [])
      .filter((item) => item.status !== "cancelled" && !!item.start?.dateTime)
      .map((item) => {
        const event: GoogleCalendarEvent = {
          id: item.id ?? `google_${Math.random().toString(36).slice(2)}`,
          summary: item.summary?.trim() || "Calendar event",
          startAt: item.start?.dateTime ?? "",
          endAt: item.end?.dateTime ?? item.start?.dateTime ?? "",
        };

        if (item.description?.trim()) {
          event.description = item.description.trim();
        }
        if (item.location?.trim()) {
          event.location = item.location.trim();
        }
        if (item.htmlLink) {
          event.htmlLink = item.htmlLink;
        }

        return event;
      });
  }

  async createEvent(input: GoogleCalendarEventInput): Promise<GoogleCalendarEvent> {
    const auth = await this.getAuthorizedClient();
    const calendar = google.calendar({ version: "v3", auth });
    const params: calendar_v3.Params$Resource$Events$Insert = {
      calendarId: this.config.calendarId,
      requestBody: {
        summary: input.summary,
        ...(input.description ? { description: input.description } : {}),
        ...(input.location ? { location: input.location } : {}),
        start: {
          dateTime: input.startAt,
          ...(input.timeZone ? { timeZone: input.timeZone } : {}),
        },
        end: {
          dateTime: input.endAt,
          ...(input.timeZone ? { timeZone: input.timeZone } : {}),
        },
      },
    };
    const response = await calendar.events.insert(params);

    const item = response.data;
    const event: GoogleCalendarEvent = {
      id: item.id ?? `google_${Math.random().toString(36).slice(2)}`,
      summary: item.summary?.trim() || input.summary,
      startAt: item.start?.dateTime ?? input.startAt,
      endAt: item.end?.dateTime ?? item.start?.dateTime ?? input.endAt,
    };

    const description = item.description?.trim() || input.description;
    if (description) {
      event.description = description;
    }

    const location = item.location?.trim() || input.location;
    if (location) {
      event.location = location;
    }

    if (item.htmlLink) {
      event.htmlLink = item.htmlLink;
    }

    return event;
  }

  private async getAuthorizedClient() {
    return authorizeGoogleClient(
      this.config.credentialsPath,
      this.config.tokenPath,
      GOOGLE_CALENDAR_SCOPES,
    );
  }
}
