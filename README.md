# Aristotle Canvas Assistant

Aristotle Canvas Assistant is a local Canvas-first study planner.

It pulls upcoming Canvas assignments, breaks them into smaller tasks, prioritizes the work, and gives you a brief plus a local dashboard you can actually use.

## Why it exists

Canvas shows deadlines. It does not turn them into a plan.

This project adds a simple three-agent workflow:

- `Aristotle`: turns assignments into concrete tasks and prep checklists
- `Napoleon`: prioritizes what matters now and flags overload
- `Caesar`: produces the short command brief

## What it does

- connect to Canvas with a personal access token
- preview upcoming assignments
- sync assignments into local state
- break assignments into actionable tasks
- generate a brief, dashboard, and today view
- run a local web dashboard

## Setup

```bash
npm install
cp .env.example .env
```

Add these values to `.env`:

- `CANVAS_BASE_URL`
- `CANVAS_ACCESS_TOKEN`

Then verify the connection:

```bash
npm run canvas:profile
npm run canvas:preview
```

## Main Commands

```bash
npm run canvas:sync
npm run dashboard
npm run today
npm run web -- --sync
```

More commands:

- `npm run demo`: seed a sample assignment and generate a brief
- `npm run intake -- --interactive --sync`: add a manual assignment
- `npm run sync`: process inbox items and rebuild the brief
- `npm run tasks`: list active tasks
- `npm run task -- --id <task_id> --status done --sync`: update a task and refresh the brief
- `npm run daemon -- --interval 300`: resync Canvas every 5 minutes
- `npm run state`: print the saved local state

## Local Data

The app writes its state to `aristotle-data/` by default:

- `state.json`
- `latest-brief.txt`
- `latest-dashboard.txt`
- `latest-today.txt`

Override that path with `ARISTOTLE_DATA_DIR` if you want.

## Quick Start

See [docs/student-quickstart.md](docs/student-quickstart.md) for the shortest path from Canvas token to running dashboard.
