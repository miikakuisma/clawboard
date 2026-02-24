# Clawboard Agent Workflow

## Overview

Clawboard is a task dashboard for AI agents. Agents use the API to create tasks, update progress, and report results. Humans review work via the dashboard UI.

## Task Schema

```json
{
  "id": "task-1708346400000-abc123",
  "title": "Analyze user feedback",
  "description": "Review and categorize customer feedback from this week",
  "status": "pending",
  "repetition": null,
  "createdAt": "2024-02-19T12:00:00Z",
  "startedAt": null,
  "completedAt": null,
  "nextRunAfter": null,
  "links": [],
  "notes": null
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated, prefixed with `task-` |
| `title` | string | Short task title |
| `description` | string | Detailed description of work to do |
| `status` | string | `pending`, `in_progress`, or `completed` |
| `repetition` | string\|null | `null` for one-off, or: `every-hour`, `few-times-daily`, `twice-daily`, `daily`, `weekly`, `monthly` |
| `createdAt` | ISO date | When the task was created |
| `startedAt` | ISO date\|null | When work began |
| `completedAt` | ISO date\|null | When work finished |
| `nextRunAfter` | ISO date\|null | For recurring tasks: earliest time to start next cycle. Set automatically on completion. |
| `links` | string[] | Related URLs or references |
| `notes` | string\|null | Results, findings, or progress notes |

## Task Lifecycle

```
pending  →  in_progress  →  completed
                              ↓
              (recurring tasks reset to pending)
```

### 1. Create Task
```bash
POST /api/tasks
{
  "title": "Task title",
  "description": "Detailed description of work to be done"
}
```
Task is created with `status: "pending"`.

For recurring tasks, add a `repetition` field:
```bash
POST /api/tasks
{
  "title": "Check system health",
  "description": "Run diagnostics and report status",
  "repetition": "daily"
}
```

### 2. Start Work
```bash
PUT /api/tasks/:id/status
{ "status": "in_progress" }
```
Sets `startedAt` timestamp. Task moves to "Current Work" in the dashboard.

### 3. Complete Task
```bash
PUT /api/tasks/:id/status
{
  "status": "completed",
  "notes": "Completed analysis. Key findings: ...",
  "links": ["https://example.com/report"]
}
```
Sets `completedAt` timestamp. Notes and links are appended to the task record.

### 4. Reset Recurring Task
For recurring tasks, reset to pending after completion:
```bash
PUT /api/tasks/:id/status
{ "status": "pending" }
```
This clears `startedAt` and `completedAt` but preserves `nextRunAfter`, ready for the next cycle.

### 5. Respect Recurring Task Cooldowns

When a recurring task is completed, the system automatically calculates a `nextRunAfter` timestamp:

| Repetition | Cooldown |
|------------|----------|
| `every-hour` | 1 hour |
| `few-times-daily` | 6 hours |
| `twice-daily` | 12 hours |
| `daily` | 24 hours |
| `weekly` | 7 days |
| `monthly` | 30 days |

Before starting a recurring task, check its `nextRunAfter` field:
```bash
GET /api/tasks
# For each recurring pending task, check:
# if task.nextRunAfter && new Date(task.nextRunAfter) > new Date() → skip, still in cooldown
# if task.nextRunAfter is null or in the past → ready to run
```

**"Daily" means once per day.** Do not run a daily task multiple times in 24 hours.
The dashboard shows a warning if a task runs before its cooldown expires.

## API Reference

All endpoints require `Authorization: Bearer <api_key>` header except `GET /`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Discovery manifest (public, no auth) |
| `GET` | `/api/tasks` | List all tasks |
| `POST` | `/api/tasks` | Create task |
| `PUT` | `/api/tasks/:id/status` | Update task status, add notes/links |
| `DELETE` | `/api/tasks/:id` | Delete task |
| `GET` | `/api/heartbeat` | Get agent status data |
| `PUT` | `/api/heartbeat` | Update agent status |
| `GET` | `/api/heartbeat/content` | Get HEARTBEAT.md content |
| `POST` | `/api/heartbeat/content` | Update HEARTBEAT.md content |
| `GET` | `/api/assistant/profile` | Get agent profile |
| `POST` | `/api/assistant/profile` | Update agent profile |
| `GET` | `/api/access` | List access entries |
| `POST` | `/api/access` | Create access entry |
| `PUT` | `/api/access/:id` | Update access entry |
| `DELETE` | `/api/access/:id` | Delete access entry |
| `POST` | `/api/reset` | Reset all data (clear KV) |
| `POST` | `/api/set-key` | Set or update API key |

## Heartbeat-Driven Workflow

During heartbeat checks, the agent should:

1. **Check for pending tasks**: `GET /api/tasks` and filter for `status: "pending"`
2. **Pick up work**: Update the next pending task to `in_progress`
3. **Work one task at a time**: Complete the current task before starting the next
4. **Report results**: Set status to `completed` with notes and links
5. **Reset recurring tasks**: After completing a recurring task, reset it to `pending`

### Example Heartbeat Flow

```bash
# 1. Check for pending tasks
GET /api/tasks
# Response: [...tasks sorted by createdAt]

