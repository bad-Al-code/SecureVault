import { ICommand } from '../core';
import { ConfigService } from '../services';
import { ConsoleFormatter } from '../utils';

export class ConfigCommand implements ICommand {
  /**
   * Executes the config command.
   * @param args - Command line arguments
   * @returns A Promise that resolves when the command has been executed.
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length === 0) {
      await this._listConfig();

      return;
    }

    if (args.length === 2) {
      const [key, value] = args;
      await ConfigService.set(key, value);

      ConsoleFormatter.green(`✔ Configuration updated: ${key} = ${value}`);

      return;
    }
    throw new Error('Usage: vault config [key] [value]');
  }

  /**
   * Lists the current configuration.
   */
  private async _listConfig(): Promise<void> {
    const config = await ConfigService.get();

    console.log(ConsoleFormatter.cyan('--- Vault Configuration ---'));
    if (Object.keys(config).length === 0) {
      console.log('No configuration set.');
    } else {
      Object.entries(config).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
      });
    }
    console.log('---------------------------');
  }
}
