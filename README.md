<div align="center">
  <h1>🛡️ SecureVault CLI 🛡️</h1>
  <p><strong>A modern, command-line tool for encrypting, editing, and versioning your sensitive files.</strong></p>
  <p>Think <code>ansible-vault</code> but with built-in, Git-like version history for every individual file.</p>
  
  <p>
    <a href="https://github.com/bad-Al-code/SecureVault/actions/workflows/ci.yml"><img src="https://github.com/bad-Al-code/SecureVault/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
    <a href="https://github.com/bad-Al-code/SecureVault/releases/latest"><img src="https://img.shields.io/github/v/release/bad-Al-code/SecureVault" alt="Latest Release"></a>
    <!-- <a href="https://github.com/bad-Al-code/SecureVault/blob/main/LICENSE"><img src="https://img.shields.io/github/license/bad-Al-code/SecureVault" alt="License"></a> -->
  </p>
</div>

<!-- TODO: Add a GIF demonstrating the 'edit', 'history', and 'compare' commands in action. -->

## Why SecureVault?

Managing secrets and sensitive configuration files can be cumbersome. You often have to choose between unencrypted files in private repos or manually encrypting/decrypting files with tools like GPG before every use. SecureVault streamlines this entire workflow.

- **✍️ Edit on the Fly:** Run `vault edit secrets.yml`, and the file is automatically decrypted into a temporary session, opened in your favorite editor (`$EDITOR`), and seamlessly re-encrypted on save. No more manual `decrypt -> edit -> encrypt` steps.
- **🔑 Multiple Passwords Per File:** Add multiple passwords to a single encrypted file using envelope encryption. Perfect for team collaboration - each member can use their own password to access the same file.
- **🔄 Key Rotation:** Change passwords without re-encrypting the entire file. Rotate keys instantly while maintaining access for other authorized users.
- **🕰️ Never Lose a Change:** Every time you encrypt or edit a file, SecureVault automatically creates a version snapshot. Made a mistake? You can instantly view the `history` and `restore` any previous version.
- **🎯 Simple and Secure:** Uses industry-standard AES-256-GCM for content encryption and AES-256-CBC with PBKDF2 for key encryption. It's strong, reliable, and requires no complex setup.

## ✨ Key Features

- 🔒 **Robust Encryption**: AES-256-GCM for content encryption with authenticated encryption and integrity protection.
- 🔑 **Multi-Key Support**: Add multiple passwords to a single file using envelope encryption. Each password can decrypt the file independently.
- ✏️ **Seamless Editing**: Automatically decrypts files for editing and re-encrypts on save.
- 🗂️ **Built-in Version Control**: Every change is saved as a new version. View history, restore, and compare versions of any file.
- 🔄 **Key Management**: Add, remove, rotate, and list passwords without re-encrypting the entire file.
- 📂 **Batch Operations**: Encrypt or decrypt entire directory trees with a single command.
- ⚙️ **Cross-Platform**: A single, dependency-free binary for Linux, macOS, and Windows.
- 🛡️ **Secure by Design**: Password strength is enforced, and secure password prompts hide input.
- 🔙 **Backward Compatible**: Fully supports legacy V1 vault files with automatic format detection.

## 🚀 Installation

### Quick Start (Recommended)

Download the pre-compiled binary for your operating system from the [**Latest Release**](https://github.com/bad-Al-code/SecureVault/releases/latest) page.

Place the binary in a directory included in your system's `PATH` (e.g., `/usr/local/bin` on Linux/macOS or a custom path on Windows).

### From Source (For Developers)

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/bad-Al-code/SecureVault.git
    cd SecureVault
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Build the project:**
    ```bash
    npm run build
    ```
    The compiled JavaScript entry point will be located at `./dist/cli.js`. You can run it directly with `node dist/cli.js <command>`.

## 💻 Usage

**Note:** On Windows, use `vault.exe` instead of `vault`.

### Core Operations

```bash
# Encrypt a file (or multiple files)
vault encrypt secrets.txt config.json

# View the decrypted contents of a file
vault view secrets.txt

# Decrypt a file in-place
vault decrypt secrets.txt

# Edit an encrypted file securely
vault edit secrets.txt
```

### Version Control

```
# Show the version history of a file
vault history secrets.txt

# Restore a file to a specific version ID
# (Get the version ID from the 'history' command)
vault restore secrets.txt <version_id>

# See the differences between two versions
vault compare secrets.txt <old_version_id> <new_version_id>
```

### Multi-Key Management

```bash
# Add a new password to an encrypted file
vault add-key secrets.txt "Bob's key"

# List all passwords/key slots
vault list-keys secrets.txt

# Remove a password (interactive selection)
vault remove-key secrets.txt

# Rotate/change a password
vault rotate-key secrets.txt

# Upgrade V1 vault file to V2 format (enables multi-key)
vault upgrade old-vault-file.txt
```

### Batch Operations

```
# Recursively find and encrypt all unencrypted files in a directory
vault batch-encrypt ./my-project/config

# Recursively find and decrypt all encrypted files
vault batch-decrypt ./my-project/config
```

## 🛠️ How It Works

### V2 Format (Current - Multi-Key Support)
- **Content Encryption**: AES-256-GCM with a randomly generated Data Encryption Key (DEK)
- **Key Encryption**: Each password derives a Key Encryption Key (KEK) using PBKDF2 (10,000 iterations, SHA-256)
- **Envelope Encryption**: The DEK encrypts your file content, and each KEK encrypts the DEK in separate key slots
- **Key Slots**: Each password gets its own slot with unique salt, IV, and encrypted DEK
- **Authenticated Encryption**: GCM mode provides integrity protection and tamper detection
- **Version History**: When a file like `secrets.txt` is versioned, history is stored in `.vault_history/secrets.txt/`

### V1 Format (Legacy - Single Key)
- **Encryption Method**: AES-256-CBC with a 16-byte Initialization Vector (IV)
- **Key Derivation**: PBKDF2 (10,000 iterations, SHA-256) with a unique 32-byte salt
- **Backward Compatible**: All V1 files continue to work; use `vault upgrade` to enable multi-key features

## 🤝 Contributing

Contributions are welcome! Whether it's a bug report, a feature request, or a pull request, your input is valued.

- Please open an [issue](https://github.com/bad-Al-code/SecureVault/issues) to discuss any significant changes before starting work.
- Our [CI workflow](https://github.com/bad-Al-code/SecureVault/actions/workflows/ci.yml) automatically checks for formatting and linting errors on every pull request. Please run `npm run lint` and `npm run format:check` locally before pushing.
