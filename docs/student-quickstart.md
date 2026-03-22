# Student Quickstart

## 1. Install

```bash
npm install
cp .env.example .env
```

## 2. Add your Canvas credentials

Fill in:

- `CANVAS_BASE_URL`
- `CANVAS_ACCESS_TOKEN`

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
- produce tasks, alerts, and a brief

## 5. Review the outputs

```bash
npm run dashboard
npm run today
npm run web -- --sync
```

## 6. Update tasks as you work

```bash
npm run tasks
npm run task -- --id <task_id> --status in_progress --sync
npm run task -- --id <task_id> --status done --sync
```

## Files written locally

- `aristotle-data/state.json`
- `aristotle-data/latest-brief.txt`
- `aristotle-data/latest-dashboard.txt`
- `aristotle-data/latest-today.txt`
