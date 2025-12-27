import * as path from 'node:path';

import { LoadingIndicator } from '../utils';
import { CryptoService } from './crypto.service';
import { FileService } from './file.service';
import { VersionControlService } from './version-control.service';

export class VaultActionService {
  /**
   * Encrypts a single file, writes it to disk, and initializes its version history.
   * Manages its own loading indicator for the operation.
   * @param filename - The path to the file to encrypt.
   * @param password - The password to use for encryption.
   */
  public static async encryptFile(
    filename: string,
    password: string
  ): Promise<void> {
    const loadingIndicator = new LoadingIndicator();
    try {
      loadingIndicator.start(`Encrypting ${filename}...`);

      const plainText = await FileService.readFile(filename);
      const encryptedOutput = await CryptoService.encrypt(plainText, password);

      await FileService.writeFile(filename, encryptedOutput);
      await VersionControlService.init(
        filename,
        `Initial encryption of ${path.basename(filename)}`
      );

      loadingIndicator.stop(`✔  ${filename} encrypted successfully`);
    } catch (error) {
      loadingIndicator.stop();

      throw error;
    }
  }

  /**
   * Decrypts a single file and writes it to disk.
   * Manages its own loading indicator for the operation.
   * @param filename - The path to the file to decrypt.
   * @param password - The password to use for decryption.
   */
  public static async decryptFile(
    filename: string,
    password: string
  ): Promise<void> {
    const loadingIndicator = new LoadingIndicator();

    try {
      loadingIndicator.start(`Decrypting ${filename}...`);

      const encryptedData = await FileService.readFile(filename);
      const decryptedText = await CryptoService.decrypt(
        encryptedData,
        password,
        filename
      );

      await FileService.writeFile(filename, decryptedText);

      loadingIndicator.stop(`✔  ${filename} decrypted successfully`);
    } catch (_error) {
      loadingIndicator.stop();

      console.error(
        `✘ Failed to decrypt ${filename}: Invalid password or corrupted file.`
      );
    }
  }
}
