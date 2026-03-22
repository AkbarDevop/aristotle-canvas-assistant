# Getting Credentials

This guide explains how to get the tokens, IDs, and credential files Aristotle needs.

Use only the integrations you actually want. `Canvas` is the only one required for the base workflow.

## 1. Canvas

Aristotle needs:

- `CANVAS_BASE_URL`
- `CANVAS_ACCESS_TOKEN`

### Find your Canvas base URL

Open your school’s Canvas in a browser and copy the root URL.

Examples:

- `https://umsystem.instructure.com`
- `https://your-school.instructure.com`

Do not include `/courses/...` or other extra path segments.

### Generate a Canvas access token

Canvas documents user access tokens here:

- https://canvas.instructure.com/doc/api/access_tokens.html
- https://community.canvaslms.com/t5/Canvas-Basics-Guide/How-do-I-manage-API-access-tokens-in-my-user-account/ta-p/615312

Typical path inside Canvas:

1. Open `Account`
2. Open `Settings`
3. Find `Approved Integrations` or `Access Tokens`
4. Create a new token
5. Copy it immediately

Put it in `.env`:

```env
CANVAS_BASE_URL=https://your-school.instructure.com
CANVAS_ACCESS_TOKEN=your_token_here
```

### Important note

Some schools disable personal access token generation for students. If your Canvas instance does not show the token option, this repo’s current Canvas flow will not work until you have an approved token method from your institution.

## 2. Google Calendar and Google Tasks

Aristotle uses:

- `GOOGLE_CLIENT_CREDENTIALS_PATH`
- optionally:
  - `GOOGLE_CALENDAR_ID`
  - `GOOGLE_TASKS_LIST_ID`

Google’s quickstarts:

- Calendar quickstart: https://developers.google.com/workspace/calendar/api/quickstart/nodejs
- Tasks quickstart: https://developers.google.com/workspace/tasks/quickstart/go

### What you need to create

1. A Google Cloud project
2. The `Google Calendar API` enabled
3. The `Google Tasks API` enabled if you want Google Tasks
4. An OAuth consent screen
5. An OAuth client of type `Desktop app`
6. The downloaded client credentials JSON file

### Recommended setup

1. Go to Google Cloud Console
2. Create or choose a project
3. Enable `Google Calendar API`
4. Enable `Google Tasks API` if needed
5. Configure the OAuth consent screen
6. Create OAuth credentials for a `Desktop app`
7. Download the JSON credentials file
8. Put the file somewhere local, outside version control if possible

Then set:

```env
GOOGLE_CLIENT_CREDENTIALS_PATH=/absolute/path/to/google-oauth-client.json
GOOGLE_CALENDAR_ID=primary
GOOGLE_TASKS_LIST_ID=
```

### First auth run

Calendar:

```bash
npm run google:auth
```

Tasks:

```bash
npm run google-tasks:auth
```

The first run opens a browser and stores a local token file inside `aristotle-data/` unless you override the token path in `.env`.

## 3. Trello

Aristotle uses:

- `TRELLO_API_KEY`
- `TRELLO_TOKEN`
- optionally:
  - `TRELLO_BOARD_ID`
  - `TRELLO_DEFAULT_LIST_ID`

Official docs:

- API intro: https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/
- Authorization: https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/

### Get your API key and token

1. Go to Trello Power-Ups admin:
   `https://trello.com/power-ups/admin`
2. Create or open a Power-Up
3. Open the `API Key` tab
4. Generate or copy the API key
5. Use the linked token flow from that page to generate a user token

The Trello docs also describe the self-authorization URL pattern for generating your own token.

Then set:

```env
TRELLO_API_KEY=your_api_key
TRELLO_TOKEN=your_user_token
TRELLO_BOARD_ID=
TRELLO_DEFAULT_LIST_ID=
```

### Find board and list IDs

Use:

```bash
npm run trello:profile
npm run trello:preview
```

That will help you identify the board and list you want to use.

## 4. Todoist

Aristotle uses:

- `TODOIST_API_TOKEN`
- optionally `TODOIST_PROJECT_ID`

Official docs:

- API docs: https://developer.todoist.com/api/v1/
- Find your API token: https://www.todoist.com/help/articles/8048880904476

### Get your personal API token

Todoist’s help article says to:

1. Log in to Todoist on the web
2. Click your avatar
3. Open `Settings`
4. Open `Integrations`
5. Open the `Developer` tab
6. Copy the API token

Then set:

```env
TODOIST_API_TOKEN=your_api_token
TODOIST_PROJECT_ID=
```

### Find project IDs

Use:

```bash
npm run todoist:projects
```

## 5. Notion

Aristotle uses:

- `NOTION_API_TOKEN`
- `NOTION_PARENT_PAGE_ID`

Official docs:

- Authorization guide: https://developers.notion.com/guides/get-started/authorization
- Authentication reference: https://developers.notion.com/reference/authentication
- Finding a page ID: https://developers.notion.com/guides/data-apis

### Create an internal integration

1. Create a Notion integration in the workspace you want to use
2. Copy the integration token from the integration settings
3. Open the page where Aristotle should create child pages
4. Share that page with the integration using `Add connections`

Then set:

```env
NOTION_API_TOKEN=your_integration_token
NOTION_PARENT_PAGE_ID=your_parent_page_id
```

### Find the page ID

Notion’s docs describe finding the page ID from the page URL. The parent page is the page Aristotle will create new pages under.

## 6. Microsoft Graph

Aristotle currently uses:

- `MICROSOFT_GRAPH_ACCESS_TOKEN`
- optionally:
  - `MICROSOFT_CALENDAR_ID`
  - `MICROSOFT_TODO_LIST_ID`
  - `MICROSOFT_TIME_ZONE`

Official docs:

- Graph Explorer features: https://learn.microsoft.com/en-us/graph/graph-explorer/graph-explorer-features
- Auth concepts: https://learn.microsoft.com/en-us/graph/auth/auth-concepts
- User delegated auth flow: https://learn.microsoft.com/en-us/graph/auth-v2-user

### Easiest current setup

For local testing, the simplest path is:

1. Open Graph Explorer
2. Sign in
3. Consent to the calendar and/or To Do permissions you need
4. Copy the access token from the `Access token` tab

The Graph Explorer docs explicitly note that the access token tab shows your token and you can copy it.

Then set:

```env
MICROSOFT_GRAPH_ACCESS_TOKEN=your_access_token
MICROSOFT_CALENDAR_ID=
MICROSOFT_TODO_LIST_ID=
MICROSOFT_TIME_ZONE=America/Chicago
```

### Important note

This is the weakest credential story in the current repo because the token is short-lived. For a more durable setup, you would register your own app and implement the full Microsoft identity OAuth flow. Aristotle does not automate that flow yet.

### Find calendar and To Do list IDs

Use:

```bash
npm run microsoft:profile
npm run microsoft:calendar-preview
npm run microsoft:todo-lists
```

## 7. Safer workflow

Before creating anything in another app, use dry runs:

```bash
npm run publish -- --to trello --id <task_id> --dry-run
npm run publish -- --to google-calendar --id <task_id> --start 2026-03-24T20:00:00-05:00 --hours 2 --dry-run
```

That lets you inspect the payload Aristotle will send before it creates cards, tasks, pages, or events.
