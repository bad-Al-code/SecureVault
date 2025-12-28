import { VaultEvents } from '../core';
import {
  CryptoService,
  EventService,
  FileService,
  PasswordResolverService,
} from '../services';
import { ICommand } from '../types';
import { ConsoleFormatter, LoadingIndicator } from '../utils';

export class ViewCommand implements ICommand {
  /**
   * Executes the view command.
   * @param args - An array containing the single file path to view.
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length !== 1) {
      throw new Error('The "view" command requires exactly one filename.');
    }

    const filename = args[0];
    const loadingIndicator = new LoadingIndicator();

    try {
      loadingIndicator.start(`Reading ${filename}...`);
      const encryptedData = await FileService.readFile(filename);

      if (!CryptoService.isVaultFile(encryptedData)) {
        loadingIndicator.stop();
        throw new Error('File is not an encrypted vault file.');
      }

      loadingIndicator.stop();

      const { decryptedContent } = await PasswordResolverService.resolve(
        encryptedData,
        filename
      );

      console.log(decryptedContent);

      EventService.getInstance().emit(VaultEvents.ACTION_COMPLETED, {
        file: filename,
        action: 'view',
      });
    } catch (err) {
      const error = err as Error;

      loadingIndicator.stop();
      console.error(ConsoleFormatter.red(`✘ View failed: ${error.message}`));

      process.exit(1);
    }
  }
}
