# Student Quickstart

## Setup (30 seconds)

```bash
git clone https://github.com/AkbarDevop/aristotle-canvas-assistant.git
cd aristotle-canvas-assistant
npm install
npm run setup
```

The wizard asks for your Canvas URL and token. That's the only required step.

### Where's my Canvas token?

Canvas → Profile picture (top left) → **Settings** → scroll to **Approved Integrations** → **+ New Access Token** → copy it.

## Daily workflow

```bash
npm run canvas:sync                    # Pull latest from Canvas
npm run updates -- --days 7            # What's due this week
npm run tasks                          # See your task list
npm run task -- --id <id> --status done  # Check off a task
```

## Course-specific prep

```bash
npm run prep -- --course "ECE 3510"
npm run prep -- --course "CHEM 1400"
```

## Push tasks to your apps

```bash
npm run publish -- --to trello --id <id> --dry-run
npm run publish -- --to google-calendar --id <id> --start 2026-03-24T20:00:00 --hours 2 --dry-run
```

Remove `--dry-run` when ready.

## Optional: Telegram notifications

Run `npm run setup` again and say yes to Telegram, or see the [README](../README.md#connect-telegram-60-seconds) for manual setup.

## Optional: Install as a skill

```bash
npm run skill:install
```

Then in Claude Code or Codex:

```
Use $aristotle to check what matters in my next 7 days
Use $aristotle to prep me for ECE 3510
```