# 2. Start work on a pending task
PUT /api/tasks/task-123/status
{ "status": "in_progress" }

# 3. Do the work...

# 4. Complete with results
PUT /api/tasks/task-123/status
{
  "status": "completed",
  "notes": "Completed analysis. Found 3 issues...",
  "links": ["https://example.com/results"]
}

# 5. If recurring, reset for next cycle
PUT /api/tasks/task-123/status
{ "status": "pending" }
```

## Heartbeat Interval

Include your check-in interval (in minutes) in every heartbeat update:
```bash
PUT /api/heartbeat
{
  "novaStatus": "active",
  "activeThreads": 1,
  "activeTasks": [],
  "recentlyCompleted": [],
  "interval": 60
}
```

The `interval` field is in minutes. Recommended default: **60 minutes**.

During onboarding, check your own scheduling configuration and report the actual interval you will be using. If the human changes the interval via the dashboard, a one-off task will be created asking you to update it. Check for and action these tasks during heartbeats.

## Access Management

Track what services and capabilities the agent has access to. Each access entry has:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Service name (e.g. "GitHub", "Calendar") |
| `type` | string | Category (e.g. "API Integration", "File System") |
| `description` | string | What this access is for |
| `status` | string | Connection status (e.g. "active", "inactive") |
| `details` | object\|string | Additional info (permissions, scopes, etc.) |
| `icon` | string | Icon key from the icon library |

```bash
# List access entries
GET /api/access

# Create access entry
POST /api/access
{
  "name": "GitHub",
  "type": "API Integration",
  "description": "Repository access for code review",
  "status": "active",
  "icon": "code",
  "details": { "scopes": ["repo", "issues"], "org": "my-org" }
}

# Update access entry
PUT /api/access/:id
{ "status": "inactive" }

# Delete access entry
DELETE /api/access/:id
```

## Dashboard Sections

- **Tasks**: All task management. Recurring tasks are pinned at the top. One-off tasks are organized by status: Current Work, Pending, Completed.
- **Heartbeat**: Agent status monitoring and HEARTBEAT.md configuration.
- **Settings**: Worker URL, API key, assistant profile, access & capabilities management, API testing, and danger zone reset.

## Communication Protocol

### When Starting Tasks
1. Create task via `POST /api/tasks`
2. Brief acknowledgment: "Started working on [task]. Track progress in Tasks dashboard."

### During Work
- Update task notes with significant progress
- Only notify human for blockers or questions

### Upon Completion
1. Update task status to `completed` with results in notes
2. Notify human: "Completed [task]. Results in Tasks dashboard."

## Best Practices

### Task Naming
- Use clear, actionable titles
- Include context: "Review Q4 budget spreadsheet"
- Avoid generic names like "Research" or "Fix issue"

### Notes & Results
- Document key findings or decisions
- Include links to created files or resources
- Mention follow-up items or dependencies
- Keep it scannable with bullet points

## HEARTBEAT.md Sync

When updating local `HEARTBEAT.md`, always sync to the dashboard:
```bash
POST /api/heartbeat/content
{ "content": "<full HEARTBEAT.md content>" }
```

## API Credentials

Store credentials in your clawboard directory:
```bash
echo "https://your-worker-url.puter.work" > clawboard/.api-endpoint
echo "your_api_key" > clawboard/.api-key

# Usage:
API_ENDPOINT=$(cat clawboard/.api-endpoint)
API_KEY=$(cat clawboard/.api-key)
```
