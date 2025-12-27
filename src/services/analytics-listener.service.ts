import { VaultEvents } from '../core';
import { AnalyticsRepository } from '../repository';
import { EventService } from './event.service';

export class AnalyticsListener {
  public static init(): void {
    const bus = EventService.getInstance();

    bus.on(VaultEvents.ACTION_COMPLETED, async (payload) => {
      const { file, action } = payload;

      try {
        await AnalyticsRepository.recordAction(file, action);
      } catch (error) {
        console.error('Failed to record analytics:', error);
      }
    });
  }
}
