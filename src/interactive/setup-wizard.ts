import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";

interface SetupResult {
  canvasBaseUrl: string;
  canvasAccessToken: string;
  telegramBotToken?: string | undefined;
  telegramChatId?: string | undefined;
}

export async function runSetupWizard(): Promise<void> {
  const rl = createInterface({ input, output });

  try {
    printBanner();

    const envPath = path.resolve(process.cwd(), ".env");
    const existingEnv = existsSync(envPath) ? await readEnvFile(envPath) : {};
    if (existsSync(envPath)) {
      const overwrite = await askYesNo(
        rl,
        "A .env file already exists. Do you want to reconfigure?",
      );
      if (!overwrite) {
        console.log("\nSetup cancelled. Your existing .env is unchanged.");
        return;
      }
    }

    // Step 1: Canvas setup
    console.log("\n  [1/4] Canvas LMS");
    console.log("  Your Canvas URL looks like: https://yourschool.instructure.com\n");

    const canvasBaseUrl = await askRequired(rl, "  Canvas URL");
    const cleanUrl = canvasBaseUrl.replace(/\/+$/, "");

    console.log("\n  Get your token: Canvas → Profile → Settings → Approved Integrations → + New Access Token\n");

    const canvasAccessToken = await askRequired(rl, "  Access token");

    // Verify Canvas connection
    process.stdout.write("\n  Verifying... ");
    const profile = await verifyCanvas(cleanUrl, canvasAccessToken);

    if (!profile) {
      console.log("failed.");
      console.log("  Could not connect. Check your URL and token.");
      const retry = await askYesNo(rl, "  Continue anyway?");
      if (!retry) {
        console.log("  Setup cancelled.");
        return;
      }
    } else {
      console.log(`done! Welcome, ${profile.name}.`);
    }

    // Step 2: Telegram (optional)
    console.log("\n  [2/4] Telegram Bot (optional)");
    console.log("  Get assignment PDFs and reminders in Telegram.");
    const wantTelegram = await askYesNo(rl, "  Set up Telegram?");

    let telegramBotToken: string | undefined;
    let telegramChatId: string | undefined;

    if (wantTelegram) {
      console.log("\n  Create a bot in 30 seconds:");
      console.log("    1. Open Telegram → search @BotFather → send /newbot");
      console.log("    2. Pick any name and username");
      console.log("    3. Copy the token BotFather gives you\n");

      telegramBotToken = await askRequired(rl, "  Bot token");

      process.stdout.write("\n  Verifying bot... ");
      const bot = await verifyTelegram(telegramBotToken);
      if (bot) {
        console.log(`connected! @${bot.username}`);
      } else {
        console.log("could not verify. Check the token later.");
      }

      console.log("\n  Now get your chat ID:");
      console.log("    1. Send any message to your bot in Telegram");
      console.log("    2. Then press Enter here and we'll detect it automatically\n");

      const autoDetect = await askYesNo(rl, "  Auto-detect chat ID? (send a message to your bot first)");

      if (autoDetect && telegramBotToken) {
        process.stdout.write("  Detecting... ");
        const detectedId = await detectTelegramChatId(telegramBotToken);
        telegramChatId = detectedId ?? undefined;
        if (telegramChatId) {
          console.log(`found! Chat ID: ${telegramChatId}`);
        } else {
          console.log("no messages found. Enter it manually.");
          console.log("  Open: https://api.telegram.org/bot<TOKEN>/getUpdates");
          console.log("  Look for \"chat\":{\"id\":YOUR_NUMBER}\n");
          telegramChatId = await askRequired(rl, "  Chat ID");
        }
      } else {
        console.log("\n  To find your chat ID manually:");
        console.log(`  Open: https://api.telegram.org/bot${telegramBotToken}/getUpdates`);
        console.log("  Find \"chat\":{\"id\":YOUR_NUMBER} in the response\n");
        telegramChatId = await askRequired(rl, "  Chat ID");
      }
    }

    // Step 3: Write .env
    console.log("\n  [3/4] Saving configuration");
    const envContent = buildEnvFile({
      canvasBaseUrl: cleanUrl,
      canvasAccessToken,
      telegramBotToken,
      telegramChatId,
    }, existingEnv);

    await writeFile(envPath, envContent, "utf-8");
    console.log("  Saved to .env");

    // Step 4: First sync
    console.log("\n  [4/4] First sync");
    const doSync = await askYesNo(rl, "  Pull your Canvas assignments now?");

    if (doSync) {
      console.log("\nSyncing...");
      await firstSync(cleanUrl, canvasAccessToken);
    }

    printSuccess(profile?.name);
  } finally {
    rl.close();
  }
}

