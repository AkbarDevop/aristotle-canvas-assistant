---
name: aristotle
description: Use when the user wants Aristotle to manage school workflows from Canvas, such as checking upcoming assignments, syncing deadlines, reviewing what matters next for a course, preparing for an exam, or publishing study tasks into Google Calendar, Trello, Todoist, Notion, Google Tasks, or Microsoft To Do. Best for terminal-first academic planning inside Codex or Claude Code.
---

# Aristotle

Aristotle is a terminal-first academic workflow skill built around the `aristotle-canvas-assistant` repo. It treats Canvas as the source of truth, turns coursework into local tasks, and can publish selected work into calendars, task apps, and notes tools.

## When To Use It

Use this skill when the user wants to:

- check upcoming Canvas deadlines or announcements
- build a short "what should I do next" plan
- prepare for a specific course or exam
- turn Aristotle tasks into study blocks or external tasks
- keep school planning inside Codex or Claude Code instead of a dashboard

Do not use this skill if the user only wants generic study advice with no repo or Canvas workflow involved.

## Repo And Setup

1. Work from the `aristotle-canvas-assistant` repo.
   Local default: `/Users/akbar/Downloads/aristotle-canvas-assistant-repo`
2. Check that `.env` is configured before assuming external integrations work.
3. For Canvas-only workflows, the minimum required env vars are:
   - `CANVAS_BASE_URL`
   - `CANVAS_ACCESS_TOKEN`
4. For publishing, use the relevant integration credentials from `.env`.

If setup details are needed, read:

- `README.md`
- `docs/student-quickstart.md`
- `docs/getting-credentials.md`
- `references/commands.md`

## Default Workflow

### 1. Build Current Context

Start with the smallest command that answers the question.

- identity / connection check: `npm run canvas:profile`
- quick upcoming deadlines: `npm run canvas:preview`
- local Aristotle state review: `npm run updates -- --days 7`
- course list: `npm run courses`

If the user wants current local planning, prefer `updates` first.
If the user wants the latest Canvas state, run `canvas:sync` first.

### 2. Sync Before Replanning

When the user asks for a fresh study plan, exam prep, or assignment breakdown:

```bash
npm run canvas:sync
```

Then use:

```bash
npm run updates -- --days 7
npm run prep -- --course "ECE 3510"
npm run tasks
```

### 3. Course Prep Flow

For a course-specific prep request:

1. sync Canvas if the answer should reflect the latest course state
2. run `npm run prep -- --course "<course name>"`
3. use the repo output as the base
4. then tailor the answer to the user's real constraints: time, exams, work, gym, clubs, or other commitments

Prefer minimum-time, highest-yield plans over broad textbook-style overviews.

### 4. Publish Carefully

When creating calendar blocks or external tasks:

1. inspect current state first if duplicates are possible
2. prefer `publish -- --dry-run` before writing to external apps
3. if the user wants direct control, use the app-specific commands

Examples:

```bash
npm run publish -- --to trello --id <task_id> --dry-run
npm run publish -- --to google-calendar --id <task_id> --start 2026-03-24T20:00:00-05:00 --hours 2 --dry-run
```

If editing an existing calendar plan, inspect the current events before patching them.

## Command Selection Rules

- `canvas:preview` for raw upcoming assignments from Canvas
- `canvas:sync` when Aristotle state should reflect the newest Canvas data
- `updates` for short planning summaries
- `prep` for one course
- `tasks` when the user wants concrete actionable items
- `publish` when pushing an Aristotle task outward

Use direct app commands only when:

- the user explicitly asks for the integration itself
- you need preview/create behavior not covered by `publish`
- you are repairing or patching existing external events/tasks

## Messaging Rules

- keep outputs practical and time-aware
- prefer "do this next" over broad summaries
- do not claim Aristotle sent an email unless a real sending flow exists
- drafting emails is fine; sending them requires a real connector or explicit user action
- never expose access tokens or secrets in output

## References

- command cheat sheet: `references/commands.md`
- project docs: `README.md`, `docs/student-quickstart.md`, `docs/getting-credentials.md`
