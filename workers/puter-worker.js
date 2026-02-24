// Clawboard API - Puter Worker
// Deploy: save this file in Puter, right-click > Publish as Worker

// ─── Helpers ───

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function err(message, status = 400) {
  return json({ error: message }, status)
}

async function listCollection(prefix) {
  const entries = await me.puter.kv.list(`${prefix}*`, true)
  if (!entries || entries.length === 0) return []
  const items = []
  for (const entry of entries) {
    try {
      const val = entry.value
      items.push(typeof val === 'string' ? JSON.parse(val) : val)
    } catch { /* skip invalid */ }
  }
  return items
}

async function putItem(prefix, id, data) {
  await me.puter.kv.set(`${prefix}${id}`, JSON.stringify(data))
  return data
}

async function getItem(prefix, id) {
  const raw = await me.puter.kv.get(`${prefix}${id}`)
  if (!raw) return null
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

async function deleteItem(prefix, id) {
  await me.puter.kv.del(`${prefix}${id}`)
}

async function checkAuth(request, user) {
  // Called via puter.workers.exec() - user context is present
  if (user) return true
  // External HTTP - check Bearer token
  const auth = request.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  const storedKey = await me.puter.kv.get('sb_api_key')
  return token === storedKey
}

// ─── Cooldown intervals for recurring tasks ───

const COOLDOWN_MS = {
  'every-hour':      1 * 60 * 60 * 1000,
  'few-times-daily': 6 * 60 * 60 * 1000,
  'twice-daily':    12 * 60 * 60 * 1000,
  'daily':          24 * 60 * 60 * 1000,
  'weekly':      7 * 24 * 60 * 60 * 1000,
  'monthly':    30 * 24 * 60 * 60 * 1000,
}

// ─── Discovery manifest (public, no auth) ───

const MANIFEST = {
  name: 'Clawboard API',
  version: '26.2.23',
  description: `API for agents to manage the Clawboard task dashboard.

    DASHBOARD SECTIONS:
    - Tasks: Track pending, current, and completed work. Supports recurring tasks.
    - Heartbeat: Monitor agent status and configure periodic checks.
    - Settings: Configure worker URL, API key, and access management.

    TASK LIFECYCLE:
    1. Create task → POST /api/tasks (status starts as "pending")
    2. Start work → PUT /api/tasks/:id/status { status: "in_progress" }
    3. Complete  → PUT /api/tasks/:id/status { status: "completed", notes: "results", links: [...] }
    4. For recurring tasks, reset to "pending" after completion to start next cycle.
       The system sets nextRunAfter on completion — check it before starting the next cycle.

    TASK FIELDS: id, title, description, status, repetition, createdAt, startedAt, completedAt, nextRunAfter, links, notes

    See AGENT_WORKFLOW.md for complete documentation.
  `,
  auth: {
    type: 'bearer',
    header: 'Authorization: Bearer <api_key>',
    note: 'GET / does not require auth. All other endpoints require a valid Bearer token.',
  },
  endpoints: [
    { method: 'GET', path: '/api/tasks', description: 'List all tasks' },
    { method: 'POST', path: '/api/tasks', description: 'Create task', body: { title: 'string', description: 'string', repetition: 'null|every-hour|few-times-daily|twice-daily|daily|weekly|monthly' } },
    { method: 'PUT', path: '/api/tasks/:id/status', description: 'Update task status. Completing a recurring task sets nextRunAfter based on repetition interval. Setting to "pending" clears timestamps but preserves nextRunAfter.', body: { status: 'pending|in_progress|completed', notes: 'string (optional)', links: ['string'] } },
    { method: 'DELETE', path: '/api/tasks/:id', description: 'Delete task' },
    { method: 'GET', path: '/api/heartbeat', description: 'Get heartbeat / agent status data' },
    { method: 'PUT', path: '/api/heartbeat', description: 'Update heartbeat data. Include interval (minutes) for check-in frequency.', body: { novaStatus: 'active|idle|busy', activeThreads: 'number', activeTasks: ['object'], recentlyCompleted: ['object'], interval: 'number (minutes, default 60)' } },
    { method: 'GET', path: '/api/heartbeat/content', description: 'Get heartbeat configuration content' },
    { method: 'POST', path: '/api/heartbeat/content', description: 'Update heartbeat configuration', body: { content: 'string' } },
    { method: 'GET', path: '/api/assistant/profile', description: 'Get assistant profile' },
    { method: 'POST', path: '/api/assistant/profile', description: 'Update assistant profile', body: { name: 'string', initials: 'string', avatar: 'string', description: 'string', color: 'string' } },
    { method: 'GET', path: '/api/access', description: 'List access entries' },
    { method: 'POST', path: '/api/access', description: 'Create access entry', body: { name: 'string', type: 'string', description: 'string', status: 'string', details: 'object|string', icon: 'string' } },
    { method: 'PUT', path: '/api/access/:id', description: 'Update access entry', body: { name: 'string', type: 'string', description: 'string', status: 'string', details: 'object|string', icon: 'string' } },
    { method: 'DELETE', path: '/api/access/:id', description: 'Delete access entry' },
    { method: 'POST', path: '/api/reset', description: 'Clear all data from KV' },
  ],
  onboarding: {
    description: `
      Welcome! You are an AI agent reading this manifest for the first time.
      Clawboard is your shared dashboard with your human — a place where they can
      see what you are doing, what you have done, and how you are configured.

      When a user gives you a Clawboard worker URL and API key, follow these steps
      to initialize yourself. Check each condition before acting — if the data is
      already present, skip that step (do not overwrite existing user data).

      These steps are designed to be safe to run at any time:
      each one checks before writing and is fully idempotent.
    `,
    steps: [
      {
        step: 1,
        title: 'Introduce yourself',
        description: `
          Check your assistant profile. If it is empty or missing, post your identity.
          This tells the human who is running on their dashboard.
        `,
        check: 'GET /api/assistant/profile — if response has no name or is empty, proceed',
        action: 'POST /api/assistant/profile',
        body: {
          name: 'Your assistant name (e.g. "Nova")',
          initials: 'Short initials shown in avatar (e.g. "N")',
          avatar: 'Emoji or short symbol that represents you (e.g. "✨")',
          description: 'One sentence: what you are and what you do for this user',
          color: 'Hex color for your avatar background (e.g. "#6366f1")',
        },
        example: {
          name: 'Nova',
          initials: 'N',
          avatar: '✨',
          description: 'AI assistant — always on, managing tasks, watching over things.',
          color: '#6366f1',
        },
      },
      {
        step: 2,
        title: 'Push your heartbeat configuration',
        description: `
          The heartbeat config is a freeform text block that tells you (the agent)
          what to check during periodic heartbeats — emails, calendar, tasks, etc.
          If it is empty, post your default configuration so the human can see
          and edit it from the dashboard.
        `,
        check: 'GET /api/heartbeat/content — if content is empty or null, proceed',
        action: 'POST /api/heartbeat/content',
        body: {
          content: 'Freeform markdown/text describing your heartbeat checklist',
        },
        example: {
          content: '# Heartbeat Checklist\n\n- Check email for urgent messages\n- Check calendar for upcoming events (< 2h)\n- Update task statuses\n- Post heartbeat status to dashboard',
        },
      },
      {
        step: 3,
        title: 'Post your current status',
        description: `
          Let the human know you are alive. Post an initial heartbeat status
          to the dashboard so the "Agent Status" panel shows something meaningful
          right away instead of being blank.

          Include your heartbeat interval (in minutes) so the dashboard knows
          how often to expect check-ins. The recommended default is 60 minutes.
          Check your own scheduling configuration and report the actual interval
          you will be using. Always include the interval field in every heartbeat update.
        `,
        check: 'Always run this step — it is safe to overwrite',
        action: 'PUT /api/heartbeat',
        body: {
          novaStatus: '"active" | "idle" | "busy"',
          activeThreads: 'number of currently running background tasks',
          activeTasks: 'array of in-progress task objects from /api/tasks',
          recentlyCompleted: 'array of recently completed task objects',
          interval: 'number — your heartbeat interval in minutes (default: 60)',
        },
        example: {
          novaStatus: 'active',
          activeThreads: 0,
          activeTasks: [],
          recentlyCompleted: [],
          interval: 60,
        },
      },
      {
        step: 4,
        title: 'List your capabilities and access',
        description: `
          Access entries are a self-reported inventory of what you can do and
          what you have access to. This gives the human a live view of your
          permissions, integrations, and tools — all in one place on the dashboard.

          If the access list is empty, discover your own capabilities and post them.
          Each entry should be honest about status: "active" means it is working
          right now, "limited" means partial access, "inactive" means configured
          but not currently usable.

          Common capability types to consider:
          - messaging: Telegram, WhatsApp, Discord, Signal, email
          - files: local filesystem access, cloud storage, drop-box folders
          - code: GitHub repos, git access, deploy pipelines
          - web: browser control, web search, web fetch
          - devices: cameras, microphones, smart home, paired nodes
          - memory: long-term memory files, knowledge bases
          - scheduling: cron jobs, reminders, calendar access
          - compute: shell execution, background workers, sub-agents
          - media: TTS, image generation, audio/video tools
          - integrations: any APIs or external services you can call

          Post one entry per capability or integration. Be specific — a human
          reading this should immediately understand what you can and cannot do.
        `,
        check: 'GET /api/access — if list is empty, proceed',
        action: 'POST /api/access (call once per capability)',
        body: {
          name: 'Short capability name (e.g. "Telegram")',
          type: 'Category: messaging | files | code | web | devices | memory | scheduling | compute | media | integrations',
          description: 'What you can do with this (be specific)',
          status: '"active" | "limited" | "inactive"',
          details: 'Object or string with relevant metadata (e.g. username, scope, path)',
          icon: 'Emoji representing this capability (e.g. "💬")',
        },
        examples: [
          { name: 'Telegram', type: 'messaging', description: 'Send and receive messages with the user via Telegram bot', status: 'active', details: { bot: '@miika_nova_bot' }, icon: '💬' },
          { name: 'GitHub', type: 'code', description: 'Read and write repos, create branches and PRs', status: 'active', details: { user: 'miikakuisma', scope: 'repo' }, icon: '🐙' },
          { name: 'Shell / Exec', type: 'compute', description: 'Run shell commands on the host machine', status: 'active', details: { host: 'Mac Mini M4', shell: 'zsh' }, icon: '⚙️' },
          { name: 'Web Search', type: 'web', description: 'Search the web via Brave Search API', status: 'active', details: {}, icon: '🔍' },
          { name: 'Long-Term Memory', type: 'memory', description: 'Read and write MEMORY.md and daily memory files', status: 'active', details: { path: '/Users/openclaw/Documents/MEMORY.md' }, icon: '🧠' },
        ],
      },
    ],
    notes: `
      After completing these steps, the dashboard should show:
      - Your name and avatar in the assistant profile panel
      - Your heartbeat config in the heartbeat settings
      - A live "active" status in the agent status panel
      - A populated access/capabilities list in the settings panel

      You do not need to create any tasks during onboarding — the human will
      add tasks, or you will create them naturally as work comes in.

      RECURRING TASKS:
      Tasks with a repetition value have built-in cooldowns. When you complete
      a recurring task, the system calculates a "nextRunAfter" timestamp:
      - every-hour: 1 hour after completion
      - few-times-daily: 6 hours after completion
      - twice-daily: 12 hours after completion
      - daily: 24 hours after completion
      - weekly: 7 days after completion
      - monthly: 30 days after completion

      After completing a recurring task, reset it to "pending". The nextRunAfter
      field will be preserved. Before starting a recurring task, check its
      nextRunAfter field — if the current time is before nextRunAfter, the task
      is still in its cooldown period and should NOT be run yet.
      "Daily" means once per day. "Weekly" means once per week. Do not run a
      daily task multiple times in 24 hours. The dashboard will show a warning
      if a task runs before its cooldown expires.

      Always fetch tasks fresh from /api/tasks.
      Deleted tasks will not appear — do not infer or recreate tasks from memory or prior context.

      HEARTBEAT INTERVAL:
      Always include your check-in interval (in minutes) in PUT /api/heartbeat.
      The recommended default is 60 minutes. If the human changes the interval
      via the dashboard, a task will be created asking you to update it.
      Check for and action these interval-change tasks during heartbeats.

      The onboarding is complete when all four steps have been checked and acted on.
      You can safely re-run this check at any time — existing data will not be overwritten.
    `,
  },
}

// ─── CORS preflight ───

router.options("/*path", () => {
  return new Response(null, { status: 204, headers: CORS })
})

// ─── Public: Discovery ───

router.get("/", () => {
  return json(MANIFEST)
})

// ─── Tasks ───

router.get("/api/tasks", async ({ request, user }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const items = await listCollection('sb_tasks:')
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return json(items)
})

router.post("/api/tasks", async ({ request, user }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const body = await request.json()
  const item = {
    id: generateId('task'),
    title: body.title || body.description || 'Untitled task',
    description: body.description || body.title || 'No description provided',
    status: 'pending', // pending, in_progress, completed
    repetition: body.repetition || null, // null, every-hour, few-times-daily, twice-daily, daily, weekly, monthly
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    nextRunAfter: null,
    links: [],
    notes: null
  }
  await putItem('sb_tasks:', item.id, item)
  return json(item, 201)
})

router.put("/api/tasks/:id/status", async ({ request, user, params }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const body = await request.json()
  const item = await getItem('sb_tasks:', params.id)
  if (!item) return err('Task not found', 404)

  const validStatuses = ['pending', 'in_progress', 'completed']
  if (!validStatuses.includes(body.status)) {
    return err(`Status must be one of: ${validStatuses.join(', ')}`)
  }

  // Update status and timestamps
  item.status = body.status

  if (body.status === 'pending') {
    item.startedAt = null
    item.completedAt = null
    // nextRunAfter is intentionally preserved through resets
  }

  if (body.status === 'in_progress' && !item.startedAt) {
    item.startedAt = new Date().toISOString()
  }

  if (body.status === 'completed') {
    item.completedAt = new Date().toISOString()
    // Calculate next run cooldown for recurring tasks
    if (item.repetition && COOLDOWN_MS[item.repetition]) {
      item.nextRunAfter = new Date(Date.now() + COOLDOWN_MS[item.repetition]).toISOString()
    }
  }

  // Add notes/results if provided
  if (body.notes) {
    item.notes = body.notes
  }

  // Add links if provided
  if (body.links && Array.isArray(body.links)) {
    item.links = [...(item.links || []), ...body.links]
  }

  await putItem('sb_tasks:', params.id, item)
  return json(item)
})

router.put("/api/tasks/:id", async ({ request, user, params }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const body = await request.json()
  const item = await getItem('sb_tasks:', params.id)
  if (!item) return err('Task not found', 404)

  if (body.description !== undefined) {
    item.description = body.description
    item.title = body.description
  }

  if (body.repetition !== undefined) {
    item.repetition = body.repetition || null
  }

  await putItem('sb_tasks:', params.id, item)
  return json(item)
})

router.delete("/api/tasks/:id", async ({ request, user, params }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  await deleteItem('sb_tasks:', params.id)
  return json({ ok: true })
})

// ─── Heartbeat ───

router.get("/api/heartbeat", async ({ request, user }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const raw = await me.puter.kv.get('sb_heartbeat')
  if (!raw) {
    return json({ novaStatus: 'idle', activeThreads: 0, activeTasks: [], recentlyCompleted: [], interval: 60 })
  }
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw
  return json(data)
})

router.put("/api/heartbeat", async ({ request, user }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const body = await request.json()
  await me.puter.kv.set('sb_heartbeat', JSON.stringify(body))
  return json(body)
})

router.get("/api/heartbeat/content", async ({ request, user }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const raw = await me.puter.kv.get('sb_heartbeat_content')
  const content = raw || null

  return json({ content })
})

router.post("/api/heartbeat/content", async ({ request, user }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const body = await request.json()
  if (!body.content && body.content !== '') return err('Content is required')

  await me.puter.kv.set('sb_heartbeat_content', body.content)
  return json({ success: true, content: body.content })
})

// ─── Assistant Profile ───

router.get("/api/assistant/profile", async ({ request, user }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)

  const raw = await me.puter.kv.get('sb_assistant_profile')
  if (!raw) {
    // Return default profile
    return json({
      name: 'Nova',
      initials: 'N',
      avatar: null,
      description: 'AI Assistant',
      color: '#3b82f6'
    })
  }

  const profile = typeof raw === 'string' ? JSON.parse(raw) : raw
  return json(profile)
})

