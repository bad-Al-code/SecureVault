import notifier from 'node-notifier';

import { VaultEvents } from '../core';
import { ConfigService } from './config.service';
import { EventService } from './event.service';

export class NotificationService {
  private static readonly TITLE = 'SecureVault CLI';

  public static async init(): Promise<void> {
    const config = await ConfigService.get();

    if (config.enableNotifications === false) return;

    const bus = EventService.getInstance();

    bus.on(VaultEvents.AUTH_FAILED, (payload) => {
      NotificationService.send(
        `Unauthorized Access Attempt detected on: ${payload.file}`,
        true
      );
    });

    bus.on(VaultEvents.BACKUP_COMPLETED, (payload) => {
      const msg =
        payload.count > 0
          ? `Backup Successful! Uploaded ${payload.count} files.`
          : `Backup Finished. Everything is up to date.`;

      NotificationService.send(msg);
    });

    bus.on(VaultEvents.BACKUP_FAILED, (payload) => {
      NotificationService.send(`Backup Failed: ${payload.error}`, true);
    });
  }

  /**
   * Sends a native desktop notification.
   * @param message - The body text.
   * @param isError - If true, may use a different sound/icon (OS dependent).
   */
  public static send(message: string, isError: boolean = false): void {
    notifier.notify({
      title: this.TITLE,
      message,
      sound: isError,
      wait: false,
    });
  }
}
