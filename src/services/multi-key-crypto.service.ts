import * as crypto from 'node:crypto';

import { KeySlot, VaultV2FileParts, VaultV2Metadata } from '../core';

export class MultiKeyCryptoService {
  private static readonly DEK_SIZE = 32; // 256 bits for AES-256
  private static readonly SALT_SIZE = 32;
  private static readonly ITERATIONS = 10000;
  private static readonly KEY_LENGTH = 32;
  private static readonly ALGORITHM_DEK = 'aes-256-gcm';
  private static readonly ALGORITHM_KEK = 'aes-256-cbc';
  private static readonly DIGEST = 'sha256';
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;
  private static readonly HEADER = 'VAULT-V2;';

  /**
   * Checks if a given string content starts with the Vault V2 header.
   * @param fileContent The string content of the file.
   * @returns True if the content is identified as a Vault V2 file, otherwise false.
   */
  public static isVaultFileV2(fileContent: string): boolean {
    if (!fileContent || typeof fileContent !== 'string') {
      return false;
    }

    return fileContent.startsWith(this.HEADER);
  }

  /**
   * Encrypts a string payload with multiple passwords using envelope encryption.
   * @param plainText The string data to encrypt.
   * @param passwords Array of passwords to use for encryption (at least one required).
   * @param labels Optional labels for each password.
   * @returns A promise that resolves to a fully formatted, encrypted vault V2 string.
   * @throws Error if plainText or passwords are invalid.
   */
  public static async encrypt(
    plainText: string,
    passwords: string[],
    labels?: string[]
  ): Promise<string> {
    if (typeof plainText !== 'string') {
      throw new Error('Plain text must be a string.');
    }

    if (!Array.isArray(passwords) || passwords.length === 0) {
      throw new Error('At least one password is required.');
    }

    for (const password of passwords) {
      if (typeof password !== 'string' || password.length === 0) {
        throw new Error('All passwords must be non-empty strings.');
      }
    }

    // Generate random Data Encryption Key (DEK)
    const dek = crypto.randomBytes(this.DEK_SIZE);

    // Encrypt the plaintext with the DEK using AES-256-GCM
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM_DEK, dek, iv);

    let encrypted = cipher.update(plainText, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Create key slots by encrypting the DEK with each password
    const keySlots: KeySlot[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < passwords.length; i++) {
      const password = passwords[i];
      const label = labels && labels[i] ? labels[i] : undefined;

      const salt = crypto.randomBytes(this.SALT_SIZE);
      const kekIv = crypto.randomBytes(this.IV_LENGTH);
      const kek = await this.deriveKey(password, salt);

      // Encrypt DEK with KEK
      const kekCipher = crypto.createCipheriv(this.ALGORITHM_KEK, kek, kekIv);
      let encryptedDEK = kekCipher.update(dek);
      encryptedDEK = Buffer.concat([encryptedDEK, kekCipher.final()]);

      keySlots.push({
        id: crypto.randomUUID(),
        algorithm: 'PBKDF2-SHA256',
        iterations: this.ITERATIONS,
        salt,
        encryptedDEK,
        iv: kekIv,
        createdAt: now,
        label,
      });
    }

    // Create metadata
    const metadata: VaultV2Metadata = {
      version: 2,
      algorithm: this.ALGORITHM_DEK.toUpperCase(),
      createdAt: now,
      modifiedAt: now,
    };

    return this.pack(metadata, keySlots, iv, authTag, encrypted);
  }

