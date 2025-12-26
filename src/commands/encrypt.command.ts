import { CryptoService, FileService, VaultActionService } from '../services';
import { ICommand } from '../types';
import { getPassword, LoadingIndicator } from '../utils';

export class EncryptCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Executes the encryption command.
   * @param filenames - An array of file paths to encrypt.
   */
  public async execute(filenames: string[]): Promise<void> {
    if (filenames.length === 0) {
      throw new Error('The "encrypt" command requires at least one filename.');
    }

    const filesToEncrypt = await this._filterFiles(filenames);

    if (filesToEncrypt.length === 0) {
      console.log('No files to encrypt.');

      return;
    }

    await this._processFiles(filesToEncrypt);
  }

  /**
   * Filters the initial list of filenames, removing those that are already encrypted or do not exist.
   * @param filenames - The initial list of file paths.
   * @returns A promise that resolves to an array of valid, unencrypted file paths.
   */
  private async _filterFiles(filenames: string[]): Promise<string[]> {
    const unencryptedFiles = [];

    for (const filename of filenames) {
      if (await FileService.fileExists(filename)) {
        const content = await FileService.readFile(filename);

        if (CryptoService.isVaultFile(content)) {
          console.log(`⚠️  Skipping already encrypted file: ${filename}`);
        } else {
          unencryptedFiles.push(filename);
        }
      } else {
        console.warn(`⚠️  Warning: File not found, skipping: ${filename}`);
      }
    }

    return unencryptedFiles;
  }

  /**
   * Orchestrates the encryption process for the filtered list of files.
   * @param filesToEncrypt - An array of file paths that are ready for encryption.
   */
  private async _processFiles(filesToEncrypt: string[]): Promise<void> {
    try {
      const password = await getPassword(true);

      for (const filename of filesToEncrypt) {
        await VaultActionService.encryptFile(filename, password);
      }
    } catch (err) {
      const error = err as Error;

      this.loadingIndicator.stop();
      console.error(`✘ Encryption failed: ${error.message}`);
      process.exit(1);
    }
  }
}
