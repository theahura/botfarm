import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { Notification, SocketEvents } from '../shared/types';

export class NotificationManager {
  constructor(private io: Server) {}

  createNotification(
    developerId: string,
    type: Notification['type'],
    message: string
  ): Notification {
    const notification: Notification = {
      id: uuidv4(),
      developerId,
      type,
      message,
      timestamp: new Date(),
      read: false
    };

    // Fire and forget - just emit to clients
    this.io.emit('notification:new', notification);
    
    return notification;
  }
}
