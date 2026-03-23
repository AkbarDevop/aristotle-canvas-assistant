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
        "  A .env file already exists. Reconfigure?",
      );
      if (!overwrite) {
        console.log("\n  Setup cancelled. Your existing .env is unchanged.");
        return;
      }
    }

    // ── Step 1: Canvas ──────────────────────────────────────
    console.log("");
    console.log("  ┌─────────────────────────────────────────┐");
    console.log("  │  Step 1 of 4 — Canvas LMS (required)    │");
    console.log("  └─────────────────────────────────────────┘");
    console.log("");
    console.log("  Your Canvas URL looks like: https://yourschool.instructure.com");
    console.log("");

    const canvasBaseUrl = await askRequired(rl, "  Canvas URL");
    const cleanUrl = canvasBaseUrl.replace(/\/+$/, "");

    console.log("");
    console.log("  How to get your token (20 seconds):");
    console.log("  Canvas → Profile picture → Settings → Approved Integrations → + New Access Token");
    console.log("");

    const canvasAccessToken = await askRequired(rl, "  Access token");

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
      console.log(`connected!`);
      console.log("");
      console.log(`  ✓ Welcome, ${profile.name}${profile.email ? ` (${profile.email})` : ""}`);
    }

    // Fetch courses to show immediately
    let courseNames: string[] = [];
    if (profile) {
      process.stdout.write("  ✓ Fetching your courses... ");
      courseNames = await fetchCourseNames(cleanUrl, canvasAccessToken);
      if (courseNames.length > 0) {
        console.log(`found ${courseNames.length}:`);
        for (const c of courseNames) {
          console.log(`    • ${c}`);
        }
      } else {
        console.log("none found.");
      }
    }

    // ── Step 2: Telegram ────────────────────────────────────
    console.log("");
    console.log("  ┌─────────────────────────────────────────┐");
    console.log("  │  Step 2 of 4 — Telegram (optional)      │");
    console.log("  └─────────────────────────────────────────┘");
    console.log("");
    console.log("  Telegram lets you:");
    console.log("    • Pull assignment PDFs to your phone");
    console.log("    • Check deadlines without opening Canvas");
    console.log("    • Get reminders (with cron, coming soon)");
    console.log("");
    const wantTelegram = await askYesNo(rl, "  Set up Telegram?");

    let telegramBotToken: string | undefined;
    let telegramChatId: string | undefined;
    let telegramBotUsername: string | undefined;

    if (wantTelegram) {
      console.log("");
      console.log("  Create a bot in 30 seconds:");
      console.log("  ┌──────────────────────────────────────────────────┐");
      console.log("  │  1. Open Telegram → search @BotFather            │");
      console.log("  │  2. Send /newbot → pick any name and username    │");
      console.log("  │  3. Copy the token BotFather gives you           │");
      console.log("  └──────────────────────────────────────────────────┘");
      console.log("");

      telegramBotToken = await askRequired(rl, "  Bot token");

      process.stdout.write("\n  Verifying bot... ");
      const bot = await verifyTelegram(telegramBotToken);
      if (bot) {
        telegramBotUsername = bot.username;
        console.log(`connected! @${bot.username}`);
      } else {
        console.log("could not verify. Check the token later.");
      }

      console.log("");
      console.log("  Now send any message to your bot in Telegram (just type 'hi')");
      console.log("  then come back here and press Enter.\n");

      await rl.question("  Press Enter after messaging your bot...");

      process.stdout.write("  Detecting your chat ID... ");
      const detectedId = await detectTelegramChatId(telegramBotToken);
      telegramChatId = detectedId ?? undefined;

      if (telegramChatId) {
        console.log(`found! (${telegramChatId})`);
      } else {
        console.log("no messages found yet.");
        console.log(`\n  Open this URL to find it manually:`);
        console.log(`  https://api.telegram.org/bot${telegramBotToken}/getUpdates`);
        console.log(`  Look for "chat":{"id": YOUR_NUMBER}\n`);
        telegramChatId = await askRequired(rl, "  Chat ID");
      }

      // Send welcome message to Telegram
      if (telegramBotToken && telegramChatId) {
        process.stdout.write("  Sending welcome message to Telegram... ");
        const sent = await sendTelegramWelcome(
          telegramBotToken,
          telegramChatId,
          profile?.name ?? "there",
          courseNames,
        );
        console.log(sent ? "sent! Check your phone." : "failed, but setup continues.");
      }
    }

    // ── Step 3: Save config ─────────────────────────────────
    console.log("");
    console.log("  ┌─────────────────────────────────────────┐");
    console.log("  │  Step 3 of 4 — Saving configuration     │");
    console.log("  └─────────────────────────────────────────┘");

    const envContent = buildEnvFile({
      canvasBaseUrl: cleanUrl,
      canvasAccessToken,
      telegramBotToken,
      telegramChatId,
    }, existingEnv);

    await writeFile(envPath, envContent, "utf-8");
    console.log("\n  ✓ Saved to .env");

    // ── Step 4: First sync ──────────────────────────────────
    console.log("");
    console.log("  ┌─────────────────────────────────────────┐");
    console.log("  │  Step 4 of 4 — First look               │");
    console.log("  └─────────────────────────────────────────┘");
    console.log("");
    const doSync = await askYesNo(rl, "  Pull your upcoming assignments now?");

    if (doSync) {
      console.log("");
      await firstSync(cleanUrl, canvasAccessToken);
    }

    printSuccess(profile?.name, telegramBotUsername, wantTelegram);
  } finally {
    rl.close();
  }
}

