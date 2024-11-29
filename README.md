# VAULT CLI

Vault is secure, command-line file encryption tool that helps you protect sensitive files with string AES-256-CBC encryption.

### Features

-   **Robust Encryption**: Use AES-256-CBC encryption with PBKDF2 key derivation
-   **File Operations**:
    -   Encrypt file
    -   Decrypt file
    -   View Encrypted file contents
    -   Edit Encrypted file directly
    -   **Version Management**:
        -   View version history of a file
        -   Restore a file to a specific version
-   **Cross Platform**: Works on Linux, macOS, and Windows
-   **Secure Password Handling**: Masked password input with advanced terminal control

### Installation

##### Build from Source

1. Clone the repository

```bash
git clone https://github.com/bad-Al-code/SecureVault.git
cd SecureVault
```

2. Install dependencies

```bash
npm install
```

3. Build the project

```bash
npm run build
```

4. Make the script executable

```bash
chmod +x ./main.js
```

### Usage

##### Basic Commands

```bash
# Encrypt a file
vault encrypt secrets.txt

# Decrypt a file
vault decrypt secrets.txt

# View encrypted file contents
vault view secrets.txt

# Edit an encrypted file (opens in your default editor)
vault edit secrets.txt

# Encrypt multiple files at once
vault encrypt secrets.txt test.json

# Decrypt multiple files at once
vault decrypt secrets.txt test.json

```

> NOTE: For windows, use `vault.exe <command name>`

##### Version Management

```bash
# View version history of a file
vault history secrets.txt

#NOTE: for versionID: look at the ./.vault_history/version_log.json
# Restore a file to a specific version
vault restore secrets.txt <versionID>
```

##### Help

```bash
vault help
```

##### Download Prebuilt Binaries

Download the appropriate binary for your operating system from the Releases page:

-   Linux: `vault`
-   macOS: `vault`
-   Windows: `vault.exe`

### Security Details

-   **Encryption Method**: AES-256-CBC
-   **Key Derivation**: PBKDF2 with 10,000 iterations
-   **Salt Size**: 32 bytes
-   **Initialization Vector**: 16 bytes

### Requirements

-   Node.js 18+

### Disclaimer

Always maintain backups of your important files. While Vault provides strong encryption, no system is 100% infallible.