router.post("/api/assistant/profile", async ({ request, user }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const body = await request.json()

  const profile = {
    name: body.name || 'Assistant',
    initials: body.initials || 'A',
    avatar: body.avatar || null,
    description: body.description || 'AI Assistant',
    color: body.color || '#3b82f6'
  }

  await me.puter.kv.set('sb_assistant_profile', JSON.stringify(profile))
  return json({ success: true, profile })
})

// ─── Access Management ───

router.get("/api/access", async ({ request, user }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const items = await listCollection('sb_access:')
  items.sort((a, b) => (a.order || 0) - (b.order || 0))
  return json(items)
})

router.post("/api/access", async ({ request, user }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const body = await request.json()

  if (!body.name) return err('Name is required')

  const access = {
    id: generateId('access'),
    name: body.name,
    type: body.type || 'General',
    description: body.description || '',
    status: body.status || 'active',
    details: body.details || {},
    icon: body.icon || 'circle',
    order: body.order || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await putItem('sb_access:', access.id, access)
  return json(access, 201)
})

router.put("/api/access/:id", async ({ request, user, params }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const body = await request.json()

  const existing = await getItem('sb_access:', params.id)
  if (!existing) return err('Access entry not found', 404)

  const updated = {
    ...existing,
    ...body,
    id: existing.id, // Preserve ID
    createdAt: existing.createdAt, // Preserve creation date
    updatedAt: new Date().toISOString()
  }

  await putItem('sb_access:', params.id, updated)
  return json(updated)
})

router.delete("/api/access/:id", async ({ request, user, params }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)
  const existing = await getItem('sb_access:', params.id)
  if (!existing) return err('Access entry not found', 404)

  await deleteItem('sb_access:', params.id)
  return json({ success: true, id: params.id })
})