function printBanner(): void {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════╗");
  console.log("  ║                                                  ║");
  console.log("  ║     Aristotle — Canvas Assistant Setup           ║");
  console.log("  ║                                                  ║");
  console.log("  ║     Pull assignments, break them into tasks,     ║");
  console.log("  ║     get PDFs on your phone, never miss a due     ║");
  console.log("  ║     date again.                                  ║");
  console.log("  ║                                                  ║");
  console.log("  ╚══════════════════════════════════════════════════╝");
  console.log("");
  console.log("  This takes ~30 seconds. You need:");
  console.log("  → Canvas access token (required)");
  console.log("  → Telegram bot token  (optional, for phone access)");
  console.log("");
}

function printSuccess(
  name?: string,
  botUsername?: string,
  hasTelegram?: boolean,
): void {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════╗");
  console.log("  ║                                                  ║");
  console.log("  ║          Setup complete!                         ║");
  console.log("  ║                                                  ║");
  console.log("  ╚══════════════════════════════════════════════════╝");
  console.log("");

  if (name) {
    console.log(`  Welcome aboard, ${name}.\n`);
  }

  console.log("  What you can do now:");
  console.log("  ─────────────────────────────────────────────────");
  console.log("");
  console.log("  Terminal commands:");
  console.log("    npm run canvas:preview           See upcoming deadlines");
  console.log("    npm run canvas:sync              Pull & break down assignments");
  console.log("    npm run updates -- --days 7      Weekly workload report");
  console.log("    npm run prep -- --course \"...\"    Course-specific study prep");
  console.log("    npm run tasks                    View your task list");
  console.log("");

  if (hasTelegram) {
    console.log("  Telegram bot" + (botUsername ? ` (@${botUsername})` : "") + ":");
    console.log("    npm run telegram:bot             Start the bot (responds to messages)");
    console.log("");
    console.log("  Telegram commands (from your phone):");
    console.log("    /workload                        What's due soon");
    console.log("    /courses                         Your enrolled courses");
    console.log("    /pdf                             Get assignment PDFs sent to you");
    console.log("    /pdf ece                         PDFs for a specific course");
    console.log("    /help                            All commands");
    console.log("");
  }

  console.log("  Publish tasks to other apps:");
  console.log("    npm run publish -- --to trello --id <id> --dry-run");
  console.log("    npm run publish -- --to google-calendar --id <id> --start ... --hours 2");
  console.log("");
  console.log("  Install as an AI skill (Claude Code / Codex):");
  console.log("    npm run skill:install");
  console.log("    Then: \"use $aristotle to check my next 7 days\"");
  console.log("");
  console.log("  ─────────────────────────────────────────────────");
  console.log("  Docs: https://github.com/AkbarDevop/aristotle-canvas-assistant");
  console.log("");
}

async function fetchCourseNames(
  baseUrl: string,
  token: string,
): Promise<string[]> {
  try {
    const response = await fetch(
      new URL("/api/v1/courses?enrollment_state=active&per_page=50", baseUrl),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) return [];

    const courses = (await response.json()) as Array<{ name?: string; course_code?: string }>;
    const junkPatterns = [
      "NONCREDIT", "PLACEMENT", "WELCOME", "EMERGENCY", "ALERT",
      "TRAINING", "Self-Paced", "CIVICS", "DATAFEST", "Placement Exam",
    ];
    return courses
      .map((c) => c.name || c.course_code || "Unknown")
      .filter((name) => !junkPatterns.some((p) => name.includes(p)))
      .map((name) => {
        const match = name.match(/\d{4}\w{2}-([A-Z_]+)-(\d{4})/);
        if (match?.[1] && match[2]) {
          return `${match[1].replace(/_/g, " ")} ${match[2]}`;
        }
        return name;
      });
  } catch {
    return [];
  }
}

async function sendTelegramWelcome(
  botToken: string,
  chatId: string,
  name: string,
  courses: string[],
): Promise<boolean> {
  try {
    let msg = `Hey ${name}! Aristotle is set up and connected to your Canvas.\n\n`;

    if (courses.length > 0) {
      msg += `Your courses:\n`;
      for (const c of courses) {
        msg += `  • ${c}\n`;
      }
      msg += `\n`;
    }

    msg += `Try these commands:\n`;
    msg += `/workload — what's due soon\n`;
    msg += `/pdf — get assignment PDFs here\n`;
    msg += `/courses — your courses\n`;
    msg += `/help — all commands`;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg }),
    });
    const data = (await response.json()) as { ok: boolean };
    return data.ok;
  } catch {
    return false;
  }
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
      console.log("  Could not fetch assignments. Run `npm run canvas:sync` later.");
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
      console.log("  No upcoming assignments found. You're clear for now!");
      return;
    }

    console.log(`  Found ${assignments.length} upcoming assignment(s):\n`);
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
      console.log(`    • ${title}`);
      console.log(`      ${course} — due ${due}`);
    }

    console.log("\n  Run `npm run canvas:sync` to import these into Aristotle.");
  } catch {
    console.log("  Sync failed. Run `npm run canvas:sync` later.");
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
