import * as crypto from 'node:crypto';

import { VaultEvents } from '../core';
import { VaultFileParts } from '../types';
import { EventService } from './event.service';

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
    if (!fileContent || typeof fileContent !== 'string') {
      return false;
    }

    return fileContent.startsWith(this.HEADER);
  }

  /**
   * Encrypts a string payload with a password.
   * @param plainText The string data to encrypt.
   * @param password The password to use for encryption.
   * @returns A promise that resolves to be fully formatted, encrypted vault string.
   * @throws Error if plainText or password is empty or invalid.
   */
  public static async encrypt(
    plainText: string,
    password: string
  ): Promise<string> {
    if (typeof plainText !== 'string') {
      throw new Error('Plain text must be a string.');
    }

    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Password must be a non-empty string.');
    }

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
   * @param vaultFileContent The complete, packed content from an encrypted file.
   * @param password The password to use for decryption.
   * @param filename Optional context for event logging.
   * @returns A promise that resolves to the decrypted string payload.
   * @throws Error if vaultFileContent or password is invalid.
   */
  public static async decrypt(
    vaultFileContent: string,
    password: string,
    filename: string = 'unknown'
  ): Promise<string> {
    if (typeof vaultFileContent !== 'string' || vaultFileContent.length === 0) {
      throw new Error('Vault file content must be a non-empty string.');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Password must be a non-empty string.');
    }
    if (!this.isVaultFile(vaultFileContent)) {
      throw new Error('Invalid vault file format: missing VAULT; header.');
    }

    const { salt, iv, encryptedContent } = this.unpack(vaultFileContent);
    const key = await this.deriveKey(password, salt);

    try {
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      let decrypted = decipher.update(encryptedContent, 'hex', 'utf-8');

      decrypted += decipher.final('utf-8');

      return decrypted;
    } catch (error) {
      EventService.getInstance().emit(VaultEvents.AUTH_FAILED, {
        file: filename,
      });

      if (error instanceof Error) {
        throw new Error(`Decryption failed: ${error.message}`);
      }

      throw new Error('Decryption failed: Unknown error occurred.');
    }
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
   * @param salt The cryptographic salt.
   * @param iv The initialization vector.
   * @param encryptedContent The encrypted content.
   * @returns A single string with parts separated by newlines.
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
   * Unpacks the standard Vault file format into its constituent parts.
   * @param vaultFileContent The raw string content from a vault file.
   * @returns An object containing the salt, iv, and encrypted content.
   * @throws Error if the vault file format is invalid or corrupted.
   */
  private static unpack(vaultFileContent: string): VaultFileParts {
    const lines = vaultFileContent.split('\n');

    if (lines.length < 4) {
      throw new Error('Invalid vault file format: insufficient data.');
    }

    if (lines[0] !== this.HEADER) {
      throw new Error(
        'Invalid vault file format: missing or incorrect header.'
      );
    }

    if (!lines[1] || !/^[0-9a-fA-F]+$/.test(lines[1])) {
      throw new Error('Invalid vault file format: corrupted salt data.');
    }

    if (!lines[2] || !/^[0-9a-fA-F]+$/.test(lines[2])) {
      throw new Error('Invalid vault file format: corrupted IV data.');
    }

    if (!lines[3] || !/^[0-9a-fA-F]+$/.test(lines[3])) {
      throw new Error(
        'Invalid vault file format: corrupted encrypted content.'
      );
    }

    const salt = Buffer.from(lines[1], 'hex');
    const iv = Buffer.from(lines[2], 'hex');

    if (salt.length !== this.SALT_SIZE) {
      throw new Error(
        `Invalid vault file format: salt must be ${this.SALT_SIZE} bytes.`
      );
    }

    if (iv.length !== this.IV_LENGTH) {
      throw new Error(
        `Invalid vault file format: IV must be ${this.IV_LENGTH} bytes.`
      );
    }

    return {
      salt,
      iv,
      encryptedContent: lines[3],
    };
  }
}
