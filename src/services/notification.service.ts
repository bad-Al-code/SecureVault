import notifier from 'node-notifier';

import { VaultEvents } from '../core';
import { ConfigService } from './config.service';
import { EventService } from './event.service';

export class NotificationService {
  private static readonly TITLE = 'SecureVault CLI';
  private static pendingNotifications: Set<Promise<void>> = new Set();

  public static async init(): Promise<void> {
    const config = await ConfigService.get();

    if (config.enableNotifications === false) return;

    const bus = EventService.getInstance();

    bus.on(VaultEvents.AUTH_FAILED, (payload) => {
      this.send(
        `Unauthorized Access Attempt detected on: ${payload.file}`,
        true
      );
    });

    bus.on(VaultEvents.BACKUP_COMPLETED, (payload) => {
      const msg =
        payload.count > 0
          ? `Backup Successful! Uploaded ${payload.count} files.`
          : `Backup Finished. Everything is up to date.`;

      this.send(msg);
    });

    bus.on(VaultEvents.BACKUP_FAILED, (payload) => {
      this.send(`Backup Failed: ${payload.error}`, true);
    });
  }

  /**
   * Sends a native desktop notification.
   * @param message - The body text.
   * @param isError - If true, may use a different sound/icon (OS dependent).
   */
  public static send(message: string, isError: boolean = false): void {
    const notificationPromise = new Promise<void>((resolve) => {
      notifier.notify(
        {
          title: this.TITLE,
          message: message,
          sound: isError,
          wait: false,
          appID: 'SecureVault.CLI',
        },
        (err, response) => {
          resolve();
        }
      );
    });

    this.pendingNotifications.add(notificationPromise);

    notificationPromise.finally(() => {
      this.pendingNotifications.delete(notificationPromise);
    });
  }

  /**
   * Waits for all pending notifications to be handed off to the OS.
   */
  public static async ensureSent(): Promise<void> {
    if (this.pendingNotifications.size > 0) {
      await Promise.all(Array.from(this.pendingNotifications));
    }
  }
}
