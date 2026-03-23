import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";

// ── ANSI helpers ──────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgCyan: "\x1b[46m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgMagenta: "\x1b[45m",
};

const bold = (s: string) => `${c.bold}${s}${c.reset}`;
const cyan = (s: string) => `${c.cyan}${s}${c.reset}`;
const green = (s: string) => `${c.green}${s}${c.reset}`;
const yellow = (s: string) => `${c.yellow}${s}${c.reset}`;
const dim = (s: string) => `${c.dim}${s}${c.reset}`;
const magenta = (s: string) => `${c.magenta}${s}${c.reset}`;
const red = (s: string) => `${c.red}${s}${c.reset}`;
const blue = (s: string) => `${c.blue}${s}${c.reset}`;

interface SetupResult {
  canvasBaseUrl: string;
  canvasAccessToken: string;
  telegramBotToken?: string | undefined;
  telegramChatId?: string | undefined;
}

// ── Spinner ───────────────────────────────────────────────
function spinner(text: string): { stop: (result: string) => void } {
  const frames = ["◐", "◓", "◑", "◒"];
  let i = 0;
  process.stdout.write(`  ${cyan(frames[0]!)} ${text}`);
  const interval = setInterval(() => {
    i = (i + 1) % frames.length;
    process.stdout.write(`\r  ${cyan(frames[i]!)} ${text}`);
  }, 80);

  return {
    stop(result: string) {
      clearInterval(interval);
      process.stdout.write(`\r  ${green("●")} ${text} ${result}\n`);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runSetupWizard(): Promise<void> {
  const rl = createInterface({ input, output });

  try {
    await printBanner();

    const envPath = path.resolve(process.cwd(), ".env");
    const existingEnv = existsSync(envPath) ? await readEnvFile(envPath) : {};
    if (existsSync(envPath)) {
      console.log(`  ${yellow("!")} Found existing ${bold(".env")} file.`);
      const overwrite = await askYesNo(rl, `  ${dim("Reconfigure?")}`);
      if (!overwrite) {
        console.log(`\n  ${dim("Setup cancelled. Your .env is unchanged.")}`);
        return;
      }
      console.log("");
    }

    // ── Step 1: Canvas ──────────────────────────────────────
    printStep(1, 4, "Connect to Canvas", "🏛️");
    console.log("");
    console.log(`  ${dim("Your Canvas URL looks like:")} ${cyan("https://yourschool.instructure.com")}`);
    console.log("");

    const canvasBaseUrl = await askStyled(rl, "Canvas URL");
    const cleanUrl = canvasBaseUrl.replace(/\/+$/, "");

    console.log("");
    console.log(`  ${dim("How to get your token (20 seconds):")}`);
    console.log(`  ${cyan("→")} Canvas ${dim("→")} Profile picture ${dim("→")} Settings ${dim("→")} Approved Integrations ${dim("→")} ${bold("+ New Access Token")}`);
    console.log("");

    const canvasAccessToken = await askStyled(rl, "Access token");

    console.log("");
    const verifySpinner = spinner("Connecting to Canvas...");
    const profile = await verifyCanvas(cleanUrl, canvasAccessToken);

    if (!profile) {
      verifySpinner.stop(red("failed"));
      console.log(`  ${red("✗")} Could not connect. Check your URL and token.`);
      const retry = await askYesNo(rl, `  ${dim("Continue anyway?")}`);
      if (!retry) {
        console.log(`  ${dim("Setup cancelled.")}`);
        return;
      }
    } else {
      verifySpinner.stop(green("connected"));
      await sleep(200);
      console.log(`  ${green("✓")} Welcome, ${bold(profile.name)}${profile.email ? dim(` (${profile.email})`) : ""}`);
    }

    // Fetch courses
    let courseNames: string[] = [];
    if (profile) {
      console.log("");
      const courseSpinner = spinner("Fetching your courses...");
      courseNames = await fetchCourseNames(cleanUrl, canvasAccessToken);
      if (courseNames.length > 0) {
        courseSpinner.stop(green(`${courseNames.length} found`));
        console.log("");
        for (const name of courseNames) {
          console.log(`    ${cyan("▸")} ${name}`);
        }
      } else {
        courseSpinner.stop(yellow("none found"));
      }
    }

    // ── Step 2: Telegram ────────────────────────────────────
    console.log("");
    printStep(2, 4, "Telegram Bot", "📱");
    console.log("");
    console.log(`  ${dim("Get assignment PDFs on your phone, check deadlines,")}`);
    console.log(`  ${dim("and interact with Aristotle from Telegram.")}`);
    console.log("");
    const wantTelegram = await askYesNo(rl, `  ${cyan("→")} Set up Telegram?`);

    let telegramBotToken: string | undefined;
    let telegramChatId: string | undefined;
    let telegramBotUsername: string | undefined;

    if (wantTelegram) {
      console.log("");
      console.log(`  ${bold("Create a bot in 30 seconds:")}`);
      console.log("");
      console.log(`    ${cyan("1.")} Open Telegram ${dim("→")} search ${bold("@BotFather")}`);
      console.log(`    ${cyan("2.")} Send ${bold("/newbot")} ${dim("→")} pick any name and username`);
      console.log(`    ${cyan("3.")} Copy the token BotFather gives you`);
      console.log("");

      telegramBotToken = await askStyled(rl, "Bot token");

      console.log("");
      const botSpinner = spinner("Verifying bot...");
      const bot = await verifyTelegram(telegramBotToken);
      if (bot) {
        telegramBotUsername = bot.username;
        botSpinner.stop(`${green("@" + bot.username)}`);
      } else {
        botSpinner.stop(yellow("could not verify — check later"));
      }

      console.log("");
      console.log(`  ${cyan("→")} Send any message to your bot in Telegram ${dim("(just type 'hi')")}`);
      console.log(`    then come back here.`);
      console.log("");

      await rl.question(`  ${dim("Press Enter after messaging your bot...")} `);

      const chatSpinner = spinner("Detecting your chat ID...");
      const detectedId = await detectTelegramChatId(telegramBotToken);
      telegramChatId = detectedId ?? undefined;

      if (telegramChatId) {
        chatSpinner.stop(green(`found (${telegramChatId})`));
      } else {
        chatSpinner.stop(yellow("no messages found"));
        console.log(`\n  ${dim("Find it manually:")}`);
        console.log(`  ${cyan(`https://api.telegram.org/bot${telegramBotToken}/getUpdates`)}`);
        console.log(`  ${dim('Look for "chat":{"id": YOUR_NUMBER}')}\n`);
        telegramChatId = await askStyled(rl, "Chat ID");
      }

      // Send welcome message
      if (telegramBotToken && telegramChatId) {
        console.log("");
        const welcomeSpinner = spinner("Sending welcome message...");
        const sent = await sendTelegramWelcome(
          telegramBotToken,
          telegramChatId,
          profile?.name ?? "there",
          courseNames,
        );
        welcomeSpinner.stop(sent ? green("sent! Check your phone") : yellow("failed, but setup continues"));
      }
    }

    // ── Step 3: Save config ─────────────────────────────────
    console.log("");
    printStep(3, 4, "Save Configuration", "💾");

    const envContent = buildEnvFile({
      canvasBaseUrl: cleanUrl,
      canvasAccessToken,
      telegramBotToken,
      telegramChatId,
    }, existingEnv);

    console.log("");
    const saveSpinner = spinner("Writing .env...");
    await writeFile(envPath, envContent, "utf-8");
    await sleep(300);
    saveSpinner.stop(green("saved"));

    // ── Step 4: First sync ──────────────────────────────────
    console.log("");
    printStep(4, 4, "First Look", "🔭");
    console.log("");
    const doSync = await askYesNo(rl, `  ${cyan("→")} Pull upcoming assignments now?`);

    if (doSync) {
      console.log("");
      await firstSync(cleanUrl, canvasAccessToken);
    }

    printSuccess(profile?.name, telegramBotUsername, wantTelegram, courseNames.length);
  } finally {
    rl.close();
  }
}

// ── Banner ────────────────────────────────────────────────
async function printBanner(): Promise<void> {
  console.clear();
  console.log("");
  console.log(cyan("        ___         _     __        __  __   "));
  console.log(cyan("       /   |  _____(_)___/ /_____  / /_/ /__ "));
  console.log(cyan("      / /| | / ___/ / __/ __/ __ \\/ __/ / _ \\"));
  console.log(cyan("     / ___ |/ /  / (__  ) /_/ /_/ / /_/ /  __/"));
  console.log(cyan("    /_/  |_/_/  /_/____/\\__/\\____/\\__/_/\\___/ "));
  console.log("");
  console.log(`    ${bold("Canvas Assistant")} ${dim("— your terminal study copilot")}`);
  console.log("");
  console.log(`    ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`);
  console.log("");
  console.log(`    ${green("▸")} Takes ~30 seconds`);
  console.log(`    ${green("▸")} You need: ${bold("Canvas access token")} ${dim("(required)")}`);
  console.log(`    ${green("▸")} Optional: ${bold("Telegram bot token")} ${dim("(for phone access)")}`);
  console.log("");
  console.log(`    ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`);
  console.log("");
  await sleep(400);
}

// ── Step header ───────────────────────────────────────────
function printStep(step: number, total: number, title: string, icon: string): void {
  const progress = dim(`[${step}/${total}]`);
  const bar = "█".repeat(step) + dim("░".repeat(total - step));
  console.log(`  ${icon} ${bold(title)} ${progress}`);
  console.log(`  ${cyan(bar)}`);
}

// ── Success screen ────────────────────────────────────────
function printSuccess(
  name?: string,
  botUsername?: string,
  hasTelegram?: boolean,
  courseCount = 0,
): void {
  console.log("");
  console.log(`  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`);
  console.log("");
  console.log(green("    ✦  Setup complete!"));
  console.log("");

  if (name) {
    console.log(`    Welcome, ${bold(name)}.`);
    if (courseCount > 0) {
      console.log(`    ${dim(`${courseCount} courses connected.`)}`);
    }
    console.log("");
  }

  console.log(`  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`);
  console.log("");

  console.log(`  ${bold("Quick start:")}`);
  console.log("");
  console.log(`    ${cyan("$")} npm run canvas:sync            ${dim("# Pull assignments")}`);
  console.log(`    ${cyan("$")} npm run updates -- --days 7    ${dim("# What's due this week")}`);
  console.log(`    ${cyan("$")} npm run tasks                  ${dim("# Your task list")}`);
  console.log(`    ${cyan("$")} npm run prep -- --course \"...\" ${dim("# Study prep for a course")}`);
  console.log("");

  if (hasTelegram) {
    console.log(`  ${bold("Telegram")}${botUsername ? dim(` @${botUsername}`) : ""}${bold(":")}`);
    console.log("");
    console.log(`    ${cyan("$")} npm run telegram:bot           ${dim("# Start the bot")}`);
    console.log("");
    console.log(`    ${dim("Then from your phone:")}`);
    console.log(`    ${magenta("/workload")}    ${dim("What's due soon")}`);
    console.log(`    ${magenta("/courses")}     ${dim("Your enrolled courses")}`);
    console.log(`    ${magenta("/pdf ece")}     ${dim("Get assignment PDFs")}`);
    console.log(`    ${magenta("/help")}        ${dim("All commands")}`);
    console.log("");
  }

  console.log(`  ${bold("Publish to other apps:")}`);
  console.log("");
  console.log(`    ${cyan("$")} npm run publish -- --to trello --id <id> --dry-run`);
  console.log(`    ${cyan("$")} npm run publish -- --to google-calendar --id <id> --start ...`);
  console.log(`    ${cyan("$")} npm run publish -- --to todoist --id <id> --dry-run`);
  console.log(`    ${cyan("$")} npm run publish -- --to notion --id <id> --dry-run`);
  console.log("");

  console.log(`  ${bold("AI skill")} ${dim("(Claude Code / Codex)")}`);
  console.log("");
  console.log(`    ${cyan("$")} npm run skill:install`);
  console.log(`    ${dim('Then:')} ${c.italic}"use $aristotle to check my next 7 days"${c.reset}`)
  console.log("");
  console.log(`  ${dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`);
  console.log(`  ${dim("Docs:")} ${cyan("https://github.com/AkbarDevop/aristotle-canvas-assistant")}`);
  console.log("");
}

// ── Styled input ──────────────────────────────────────────
async function askStyled(
  rl: ReturnType<typeof createInterface>,
  label: string,
): Promise<string> {
  while (true) {
    const value = (await rl.question(`  ${cyan("→")} ${bold(label)}: `)).trim();
    if (value.length > 0) return value;
    console.log(`    ${red("✗")} ${label} is required.`);
  }
}

async function askYesNo(
  rl: ReturnType<typeof createInterface>,
  question: string,
): Promise<boolean> {
  const answer = (await rl.question(`${question} ${dim("(y/n)")}: `)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

// ── Canvas helpers ────────────────────────────────────────
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
    let msg = `🏛️ Hey ${name}! Aristotle is set up and connected to your Canvas.\n\n`;

    if (courses.length > 0) {
      msg += `📚 Your courses:\n`;
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
    const syncSpinner = spinner("Pulling upcoming assignments...");
    const url = new URL("/api/v1/users/self/upcoming_events", baseUrl);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      syncSpinner.stop(red("failed"));
      console.log(`  ${dim("Run")} ${cyan("npm run canvas:sync")} ${dim("later.")}`);
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
      syncSpinner.stop(green("clear schedule!"));
      console.log(`  ${dim("No upcoming assignments. You're good for now.")}`);
      return;
    }

    syncSpinner.stop(green(`${assignments.length} found`));
    console.log("");

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
      console.log(`    ${cyan("▸")} ${bold(title)}`);
      console.log(`      ${dim(course)} ${dim("—")} ${yellow(`due ${due}`)}`);
    }

    console.log(`\n  ${dim("Run")} ${cyan("npm run canvas:sync")} ${dim("to import these into Aristotle.")}`);
  } catch {
    console.log(`  ${red("✗")} Sync failed. Run ${cyan("npm run canvas:sync")} later.`);
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
