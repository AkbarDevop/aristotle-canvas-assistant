import type { TrelloConfig } from "../config.js";

export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

export interface TrelloProfile {
  id: string;
  username: string;
  url: string;
  fullName?: string;
  boards: TrelloBoard[];
}

export interface TrelloCard {
  id: string;
  name: string;
  url: string;
  boardId: string;
  boardName: string;
  listId: string;
  listName: string;
  dueAt?: string;
  desc?: string;
  labels: string[];
}

export interface TrelloCardInput {
  name: string;
  desc?: string;
  dueAt?: string;
  listId?: string;
}

export interface TrelloBoardSnapshot {
  board: TrelloBoard;
  cards: TrelloCard[];
}

interface TrelloApiProfile {
  id: string;
  username: string;
  fullName?: string | null;
  url: string;
}

interface TrelloApiBoard {
  id: string;
  name: string;
  url: string;
  closed?: boolean;
}

interface TrelloApiLabel {
  name?: string | null;
  color?: string | null;
}

interface TrelloApiCard {
  id: string;
  name: string;
  desc?: string | null;
  url: string;
  due?: string | null;
  labels?: TrelloApiLabel[];
}

interface TrelloApiList {
  id: string;
  name: string;
  idBoard?: string;
  cards?: TrelloApiCard[];
}

export class TrelloClient {
  constructor(private readonly config: TrelloConfig) {}

  async getProfile(boardLimit = 10): Promise<TrelloProfile> {
    const profile = await this.requestJson<TrelloApiProfile>("/members/me", {
      query: {
        fields: "id,username,fullName,url",
      },
    });
    const boards = await this.listBoards(boardLimit);
    const result: TrelloProfile = {
      id: profile.id,
      username: profile.username,
      url: profile.url,
      boards,
    };

    if (profile.fullName?.trim()) {
      result.fullName = profile.fullName.trim();
    }

    return result;
  }

  async listBoards(limit = 10): Promise<TrelloBoard[]> {
    const boards = await this.requestJson<TrelloApiBoard[]>("/members/me/boards", {
      query: {
        fields: "id,name,url,closed",
        filter: "open",
      },
    });

    return boards
      .filter((board) => !board.closed)
      .slice(0, limit)
      .map((board) => ({
        id: board.id,
        name: board.name.trim(),
        url: board.url,
      }));
  }

  async getBoardSnapshot(limit = 50, boardId = this.config.boardId): Promise<TrelloBoardSnapshot> {
    const resolvedBoardId = boardId?.trim();
    if (!resolvedBoardId) {
      throw new Error(
        "Missing Trello board ID. Set TRELLO_BOARD_ID in .env or pass --board-id to the Trello command.",
      );
    }

    const board = await this.requestJson<TrelloApiBoard>(`/boards/${resolvedBoardId}`, {
      query: {
        fields: "id,name,url",
      },
    });
    const lists = await this.requestJson<TrelloApiList[]>(`/boards/${resolvedBoardId}/lists`, {
      query: {
        filter: "open",
        fields: "id,name",
        cards: "open",
        card_fields: "id,name,desc,due,url,labels",
      },
    });

    const cards = lists
      .filter((list) => !isCompletedListName(list.name))
      .flatMap((list, listIndex) =>
        (list.cards ?? []).map((card, cardIndex) => ({
          card,
          list,
          listIndex,
          cardIndex,
        })),
      )
      .sort((left, right) => {
        const leftDue = left.card.due ?? "";
        const rightDue = right.card.due ?? "";

        if (leftDue && rightDue && leftDue !== rightDue) {
          return leftDue.localeCompare(rightDue);
        }

        if (leftDue && !rightDue) {
          return -1;
        }

        if (!leftDue && rightDue) {
          return 1;
        }

        if (left.listIndex !== right.listIndex) {
          return left.listIndex - right.listIndex;
        }

        return left.cardIndex - right.cardIndex;
      })
      .slice(0, limit)
      .map(({ card, list }) => {
        const result: TrelloCard = {
          id: card.id,
          name: card.name.trim(),
          url: card.url,
          boardId: board.id,
          boardName: board.name.trim(),
          listId: list.id,
          listName: list.name.trim(),
          labels: normalizeLabels(card.labels ?? []),
        };

        if (card.due) {
          result.dueAt = card.due;
        }

        if (card.desc?.trim()) {
          result.desc = card.desc.trim();
        }

        return result;
      });

    return {
      board: {
        id: board.id,
        name: board.name.trim(),
        url: board.url,
      },
      cards,
    };
  }

  async createCard(input: TrelloCardInput): Promise<TrelloCard> {
    const listId = input.listId?.trim() || this.config.defaultListId?.trim();
    if (!listId) {
      throw new Error(
        "Missing Trello list ID. Set TRELLO_DEFAULT_LIST_ID in .env or pass --list-id to the Trello create command.",
      );
    }

    const card = await this.requestJson<TrelloApiCard>("/cards", {
      method: "POST",
      query: {
        idList: listId,
        name: input.name,
        desc: input.desc,
        due: input.dueAt,
      },
    });

    const list = await this.requestJson<TrelloApiList>(`/lists/${listId}`, {
      query: {
        fields: "id,name,idBoard",
      },
    });
    const boardId = list.idBoard ?? this.config.boardId;
    if (!boardId) {
      throw new Error("Unable to resolve the Trello board for the created card.");
    }

    const board = await this.requestJson<TrelloApiBoard>(`/boards/${boardId}`, {
      query: {
        fields: "id,name,url",
      },
    });

    const result: TrelloCard = {
      id: card.id,
      name: card.name.trim(),
      url: card.url,
      boardId: board.id,
      boardName: board.name.trim(),
      listId: list.id,
      listName: list.name.trim(),
      labels: normalizeLabels(card.labels ?? []),
    };

    if (card.due) {
      result.dueAt = card.due;
    }

    if (card.desc?.trim()) {
      result.desc = card.desc.trim();
    }

    return result;
  }

  private async requestJson<T>(
    pathname: string,
    options?: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
    },
  ): Promise<T> {
    const url = new URL(`/1${pathname}`, "https://api.trello.com");
    url.searchParams.set("key", this.config.apiKey);
    url.searchParams.set("token", this.config.token);

    for (const [key, value] of Object.entries(options?.query ?? {})) {
      if (value === undefined) {
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      method: options?.method ?? "GET",
    });
    if (!response.ok) {
      throw new Error(`Trello request failed with ${response.status} ${response.statusText}.`);
    }

    return (await response.json()) as T;
  }
}

function normalizeLabels(labels: TrelloApiLabel[]): string[] {
  return labels
    .map((label) => label.name?.trim() || label.color?.trim())
    .filter((label): label is string => Boolean(label));
}

function isCompletedListName(listName: string): boolean {
  const normalized = listName.trim().toLowerCase();
  return (
    normalized === "done" ||
    normalized === "completed" ||
    normalized === "archive" ||
    normalized === "archived"
  );
}
