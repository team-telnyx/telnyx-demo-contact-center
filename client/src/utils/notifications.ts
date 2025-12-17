// Browser notification utility for calls and messages

export type NotificationType = 'call' | 'message';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
}

class NotificationService {
  private permissionGranted = false;
  private permissionRequested = false;

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permissionGranted = Notification.permission === 'granted';
    }
  }

  /**
   * Request notification permission from the user
   */
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Notifications not supported in this browser');
      return false;
    }

    if (this.permissionGranted) {
      return true;
    }

    if (this.permissionRequested) {
      return this.permissionGranted;
    }

    this.permissionRequested = true;

    try {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === 'granted';

      if (this.permissionGranted) {
        console.log('✅ Notification permission granted');
      } else {
        console.warn('⚠️ Notification permission denied');
      }

      return this.permissionGranted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Check if notifications are supported and permission is granted
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Check if permission is granted
   */
  hasPermission(): boolean {
    return this.permissionGranted;
  }

  /**
   * Show a notification for a new call
   */
  async notifyNewCall(from: string, options?: Partial<NotificationOptions>): Promise<void> {
    console.log('📞 notifyNewCall called with:', from);
    console.log('📞 Permission granted:', this.permissionGranted);
    console.log('📞 Notification permission:', typeof window !== 'undefined' ? Notification.permission : 'N/A');

    if (!this.permissionGranted) {
      console.log('📞 Permission not granted, requesting...');
      await this.requestPermission();
    }

    if (!this.permissionGranted) {
      console.warn('⚠️ Cannot show notification - permission not granted');
      return;
    }

    const notificationOptions: NotificationOptions = {
      title: 'Incoming Call',
      body: `Call from ${from}`,
      icon: '/phone-icon.png',
      badge: '/badge-icon.png',
      tag: 'incoming-call',
      requireInteraction: true,
      data: {
        type: 'call',
        from,
        timestamp: Date.now(),
      },
      ...options,
    };

    console.log('📞 Creating notification with options:', notificationOptions);

    try {
      const notification = new Notification(notificationOptions.title, {
        body: notificationOptions.body,
        icon: notificationOptions.icon,
        badge: notificationOptions.badge,
        tag: notificationOptions.tag,
        requireInteraction: notificationOptions.requireInteraction,
        data: notificationOptions.data,
      });

      console.log('✅ Notification created successfully');

      // Auto-close after 10 seconds if not requiring interaction
      if (!notificationOptions.requireInteraction) {
        setTimeout(() => notification.close(), 10000);
      }

      // Handle click event
      notification.onclick = () => {
        window.focus();
        // Navigate to phone page
        if (typeof window !== 'undefined') {
          window.location.href = '/phone';
        }
        notification.close();
      };

      console.log('📞 Call notification sent:', from);
    } catch (error) {
      console.error('❌ Error showing call notification:', error);
    }
  }

  /**
   * Show a notification for a new message
   */
  async notifyNewMessage(from: string, preview: string, options?: Partial<NotificationOptions>): Promise<void> {
    if (!this.permissionGranted) {
      await this.requestPermission();
    }

    if (!this.permissionGranted) {
      return;
    }

    const notificationOptions: NotificationOptions = {
      title: `New message from ${from}`,
      body: preview,
      icon: '/message-icon.png',
      badge: '/badge-icon.png',
      tag: 'new-message',
      requireInteraction: false,
      data: {
        type: 'message',
        from,
        timestamp: Date.now(),
      },
      ...options,
    };

    try {
      const notification = new Notification(notificationOptions.title, {
        body: notificationOptions.body,
        icon: notificationOptions.icon,
        badge: notificationOptions.badge,
        tag: notificationOptions.tag,
        requireInteraction: notificationOptions.requireInteraction,
        data: notificationOptions.data,
      });

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);

      // Handle click event
      notification.onclick = () => {
        window.focus();
        // Navigate to conversations page
        if (typeof window !== 'undefined') {
          window.location.href = '/sms';
        }
        notification.close();
      };

      console.log('💬 Message notification sent:', from);
    } catch (error) {
      console.error('Error showing message notification:', error);
    }
  }

  /**
   * Show a custom notification
   */
  async notify(options: NotificationOptions): Promise<void> {
    if (!this.permissionGranted) {
      await this.requestPermission();
    }

    if (!this.permissionGranted) {
      return;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon,
        badge: options.badge,
        tag: options.tag,
        requireInteraction: options.requireInteraction,
        data: options.data,
      });

      // Auto-close after 10 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 10000);
      }

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export convenience functions
export const requestNotificationPermission = () => notificationService.requestPermission();
export const notifyNewCall = (from: string, options?: Partial<NotificationOptions>) =>
  notificationService.notifyNewCall(from, options);
export const notifyNewMessage = (from: string, preview: string, options?: Partial<NotificationOptions>) =>
  notificationService.notifyNewMessage(from, preview, options);
