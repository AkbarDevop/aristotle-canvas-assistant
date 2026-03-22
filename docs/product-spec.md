# Aristotle Product Spec

## Positioning

Aristotle is a terminal-first Canvas copilot for students who already work inside an AI coding shell or a normal terminal.

The key idea is not "another student dashboard." It is:

- pull real course data from Canvas
- compress it into a short actionable plan
- keep the output in plain text so it fits inside `Codex`, `Claude Code`, and shell workflows

## Why not a dashboard

A dashboard creates another place to check.

For the target user, the better workflow is:

1. open terminal
2. sync Canvas
3. ask what matters next
4. get a short answer
5. keep moving

That is why the main product surface is CLI-first.

## CLI v1

### Goal

Ship the narrowest version that is clearly useful:

- upcoming deadlines
- assignment breakdowns
- course-specific prep
- task tracking

### Primary user

A busy student who:

- already uses terminal tools
- wants minimum planning overhead
- wants fast exam and assignment triage
- prefers local-first tools over another SaaS app

### Core commands

- `npm run canvas:profile`
- `npm run canvas:preview`
- `npm run canvas:sync`
- `npm run updates -- --days 7`
- `npm run prep -- --course "ECE 3510"`
- `npm run courses`
- `npm run tasks`
- `npm run task -- --id <task_id> --status done`
- `npm run intake -- --interactive --sync`

### Outputs

- `state.json` for local state
- `latest-report.txt` for the most recent terminal summary
- plain-text reports that can be pasted directly into AI tools

### Non-goals for v1

- hosted backend
- social features
- full calendar system
- visual dashboard
- browser UI as the main experience

## Chrome extension v2

### Why it exists

The extension is useful only after the CLI is solid.

Its job is not to replace the CLI. Its job is to make Canvas pages themselves smarter.

### Best extension entry points

- assignment page: summarize prompt and produce a task breakdown
- module page: summarize what matters in this module
- announcements page: extract exam details or important changes
- grades page: flag high-risk courses or missing items

### Good v2 features

- "Summarize this assignment"
- "Turn this page into Aristotle tasks"
- "Extract exam date, room, and allowed materials"
- "Send this assignment to local Aristotle state"

### Non-goals for v2

- reproducing all CLI features in the extension
- becoming a general-purpose Canvas redesign
- requiring a hosted sync service

## Roadmap summary

- `v1`: terminal-first Aristotle CLI
- `v2`: optional Chrome extension for page-level Canvas actions
