import { VaultEvents } from '../core';
import {
  ClipboardService,
  CryptoService,
  EventService,
  FileService,
  PasswordResolverService,
} from '../services';
import { ICommand } from '../types';
import { ConsoleFormatter, LoadingIndicator } from '../utils';

export class CopyCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  public async execute(args: string[]): Promise<void> {
    if (args.length !== 1) {
      throw new Error('The "copy" command requires exactly one filename.');
    }

    const filename = args[0];

    try {
      this.loadingIndicator.start(`Reading ${filename}...`);
      const encryptedData = await FileService.readFile(filename);

      if (!CryptoService.isVaultFile(encryptedData)) {
        this.loadingIndicator.stop();

        throw new Error('File is not an encrypted vault file.');
      }
      this.loadingIndicator.stop();

      const { decryptedContent } = await PasswordResolverService.resolve(
        encryptedData,
        filename
      );

      await ClipboardService.writeWithAutoClear(decryptedContent);

      EventService.getInstance().emit(VaultEvents.ACTION_COMPLETED, {
        file: filename,
        action: 'copy',
      });
    } catch (err) {
      this.loadingIndicator.stop();

      const error = err as Error;
      console.error(ConsoleFormatter.red(`✘ Copy failed: ${error.message}`));
      process.exit(1);
    }
  }
}