function printBanner(): void {
  console.log("");
  console.log("  ╔══════════════════════════════════════════╗");
  console.log("  ║   Aristotle Canvas Assistant — Setup     ║");
  console.log("  ╚══════════════════════════════════════════╝");
  console.log("");
  console.log("  This takes ~30 seconds. You need one thing:");
  console.log("  → Your Canvas access token (Settings → Approved Integrations)");
  console.log("");
}

function printSuccess(name?: string): void {
  console.log("");
  console.log("  ╔══════════════════════════════════════════╗");
  console.log("  ║          You're all set!                 ║");
  console.log("  ╚══════════════════════════════════════════╝");
  console.log("");
  if (name) {
    console.log(`  Welcome, ${name}.`);
    console.log("");
  }
  console.log("  Next steps:");
  console.log("");
  console.log("    npm run canvas:preview           → see upcoming deadlines");
  console.log("    npm run canvas:sync              → pull assignments");
  console.log("    npm run updates -- --days 7      → weekly plan");
  console.log("    npm run prep -- --course \"ECE 3510\"  → course prep");
  console.log("");
  console.log("  Use as a skill in Claude Code / Codex:");
  console.log("");
  console.log("    npm run skill:install");
  console.log("    → \"use $aristotle to check my next 7 days\"");
  console.log("");
}

async function verifyCanvas(
  baseUrl: string,
  token: string,
): Promise<{ name: string; email?: string | undefined } | null> {
  try {
    const url = new URL("/api/v1/users/self/profile", baseUrl);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      name: string;
      primary_email?: string;
    };
    return { name: data.name, email: data.primary_email };
  } catch {
    return null;
  }
}

async function verifyTelegram(
  botToken: string,
): Promise<{ username: string } | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`,
    );
    const data = (await response.json()) as {
      ok: boolean;
      result?: { username: string };
    };
    if (!data.ok || !data.result) return null;
    return { username: data.result.username };
  } catch {
    return null;
  }
}

async function detectTelegramChatId(
  botToken: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?limit=5`,
    );
    const data = (await response.json()) as {
      ok: boolean;
      result?: Array<{
        message?: { chat?: { id: number } };
      }>;
    };
    if (!data.ok || !data.result?.length) return null;

    for (const update of data.result) {
      const chatId = update.message?.chat?.id;
      if (chatId) return String(chatId);
    }
    return null;
  } catch {
    return null;
  }
}

async function firstSync(baseUrl: string, token: string): Promise<void> {
  try {
    const url = new URL("/api/v1/users/self/upcoming_events", baseUrl);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.log("Could not fetch assignments. Run `npm run canvas:sync` later.");
      return;
    }

    const events = (await response.json()) as Array<{
      type?: string;
      title: string;
      end_at?: string;
      context_name?: string;
      assignment?: { name?: string };
    }>;

    const assignments = events.filter(
      (e) => (e.type ?? "assignment") === "assignment",
    );

    if (assignments.length === 0) {
      console.log("No upcoming assignments found on Canvas.");
      return;
    }

    console.log(`\nFound ${assignments.length} upcoming assignment(s):\n`);
    for (const a of assignments) {
      const title = a.assignment?.name?.trim() || a.title.trim();
      const course = a.context_name?.trim() || "Unknown course";
      const due = a.end_at
        ? new Date(a.end_at).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "no date";
      console.log(`  - ${title} (${course}) -- due ${due}`);
    }

    console.log("\nRun `npm run canvas:sync` to import these into Aristotle.");
  } catch {
    console.log("Sync failed. Run `npm run canvas:sync` later.");
  }
}

