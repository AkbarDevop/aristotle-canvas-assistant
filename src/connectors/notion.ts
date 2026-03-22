import type { NotionConfig } from "../config.js";

const NOTION_VERSION = "2022-06-28";

export interface NotionProfile {
  id: string;
  name?: string;
  type: string;
}

export interface NotionPageSummary {
  id: string;
  title: string;
  url?: string;
}

export interface NotionPageInput {
  title: string;
  body?: string;
  parentPageId?: string;
}

interface NotionApiUser {
  object: string;
  id: string;
  name?: string | null;
  type?: string;
}

interface NotionApiBlock {
  id: string;
  type: string;
  child_page?: {
    title?: string;
  };
}

interface NotionApiPage {
  id: string;
  url?: string;
  properties?: {
    title?: {
      title?: Array<{
        plain_text?: string;
      }>;
    };
  };
}

export class NotionClient {
  constructor(private readonly config: NotionConfig) {}

  async getProfile(): Promise<NotionProfile> {
    const user = await this.requestJson<NotionApiUser>("/v1/users/me");
    const profile: NotionProfile = {
      id: user.id,
      type: user.type ?? user.object,
    };

    if (user.name?.trim()) {
      profile.name = user.name.trim();
    }

    return profile;
  }

  async listChildPages(limit = 20, parentPageId?: string): Promise<NotionPageSummary[]> {
    const resolvedParentPageId = parentPageId?.trim() || this.config.parentPageId?.trim();
    if (!resolvedParentPageId) {
      throw new Error(
        "Missing Notion parent page ID. Set NOTION_PARENT_PAGE_ID in .env or pass --parent-page-id.",
      );
    }

    const response = await this.requestJson<{ results?: NotionApiBlock[] }>(
      `/v1/blocks/${resolvedParentPageId}/children?page_size=${limit}`,
    );

    return (response.results ?? [])
      .filter((block) => block.type === "child_page")
      .map((block) => ({
        id: block.id,
        title: block.child_page?.title?.trim() || "Untitled page",
      }));
  }

  async createPage(input: NotionPageInput): Promise<NotionPageSummary> {
    const resolvedParentPageId = input.parentPageId?.trim() || this.config.parentPageId?.trim();
    if (!resolvedParentPageId) {
      throw new Error(
        "Missing Notion parent page ID. Set NOTION_PARENT_PAGE_ID in .env or pass --parent-page-id.",
      );
    }

    const children = input.body?.trim()
      ? [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: input.body.trim().slice(0, 1900),
                  },
                },
              ],
            },
          },
        ]
      : undefined;

    const page = await this.requestJson<NotionApiPage>("/v1/pages", {
      method: "POST",
      body: {
        parent: {
          page_id: resolvedParentPageId,
        },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: input.title,
                },
              },
            ],
          },
        },
        ...(children ? { children } : {}),
      },
    });

    return {
      id: page.id,
      title: input.title,
      ...(page.url ? { url: page.url } : {}),
    };
  }

  private async requestJson<T>(
    pathname: string,
    options?: {
      method?: string;
      body?: unknown;
    },
  ): Promise<T> {
    const response = await fetch(new URL(pathname, "https://api.notion.com"), {
      method: options?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        "Notion-Version": NOTION_VERSION,
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
    });

    if (!response.ok) {
      throw new Error(`Notion request failed with ${response.status} ${response.statusText}.`);
    }

    return (await response.json()) as T;
  }
}
