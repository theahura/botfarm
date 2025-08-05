#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const open = require('open');

async function checkGitRepo() {
  return new Promise((resolve) => {
    const git = spawn('git', ['rev-parse', '--git-dir'], { stdio: 'pipe' });
    git.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

async function startServer() {
  console.log('🤖 Starting BotFarm server...');
  
  const serverPath = path.join(__dirname, '../dist/server.js');
  const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  server.on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Wait a moment for server to start, then open browser
  setTimeout(() => {
    console.log('🌐 Opening browser at http://localhost:3001');
    open('http://localhost:3001');
  }, 2000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down BotFarm...');
    server.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.kill();
    process.exit(0);
  });
}

async function main() {
  console.log('🚀 BotFarm - Claude Code Developer Management');
  
  // Check if we're in a git repository
  const isGitRepo = await checkGitRepo();
  if (!isGitRepo) {
    console.error('❌ Error: BotFarm must be run from within a git repository.');
    console.log('Please navigate to a git repository and try again.');
    process.exit(1);
  }

  console.log('✅ Git repository detected');

  // Check if built files exist
  const serverPath = path.join(__dirname, '../dist/server.js');
  if (!fs.existsSync(serverPath)) {
    console.error('❌ Error: BotFarm is not built. Please run "npm run build" first.');
    process.exit(1);
  }

  await startServer();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});