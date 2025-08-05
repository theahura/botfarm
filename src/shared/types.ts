export interface Developer {
  id: string;
  name: string;
  branchName: string;
  workingDirectory: string;
  status: DeveloperStatus;
  createdAt: Date;
  lastActivity: Date;
  pullRequestUrl?: string;
  notificationCount: number;
}

export enum DeveloperStatus {
  IDLE = 'idle',
  ACTIVE = 'active',
  WAITING_FOR_INPUT = 'waiting_for_input',
  ERROR = 'error',
  COMPLETED = 'completed'
}

export interface ChatMessage {
  id: string;
  developerId: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: Date;
}

export interface CreateDeveloperRequest {
  name: string;
  branchName: string;
}

export interface CommitRequest {
  developerId: string;
  message: string;
}

export interface Notification {
  id: string;
  developerId: string;
  type: 'ready_for_review' | 'error' | 'waiting_for_input' | 'pr_created';
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface SocketEvents {
  'developer:created': Developer;
  'developer:updated': Developer;
  'developer:deleted': string;
  'chat:message': ChatMessage;
  'notification:new': Notification;
  'notification:read': string;
}