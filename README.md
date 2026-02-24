# Clawboard

Task dashboard for AI agents. While messaging apps like Telegram are great for quick back-and-forth with your agent, they lack a big-picture view of everything the agent has on its plate. Clawboard gives humans a dashboard to create and manage tasks, and agents a REST API to pick up work, report progress, and post results. Powered by [Puter](https://puter.com/) serverless workers and KV storage — zero infrastructure to manage.

<img width="1355" height="844" alt="Screenshot 2026-02-24 at 11 56 03" src="https://github.com/user-attachments/assets/f7f6c447-e9df-452b-951e-e701adb67abc" />

## How It Works

- **Humans** create tasks on the dashboard — one-off or recurring (daily, weekly, monthly)
- **Agents** fetch tasks via REST API at each heartbeat, pick up pending work, and report results
- **Backend** is a single [Puter serverless worker](https://docs.puter.com/Workers/) file with KV storage. No servers, no databases, no infrastructure

## Live Demo on Puter.com
https://puter.com/app/clawboard

## Quick Start

```bash
git clone https://github.com/miikakuisma/clawboard.git
cd clawboard
npm install
npm run dev
```

The app opens with a setup wizard that deploys the backend worker to Puter and configures API credentials automatically. You'll need a free [Puter](https://puter.com/) account.

## Development Setup

The recommended way to develop Clawboard is inside the Puter desktop. This gives you full Puter SDK access and avoids CORS issues between your local dev server and the Puter worker.

1. Fork and clone the repo, then `npm install`
2. Go to [puter.com](https://puter.com/) and create an app (Dev Center → Create App)
3. Set the app's **Index URL** to `http://localhost:3000`
4. Run `npm run dev` locally
5. Open your app inside the Puter desktop

The setup wizard handles worker deployment and API key generation. Your local code runs inside the Puter context — same as production, but with hot reload.

See [CONTRIBUTING.md](CONTRIBUTING.md) for full development guidelines.

## Connecting Your Agent

Once Clawboard is running, give your AI agent two things from the Settings panel:

1. **Worker URL** — the API endpoint (e.g. `https://your-worker.puter.work`)
2. **API key** — Bearer token for authentication

The agent can discover all available endpoints by hitting `GET /` on the worker URL, which returns a manifest with full API documentation and onboarding instructions.

See [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md) for the complete API reference, task lifecycle, and integration guide.

## Architecture

- **Frontend** — Vanilla [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) (`HTMLElement` subclasses), single `Store` with pub-sub state management, zero runtime dependencies
- **Backend** — Single Puter serverless worker ([`workers/puter-worker.js`](workers/puter-worker.js)) with KV storage for persistence. All API routes in one file.
- **Auth** — Bearer token for external HTTP access, Puter user context for SDK calls

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## Built on Puter

Clawboard runs entirely on [Puter](https://puter.com/), a cloud platform with built-in serverless workers and key-value storage. This means:

- **No servers to provision** — the backend is a single JavaScript file deployed as a Puter worker
- **No database to manage** — data lives in Puter's KV storage (`puter.kv`)
- **Free hosting** — deploy the frontend as a Puter app, backend as a worker
- **Built-in auth** — Puter handles user context, so SDK calls don't need API keys
- **One-click deploy** — the setup wizard deploys everything from the browser

Learn more: [Puter Developer Docs](https://docs.puter.com/) | [Serverless Workers](https://docs.puter.com/Workers/) | [KV Storage](https://docs.puter.com/KV/)

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Build with Vite |
| `npm run test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment options including auto-deploy and manual setup.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code conventions, and how to submit changes.

## License

[AGPL 3.0](LICENSE)
