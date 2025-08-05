import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { GitManager } from './GitManager';
import { NotificationManager } from './NotificationManager';
import { Developer, DeveloperStatus, CreateDeveloperRequest, ChatMessage, SocketEvents } from '../shared/types';

export class DeveloperManager {
  private developers: Map<string, Developer> = new Map();
  private terminals: Map<string, pty.IPty> = new Map();
  private gitManager: GitManager;
  private notificationManager: NotificationManager;

  constructor(private io: Server) {
    this.gitManager = new GitManager();
    this.notificationManager = new NotificationManager(io);
  }

  async createDeveloper(request: CreateDeveloperRequest): Promise<Developer> {
    console.log('🔧 DeveloperManager: Creating developer with request:', request);
    
    try {
      const id = uuidv4();
      console.log('🔧 DeveloperManager: Generated ID:', id);
      
      console.log('🔧 DeveloperManager: Creating worktree for branch:', request.branchName);
      const workingDirectory = await this.gitManager.createWorktree(request.branchName);
      console.log('🔧 DeveloperManager: Worktree created at:', workingDirectory);
      
      const developer: Developer = {
        id,
        name: request.name,
        branchName: request.branchName,
        workingDirectory,
        status: DeveloperStatus.IDLE,
        createdAt: new Date(),
        lastActivity: new Date(),
        notificationCount: 0
      };

      console.log('🔧 DeveloperManager: Storing developer in map');
      this.developers.set(id, developer);
      
      console.log('🔧 DeveloperManager: Starting Claude terminal');
      this.startClaudeTerminal(developer);
      
      console.log('🔧 DeveloperManager: Emitting developer:created event');
      this.io.emit('developer:created', developer);
      
      console.log('✅ DeveloperManager: Developer created successfully');
      return developer;
    } catch (error) {
      console.error('❌ DeveloperManager: Error in createDeveloper:', error);
      console.error('❌ DeveloperManager: Error stack:', (error as Error).stack);
      throw error;
    }
  }

  private startClaudeTerminal(developer: Developer) {
    console.log(`Starting Claude terminal for ${developer.name} in ${developer.workingDirectory}`);
    
    // Create a PTY (pseudo-terminal) that spawns Claude
    const terminal = pty.spawn('/home/soot/.nvm/versions/node/v22.15.0/bin/node', [
      '/home/soot/.nvm/versions/node/v22.15.0/bin/claude'
    ], {
      name: 'claude-terminal',
      cols: 120,
      rows: 30,
      cwd: developer.workingDirectory,
      env: { 
        ...process.env, 
        PATH: '/home/soot/.nvm/versions/node/v22.15.0/bin:' + process.env.PATH,
        HOME: process.env.HOME,
        USER: process.env.USER,
        TERM: 'xterm-256color'
      }
    });

    console.log(`🔧 Terminal PID: ${terminal.pid}`);
    this.terminals.set(developer.id, terminal);

    // Handle terminal data (output from Claude)
    terminal.onData((data) => {
      console.log(`📤 Claude terminal output for ${developer.name}:`, data);
      this.handleTerminalOutput(developer.id, data);
    });

    // Handle terminal exit
    terminal.onExit(({ exitCode, signal }) => {
      console.log(`🛑 Claude terminal for ${developer.name} exited with code ${exitCode}, signal: ${signal}`);
      this.updateDeveloperStatus(developer.id, DeveloperStatus.ERROR);
      this.notificationManager.createNotification(
        developer.id,
        'error',
        `${developer.name} terminal exited unexpectedly`
      );
      this.terminals.delete(developer.id);
    });

    // Send initial greeting after a short delay
    setTimeout(() => {
      console.log(`📝 Sending initial message to Claude terminal for ${developer.name}`);
      terminal.write('Hello! I\'m ready to help you with this project. What would you like me to work on?\n');
    }, 2000);

    // Set initial status
    this.updateDeveloperStatus(developer.id, DeveloperStatus.ACTIVE);
    console.log(`🔄 Set initial status to ACTIVE for ${developer.name}`);
  }

  private handleTerminalOutput(developerId: string, data: string) {
    console.log(`🔄 Handling terminal output for developer ${developerId}: "${data.trim()}"`);
    
    // Emit raw terminal data to connected clients
    this.io.to(`terminal:${developerId}`).emit('terminal:data', data);
    
    const message: ChatMessage = {
      id: uuidv4(),
      developerId,
      type: 'output',
      content: data,
      timestamp: new Date()
    };

    console.log(`📡 Emitting chat:message to clients:`, { 
      messageId: message.id, 
      developerId, 
      contentLength: data.length 
    });
    
    this.io.emit('chat:message', message);
    this.updateLastActivity(developerId);

    if (this.isWaitingForInput(data)) {
      console.log(`⏳ Detected waiting for input pattern in: "${data.trim()}"`);
      this.updateDeveloperStatus(developerId, DeveloperStatus.WAITING_FOR_INPUT);
      const developer = this.developers.get(developerId);
      if (developer) {
        this.notificationManager.createNotification(
          developerId,
          'waiting_for_input',
          `${developer.name} is waiting for your input`
        );
      }
    }
  }

