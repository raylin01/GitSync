# GitSync

Auto-deploy companion tool for [TaskServer](https://github.com/raylin01/TaskServer). Listens for git webhooks (or polls for changes), automatically pulls updates, installs dependencies, and gracefully restarts scripts.

## Features

- **Multiple Trigger Modes**: Webhook server, polling, or both
- **Git Provider Support**: GitHub, GitLab, and Gitea with signature verification
- **Dependency Management**: npm, bun, yarn, and pip (with venv support)
- **TaskServer Integration**: Gracefully restart scripts via TaskServer's API
- **Configurable**: YAML configuration for all settings

## Quick Start

### 1. Install dependencies

```bash
cd ~/Documents/GitSync
bun install
```

### 2. Configure

```bash
cp config.example.yaml config.yaml
# Edit config.yaml with your repos and settings
```

### 3. Run via TaskServer (Recommended)

Add GitSync as a **forever script** in TaskServer's `config.yaml`:

```yaml
scripts:
  - name: gitsync
    command: cd /path/to/GitSync && bun start
    type: forever
    args: []
    env: {}
```

Then restart TaskServer. Benefits:
- **Auto-restart**: TaskServer restarts GitSync if it crashes
- **Log management**: Logs are captured and viewable in TaskServer dashboard
- **Unified management**: Control GitSync from the same dashboard as your other scripts

### 4. Run Standalone (Alternative)

If you prefer to run GitSync independently:

```bash
bun start
# or with auto-reload during development
bun run dev
```

## Managing TaskServer with GitSync
GitSync can also update and restart its host TaskServer.

**Configuration:**
Add this to your `repos` list in `config.yaml`:
```yaml
- name: "taskserver"
  path: "/path/to/TaskServer"
  branch: "main"
  dependencies:
    type: "npm"
  restartScripts:
    - "taskserver"
```

**Important Requirement:**
For this to work, TaskServer **must** be running under PM2 with the name `taskserver`.
```bash
pm2 start server.js --name taskserver
```
If you run it with `node server.js` or `npm start`, it cannot restart itself via the API.

## Configuration

See `config.example.yaml` for all available options.

### Basic Example

```yaml
triggerMode: "webhook"

webhook:
  port: 4000
  secret: "your-webhook-secret"

repos:
  - name: "my-app"
    path: "/path/to/my-app"
    repoUrl: "git@github.com:username/my-app.git"  # Clones if folder doesn't exist
    branch: "main"
    dependencies:
      type: "npm"
    
    # Optional build command
    build:
      command: "npm run build"
      
    restartScripts:
      - "myAppServer"
    
    # Auto-register scripts in TaskServer on first clone (optional)
    registerScripts:
      - name: "myAppServer"
        command: "cd /path/to/my-app && npm start"
        type: "forever"

taskServer:
  url: "http://localhost:3000"
  apiKey: ""  # Optional
```

### Auto-Clone & Setup

When `repoUrl` is provided, GitSync automatically:
1. **Clones the repo** if the folder doesn't exist or is empty
2. **Installs dependencies** (npm/bun/yarn/pip)
3. **Registers scripts** in TaskServer (if `registerScripts` is configured)
4. **Starts the scripts** automatically

This means you can add a new project to GitSync, push to trigger a webhook, and it will fully set itself up!

### Trigger Modes

| Mode | Description |
|------|-------------|
| `webhook` | HTTP server that receives push events from Git providers |
| `polling` | Periodically checks repos for new commits |
| `both` | Runs both webhook server and polling |

### Dependency Types

| Type | Install Command | Prerequisites |
|------|-----------------|---------------|
| `npm` | `npm install` | `package.json` |
| `bun` | `bun install` | `package.json` |
| `yarn` | `yarn install` | `package.json` |
| `pip` | `pip install -r requirements.txt` | `requirements.txt` |
| `none` | Skipped | - |

For pip, use `venv: "auto"` to auto-create a `.venv` directory.

## Webhook Setup

### GitHub

1. Go to your repo → Settings → Webhooks → Add webhook
2. Payload URL: `https://your-tunnel-url.trycloudflare.com/webhook/github`
3. Content type: `application/json`
4. Secret: Match your `webhook.secret` in config
5. Events: Push events

### GitLab

1. Go to your repo → Settings → Webhooks
2. URL: `https://your-tunnel-url.trycloudflare.com/webhook/gitlab`
3. Secret token: Match your `webhook.secret` in config
4. Trigger: Push events

### Gitea

1. Go to your repo → Settings → Webhooks → Add Webhook → Gitea
2. Target URL: `https://your-tunnel-url.trycloudflare.com/webhook/gitea`
3. Secret: Match your `webhook.secret` in config
4. Events: Push events

## Exposing GitSync with Cloudflare Tunnel

For GitHub/GitLab webhooks to reach GitSync, you need to expose port 4000 to the internet. The easiest way is using [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).

### Option 1: Run cloudflared via TaskServer (Recommended)

Add a cloudflared tunnel as a TaskServer forever script. See the [TaskServer Cloudflare Tunnel docs](https://github.com/raylin01/TaskServer#cloudflare-tunnel-setup) for setup instructions.

Add to TaskServer's `config.yaml`:

```yaml
scripts:
  # Expose GitSync webhook port via Cloudflare Tunnel
  - name: gitsync-tunnel
    command: cloudflared tunnel --url http://localhost:4000
    type: forever
```

This will output a public URL like `https://xxx-xxx-xxx.trycloudflare.com` that you can use in your webhook settings.

### Option 2: Use a Named Tunnel

For a permanent URL, create a named tunnel in the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/):

1. Create a tunnel and get your token
2. Configure the tunnel to route to `http://localhost:4000`
3. Run via TaskServer:

```yaml
scripts:
  - name: gitsync-tunnel
    command: cloudflared tunnel run --token YOUR_TUNNEL_TOKEN
    type: forever
```

### Option 3: Quick Tunnel (Development)

For quick testing, run manually:

```bash
cloudflared tunnel --url http://localhost:4000
```

> **Tip**: If using TaskServer to manage both GitSync and its tunnel, you get auto-restart, logging, and unified management for both!

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         TaskServer                              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Forever Scripts:                                       │    │
│  │    • gitsync (this tool)                               │    │
│  │    • myAppServer  ←─── restart triggered ───┐          │    │
│  │    • myWorker     ←─── restart triggered ───┤          │    │
│  └────────────────────────────────────────────────────────┘    │
│                              ▲                                  │
│                              │ POST /api/restart-script/:name   │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│                         GitSync                                 │
│                              │                                  │
│  ┌─────────────┐    ┌───────┴──────┐    ┌─────────────────┐    │
│  │   Webhook   │───▶│   Deployer   │───▶│  TaskServer     │    │
│  │   Server    │    │              │    │  Client         │    │
│  └─────────────┘    │  1. git pull │    └─────────────────┘    │
│        ▲            │  2. npm/bun  │                            │
│        │            │     install  │                            │
│   GitHub/GitLab     │  3. restart  │                            │
│   push event        │     scripts  │                            │
└─────────────────────┴──────────────┴────────────────────────────┘
```

**Flow:**
1. You push code to GitHub/GitLab/Gitea
2. Git provider sends webhook to GitSync
3. GitSync runs `git pull` in your repo
4. GitSync runs dependency install (if configured)
5. GitSync calls TaskServer API to restart your scripts
6. TaskServer gracefully restarts the specified scripts

> **Note**: GitSync restarts *other* scripts, not itself. If you need to update GitSync, you'd manually restart it or use a separate deployment mechanism.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/webhook/github` | POST | GitHub webhook |
| `/webhook/gitlab` | POST | GitLab webhook |
| `/webhook/gitea` | POST | Gitea webhook |

## Project Structure

```
GitSync/
├── package.json
├── config.yaml              # Your configuration
├── config.example.yaml      # Example configuration
└── src/
    ├── index.js             # Main entry point
    ├── configLoader.js      # YAML config parser
    ├── webhook.js           # Webhook HTTP server
    ├── polling.js           # Polling mode
    ├── gitPull.js           # Git operations
    ├── dependencyInstaller.js # npm/bun/yarn/pip
    ├── deployer.js          # Deployment orchestrator
    └── taskServerClient.js  # TaskServer API client
```

## License

MIT
