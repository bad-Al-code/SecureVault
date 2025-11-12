import { ICommand } from '../core';
import { VersionControlService } from '../services';

export class HistoryCommand implements ICommand {
  /**
   * Executes the history command.
   * @param args - An array containing the single file path.
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length !== 1) {
      throw new Error('The "history" command requires exactly one filename.');
    }

    await VersionControlService.showHistory(args[0]);
  }
}
