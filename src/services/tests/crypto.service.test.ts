/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';

import { CryptoService } from '../crypto.service';

describe('CryptoService', () => {
  const mockPassword = 'my-super-secret-password-!@#$';
  const mockPlainText = 'This is a secret message that needs to be encrypted.';

  describe('isVaultFile', () => {
    it('should return true for content with a valid vault header', () => {
      const validContent =
        'VAULT;\nasdf1234salt\nasdf1234iv\nasdf1234encrypted';
      expect(CryptoService.isVaultFile(validContent)).toBe(true);
    });

    it('should return false for content without a vault header', () => {
      const invalidContent = 'Just some regular text file content.';
      expect(CryptoService.isVaultFile(invalidContent)).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(CryptoService.isVaultFile('')).toBe(false);
    });

    it('should return false for null or undefined input', () => {
      expect(CryptoService.isVaultFile(null as any)).toBe(false);
      expect(CryptoService.isVaultFile(undefined as any)).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(CryptoService.isVaultFile(123 as any)).toBe(false);
      expect(CryptoService.isVaultFile({} as any)).toBe(false);
      expect(CryptoService.isVaultFile([] as any)).toBe(false);
    });

    it('should return true for content starting with VAULT; even with extra content', () => {
      const content = 'VAULT;extra content here';
      expect(CryptoService.isVaultFile(content)).toBe(true);
    });

    it('should return false for content with VAULT; not at the start', () => {
      const content = 'some text VAULT;';
      expect(CryptoService.isVaultFile(content)).toBe(false);
    });

    it('should return false for case-sensitive header variations', () => {
      expect(CryptoService.isVaultFile('vault;')).toBe(false);
      expect(CryptoService.isVaultFile('Vault;')).toBe(false);
      expect(CryptoService.isVaultFile('VAULT:')).toBe(false);
    });
  });

  describe('encrypt', () => {
    it('should encrypt plain text and return a properly formatted vault string', async () => {
      const encrypted = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );

      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT;')).toBe(true);

      const lines = encrypted.split('\n');
      expect(lines).toHaveLength(4);
      expect(lines[0]).toBe('VAULT;');
      expect(lines[1]).toMatch(/^[0-9a-f]+$/);
      expect(lines[2]).toMatch(/^[0-9a-f]+$/);
      expect(lines[3]).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce different encrypted outputs for the same input (due to random salt/iv)', async () => {
      const encrypted1 = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );
      const encrypted2 = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should encrypt empty string', async () => {
      const encrypted = await CryptoService.encrypt('', mockPassword);
      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT;')).toBe(true);
    });

    it('should encrypt very long text', async () => {
      const longText = 'a'.repeat(100000);
      const encrypted = await CryptoService.encrypt(longText, mockPassword);

      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT;')).toBe(true);
    });

    it('should encrypt text with special characters', async () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`\n\r\t';
      const encrypted = await CryptoService.encrypt(specialText, mockPassword);

      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT;')).toBe(true);
    });

    it('should encrypt text with unicode characters', async () => {
      const unicodeText = '你好世界 🌍 café résumé';
      const encrypted = await CryptoService.encrypt(unicodeText, mockPassword);

      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT;')).toBe(true);
    });

    it('should encrypt text with emojis', async () => {
      const emojiText = '😀😃😄😁🎉🎊🎈';
      const encrypted = await CryptoService.encrypt(emojiText, mockPassword);

      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT;')).toBe(true);
    });

    it('should encrypt with different passwords', async () => {
      const encrypted1 = await CryptoService.encrypt(
        mockPlainText,
        'password1'
      );
      const encrypted2 = await CryptoService.encrypt(
        mockPlainText,
        'password2'
      );

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for empty password', async () => {
      await expect(CryptoService.encrypt(mockPlainText, '')).rejects.toThrow(
        'Password must be a non-empty string'
      );
    });

    it('should throw error for non-string password', async () => {
      await expect(
        CryptoService.encrypt(mockPlainText, null as any)
      ).rejects.toThrow('Password must be a non-empty string');

      await expect(
        CryptoService.encrypt(mockPlainText, undefined as any)
      ).rejects.toThrow('Password must be a non-empty string');

      await expect(
        CryptoService.encrypt(mockPlainText, 123 as any)
      ).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error for non-string plaintext', async () => {
      await expect(
        CryptoService.encrypt(null as any, mockPassword)
      ).rejects.toThrow('Plain text must be a string');

      await expect(
        CryptoService.encrypt(undefined as any, mockPassword)
      ).rejects.toThrow('Plain text must be a string');

      await expect(
        CryptoService.encrypt(123 as any, mockPassword)
      ).rejects.toThrow('Plain text must be a string');
    });

    it('should accept password with special characters', async () => {
      const complexPassword = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const encrypted = await CryptoService.encrypt(
        mockPlainText,
        complexPassword
      );

      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT;')).toBe(true);
    });

    it('should encrypt multiline text correctly', async () => {
      const multilineText = 'Line 1\nLine 2\nLine 3\rLine 4\r\nLine 5';
      const encrypted = await CryptoService.encrypt(
        multilineText,
        mockPassword
      );

      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT;')).toBe(true);
    });
  });

  describe('decrypt', () => {
    it('should decrypt previously encrypted data with correct password', async () => {
      const encrypted = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );
      const decrypted = await CryptoService.decrypt(encrypted, mockPassword);

      expect(decrypted).toBe(mockPlainText);
    });

    it('should throw error when decrypting with wrong password', async () => {
      const encrypted = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );

      await expect(
        CryptoService.decrypt(encrypted, 'wrong-password')
      ).rejects.toThrow('Decryption failed');
    });

    it('should throw error for empty vault content', async () => {
      await expect(CryptoService.decrypt('', mockPassword)).rejects.toThrow(
        'Vault file content must be a non-empty string'
      );
    });

    it('should throw error for non-string vault content', async () => {
      await expect(
        CryptoService.decrypt(null as any, mockPassword)
      ).rejects.toThrow('Vault file content must be a non-empty string');

      await expect(
        CryptoService.decrypt(undefined as any, mockPassword)
      ).rejects.toThrow('Vault file content must be a non-empty string');
    });

    it('should throw error for empty password', async () => {
      const encrypted = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );

      await expect(CryptoService.decrypt(encrypted, '')).rejects.toThrow(
        'Password must be a non-empty string'
      );
    });

    it('should throw error for invalid vault header', async () => {
      const invalidContent = 'INVALID;\nsalt\niv\ncontent';

      await expect(
        CryptoService.decrypt(invalidContent, mockPassword)
      ).rejects.toThrow('Invalid vault file format: missing VAULT; header');
    });

    it('should throw error for missing header', async () => {
      const noHeader = 'salt\niv\ncontent';

      await expect(
        CryptoService.decrypt(noHeader, mockPassword)
      ).rejects.toThrow('Invalid vault file format: missing VAULT; header');
    });

    it('should throw error for insufficient data lines', async () => {
      const insufficientData = 'VAULT;\nsalt\niv';

      await expect(
        CryptoService.decrypt(insufficientData, mockPassword)
      ).rejects.toThrow('Invalid vault file format: insufficient data');
    });

    it('should throw error for corrupted salt data', async () => {
      const corruptedSalt =
        'VAULT;\ninvalid-hex!!!\n0123456789abcdef0123456789abcdef\nabcdef123456';

      await expect(
        CryptoService.decrypt(corruptedSalt, mockPassword)
      ).rejects.toThrow('Invalid vault file format: corrupted salt data');
    });

    it('should throw error for corrupted IV data', async () => {
      const corruptedIV =
        'VAULT;\n' +
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n' +
        'invalid-hex!!!\nabcdef123456';

      await expect(
        CryptoService.decrypt(corruptedIV, mockPassword)
      ).rejects.toThrow('Invalid vault file format: corrupted IV data');
    });

    it('should throw error for corrupted encrypted content', async () => {
      const corruptedContent =
        'VAULT;\n' +
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n' +
        '0123456789abcdef0123456789abcdef\n' +
        'invalid-hex!!!';

      await expect(
        CryptoService.decrypt(corruptedContent, mockPassword)
      ).rejects.toThrow(
        'Invalid vault file format: corrupted encrypted content'
      );
    });

    it('should throw error for wrong salt size', async () => {
      const wrongSaltSize =
        'VAULT;\n' +
        '0123456789abcdef\n' +
        '0123456789abcdef0123456789abcdef\n' +
        'abcdef123456';

      await expect(
        CryptoService.decrypt(wrongSaltSize, mockPassword)
      ).rejects.toThrow('Invalid vault file format: salt must be 32 bytes');
    });

    it('should throw error for wrong IV size', async () => {
      const wrongIVSize =
        'VAULT;\n' +
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n' +
        '0123456789abcdef\n' +
        'abcdef123456';

      await expect(
        CryptoService.decrypt(wrongIVSize, mockPassword)
      ).rejects.toThrow('Invalid vault file format: IV must be 16 bytes');
    });

    it('should throw error for empty salt field', async () => {
      const emptySalt =
        'VAULT;\n\n0123456789abcdef0123456789abcdef\nabcdef123456';

      await expect(
        CryptoService.decrypt(emptySalt, mockPassword)
      ).rejects.toThrow('Invalid vault file format: corrupted salt data');
    });

    it('should throw error for empty IV field', async () => {
      const emptyIV =
        'VAULT;\n' +
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n\nabcdef123456';

      await expect(
        CryptoService.decrypt(emptyIV, mockPassword)
      ).rejects.toThrow('Invalid vault file format: corrupted IV data');
    });

    it('should throw error for empty encrypted content field', async () => {
      const emptyContent =
        'VAULT;\n' +
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n' +
        '0123456789abcdef0123456789abcdef\n';

      await expect(
        CryptoService.decrypt(emptyContent, mockPassword)
      ).rejects.toThrow(
        'Invalid vault file format: corrupted encrypted content'
      );
    });
  });

  describe('Encryption and Decryption Round Trip', () => {
    it('should encrypt and then decrypt data successfully with the correct password', async () => {
      const encryptedData = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );

      expect(encryptedData).toBeTypeOf('string');
      expect(encryptedData.startsWith('VAULT;')).toBe(true);
      expect(encryptedData.split('\n')).toHaveLength(4);

      const decryptedData = await CryptoService.decrypt(
        encryptedData,
        mockPassword
      );

      expect(decryptedData).toBe(mockPlainText);
    });

    it('should handle round trip with empty string', async () => {
      const encrypted = await CryptoService.encrypt('', mockPassword);
      const decrypted = await CryptoService.decrypt(encrypted, mockPassword);

      expect(decrypted).toBe('');
    });

    it('should handle round trip with special characters', async () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const encrypted = await CryptoService.encrypt(specialText, mockPassword);
      const decrypted = await CryptoService.decrypt(encrypted, mockPassword);

      expect(decrypted).toBe(specialText);
    });

    it('should handle round trip with unicode characters', async () => {
      const unicodeText = '你好世界 🌍 café résumé';
      const encrypted = await CryptoService.encrypt(unicodeText, mockPassword);
      const decrypted = await CryptoService.decrypt(encrypted, mockPassword);

      expect(decrypted).toBe(unicodeText);
    });

    it('should handle round trip with multiline text', async () => {
      const multilineText = 'Line 1\nLine 2\nLine 3\rLine 4\r\nLine 5';
      const encrypted = await CryptoService.encrypt(
        multilineText,
        mockPassword
      );
      const decrypted = await CryptoService.decrypt(encrypted, mockPassword);

      expect(decrypted).toBe(multilineText);
    });

    it('should handle round trip with very long text', async () => {
      const longText = 'a'.repeat(50000);
      const encrypted = await CryptoService.encrypt(longText, mockPassword);
      const decrypted = await CryptoService.decrypt(encrypted, mockPassword);

      expect(decrypted).toBe(longText);
    });

    it('should handle round trip with JSON data', async () => {
      const jsonData = JSON.stringify({
        name: 'Test User',
        age: 30,
        email: 'test@example.com',
        tags: ['admin', 'user'],
      });

      const encrypted = await CryptoService.encrypt(jsonData, mockPassword);
      const decrypted = await CryptoService.decrypt(encrypted, mockPassword);

      expect(decrypted).toBe(jsonData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });

    it('should produce different ciphertext for same plaintext with same password', async () => {
      const encrypted1 = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );
      const encrypted2 = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );

      expect(encrypted1).not.toBe(encrypted2);

      const decrypted1 = await CryptoService.decrypt(encrypted1, mockPassword);
      const decrypted2 = await CryptoService.decrypt(encrypted2, mockPassword);

      expect(decrypted1).toBe(mockPlainText);
      expect(decrypted2).toBe(mockPlainText);
    });

    it('should throw an error when trying to decrypt with an incorrect password', async () => {
      const wrongPassword = 'this-is-the-wrong-password';
      const encryptedData = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );

      await expect(
        CryptoService.decrypt(encryptedData, wrongPassword)
      ).rejects.toThrow();
    });

    it('should throw an error when trying to decrypt corrupted or invalid data', async () => {
      const corruptedData =
        'VAULT;\ninvalid-hex-salt\ninvalid-hex-iv\ninvalid-content';

      await expect(
        CryptoService.decrypt(corruptedData, mockPassword)
      ).rejects.toThrow(/Invalid vault file format|corrupted/);
    });
  });

  describe('Edge cases and security', () => {
    it('should handle password with spaces', async () => {
      const passwordWithSpaces = '  password with spaces  ';
      const encrypted = await CryptoService.encrypt(
        mockPlainText,
        passwordWithSpaces
      );
      const decrypted = await CryptoService.decrypt(
        encrypted,
        passwordWithSpaces
      );

      expect(decrypted).toBe(mockPlainText);
    });

    it('should not decrypt with trimmed password if original had spaces', async () => {
      const passwordWithSpaces = '  password  ';
      const encrypted = await CryptoService.encrypt(
        mockPlainText,
        passwordWithSpaces
      );

      await expect(
        CryptoService.decrypt(encrypted, 'password')
      ).rejects.toThrow();
    });

    it('should handle very short password', async () => {
      const shortPassword = 'a';
      const encrypted = await CryptoService.encrypt(
        mockPlainText,
        shortPassword
      );
      const decrypted = await CryptoService.decrypt(encrypted, shortPassword);

      expect(decrypted).toBe(mockPlainText);
    });

    it('should handle very long password', async () => {
      const longPassword = 'a'.repeat(1000);
      const encrypted = await CryptoService.encrypt(
        mockPlainText,
        longPassword
      );
      const decrypted = await CryptoService.decrypt(encrypted, longPassword);

      expect(decrypted).toBe(mockPlainText);
    });

    it('should treat passwords as case-sensitive', async () => {
      const password1 = 'Password123';
      const password2 = 'password123';

      const encrypted = await CryptoService.encrypt(mockPlainText, password1);

      await expect(
        CryptoService.decrypt(encrypted, password2)
      ).rejects.toThrow();
    });

    it('should detect tampering with encrypted content', async () => {
      const encrypted = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );
      const lines = encrypted.split('\n');

      const tamperedContent = lines[3].slice(0, -2) + '00';
      const tampered = [lines[0], lines[1], lines[2], tamperedContent].join(
        '\n'
      );

      await expect(
        CryptoService.decrypt(tampered, mockPassword)
      ).rejects.toThrow();
    });

    it('should handle vault file with extra newlines at the end', async () => {
      const encrypted = await CryptoService.encrypt(
        mockPlainText,
        mockPassword
      );
      const lines = encrypted.split('\n');

      const withExtraNewlines = encrypted + '\n\n\n';
      const decrypted = await CryptoService.decrypt(
        withExtraNewlines,
        mockPassword
      );

      expect(decrypted).toBe(mockPlainText);
    });
  });
});
