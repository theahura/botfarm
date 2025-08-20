import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { Notification, SocketEvents } from '../shared/types';

export class NotificationManager {
  private notifications: Map<string, Notification> = new Map();

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

    this.notifications.set(notification.id, notification);
    this.io.emit('notification:new', notification);
    
    return notification;
  }

  markAsRead(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
      this.notifications.set(notificationId, notification);
      this.io.emit('notification:read', notificationId);
    }
  }

  getAllNotifications(): Notification[] {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getUnreadNotifications(): Notification[] {
    return this.getAllNotifications().filter(n => !n.read);
  }

  getNotificationsForDeveloper(developerId: string): Notification[] {
    return this.getAllNotifications().filter(n => n.developerId === developerId);
  }

  clearNotificationsForDeveloper(developerId: string): void {
    const toDelete: string[] = [];
    for (const [id, notification] of this.notifications) {
      if (notification.developerId === developerId) {
        toDelete.push(id);
      }
    }
    toDelete.forEach(id => this.notifications.delete(id));
  }
}
