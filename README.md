Create a similar vault like ansible-vault.

- Ansible-vault uses AES-256 encryption in CBC mode with a PBKDF2 key derivation.

### How it Works?

1. **Encryption**:
   - Genreate a random salt
   - Use PBKDF2 to derive an encryption key from the password and salt
   - Genereate a random IV (initialization vector)
   - Encrypt file(data) using AES-256-CBC
2. **Decryption**:
   - Extracts salt, IV and encrypted data
   - Get the key, using the same process
   - Decrypt using AES-256-CBC