// ─── Reset all data ───

router.post("/api/reset", async ({ request, user }) => {
  if (!(await checkAuth(request, user))) return err('Unauthorized', 401)

  const prefixes = ['sb_tasks:', 'sb_access:']
  for (const prefix of prefixes) {
    const entries = await me.puter.kv.list(`${prefix}*`, true)
    if (entries) {
      for (const entry of entries) {
        await me.puter.kv.del(entry.key)
      }
    }
  }
  await me.puter.kv.del('sb_heartbeat')
  await me.puter.kv.del('sb_heartbeat_content')
  await me.puter.kv.del('sb_assistant_profile')
  return json({ ok: true, message: 'All data cleared' })
})

// ─── Set API key (bootstrapping) ───

router.post("/api/set-key", async ({ request }) => {
  const body = await request.json()
  if (!body.api_key) return err('api_key is required', 400)

  const existingKey = await me.puter.kv.get('sb_api_key')
  if (existingKey) {
    // Key already set - require current key to change it
    const auth = request.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== existingKey) {
      return err('API key already set. Provide current key as Bearer token to change it.', 403)
    }
  }

  await me.puter.kv.set('sb_api_key', body.api_key)
  return json({ ok: true, message: 'API key set' })
})

// ─── 404 catch-all ───

router.get("/*path", () => err('Not found', 404))
router.post("/*path", () => err('Not found', 404))
router.put("/*path", () => err('Not found', 404))
router.delete("/*path", () => err('Not found', 404))
