/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';

import { MultiKeyCryptoService } from '../multi-key-crypto.service';

describe('MultiKeyCryptoService', () => {
  const mockPassword1 = 'password-one-super-secret';
  const mockPassword2 = 'password-two-also-secret';
  const mockPassword3 = 'password-three-very-secure';
  const mockPlainText = 'This is a secret message for multi-key encryption.';

  describe('isVaultFileV2', () => {
    it('should return true for content with a valid vault V2 header', () => {
      const validContent = 'VAULT-V2;\n{"version":2}\n[]';
      expect(MultiKeyCryptoService.isVaultFileV2(validContent)).toBe(true);
    });

    it('should return false for content with V1 header', () => {
      const v1Content = 'VAULT;\nsalt\niv\ncontent';
      expect(MultiKeyCryptoService.isVaultFileV2(v1Content)).toBe(false);
    });

    it('should return false for content without a vault header', () => {
      const invalidContent = 'Just some regular text file content.';
      expect(MultiKeyCryptoService.isVaultFileV2(invalidContent)).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(MultiKeyCryptoService.isVaultFileV2('')).toBe(false);
    });

    it('should return false for null or undefined input', () => {
      expect(MultiKeyCryptoService.isVaultFileV2(null as any)).toBe(false);
      expect(MultiKeyCryptoService.isVaultFileV2(undefined as any)).toBe(false);
    });
  });

  describe('encrypt', () => {
    it('should encrypt plain text with a single password', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);

      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT-V2;')).toBe(true);

      const lines = encrypted.split('\n');
      expect(lines).toHaveLength(6);
      expect(lines[0]).toBe('VAULT-V2;');
    });

    it('should encrypt plain text with multiple passwords', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
        mockPassword2,
        mockPassword3,
      ]);

      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT-V2;')).toBe(true);

      // Verify all three passwords can decrypt
      const decrypted1 = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword1
      );
      const decrypted2 = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword2
      );
      const decrypted3 = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword3
      );

      expect(decrypted1).toBe(mockPlainText);
      expect(decrypted2).toBe(mockPlainText);
      expect(decrypted3).toBe(mockPlainText);
    });

    it('should encrypt with labels for passwords', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(
        mockPlainText,
        [mockPassword1, mockPassword2],
        ['Alice', 'Bob']
      );

      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT-V2;')).toBe(true);

      const keySlots = MultiKeyCryptoService.listKeys(encrypted);
      expect(keySlots).toHaveLength(2);
      expect(keySlots[0].label).toBe('Alice');
      expect(keySlots[1].label).toBe('Bob');
    });

    it('should produce different encrypted outputs for the same input', async () => {
      const encrypted1 = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);
      const encrypted2 = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for empty password array', async () => {
      await expect(
        MultiKeyCryptoService.encrypt(mockPlainText, [])
      ).rejects.toThrow('At least one password is required');
    });

    it('should throw error for non-array passwords', async () => {
      await expect(
        MultiKeyCryptoService.encrypt(mockPlainText, 'not-an-array' as any)
      ).rejects.toThrow('At least one password is required');
    });

    it('should throw error for empty password in array', async () => {
      await expect(
        MultiKeyCryptoService.encrypt(mockPlainText, [mockPassword1, ''])
      ).rejects.toThrow('All passwords must be non-empty strings');
    });

    it('should throw error for non-string plaintext', async () => {
      await expect(
        MultiKeyCryptoService.encrypt(null as any, [mockPassword1])
      ).rejects.toThrow('Plain text must be a string');
    });

    it('should encrypt empty string', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt('', [
        mockPassword1,
      ]);
      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.startsWith('VAULT-V2;')).toBe(true);

      const decrypted = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword1
      );
      expect(decrypted).toBe('');
    });

    it('should encrypt unicode and emoji text', async () => {
      const unicodeText = '你好世界 🌍 café résumé 😀';
      const encrypted = await MultiKeyCryptoService.encrypt(unicodeText, [
        mockPassword1,
      ]);

      const decrypted = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword1
      );
      expect(decrypted).toBe(unicodeText);
    });
  });

  describe('decrypt', () => {
    it('should decrypt with correct password', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);
      const decrypted = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword1
      );

      expect(decrypted).toBe(mockPlainText);
    });

    it('should decrypt with any valid password from multiple key slots', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
        mockPassword2,
        mockPassword3,
      ]);

      const decrypted1 = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword1
      );
      const decrypted2 = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword2
      );
      const decrypted3 = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword3
      );

      expect(decrypted1).toBe(mockPlainText);
      expect(decrypted2).toBe(mockPlainText);
      expect(decrypted3).toBe(mockPlainText);
    });

    it('should throw error when decrypting with wrong password', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);

      await expect(
        MultiKeyCryptoService.decrypt(encrypted, 'wrong-password')
      ).rejects.toThrow('Password does not match any key slot');
    });

    it('should throw error for invalid vault header', async () => {
      const invalidContent = 'INVALID;\nmetadata\nkeyslots';

      await expect(
        MultiKeyCryptoService.decrypt(invalidContent, mockPassword1)
      ).rejects.toThrow('Invalid vault file format: missing VAULT-V2; header');
    });

    it('should throw error for empty vault content', async () => {
      await expect(
        MultiKeyCryptoService.decrypt('', mockPassword1)
      ).rejects.toThrow('Vault file content must be a non-empty string');
    });

    it('should throw error for corrupted metadata', async () => {
      const corrupted = 'VAULT-V2;\n{invalid json}\n[]\niv\ntag\ncontent';

      await expect(
        MultiKeyCryptoService.decrypt(corrupted, mockPassword1)
      ).rejects.toThrow('Invalid vault file format: corrupted metadata');
    });

    it('should throw error for corrupted key slots', async () => {
      const corrupted =
        'VAULT-V2;\n{"version":2}\n{invalid json}\niv\ntag\ncontent';

      await expect(
        MultiKeyCryptoService.decrypt(corrupted, mockPassword1)
      ).rejects.toThrow('Invalid vault file format: corrupted key slots');
    });
  });

  describe('addKey', () => {
    it('should add a new key slot to existing encrypted file', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);

      const updated = await MultiKeyCryptoService.addKey(
        encrypted,
        mockPassword1,
        mockPassword2
      );

      // Both passwords should now work
      const decrypted1 = await MultiKeyCryptoService.decrypt(
        updated,
        mockPassword1
      );
      const decrypted2 = await MultiKeyCryptoService.decrypt(
        updated,
        mockPassword2
      );

      expect(decrypted1).toBe(mockPlainText);
      expect(decrypted2).toBe(mockPlainText);

      const keySlots = MultiKeyCryptoService.listKeys(updated);
      expect(keySlots).toHaveLength(2);
    });

    it('should add key with label', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);

      const updated = await MultiKeyCryptoService.addKey(
        encrypted,
        mockPassword1,
        mockPassword2,
        'Bob'
      );

      const keySlots = MultiKeyCryptoService.listKeys(updated);
      expect(keySlots).toHaveLength(2);
      expect(keySlots[1].label).toBe('Bob');
    });

    it('should throw error when existing password is wrong', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);

      await expect(
        MultiKeyCryptoService.addKey(encrypted, 'wrong-password', mockPassword2)
      ).rejects.toThrow();
    });

    it('should allow adding multiple keys sequentially', async () => {
      let encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);

      encrypted = await MultiKeyCryptoService.addKey(
        encrypted,
        mockPassword1,
        mockPassword2
      );

      encrypted = await MultiKeyCryptoService.addKey(
        encrypted,
        mockPassword2,
        mockPassword3
      );

      // All three passwords should work
      const decrypted1 = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword1
      );
      const decrypted2 = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword2
      );
      const decrypted3 = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword3
      );

      expect(decrypted1).toBe(mockPlainText);
      expect(decrypted2).toBe(mockPlainText);
      expect(decrypted3).toBe(mockPlainText);

      const keySlots = MultiKeyCryptoService.listKeys(encrypted);
      expect(keySlots).toHaveLength(3);
    });
  });

  describe('removeKey', () => {
    it('should remove a key slot from encrypted file', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
        mockPassword2,
      ]);

      const keySlots = MultiKeyCryptoService.listKeys(encrypted);
      const keySlotToRemove = keySlots[0].id;

      const updated = await MultiKeyCryptoService.removeKey(
        encrypted,
        mockPassword2,
        keySlotToRemove
      );

      // First password should no longer work
      await expect(
        MultiKeyCryptoService.decrypt(updated, mockPassword1)
      ).rejects.toThrow();

      // Second password should still work
      const decrypted = await MultiKeyCryptoService.decrypt(
        updated,
        mockPassword2
      );
      expect(decrypted).toBe(mockPlainText);

      const updatedKeySlots = MultiKeyCryptoService.listKeys(updated);
      expect(updatedKeySlots).toHaveLength(1);
    });

    it('should throw error when trying to remove last key slot', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);

      const keySlots = MultiKeyCryptoService.listKeys(encrypted);

      await expect(
        MultiKeyCryptoService.removeKey(
          encrypted,
          mockPassword1,
          keySlots[0].id
        )
      ).rejects.toThrow('Cannot remove the last key slot');
    });

    it('should throw error when key slot ID not found', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
        mockPassword2,
      ]);

      await expect(
        MultiKeyCryptoService.removeKey(
          encrypted,
          mockPassword1,
          'non-existent-id'
        )
      ).rejects.toThrow('Key slot with ID non-existent-id not found');
    });

    it('should throw error when auth password is wrong', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
        mockPassword2,
      ]);

      const keySlots = MultiKeyCryptoService.listKeys(encrypted);

      await expect(
        MultiKeyCryptoService.removeKey(
          encrypted,
          'wrong-password',
          keySlots[0].id
        )
      ).rejects.toThrow();
    });
  });

  describe('listKeys', () => {
    it('should list all key slots with metadata', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(
        mockPlainText,
        [mockPassword1, mockPassword2],
        ['Alice', 'Bob']
      );

      const keySlots = MultiKeyCryptoService.listKeys(encrypted);

      expect(keySlots).toHaveLength(2);
      expect(keySlots[0]).toHaveProperty('id');
      expect(keySlots[0]).toHaveProperty('algorithm');
      expect(keySlots[0]).toHaveProperty('createdAt');
      expect(keySlots[0].label).toBe('Alice');
      expect(keySlots[1].label).toBe('Bob');
    });

    it('should not expose sensitive data', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);

      const keySlots = MultiKeyCryptoService.listKeys(encrypted);

      expect(keySlots[0]).not.toHaveProperty('salt');
      expect(keySlots[0]).not.toHaveProperty('encryptedDEK');
      expect(keySlots[0]).not.toHaveProperty('iv');
    });

    it('should handle files without labels', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
        mockPassword2,
      ]);

      const keySlots = MultiKeyCryptoService.listKeys(encrypted);

      expect(keySlots).toHaveLength(2);
      expect(keySlots[0].label).toBeUndefined();
      expect(keySlots[1].label).toBeUndefined();
    });
  });

  describe('Round trip tests', () => {
    it('should handle complete encryption and decryption cycle', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);
      const decrypted = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword1
      );

      expect(decrypted).toBe(mockPlainText);
    });

    it('should handle JSON data', async () => {
      const jsonData = JSON.stringify({
        name: 'Test User',
        secrets: ['api-key-123', 'token-456'],
        nested: { value: 'secret' },
      });

      const encrypted = await MultiKeyCryptoService.encrypt(jsonData, [
        mockPassword1,
      ]);
      const decrypted = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword1
      );

      expect(decrypted).toBe(jsonData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });

    it('should handle multiline text', async () => {
      const multilineText = 'Line 1\nLine 2\nLine 3\r\nLine 4';
      const encrypted = await MultiKeyCryptoService.encrypt(multilineText, [
        mockPassword1,
      ]);
      const decrypted = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword1
      );

      expect(decrypted).toBe(multilineText);
    });

    it('should handle very long text', async () => {
      const longText = 'a'.repeat(100000);
      const encrypted = await MultiKeyCryptoService.encrypt(longText, [
        mockPassword1,
      ]);
      const decrypted = await MultiKeyCryptoService.decrypt(
        encrypted,
        mockPassword1
      );

      expect(decrypted).toBe(longText);
    });
  });

  describe('Security tests', () => {
    it('should treat passwords as case-sensitive', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        'Password123',
      ]);

      await expect(
        MultiKeyCryptoService.decrypt(encrypted, 'password123')
      ).rejects.toThrow();
    });

    it('should not decrypt with trimmed password if original had spaces', async () => {
      const passwordWithSpaces = '  password  ';
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        passwordWithSpaces,
      ]);

      await expect(
        MultiKeyCryptoService.decrypt(encrypted, 'password')
      ).rejects.toThrow();
    });

    it('should handle password with special characters', async () => {
      const complexPassword = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:\'",./<>?~`';
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        complexPassword,
      ]);
      const decrypted = await MultiKeyCryptoService.decrypt(
        encrypted,
        complexPassword
      );

      expect(decrypted).toBe(mockPlainText);
    });

    it('should detect tampering with encrypted content', async () => {
      const encrypted = await MultiKeyCryptoService.encrypt(mockPlainText, [
        mockPassword1,
      ]);
      const lines = encrypted.split('\n');

      // Tamper with encrypted content
      const tamperedContent = lines[5].slice(0, -2) + '00';
      const tampered = lines.slice(0, 5).concat(tamperedContent).join('\n');

      await expect(
        MultiKeyCryptoService.decrypt(tampered, mockPassword1)
      ).rejects.toThrow();
    });
  });
});
