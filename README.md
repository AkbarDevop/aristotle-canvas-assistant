# Aristotle Canvas Assistant

> **Get started in 30 seconds.** Just copy this command to your terminal

```bash
git clone https://github.com/AkbarDevop/aristotle-canvas-assistant.git
cd aristotle-canvas-assistant
npm install
npm run setup
```

The wizard walks you through everything. You only need **one thing**: your Canvas access token.

**Get your Canvas token (20 seconds):**
Canvas → Profile picture (top left) → **Settings** → **Approved Integrations** → **+ New Access Token** → copy it → paste into wizard.

> Some schools disable student tokens. If you don't see the option, ask your IT department.

---

Terminal-first Canvas LMS copilot. Pulls assignments, breaks them into tasks, publishes to your tools. Built for students who live in `Claude Code`, `Codex`, or a terminal.

## What it does

```
Canvas → Aristotle sync → task breakdown → terminal reports → publish to your apps
```

- Pulls assignments and deadlines from Canvas
- Breaks them into actionable study tasks
- Shows what to do first (priority + deadline awareness)
- Publishes tasks to the app you actually use

## Core commands

```bash
npm run canvas:sync                    # Pull assignments from Canvas
npm run updates -- --days 7            # What's due this week
npm run prep -- --course "ECE 3510"    # Course-specific prep
npm run tasks                          # List all tasks
npm run task -- --id <id> --status done  # Mark done
```

## Publish to your apps

```bash
npm run publish -- --to trello --id <id> --dry-run
npm run publish -- --to google-calendar --id <id> --start 2026-03-24T20:00:00 --hours 2 --dry-run
npm run publish -- --to todoist --id <id> --dry-run
npm run publish -- --to notion --id <id> --dry-run
npm run publish -- --to microsoft-todo --id <id> --dry-run
```

Remove `--dry-run` when you're ready to create for real.

## Supported integrations

| App | Type | Setup time |
|-----|------|-----------|
| **Canvas** | Source (required) | 20 sec — token from Settings |
| **Telegram** | Notifications + PDFs | 60 sec — create bot via @BotFather |
| **Google Calendar** | Calendar | 2 min — OAuth credentials |
| **Google Tasks** | Tasks | 2 min — same OAuth as Calendar |
| **Trello** | Tasks | 60 sec — API key from Power-Ups |
| **Todoist** | Tasks | 30 sec — token from Settings |
| **Notion** | Notes | 60 sec — create integration |
| **Outlook / Microsoft To Do** | Calendar + Tasks | 2 min — Graph Explorer token |

Only Canvas is required. Everything else is opt-in.

## Connect Telegram (60 seconds)

Aristotle can send you assignment PDFs and reminders straight to Telegram.

### Step 1: Create a bot (30 sec)

1. Open Telegram, search for **@BotFather**
2. Send `/newbot`
3. Pick a name (e.g. "Aristotle") and username (e.g. `aristotle_canvas_bot`)
4. BotFather gives you a token like `7123456789:AAF1x...` — copy it

### Step 2: Get your chat ID (30 sec)

1. Open your new bot in Telegram and send it any message (e.g. "hello")
2. Open this URL in your browser (replace `YOUR_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_TOKEN/getUpdates
   ```
3. Find `"chat":{"id":123456789}` in the response — that number is your chat ID

### Step 3: Add to config

If you ran `npm run setup`, you already entered these. Otherwise add to `.env`:

```env
TELEGRAM_BOT_TOKEN=7123456789:AAF1x...
TELEGRAM_CHAT_ID=123456789
```

### Test it

```bash
npm run telegram:profile          # Should show your bot's name
npm run telegram:send             # Send a test message
npm run generate:list             # List Canvas assignments
npm run generate:send             # Download + send PDF to Telegram
```

## Connect other apps

<details>
<summary><strong>Google Calendar / Google Tasks</strong></summary>

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → enable **Google Calendar API** (and **Tasks API** if needed)
3. Go to **Credentials** → **Create OAuth client** → type **Desktop app**
4. Download the JSON file

```env
GOOGLE_CLIENT_CREDENTIALS_PATH=/path/to/credentials.json
GOOGLE_CALENDAR_ID=primary
```

```bash
npm run google:auth    # Opens browser, one-time OAuth
```

</details>

<details>
<summary><strong>Trello</strong></summary>

1. Go to [trello.com/power-ups/admin](https://trello.com/power-ups/admin)
2. Create a Power-Up → copy **API Key**
3. Follow the token link to generate a **user token**

```env
TRELLO_API_KEY=your_key
TRELLO_TOKEN=your_token
```

```bash
npm run trello:profile    # Find your board/list IDs
```

</details>

<details>
<summary><strong>Todoist</strong></summary>

1. [Todoist Settings](https://todoist.com) → **Integrations** → **Developer** → copy **API Token**

```env
TODOIST_API_TOKEN=your_token
```

</details>

<details>
<summary><strong>Notion</strong></summary>

1. Create an [internal integration](https://www.notion.so/my-integrations) → copy token
2. Share your target page with the integration

```env
NOTION_API_TOKEN=your_token
NOTION_PARENT_PAGE_ID=page_id_from_url
```

</details>

<details>
<summary><strong>Microsoft (Outlook Calendar / To Do)</strong></summary>

1. Open [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in → consent to calendar + todo permissions
3. Copy the access token

```env
MICROSOFT_GRAPH_ACCESS_TOKEN=your_token
MICROSOFT_TIME_ZONE=America/Chicago
```

> Note: This token is short-lived. For durable setup, register your own app.

</details>

## Install as a skill (Claude Code / Codex)

```bash
npm run skill:install
```

Then use in prompts:

```
Use $aristotle to check what matters in my next 7 days
Use $aristotle to prep me for ECE 3510
Use $aristotle to sync Canvas and publish my next task to Trello
```

## Architecture

```
src/
├── connectors/     # Canvas, Google, Trello, Todoist, Notion, Microsoft, Telegram
├── pipeline/       # sync, intake, tasks, publish, reports, generate-pdf
├── interactive/    # setup wizard, intake wizard
├── agents/         # Aristotle AI agent
├── memory/         # local file store
├── index.ts        # CLI entry point
└── config.ts       # env loader
```

All state stored locally in `aristotle-data/`. No hosted backend. Your data stays on your machine.

## Testing

```bash
npm run check    # TypeScript check
npm run test     # Run tests
```

## License

[MIT](LICENSE)
