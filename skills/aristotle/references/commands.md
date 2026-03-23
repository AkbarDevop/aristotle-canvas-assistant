# Aristotle Command Reference

Use this file when you need the exact repo commands while running the skill.

## Core Canvas Workflow

```bash
npm run canvas:profile
npm run canvas:preview
npm run canvas:sync
npm run updates -- --days 7
npm run prep -- --course "ECE 3510"
npm run courses
npm run tasks
npm run task -- --id <task_id> --status in_progress
npm run task -- --id <task_id> --status done
```

## Unified Publish Flow

```bash
npm run publish -- --to trello --id <task_id> --dry-run
npm run publish -- --to todoist --id <task_id> --dry-run
npm run publish -- --to notion --id <task_id> --dry-run
npm run publish -- --to google-tasks --id <task_id> --dry-run
npm run publish -- --to microsoft-todo --id <task_id> --dry-run
npm run publish -- --to google-calendar --id <task_id> --start 2026-03-24T20:00:00-05:00 --hours 2 --dry-run
npm run publish -- --to microsoft-calendar --id <task_id> --start 2026-03-24T20:00:00-05:00 --hours 2 --dry-run
```

## Direct Integration Commands

Google Calendar:

```bash
npm run google:auth
npm run google:preview
npm run google:create
npm run google:from-task
```

Google Tasks:

```bash
npm run google-tasks:auth
npm run google-tasks:lists
npm run google-tasks:preview
npm run google-tasks:create
npm run google-tasks:from-task
```

Trello:

```bash
npm run trello:profile
npm run trello:preview
npm run trello:create
npm run trello:from-task
```

Todoist:

```bash
npm run todoist:profile
npm run todoist:projects
npm run todoist:preview
npm run todoist:create
npm run todoist:from-task
```

Notion:

```bash
npm run notion:profile
npm run notion:preview
npm run notion:create
npm run notion:from-task
```

Microsoft Graph:

```bash
npm run microsoft:profile
npm run microsoft:calendar-preview
npm run microsoft:calendar-create
npm run microsoft:calendar-from-task
npm run microsoft:todo-lists
npm run microsoft:todo-preview
npm run microsoft:todo-create
npm run microsoft:todo-from-task
```

## Recommended Order

For most users:

1. `npm run canvas:sync`
2. `npm run updates -- --days 7`
3. `npm run prep -- --course "<course>"`
4. `npm run tasks`
5. `npm run publish -- --to <target> --id <task_id> --dry-run`
