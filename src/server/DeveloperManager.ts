import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { GitManager } from './GitManager';
import { NotificationManager } from './NotificationManager';
import { Developer, DeveloperStatus, CreateDeveloperRequest, ChatMessage, SocketEvents } from '../shared/types';

export class DeveloperManager {
  private developers: Map<string, Developer> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private gitManager: GitManager;
  private notificationManager: NotificationManager;

  constructor(private io: Server) {
    this.gitManager = new GitManager();
    this.notificationManager = new NotificationManager(io);
  }

  async createDeveloper(request: CreateDeveloperRequest): Promise<Developer> {
    const id = uuidv4();
    const workingDirectory = await this.gitManager.createWorktree(request.branchName);
    
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

    this.developers.set(id, developer);
    this.startClaudeProcess(developer);
    
    this.io.emit('developer:created', developer);
    return developer;
  }

  private startClaudeProcess(developer: Developer) {
    const process = spawn('claude', [], {
      cwd: developer.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.processes.set(developer.id, process);

    process.stdout?.on('data', (data) => {
      const content = data.toString();
      this.handleOutput(developer.id, content, 'output');
    });

    process.stderr?.on('data', (data) => {
      const content = data.toString();
      this.handleOutput(developer.id, content, 'error');
    });

    process.on('exit', (code) => {
      console.log(`Claude process for ${developer.name} exited with code ${code}`);
      this.updateDeveloperStatus(developer.id, DeveloperStatus.ERROR);
      this.notificationManager.createNotification(
        developer.id,
        'error',
        `${developer.name} encountered an error and stopped`
      );
    });

    this.updateDeveloperStatus(developer.id, DeveloperStatus.ACTIVE);
  }

  private handleOutput(developerId: string, content: string, type: 'output' | 'error') {
    const message: ChatMessage = {
      id: uuidv4(),
      developerId,
      type,
      content,
      timestamp: new Date()
    };

    this.io.emit('chat:message', message);
    this.updateLastActivity(developerId);

    if (this.isWaitingForInput(content)) {
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
    const process = this.processes.get(developerId);
    if (!process || !process.stdin) {
      throw new Error('Developer process not found or not accessible');
    }

    process.stdin.write(input + '\n');
    
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

  async deleteDeveloper(developerId: string): Promise<void> {
    const process = this.processes.get(developerId);
    if (process) {
      process.kill();
      this.processes.delete(developerId);
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