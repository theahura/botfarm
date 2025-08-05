# BotFarm 🤖

A local webapp for managing multiple Claude Code developers in a single UI. Each developer runs in its own git worktree with its own branch, allowing you to work on multiple features simultaneously with separate Claude Code instances.

## Features

- **Multi-Developer Management**: Create and manage multiple Claude Code developers
- **Git Integration**: Automatic git worktree and branch creation
- **Real-time Chat**: Interact with Claude Code through a web interface
- **Notifications**: Get notified when developers need attention
- **PR Integration**: Commit changes and create pull requests directly from the UI
- **Status Tracking**: Monitor the status of all your developers

## Prerequisites

- Node.js (v16 or higher)
- Git repository
- Claude Code CLI installed and configured
- GitHub CLI (`gh`) for PR creation

## Installation

1. Clone this repository or download the source
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Install globally (optional):
   ```bash
   npm link
   ```

## Usage

### Quick Start

Navigate to any git repository and run:

```bash
npx botfarm
```

Or if installed globally:

```bash
botfarm
```

This will:
1. Verify you're in a git repository
2. Start the BotFarm server
3. Open your browser to `http://localhost:3001`

### Creating Developers

1. Click "New Developer" on the main page
2. Enter a name for your developer (e.g., "Feature Developer")
3. Enter a branch name (e.g., "feature/new-feature")
4. Click "Create Developer"

This will:
- Create a new git worktree in `.worktrees/{branch-name}`
- Create a new branch from `main`
- Start a Claude Code session in that worktree
- Take you to the chat interface

### Interacting with Developers

- **Chat Interface**: Send messages to Claude Code and see responses in real-time
- **Status Indicators**: See when Claude is active, waiting for input, or encountered an error
- **Notifications**: Get alerted when developers need your attention

### Committing Changes

1. Click "Commit Changes" in the chat interface
2. Enter a commit message
3. The system will:
   - Add all changes to git
   - Create a commit
   - Push the branch to GitHub
   - Create a pull request
   - Display the PR link

## Development

### Running in Development Mode

```bash
npm run dev
```

This starts both the server and client in development mode with hot reloading.

### Project Structure

```
botfarm/
├── src/
│   ├── client/          # Vue.js frontend
│   │   ├── components/  # Vue components
│   │   ├── views/       # Page components
│   │   └── composables/ # Vue composables
│   ├── server/          # Express.js backend
│   │   ├── server.ts    # Main server file
│   │   ├── DeveloperManager.ts  # Claude Code process management
│   │   ├── GitManager.ts        # Git operations
│   │   └── NotificationManager.ts # Notification system
│   └── shared/          # Shared TypeScript types
├── bin/
│   └── botfarm.js       # CLI entry point
└── dist/                # Built files
```

### API Endpoints

- `GET /api/developers` - List all developers
- `POST /api/developers` - Create new developer
- `GET /api/developers/:id` - Get developer details
- `DELETE /api/developers/:id` - Delete developer
- `POST /api/developers/:id/commit` - Commit changes and create PR
- `POST /api/developers/:id/input` - Send input to Claude Code
- `GET /api/notifications` - Get notifications
- `POST /api/notifications/:id/read` - Mark notification as read

### WebSocket Events

- `developer:created` - New developer created
- `developer:updated` - Developer status changed
- `developer:deleted` - Developer removed
- `chat:message` - New chat message
- `notification:new` - New notification
- `notification:read` - Notification marked as read

## Troubleshooting

### Claude Code Not Found
Make sure Claude Code CLI is installed and available in your PATH:
```bash
which claude
```

### Git Worktree Issues
If you encounter git worktree errors, you may need to clean up manually:
```bash
git worktree prune
```

### Port Already in Use
If port 3001 is already in use, set the PORT environment variable:
```bash
PORT=3002 botfarm
```

## License

MIT License

hello world
