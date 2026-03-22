# Student Quickstart

## 1. Install

```bash
npm install
cp .env.example .env
```

## 2. Add your Canvas credentials

Start with:

- `CANVAS_BASE_URL`
- `CANVAS_ACCESS_TOKEN`

If you need help finding them:

- [Getting Credentials](getting-credentials.md)

Optional:

- `ARISTOTLE_DATA_DIR` if you do not want the default `./aristotle-data`

## 3. Verify the Canvas connection

```bash
npm run canvas:profile
npm run canvas:preview
```

## 4. Pull your assignments

```bash
npm run canvas:sync
```

That will:

- fetch upcoming Canvas assignments
- enqueue them locally
- run Aristotle on them
- write tasks, drafts, events, and a terminal report

## 5. Review what matters next

```bash
npm run updates -- --days 7
npm run courses
npm run prep -- --course "ECE 3510"
```

## 6. Update tasks as you work

```bash
npm run tasks
npm run task -- --id <task_id> --status in_progress
npm run task -- --id <task_id> --status done
```

## 7. Connect other apps if you want

Pick only what you actually use:

- `Google Calendar` and `Google Tasks`
- `Trello`
- `Todoist`
- `Notion`
- `Outlook Calendar` / `Microsoft To Do`

Examples:

```bash
npm run publish -- --to trello --id <task_id> --dry-run
npm run publish -- --to todoist --id <task_id> --dry-run
npm run publish -- --to notion --id <task_id> --dry-run
npm run publish -- --to google-calendar --id <task_id> --start 2026-03-24T20:00:00-05:00 --hours 2 --dry-run
```

## Files written locally

- `aristotle-data/state.json`
- `aristotle-data/latest-report.txt`
- optional Google OAuth token files if you enable Google integrations
