# Contributing to Clawboard

## Development Setup

The recommended way to develop Clawboard is inside the [Puter](https://puter.com/) desktop. This runs your local dev server inside Puter's app context, which gives you full SDK access and avoids CORS issues between localhost and the Puter worker.

### 1. Fork and clone

```bash
git clone https://github.com/YOUR_USERNAME/clawboard.git
cd clawboard
npm install
```

### 2. Create a Puter app

1. Go to [puter.com](https://puter.com/) and sign in (free account)
2. Open **Developer Center** → **Create App**
3. Set the **Index URL** to `http://localhost:3000`
4. Save the app

### 3. Start developing

```bash
npm run dev
```

Open your app inside the Puter desktop. The setup wizard will deploy the backend worker and generate an API key automatically.

Your local code now runs inside the Puter context — hot reload works normally, and the worker API is accessible without CORS restrictions.

### Why develop inside Puter?

- **No CORS issues** — your app and the worker share the Puter context
- **Full Puter SDK** — `puter.kv`, `puter.fs`, `puter.workers` all work natively
- **Matches production** — same environment as deployed users experience
- **Auto-deploy** — the setup wizard handles worker deployment from inside the app

## Project Structure

```
clawboard/
├── index.html                     # App entry point
├── workers/
│   └── puter-worker.js            # Backend — all API routes in one file
├── src/
│   ├── main.js                    # Registers all Web Components
│   ├── Store.js                   # Centralized state (EventEmitter pub-sub)
│   ├── layout/                    # AppShell, Sidebar
│   ├── views/                     # TasksView, HeartbeatView, SettingsPanel, NotesView
│   ├── components/                # StatusBadge, DropZone, SearchBar, ProgressBar, etc.
│   ├── services/
│   │   ├── PuterAPI.js            # Fetch-based API client
│   │   ├── PollingService.js      # Polls tasks/heartbeat every 30s
│   │   └── WorkerDeployService.js # Auto-deploy logic
│   └── utils/                     # html tagged template, icons, formatters, EventEmitter
├── AGENT_WORKFLOW.md              # Full API reference for AI agents
├── DEPLOYMENT.md                  # Deployment guide
└── CLAUDE.md                      # Detailed architecture docs
```

## Code Conventions

### Vanilla Web Components only

Every UI element is an `HTMLElement` subclass registered with `customElements.define()`. No frameworks, no build-time UI transforms. Components are registered in `src/main.js`.

### Zero runtime dependencies

The project has zero runtime dependencies — only dev dependencies (Vite, Vitest, ESLint). Keep it that way. If you need a utility, write it in `src/utils/`.

### HTML templates

Use the `html` tagged template literal from `src/utils/html.js` for component markup:

```js
import { html } from '@/utils/html.js'

this.innerHTML = html`<div class="my-component">...</div>`
```

### State management

Use the single `Store` instance (`src/Store.js`) with EventEmitter pub-sub. Components subscribe to store events and re-render. The store is also available as `window.store`.

### CSS theming

Use CSS custom properties for colors and spacing. Light/dark mode toggles via `data-theme` attribute on `<html>`.

### Path alias

`@` maps to `./src` (configured in `vite.config.js` and `jsconfig.json`).

## Testing

Tests live alongside source files as `*.test.js`:

```bash
npm run test          # Run once
npm run test:watch    # Watch mode
```

## Linting

```bash
npm run lint
```

## Submitting Changes

1. Fork the repo and create a branch (`git checkout -b my-feature`)
2. Make your changes
3. Run `npm run lint && npm run test`
4. Commit with a clear message
5. Open a pull request

Keep PRs focused — one feature or fix per PR.

## Worker Changes

The backend is a single file: `workers/puter-worker.js`. When this file is modified, the app detects changes via content hash and prompts users to update on next launch. No version bump is needed for worker-only changes.
