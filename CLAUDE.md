# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands
- `npm run dev` - Start development server (runs both client and server in watch mode)
- `npm run dev:server` - Start only the server in watch mode using tsx
- `npm run dev:client` - Start only the client Vite dev server
- `npm run build` - Build for production (both server and client)
- `npm run build:server` - Build only the server TypeScript
- `npm run build:client` - Build only the client Vue.js app
- `npm run start` - Start production server
- `npm run preview` - Preview production client build

## Architecture Overview

BotFarm is a Node.js application that manages multiple Claude Code developer instances using git worktrees. Each "developer" runs in its own isolated git worktree with its own branch.

### Core Components

**Server Architecture (Express.js + Socket.io)**
- `DeveloperManager` - Central class managing Claude Code PTY processes and developer lifecycle
- `GitManager` - Handles git operations (worktrees, branches, commits, PRs)
- `NotificationManager` - System for alerting users about developer status changes
- Real-time WebSocket communication for terminal output and status updates

**Client Architecture (Vue 3 + TypeScript)**
- `ChatPage.vue` - Main interface for interacting with individual developers
- `HomePage.vue` - Dashboard showing all developers and their status
- `Terminal.vue` - XTerm.js component for displaying Claude Code terminal output
- `DeveloperSidebar.vue` - Navigation and developer management UI

**Key Data Flow**
1. User creates developer → GitManager creates worktree/branch → DeveloperManager spawns Claude PTY
2. Claude output → Terminal PTY → WebSocket → Client terminal display
3. User input → WebSocket → PTY write → Claude Code process
4. Status changes detected via terminal output patterns → Notifications → UI updates

### Development Patterns

**TypeScript Configuration**
- Separate configs: `tsconfig.json` (client), `tsconfig.server.json` (server)
- Client uses ES modules with Vite bundler resolution
- Server uses CommonJS targeting Node.js
- Strict null checks and unused parameter checking enabled

**State Management**
- Server state managed in-memory with Map structures for developers/terminals
- Client uses Vue composables (`useApi.ts`, `useSocket.ts`) for API and WebSocket communication
- Real-time synchronization via Socket.io events

**Terminal Integration**
- Uses `node-pty` for pseudo-terminal creation spawning Claude Code CLI
- XTerm.js on client for terminal rendering with fit and attach addons
- Pattern matching on terminal output to detect status changes (waiting for input, permissions, etc.)

**Git Worktree Pattern**
- Each developer gets isolated worktree in `.worktrees/{branch-name}/`
- Automatic branch creation from main
- PR creation and cleanup handled through GitHub CLI (`gh`)

### File Organization
```
src/
├── client/          # Vue.js frontend
│   ├── components/  # Reusable Vue components
│   ├── views/       # Page-level components
│   └── composables/ # Vue composition API logic
├── server/          # Express.js backend
└── shared/          # Shared TypeScript interfaces
```

### Important Implementation Details

**Developer Status Detection**
- Status changes detected by parsing Claude Code terminal output
- Patterns in `DeveloperManager.ts:151-176` detect waiting states and permission requests
- Critical for notification system and UI status indicators

**PTY Process Management**
- Claude Code spawned as child process using `node-pty`
- Process discovery uses `which claude` - requires Claude Code CLI in PATH
- Terminal cleanup handled on developer deletion and process exit

**WebSocket Events**
- All events defined in `shared/types.ts` SocketEvents interface
- Real-time updates for developer status, chat messages, and notifications
- Room-based terminal data streaming (`terminal:${developerId}`)