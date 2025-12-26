import { ICommand } from '../core';
import { CryptoService, FileService } from '../services';
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
    const { MultiKeyCryptoService } = await import('../services');
    const encryptedFiles = [];

    for (const filename of filenames) {
      if (await FileService.fileExists(filename)) {
        const content = await FileService.readFile(filename);

        // Check for both V1 and V2 formats
        if (
          CryptoService.isVaultFile(content) ||
          MultiKeyCryptoService.isVaultFileV2(content)
        ) {
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
    const { MultiKeyCryptoService } = await import('../services');

    try {
      const password = await getPassword(false);

      for (const filename of filesToDecrypt) {
        await this._decryptFile(filename, password, MultiKeyCryptoService);
      }
    } catch (_err) {
      this.loadingIndicator.stop();

      console.error(`✘ A critical error occurred during decryption.`);
      process.exit(1);
    }
  }

  /**
   * Decrypts a single file, automatically detecting V1 or V2 format.
   * @param filename - The path to the file to decrypt.
   * @param password - The password to use for decryption.
   * @param MultiKeyCryptoService - The multi-key crypto service.
   */
  private async _decryptFile(
    filename: string,
    password: string,
    MultiKeyCryptoService: typeof import('../services').MultiKeyCryptoService
  ): Promise<void> {
    this.loadingIndicator.start(`Decrypting ${filename}...`);

    try {
      const encryptedData = await FileService.readFile(filename);
      const version = CryptoService.getVaultVersion(encryptedData);

      let decryptedText: string;

      if (version === 2) {
        // V2 format - use MultiKeyCryptoService
        decryptedText = await MultiKeyCryptoService.decrypt(
          encryptedData,
          password
        );
      } else {
        // V1 format - use CryptoService
        decryptedText = await CryptoService.decrypt(encryptedData, password);
      }

      await FileService.writeFile(filename, decryptedText);

      this.loadingIndicator.stop(
        `✔  ${filename} decrypted successfully${version === 2 ? ' (V2)' : ''}`
      );
    } catch (_error) {
      this.loadingIndicator.stop();

      console.error(
        `✘ Failed to decrypt ${filename}: Invalid password or corrupted file.`
      );
    }
  }
}
