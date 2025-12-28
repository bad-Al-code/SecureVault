import { SessionService } from '../services';
import { ICommand } from '../types';
import { ConsoleFormatter } from '../utils';

export class LogoutCommand implements ICommand {
  public async execute(_args: string[]): Promise<void> {
    try {
      await SessionService.clearSession();

      console.log(ConsoleFormatter.green('✔  Session cleared (Logged out).'));
    } catch (_error) {
      console.error(ConsoleFormatter.red('✘  Failed to logout.'));
    }
  }
}