  private isWaitingForInput(content: string): boolean {
    const waitingPatterns = [
      /Press enter to continue/i,
      /Enter your response:/i,
      /Type your message:/i,
      /Waiting for input/i
    ];
    
    return waitingPatterns.some(pattern => pattern.test(content));
  }

  sendInput(developerId: string, input: string) {
    const terminal = this.terminals.get(developerId);
    if (!terminal) {
      throw new Error('Developer terminal not found');
    }

    terminal.write(input + '\n');
    
    const message: ChatMessage = {
      id: uuidv4(),
      developerId,
      type: 'input',
      content: input,
      timestamp: new Date()
    };

    this.io.emit('chat:message', message);
    this.updateDeveloperStatus(developerId, DeveloperStatus.ACTIVE);
    this.updateLastActivity(developerId);
  }

  async commitAndCreatePR(developerId: string, commitMessage: string): Promise<string> {
    const developer = this.developers.get(developerId);
    if (!developer) {
      throw new Error('Developer not found');
    }

    const pullRequestUrl = await this.gitManager.commitAndCreatePR(
      developer.workingDirectory,
      developer.branchName,
      commitMessage
    );

    developer.pullRequestUrl = pullRequestUrl;
    this.developers.set(developerId, developer);
    this.io.emit('developer:updated', developer);

    this.notificationManager.createNotification(
      developerId,
      'pr_created',
      `Pull request created for ${developer.name}: ${pullRequestUrl}`
    );

    return pullRequestUrl;
  }

  async mergePRAndCleanup(developerId: string): Promise<void> {
    const developer = this.developers.get(developerId);
    if (!developer) {
      throw new Error('Developer not found');
    }

    if (!developer.pullRequestUrl) {
      throw new Error('No pull request found for this developer');
    }

    // Kill the Claude terminal first
    const terminal = this.terminals.get(developerId);
    if (terminal) {
      terminal.kill();
      this.terminals.delete(developerId);
    }

    try {
      // Merge PR and cleanup using GitManager
      await this.gitManager.mergePRAndCleanup(
        developer.pullRequestUrl,
        developer.branchName,
        developer.workingDirectory
      );

      // Clean up notifications
      this.notificationManager.clearNotificationsForDeveloper(developerId);

      // Remove developer from memory
      this.developers.delete(developerId);

      // Notify clients
      this.io.emit('developer:deleted', developerId);

      // Create success notification
      this.notificationManager.createNotification(
        developerId,
        'pr_created', // Reusing this type for merged PR
        `Successfully merged PR and cleaned up ${developer.name}`
      );

    } catch (error) {
      // If merge fails, restart the Claude terminal
      this.startClaudeTerminal(developer);
      this.notificationManager.createNotification(
        developerId,
        'error',
        `Failed to merge PR for ${developer.name}: ${(error as Error).message}`
      );
      throw error;
    }
  }

  async deleteDeveloper(developerId: string): Promise<void> {
    const terminal = this.terminals.get(developerId);
    if (terminal) {
      terminal.kill();
      this.terminals.delete(developerId);
    }

    const developer = this.developers.get(developerId);
    if (developer) {
      await this.gitManager.removeWorktree(developer.workingDirectory);
      this.notificationManager.clearNotificationsForDeveloper(developerId);
      this.developers.delete(developerId);
      this.io.emit('developer:deleted', developerId);
    }
  }

  getDeveloper(id: string): Developer | undefined {
    return this.developers.get(id);
  }

  getAllDevelopers(): Developer[] {
    return Array.from(this.developers.values());
  }

  getTerminal(developerId: string): pty.IPty | undefined {
    return this.terminals.get(developerId);
  }

  sendTerminalInput(developerId: string, data: string) {
    const terminal = this.terminals.get(developerId);
    if (!terminal) {
      throw new Error('Developer terminal not found');
    }

    terminal.write(data);
  }

  private updateDeveloperStatus(developerId: string, status: DeveloperStatus) {
    const developer = this.developers.get(developerId);
    if (developer) {
      developer.status = status;
      developer.lastActivity = new Date();
      this.developers.set(developerId, developer);
      this.io.emit('developer:updated', developer);
    }
  }

  private updateLastActivity(developerId: string) {
    const developer = this.developers.get(developerId);
    if (developer) {
      developer.lastActivity = new Date();
      this.developers.set(developerId, developer);
    }
  }
}
