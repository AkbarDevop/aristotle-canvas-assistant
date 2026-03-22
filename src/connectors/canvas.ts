import type { CanvasConfig } from "../config.js";
import type { AssignmentBrief } from "../types.js";

interface CanvasProfile {
  id: number;
  name: string;
  primary_email?: string;
}

interface CanvasUpcomingEvent {
  id: string | number;
  title: string;
  type?: string;
  description?: string;
  start_at?: string;
  end_at?: string;
  html_url?: string;
  context_name?: string;
  assignment?: {
    name?: string;
  };
}

export class CanvasClient {
  constructor(private readonly config: CanvasConfig) {}

  async getProfile(): Promise<CanvasProfile> {
    return this.requestJson<CanvasProfile>("/api/v1/users/self/profile");
  }

  async listUpcomingAssignments(limit = 20): Promise<AssignmentBrief[]> {
    const events = await this.requestJson<CanvasUpcomingEvent[]>("/api/v1/users/self/upcoming_events");

    return events
      .filter((event) => (event.type ?? "assignment") === "assignment")
      .slice(0, limit)
      .map((event) => this.toAssignmentBrief(event));
  }

  private toAssignmentBrief(event: CanvasUpcomingEvent): AssignmentBrief {
    const title = event.assignment?.name?.trim() || event.title.trim();
    const course = event.context_name?.trim() || "Canvas course";
    const dueAt = event.end_at ?? event.start_at;

    if (!dueAt) {
      throw new Error(`Canvas event ${event.id} is missing a due date.`);
    }

    const assignment: AssignmentBrief = {
      course,
      title,
      summary:
        event.description?.trim() ||
        `Canvas assignment from ${course}. Open the Canvas link for instructions, rubric, and submission details.`,
      deliverable: "Canvas assignment submission",
      dueAt,
      effortHours: estimateCanvasEffort(title),
      externalKey: `canvas:${event.id}`,
    };

    if (event.html_url) {
      assignment.sourceLink = event.html_url;
    }

    return assignment;
  }

  private async requestJson<T>(pathname: string): Promise<T> {
    const url = new URL(pathname, this.config.baseUrl);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Canvas request failed with ${response.status} ${response.statusText}.`);
    }

    return (await response.json()) as T;
  }
}

function estimateCanvasEffort(title: string): number {
  const normalized = title.toLowerCase();

  if (normalized.includes("exam") || normalized.includes("midterm") || normalized.includes("final")) {
    return 5;
  }

  if (normalized.includes("project") || normalized.includes("report") || normalized.includes("essay")) {
    return 4;
  }

  if (normalized.includes("quiz") || normalized.includes("lab")) {
    return 2;
  }

  return 1;
}
