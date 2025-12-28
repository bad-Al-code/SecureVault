import { CompletionService } from '../services';
import { ICommand } from '../types';
import { ConsoleFormatter } from '../utils';

export class CompletionCommand implements ICommand {
  public async execute(args: string[]): Promise<void> {
    if (args.length === 0) {
      throw new Error('Usage: vault completion setup.');
    }

    if (args[0] === 'setup') {
      console.log(
        ConsoleFormatter.cyan('initializing shell completion setup...')
      );

      CompletionService.setup();

      return;
    }

    throw new Error(`Unknown completion argument: ${args[0]}`);
  }
}
