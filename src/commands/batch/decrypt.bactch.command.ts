import { ICommand } from '../../core';
import { CryptoService, FileService, VaultActionService } from '../../services';
import { LoadingIndicator, findFiles, getPassword } from '../../utils';

export class BatchDecryptCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Executes the batch decryption command.
   * @param args - An array containing the single directory path.
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length !== 1) {
      throw new Error(
        'The "batch-decrypt" command requires exactly one directory path.'
      );
    }

    const directory = args[0];

    this.loadingIndicator.start(`Finding encrypted files in ${directory}...`);

    const allFiles = await findFiles(directory);
    const filesToDecrypt = await this._filterEncryptedFiles(allFiles);

    this.loadingIndicator.stop();

    if (filesToDecrypt.length === 0) {
      console.log('No encrypted files found to process.');
      return;
    }

    console.log(`Found ${filesToDecrypt.length} file(s) to decrypt.`);

    await this._processFiles(filesToDecrypt);
  }

  /**
   * Filters a list of file paths, returning only those that are encrypted.
   * @param filenames - A list of file paths to check.
   * @returns A promise that resolves to an array of encrypted file paths.
   */
  private async _filterEncryptedFiles(filenames: string[]): Promise<string[]> {
    const encryptedFiles = [];

    for (const filename of filenames) {
      const content = await FileService.readFile(filename);

      if (CryptoService.isVaultFile(content)) {
        encryptedFiles.push(filename);
      }
    }

    return encryptedFiles;
  }

  /**
   * Decrypts a list of files using a single password prompt.
   * @param filesToDecrypt - The list of file paths to decrypt.
   */
  private async _processFiles(filesToDecrypt: string[]): Promise<void> {
    const password = await getPassword(false);

    for (const filename of filesToDecrypt) {
      await VaultActionService.decryptFile(filename, password);
    }
  }
}
