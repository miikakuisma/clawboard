# Clawboard Deployment Guide

> **Developing locally?** See [CONTRIBUTING.md](CONTRIBUTING.md) for the recommended development setup using the Puter desktop.

Clawboard deploys entirely on [Puter](https://puter.com/) — the frontend as a Puter app, the backend as a serverless worker with KV storage. No external servers or databases needed.

## Auto-Deploy (Recommended)

The easiest way to deploy is through the built-in setup wizard:

1. Run `npm run dev` and open the app
2. The setup wizard appears automatically on first launch
3. Log in to Puter when prompted
4. The wizard deploys the worker, generates an API key, and configures everything

The worker URL and API key are saved to `localStorage`. On subsequent launches, the app checks for worker code updates and offers to redeploy if needed.

## Manual Deploy

If you prefer to deploy manually:

1. **Copy worker code**: Open `workers/puter-worker.js` and copy all contents

2. **Create worker in Puter**:
   - Go to Puter.com and log in
   - Create a new file (e.g., `clawboard-api.js`)
   - Paste the worker code
   - Right-click the file → "Publish as Worker"

3. **Get worker URL**: Puter provides a URL for the worker

4. **Configure the dashboard**: Enter the worker URL in Settings → Dashboard Configuration

5. **Set up API key**:
   - In Puter console: `puter.kv.set('sb_api_key', 'your-secret-key')`
   - Or use the "Re-Generate" button in Settings

## Using the API

### From your agent:
```javascript
const API_BASE = 'https://your-worker.puter.site';
const headers = { 'Authorization': 'Bearer your-api-key' };

// Create a task
fetch(`${API_BASE}/api/tasks`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Analyze user feedback',
    description: 'Review and categorize customer feedback from this week'
  })
});

// Update task status
fetch(`${API_BASE}/api/tasks/task-123/status`, {
  method: 'PUT',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'in_progress',
    notes: 'Started analysis, found initial patterns...'
  })
});
```

### Testing the deployment:
```bash
# Get API manifest (no auth required)
curl https://your-worker.puter.site/

# List tasks
curl -H "Authorization: Bearer your-key" \
     https://your-worker.puter.site/api/tasks
```

## Resetting & Redeploying

To reset all data and start fresh:

1. Go to **Settings → Danger Zone** and click "Reset Clawboard"
2. This clears all server data (tasks, heartbeat, access, profile) and local settings
3. The setup wizard will reappear to redeploy

To update the worker code without losing data:

1. Make your changes to `workers/puter-worker.js`
2. Bump the version: `npm version patch`
3. Rebuild and deploy — the app detects code changes on launch (via content hash) and offers an automatic update through the setup wizard

The version bump ensures `package.json` stays in sync with deployed builds. The auto-update detection is hash-based, so any change to the worker code will trigger it.

## Access Management

Manage agent capabilities via the API:

```bash
# List access entries
curl -H "Authorization: Bearer your-key" \
     https://your-worker.puter.site/api/access

# Create access entry
curl -X POST -H "Authorization: Bearer your-key" \
     -H "Content-Type: application/json" \
     -d '{"name":"GitHub","type":"API Integration","status":"active","description":"Repo access"}' \
     https://your-worker.puter.site/api/access
```

See [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md) for the full API reference.
