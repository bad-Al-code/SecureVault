import path from 'node:path';

import { VaultEvents } from '../core';
import {
  ClipboardService,
  CryptoService,
  EventService,
  FileService,
  VersionControlService,
} from '../services';
import { ICommand } from '../types';
import { ConsoleFormatter, getPassword, LoadingIndicator } from '../utils';

export class PasteCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  public async execute(args: string[]): Promise<void> {
    if (args.length !== 1) {
      throw new Error('The "paste" command requires exactly one filename.');
    }

    const filename = args[0];

    try {
      const content = await ClipboardService.read();

      if (!content || content.trim().length === 0) {
        throw new Error('Clipboard is empty.');
      }

      console.log(
        ConsoleFormatter.cyan(
          `📋 Found content in clipboard (${content.length} chars).`
        )
      );

      const password = await getPassword(true);

      this.loadingIndicator.start('Encrypting and saving...');
      const encryptedContent = await CryptoService.encrypt(content, password);

      await FileService.writeFile(filename, encryptedContent);

      await VersionControlService.init(
        filename,
        `Created ${path.basename(filename)} from clipboard`
      );

      await ClipboardService.clear();

      this.loadingIndicator.stop();
      console.log(ConsoleFormatter.green(`✔  Saved to ${filename}`));
      console.log(ConsoleFormatter.gray('✔  Clipboard cleared for security.'));

      EventService.getInstance().emit(VaultEvents.ACTION_COMPLETED, {
        file: filename,
        action: 'paste',
      });
    } catch (err) {
      this.loadingIndicator.stop();

      const error = err as Error;
      console.error(ConsoleFormatter.red(`✘ Paste failed: ${error.message}`));
      process.exit(1);
    }
  }
}
