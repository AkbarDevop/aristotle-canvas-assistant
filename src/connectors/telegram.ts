import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TelegramConfig } from "../config.js";

interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: unknown;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    date: number;
    text?: string;
  };
}

export class TelegramClient {
  private readonly apiBase: string;

  constructor(private readonly config: TelegramConfig) {
    this.apiBase = `https://api.telegram.org/bot${config.botToken}`;
  }

  async sendMessage(text: string, chatId?: string): Promise<TelegramResponse> {
    const targetChatId = chatId ?? this.config.chatId;
    if (!targetChatId) {
      throw new Error("No chat ID provided. Set TELEGRAM_CHAT_ID in .env or pass --chat-id.");
    }

    const response = await fetch(`${this.apiBase}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
      }),
    });

    const data = (await response.json()) as TelegramResponse;
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description ?? "unknown error"}`);
    }

    return data;
  }

  async sendDocument(
    filePath: string,
    caption?: string,
    chatId?: string,
  ): Promise<TelegramResponse> {
    const targetChatId = chatId ?? this.config.chatId;
    if (!targetChatId) {
      throw new Error("No chat ID provided. Set TELEGRAM_CHAT_ID in .env or pass --chat-id.");
    }

    const fileBuffer = await readFile(filePath);
    const fileName = path.basename(filePath);

    const formData = new FormData();
    formData.append("chat_id", targetChatId);
    formData.append("document", new Blob([fileBuffer]), fileName);
    if (caption) {
      formData.append("caption", caption);
    }

    const response = await fetch(`${this.apiBase}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as TelegramResponse;
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description ?? "unknown error"}`);
    }

    return data;
  }

  async getUpdates(offset?: number): Promise<TelegramUpdate[]> {
    const params = new URLSearchParams({ timeout: "30", limit: "10" });
    if (offset !== undefined) params.set("offset", String(offset));

    const response = await fetch(`${this.apiBase}/getUpdates?${params}`);
    const data = (await response.json()) as {
      ok: boolean;
      result?: TelegramUpdate[];
    };
    return data.ok ? (data.result ?? []) : [];
  }

  async getMe(): Promise<TelegramResponse> {
    const response = await fetch(`${this.apiBase}/getMe`);
    const data = (await response.json()) as TelegramResponse;
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description ?? "unknown error"}`);
    }

    return data;
  }
}
