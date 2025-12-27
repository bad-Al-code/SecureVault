import EventEmitter from 'node:events';

export class EventService extends EventEmitter {
  private static instance: EventService;

  private constructor() {
    super();
  }

  public static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }

    return EventService.instance;
  }
}
