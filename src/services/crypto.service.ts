import * as crypto from 'node:crypto';

import { VaultFileParts } from '../core';

export class CryptoService {
  private static readonly SALT_SIZE = 32;
  private static readonly ITERATIONS = 10000;
  private static readonly KEY_LENGTH = 32;
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly DIGEST = 'sha256';
  private static readonly IV_LENGTH = 16;
  private static readonly HEADER = 'VAULT;';

  /**
   * Checks if a given string content starts with the Vault header.
   * @param fileContent The string content of the file.
   * @returns True if the content is identified as a Vault file, otherwise false.
   */
  public static isVaultFile(fileContent: string): boolean {
    return fileContent.startsWith(this.HEADER);
  }

  /**
   * Encrypts a string payload with a password.
   * @param plainText The string data to encypt.
   * @param password The password to use for encryption
   * @returns A promise that resolves to be fully formatted, encrypted vault string.
   */
  public static async encrypt(
    plainText: string,
    password: string
  ): Promise<string> {
    const salt = crypto.randomBytes(this.SALT_SIZE);
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = await this.deriveKey(password, salt);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    let encrypted = cipher.update(plainText, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    return this.pack(salt, iv, encrypted);
  }

  /**
   * Decrypts a Vault-formatted string with a password.
   * @param vaultFileContent The complete, packed content from an encry[ted file.
   * @param password The password to use for decryption.
   * @returns A promise that resolves to the decrypted string payload.
   */
  public static async decrypt(
    vaultFileContent: string,
    password: string
  ): Promise<string> {
    const { salt, iv, encryptedContent } = this.unpack(vaultFileContent);
    const key = await this.deriveKey(password, salt);

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);

    let decrypted = decipher.update(encryptedContent, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  }

  /**
   * Derives a cryptographic key from a password and salt using PBKDF2.
   * @param password The password to derive the key from.
   * @param salt The cryptographic salt.
   * @returns A promise that resolves to the derived key as a Buffer.
   */
  private static deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        this.ITERATIONS,
        this.KEY_LENGTH,
        this.DIGEST,
        (err, derivedKey) => {
          if (err) return reject(err);

          resolve(derivedKey);
        }
      );
    });
  }

  /**
   * Packs the crypto parts into the standard Vault file format.
   * @param salt
   * @param iv
   * @param encryptedContent
   * @returns A single string with parts seperated by newlines.
   */
  private static pack(
    salt: Buffer,
    iv: Buffer,
    encryptedContent: string
  ): string {
    return [
      this.HEADER,
      salt.toString('hex'),
      iv.toString('hex'),
      encryptedContent,
    ].join('\n');
  }

  /**
   * Unpacks the standard Vault file format into its consituent parts.
   * @param vaultFileContent The raw string content from a vault file.
   * @returns An object containing the salt, iv, and encrypted content.
   */
  private static unpack(vaultFileContent: string): VaultFileParts {
    const lines = vaultFileContent.split('\n');

    if (lines.length < 4 || lines[0] !== this.HEADER) {
      throw new Error('Invalid or corrupted vault file format.');
    }

    return {
      salt: Buffer.from(lines[1], 'hex'),
      iv: Buffer.from(lines[2], 'hex'),
      encryptedContent: lines[3],
    };
  }
}