  /**
   * Decrypts a Vault V2 formatted string with one of the passwords.
   * @param vaultFileContent The complete, packed content from an encrypted file.
   * @param password The password to use for decryption.
   * @returns A promise that resolves to the decrypted string payload.
   * @throws Error if vaultFileContent or password is invalid, or decryption fails.
   */
  public static async decrypt(
    vaultFileContent: string,
    password: string
  ): Promise<string> {
    if (typeof vaultFileContent !== 'string' || vaultFileContent.length === 0) {
      throw new Error('Vault file content must be a non-empty string.');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Password must be a non-empty string.');
    }
    if (!this.isVaultFileV2(vaultFileContent)) {
      throw new Error('Invalid vault file format: missing VAULT-V2; header.');
    }

    const { keySlots, iv, authTag, encryptedContent } =
      this.unpack(vaultFileContent);

    // Try each key slot until one works
    let dek: Buffer | null = null;

    for (const keySlot of keySlots) {
      try {
        const kek = await this.deriveKey(password, keySlot.salt);
        const decipher = crypto.createDecipheriv(
          this.ALGORITHM_KEK,
          kek,
          keySlot.iv
        );

        let decryptedDEK = decipher.update(keySlot.encryptedDEK);
        decryptedDEK = Buffer.concat([decryptedDEK, decipher.final()]);

        dek = decryptedDEK;
        break; // Successfully decrypted DEK
      } catch {
        // This key slot doesn't match the password, try next one
        continue;
      }
    }

    if (!dek) {
      throw new Error(
        'Decryption failed: Password does not match any key slot.'
      );
    }

    // Decrypt the content with the DEK
    try {
      const decipher = crypto.createDecipheriv(this.ALGORITHM_DEK, dek, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedContent, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');

      return decrypted;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Decryption failed: ${error.message}`);
      }

      throw new Error('Decryption failed: Unknown error occurred.');
    }
  }

  /**
   * Adds a new key slot to an existing encrypted file.
   * @param vaultFileContent The current vault file content.
   * @param existingPassword A password that can decrypt the file.
   * @param newPassword The new password to add.
   * @param newLabel Optional label for the new key.
   * @returns A promise that resolves to the updated vault file content.
   */
  public static async addKey(
    vaultFileContent: string,
    existingPassword: string,
    newPassword: string,
    newLabel?: string
  ): Promise<string> {
    // Unpack to get existing structure
    const { metadata, keySlots, iv, authTag, encryptedContent } =
      this.unpack(vaultFileContent);

    // Derive DEK by trying each key slot with existing password
    let dek: Buffer | null = null;
    for (const keySlot of keySlots) {
      try {
        const kek = await this.deriveKey(existingPassword, keySlot.salt);
        const decipher = crypto.createDecipheriv(
          this.ALGORITHM_KEK,
          kek,
          keySlot.iv
        );

        let decryptedDEK = decipher.update(keySlot.encryptedDEK);
        decryptedDEK = Buffer.concat([decryptedDEK, decipher.final()]);

        dek = decryptedDEK;
        break;
      } catch {
        continue;
      }
    }

    if (!dek) {
      throw new Error('Failed to derive DEK with existing password.');
    }

    // Create new key slot for the new password
    const salt = crypto.randomBytes(this.SALT_SIZE);
    const kekIv = crypto.randomBytes(this.IV_LENGTH);
    const kek = await this.deriveKey(newPassword, salt);

    const kekCipher = crypto.createCipheriv(this.ALGORITHM_KEK, kek, kekIv);
    let encryptedDEK = kekCipher.update(dek);
    encryptedDEK = Buffer.concat([encryptedDEK, kekCipher.final()]);

    const newKeySlot: KeySlot = {
      id: crypto.randomUUID(),
      algorithm: 'PBKDF2-SHA256',
      iterations: this.ITERATIONS,
      salt,
      encryptedDEK,
      iv: kekIv,
      createdAt: new Date().toISOString(),
      label: newLabel,
    };

    // Add new key slot to existing ones
    const updatedKeySlots = [...keySlots, newKeySlot];

    // Update metadata
    const updatedMetadata: VaultV2Metadata = {
      ...metadata,
      modifiedAt: new Date().toISOString(),
    };

    return this.pack(
      updatedMetadata,
      updatedKeySlots,
      iv,
      authTag,
      encryptedContent
    );
  }

  /**
   * Removes a key slot from an existing encrypted file.
   * @param vaultFileContent The current vault file content.
   * @param authPassword A password that can decrypt the file (for authentication).
   * @param keySlotId The ID of the key slot to remove.
   * @returns A promise that resolves to the updated vault file content.
   */
  public static async removeKey(
    vaultFileContent: string,
    authPassword: string,
    keySlotId: string
  ): Promise<string> {
    // Verify password works
    await this.decrypt(vaultFileContent, authPassword);

    const { metadata, keySlots, iv, authTag, encryptedContent } =
      this.unpack(vaultFileContent);

    if (keySlots.length <= 1) {
      throw new Error(
        'Cannot remove the last key slot. At least one key must remain.'
      );
    }

    const updatedKeySlots = keySlots.filter((slot) => slot.id !== keySlotId);

    if (updatedKeySlots.length === keySlots.length) {
      throw new Error(`Key slot with ID ${keySlotId} not found.`);
    }

    const updatedMetadata: VaultV2Metadata = {
      ...metadata,
      modifiedAt: new Date().toISOString(),
    };

    return this.pack(
      updatedMetadata,
      updatedKeySlots,
      iv,
      authTag,
      encryptedContent
    );
  }

  /**
   * Lists all key slots in a vault file.
   * @param vaultFileContent The vault file content.
   * @returns Array of key slot information (without sensitive data).
   */
  public static listKeys(vaultFileContent: string): Array<{
    id: string;
    algorithm: string;
    createdAt: string;
    label?: string;
  }> {
    const { keySlots } = this.unpack(vaultFileContent);

    return keySlots.map((slot) => ({
      id: slot.id,
      algorithm: slot.algorithm,
      createdAt: slot.createdAt,
      label: slot.label,
    }));
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
   * Packs the crypto parts into the Vault V2 file format.
   * @param metadata The vault metadata.
   * @param keySlots The key slots.
   * @param iv The initialization vector for content encryption.
   * @param authTag The authentication tag from GCM.
   * @param encryptedContent The encrypted content.
   * @returns A single string with parts separated by newlines.
   */
  private static pack(
    metadata: VaultV2Metadata,
    keySlots: KeySlot[],
    iv: Buffer,
    authTag: Buffer,
    encryptedContent: string
  ): string {
    // Serialize metadata and key slots to JSON
    const metadataJson = JSON.stringify(metadata);

    // Convert key slots to serializable format
    const serializableKeySlots = keySlots.map((slot) => ({
      id: slot.id,
      algorithm: slot.algorithm,
      iterations: slot.iterations,
      salt: slot.salt.toString('hex'),
      encryptedDEK: slot.encryptedDEK.toString('hex'),
      iv: slot.iv.toString('hex'),
      createdAt: slot.createdAt,
      label: slot.label,
    }));

    const keySlotsJson = JSON.stringify(serializableKeySlots);

    return [
      this.HEADER,
      metadataJson,
      keySlotsJson,
      iv.toString('hex'),
      authTag.toString('hex'),
      encryptedContent,
    ].join('\n');
  }

  /**
   * Unpacks the Vault V2 file format into its constituent parts.
   * @param vaultFileContent The raw string content from a vault file.
   * @returns An object containing the metadata, key slots, iv, authTag, and encrypted content.
   * @throws Error if the vault file format is invalid or corrupted.
   */
  private static unpack(vaultFileContent: string): VaultV2FileParts {
    const lines = vaultFileContent.split('\n');

    if (lines.length < 6) {
      throw new Error('Invalid vault file format: insufficient data.');
    }

    if (lines[0] !== this.HEADER) {
      throw new Error(
        'Invalid vault file format: missing or incorrect header.'
      );
    }

    // Parse metadata
    let metadata: VaultV2Metadata;
    try {
      metadata = JSON.parse(lines[1]);
    } catch {
      throw new Error('Invalid vault file format: corrupted metadata.');
    }

    // Parse key slots
    let keySlots: KeySlot[];
    try {
      const serializedSlots = JSON.parse(lines[2]) as Array<{
        id: string;
        algorithm: string;
        iterations: number;
        salt: string;
        encryptedDEK: string;
        iv: string;
        createdAt: string;
        label?: string;
      }>;
      keySlots = serializedSlots.map((slot) => ({
        id: slot.id,
        algorithm: slot.algorithm,
        iterations: slot.iterations,
        salt: Buffer.from(slot.salt, 'hex'),
        encryptedDEK: Buffer.from(slot.encryptedDEK, 'hex'),
        iv: Buffer.from(slot.iv, 'hex'),
        createdAt: slot.createdAt,
        label: slot.label,
      }));
    } catch {
      throw new Error('Invalid vault file format: corrupted key slots.');
    }

    // Parse IV
    if (!lines[3] || !/^[0-9a-fA-F]+$/.test(lines[3])) {
      throw new Error('Invalid vault file format: corrupted IV data.');
    }
    const iv = Buffer.from(lines[3], 'hex');

    if (iv.length !== this.IV_LENGTH) {
      throw new Error(
        `Invalid vault file format: IV must be ${this.IV_LENGTH} bytes.`
      );
    }

    // Parse auth tag
    if (!lines[4] || !/^[0-9a-fA-F]+$/.test(lines[4])) {
      throw new Error('Invalid vault file format: corrupted auth tag data.');
    }
    const authTag = Buffer.from(lines[4], 'hex');

    if (authTag.length !== this.AUTH_TAG_LENGTH) {
      throw new Error(
        `Invalid vault file format: auth tag must be ${this.AUTH_TAG_LENGTH} bytes.`
      );
    }

    // Parse encrypted content (can be empty for empty plaintext)
    if (lines[5] === undefined) {
      throw new Error('Invalid vault file format: missing encrypted content.');
    }

    if (lines[5].length > 0 && !/^[0-9a-fA-F]+$/.test(lines[5])) {
      throw new Error(
        'Invalid vault file format: corrupted encrypted content.'
      );
    }

    return {
      metadata,
      keySlots,
      iv,
      authTag,
      encryptedContent: lines[5],
    };
  }
}
