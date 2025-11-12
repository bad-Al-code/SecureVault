import { ICommand } from '../core';
import { CryptoService, FileService, VaultActionService } from '../services';
import { getPassword, LoadingIndicator } from '../utils';

export class DecryptCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Executes the decryption command.
   * @param filenames - An array of file paths to decrypt.
   */
  public async execute(filenames: string[]): Promise<void> {
    if (filenames.length === 0) {
      throw new Error('The "decrypt" command requires at least one filename.');
    }

    const filesToDecrypt = await this._filterFiles(filenames);

    if (filesToDecrypt.length === 0) {
      console.log('No files to decrypt.');
      return;
    }

    await this._processFiles(filesToDecrypt);
  }

  /**
   * Filters the initial list of filenames, removing those that are not encrypted or do not exist.
   * @param filenames - The initial list of file paths.
   * @returns A promise that resolves to an array of valid, encrypted file paths.
   */
  private async _filterFiles(filenames: string[]): Promise<string[]> {
    const encryptedFiles = [];

    for (const filename of filenames) {
      if (await FileService.fileExists(filename)) {
        const content = await FileService.readFile(filename);

        if (CryptoService.isVaultFile(content)) {
          encryptedFiles.push(filename);
        } else {
          console.log(`⚠️  Skipping non-encrypted file: ${filename}`);
        }
      } else {
        console.warn(`⚠️  Warning: File not found, skipping: ${filename}`);
      }
    }

    return encryptedFiles;
  }

  /**
   * Orchestrates the decryption process for the filtered list of files.
   * @param filesToDecrypt - An array of file paths ready for decryption.
   */
  private async _processFiles(filesToDecrypt: string[]): Promise<void> {
    try {
      const password = await getPassword(false);

      for (const filename of filesToDecrypt) {
        await VaultActionService.decryptFile(filename, password);
      }
    } catch (_err) {
      this.loadingIndicator.stop();

      console.error(`✘ A critical error occurred during decryption.`);
      process.exit(1);
    }
  }
}
