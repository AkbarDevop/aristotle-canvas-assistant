# Aristotle Canvas Assistant

Aristotle Canvas Assistant is a terminal-first Canvas copilot for students who already live in `Codex`, `Claude Code`, or a shell.

It pulls Canvas assignments, turns them into concrete tasks, keeps local state on your machine, and can publish that work out to the tools people already use: Google Calendar, Google Tasks, Trello, Todoist, Notion, Outlook Calendar, and Microsoft To Do.

![Aristotle terminal preview](docs/assets/terminal-preview.svg)

## Why this exists

Canvas shows deadlines. It usually does not tell you:

- what to do first
- how to break an assignment down
- what course is about to collide with another one
- what to review for a specific class right now
- how to push that plan into your actual workflow tools

Aristotle sits on top of Canvas and gives you:

- local task breakdowns
- terminal reports
- course-specific prep views
- one-command publishing into popular calendar, task, and notes apps

## 30-second demo

```bash
npm run canvas:sync
npm run tasks
npm run publish -- --to trello --id <task_id> --dry-run
npm run publish -- --to google-calendar --id <task_id> --start 2026-03-24T20:00:00-05:00 --hours 2 --dry-run
```

That is the core loop:

1. pull assignments from Canvas
2. let Aristotle break them into tasks
3. push the one you care about into the external tool you actually use

## Product shape

This repo is intentionally not a dashboard app.

The main workflow is:

```text
Canvas
  ->
local sync
  ->
Aristotle task breakdown
  ->
terminal reports
  ->
publish selected tasks to external apps
```

That makes it fit well inside:

- `Codex`
- `Claude Code`
- a normal terminal session

## Supported integrations

Core source:

- `Canvas`

Calendars:

- `Google Calendar`
- `Outlook Calendar` via Microsoft Graph

Task apps:

- `Google Tasks`
- `Trello`
- `Todoist`
- `Microsoft To Do`

Notes / workspace:

- `Notion`

## What it does today

- connect to Canvas with a personal access token
- preview upcoming assignments
- sync assignments into local Aristotle state
- break assignments into actionable tasks and outlines
- print a plain-text updates report
- print a course-specific prep report
- publish an Aristotle task into external apps with `from-task`
- keep all generated state on your machine

## Quick start

```bash
npm install
cp .env.example .env
```

Minimum required for the Canvas workflow:

- `CANVAS_BASE_URL`
- `CANVAS_ACCESS_TOKEN`

Then verify the connection:

```bash
npm run canvas:profile
npm run canvas:preview
```

If you do not know where to get the required tokens and IDs, use the setup guide:

- [Getting Credentials](docs/getting-credentials.md)

## Core terminal workflow

```bash
npm run canvas:sync
npm run updates -- --days 7
npm run prep -- --course "ECE 3510"
npm run tasks
```

Example task update:

```bash
npm run task -- --id <task_id> --status done
```

## Publish a task into other apps

Once Aristotle has local tasks, you can push a task into the apps you actually use.

Examples:

```bash
npm run publish -- --to trello --id <task_id> --dry-run
npm run publish -- --to todoist --id <task_id> --dry-run
npm run publish -- --to notion --id <task_id> --dry-run
npm run publish -- --to google-tasks --id <task_id> --dry-run
npm run publish -- --to microsoft-todo --id <task_id> --dry-run
npm run publish -- --to google-calendar --id <task_id> --start 2026-03-24T20:00:00-05:00 --hours 2 --dry-run
npm run publish -- --to microsoft-calendar --id <task_id> --start 2026-03-24T20:00:00-05:00 --hours 2 --dry-run
```

Supported `--to` targets:

- `google-calendar`
- `google-tasks`
- `trello`
- `todoist`
- `notion`
- `microsoft-calendar`
- `microsoft-todo`

For calendars, `publish` creates a study block. For task and notes apps, it publishes the Aristotle task directly.

## Main commands

Canvas + Aristotle:

- `npm run canvas:profile`
- `npm run canvas:preview`
- `npm run canvas:sync`
- `npm run updates -- --days 7`
- `npm run prep -- --course "ECE 3510"`
- `npm run courses`
- `npm run tasks`
- `npm run task -- --id <task_id> --status in_progress`
- `npm run intake -- --interactive --sync`
- `npm run state`
- `npm run publish -- --to <target> --id <task_id> [--dry-run]`

Power-user direct app commands:
These stay available if you want app-specific control instead of the unified `publish` command.

Google Calendar:

- `npm run google:auth`
- `npm run google:preview`
- `npm run google:create`
- `npm run google:from-task`

Google Tasks:

- `npm run google-tasks:auth`
- `npm run google-tasks:lists`
- `npm run google-tasks:preview`
- `npm run google-tasks:create`
- `npm run google-tasks:from-task`

Trello:

- `npm run trello:profile`
- `npm run trello:preview`
- `npm run trello:create`
- `npm run trello:from-task`

Todoist:

- `npm run todoist:profile`
- `npm run todoist:projects`
- `npm run todoist:preview`
- `npm run todoist:create`
- `npm run todoist:from-task`

Notion:

- `npm run notion:profile`
- `npm run notion:preview`
- `npm run notion:create`
- `npm run notion:from-task`

Microsoft Graph:

- `npm run microsoft:profile`
- `npm run microsoft:calendar-preview`
- `npm run microsoft:calendar-create`
- `npm run microsoft:calendar-from-task`
- `npm run microsoft:todo-lists`
- `npm run microsoft:todo-preview`
- `npm run microsoft:todo-create`
- `npm run microsoft:todo-from-task`

## Configuration

The repo is still local-first:

- data is stored in `aristotle-data/` by default
- secrets stay in your local `.env`
- no hosted backend is required

Files written locally:

- `state.json`
- `latest-report.txt`
- Google OAuth token files if you enable Google Calendar or Google Tasks

Override the default data path with `ARISTOTLE_DATA_DIR` if you want.

## Integration notes

- `Google Calendar` and `Google Tasks` use local OAuth credentials plus local token files.
- `Trello`, `Todoist`, `Notion`, and `Microsoft Graph` use API tokens in `.env`.
- `Notion` expects a parent page ID for page creation.
- `Microsoft Graph` expects a bearer token with the calendar and/or To Do scopes you need.
- `publish -- --dry-run` is the safest way to verify what Aristotle will send before it creates anything.

## CLI v1 and extension v2

This repo is still intentionally focused on the CLI first. The product direction is:

- `CLI v1`: terminal-first Canvas + integration assistant
- `Chrome extension v2`: optional in-browser helper for Canvas pages

See [docs/product-spec.md](docs/product-spec.md).

## Testing

```bash
npm run check
npm run test
```

## Docs

- [Student Quickstart](docs/student-quickstart.md)
- [Getting Credentials](docs/getting-credentials.md)
- [Product Spec](docs/product-spec.md)

## License

[MIT](LICENSE)