function buildEnvFile(
  config: SetupResult,
  existingEnv: Record<string, string>,
): string {
  const withFallback = (
    key: string,
    nextValue: string | undefined,
    fallback = "",
  ): string => nextValue ?? existingEnv[key] ?? fallback;

  const lines: string[] = [
    `ARISTOTLE_DATA_DIR=${withFallback("ARISTOTLE_DATA_DIR", undefined, "./aristotle-data")}`,
    "",
    `CANVAS_BASE_URL=${config.canvasBaseUrl}`,
    `CANVAS_ACCESS_TOKEN=${config.canvasAccessToken}`,
    "",
    "# Google Calendar + Google Tasks",
    `GOOGLE_CLIENT_CREDENTIALS_PATH=${withFallback("GOOGLE_CLIENT_CREDENTIALS_PATH", undefined)}`,
    `GOOGLE_CALENDAR_TOKEN_PATH=${withFallback("GOOGLE_CALENDAR_TOKEN_PATH", undefined, "./aristotle-data/google-calendar-token.json")}`,
    `GOOGLE_CALENDAR_ID=${withFallback("GOOGLE_CALENDAR_ID", undefined, "primary")}`,
    `GOOGLE_TASKS_TOKEN_PATH=${withFallback("GOOGLE_TASKS_TOKEN_PATH", undefined, "./aristotle-data/google-tasks-token.json")}`,
    `GOOGLE_TASKS_LIST_ID=${withFallback("GOOGLE_TASKS_LIST_ID", undefined)}`,
    "",
    "# Trello",
    `TRELLO_API_KEY=${withFallback("TRELLO_API_KEY", undefined)}`,
    `TRELLO_TOKEN=${withFallback("TRELLO_TOKEN", undefined)}`,
    `TRELLO_BOARD_ID=${withFallback("TRELLO_BOARD_ID", undefined)}`,
    `TRELLO_DEFAULT_LIST_ID=${withFallback("TRELLO_DEFAULT_LIST_ID", undefined)}`,
    "",
    "# Todoist",
    `TODOIST_API_TOKEN=${withFallback("TODOIST_API_TOKEN", undefined)}`,
    `TODOIST_PROJECT_ID=${withFallback("TODOIST_PROJECT_ID", undefined)}`,
    "",
    "# Notion",
    `NOTION_API_TOKEN=${withFallback("NOTION_API_TOKEN", undefined)}`,
    `NOTION_PARENT_PAGE_ID=${withFallback("NOTION_PARENT_PAGE_ID", undefined)}`,
    "",
    "# Microsoft Graph (Outlook Calendar + Microsoft To Do)",
    `MICROSOFT_GRAPH_ACCESS_TOKEN=${withFallback("MICROSOFT_GRAPH_ACCESS_TOKEN", undefined)}`,
    `MICROSOFT_CALENDAR_ID=${withFallback("MICROSOFT_CALENDAR_ID", undefined)}`,
    `MICROSOFT_TODO_LIST_ID=${withFallback("MICROSOFT_TODO_LIST_ID", undefined)}`,
    `MICROSOFT_TIME_ZONE=${withFallback("MICROSOFT_TIME_ZONE", undefined, "America/Chicago")}`,
    "",
    "# Telegram Bot",
  ];

  lines.push(`TELEGRAM_BOT_TOKEN=${withFallback("TELEGRAM_BOT_TOKEN", config.telegramBotToken)}`);
  lines.push(`TELEGRAM_CHAT_ID=${withFallback("TELEGRAM_CHAT_ID", config.telegramChatId)}`);

  lines.push("");
  return lines.join("\n");
}

async function readEnvFile(envPath: string): Promise<Record<string, string>> {
  const contents = await readFile(envPath, "utf-8");
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    values[key] = value;
  }

  return values;
}

async function askRequired(
  rl: ReturnType<typeof createInterface>,
  label: string,
): Promise<string> {
  while (true) {
    const value = (await rl.question(`${label}: `)).trim();
    if (value.length > 0) return value;
    console.log(`  ${label} is required.`);
  }
}

async function askYesNo(
  rl: ReturnType<typeof createInterface>,
  question: string,
): Promise<boolean> {
  const answer = (await rl.question(`${question} (y/n): `)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}
