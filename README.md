<div align="center">
  <h1>🛡️ SecureVault CLI 🛡️</h1>
  <p><strong>A modern, command-line tool for encrypting, editing, and versioning your sensitive files.</strong></p>
  <p>Think <code>ansible-vault</code> but with built-in, Git-like version history, Cloud Sync, and Analytics.</p>

  <p>
    <a href="https://github.com/bad-Al-code/SecureVault/actions/workflows/ci.yml">
      <img src="https://github.com/bad-Al-code/SecureVault/actions/workflows/ci.yml/badge.svg" alt="CI Status">
    </a>
    <a href="https://github.com/bad-Al-code/SecureVault/releases/latest">
      <img src="https://img.shields.io/github/v/release/bad-Al-code/SecureVault" alt="Latest Release">
    </a>
  </p>
</div>

<!-- TODO: Add a GIF demonstrating the 'edit', 'history', 'compare', and 'analytics' commands in action. -->

## Why SecureVault?

Managing secrets and sensitive configuration files can be cumbersome. You often have to choose between unencrypted files in private repos or manually encrypting/decrypting files with tools like GPG before every use. SecureVault streamlines this entire workflow.

- **✍️ Edit on the Fly:** Run `vault edit secrets.yml`, and the file is automatically decrypted into a temporary session, opened in your favorite editor (`$EDITOR`), and seamlessly re-encrypted on save.
- **🕰️ Never Lose a Change:** Every time you encrypt or edit a file, SecureVault automatically creates a version snapshot. View `history`, `restore`, or `compare` versions instantly.
- **☁️ Cloud Sync & Backup:** Sync your encrypted secrets to AWS S3 (or compatible storage) with built-in conflict resolution and optimistic locking.
- **📊 Vault Health Insights:** Track frequently accessed secrets, measure storage overhead, and receive warnings when secrets haven’t been rotated.
- **🎯 Simple and Secure:** Uses AES-256-CBC with PBKDF2 key derivation. Strong defaults, no complex setup.

## ✨ Key Features

- 🔒 **Robust Encryption**: AES-256-CBC with salted PBKDF2 key derivation.
- ✏️ **Seamless Editing**: Auto-decrypt → edit → re-encrypt workflow.
- 🗂️ **Built-in Version Control**: View history, restore, and compare versions of any file.
- 📂 **Batch Operations**: Encrypt or decrypt entire directory trees.
- ☁️ **Cloud Sync**: Push and pull encrypted files to S3-compatible storage.
- 🔍 **Secure Search**: Search inside encrypted files instantly.
- 📊 **Vault Analytics**: Usage statistics, storage bloat detection, and rotation warnings.
- ⚙️ **Cross-Platform**: Linux, macOS, and Windows support.
- 🛡️ **Secure by Design**: Password strength enforcement and hidden input prompts.

## 🚀 Installation

### Quick Start (Recommended)

Download the pre-compiled binary for your operating system from the  
[**Latest Release**](https://github.com/bad-Al-code/SecureVault/releases/latest).

Place the binary in a directory included in your system’s `PATH`.

### Docker

```bash
docker run --rm -v $(pwd):/vault secure-vault help
```

### From Source (For Developers)

```bash
git clone https://github.com/bad-Al-code/SecureVault.git
cd SecureVault
npm install
npm run build
# executable at ./dist/cli.js
```

## 💻 Usage

**Note:** On Windows, use `vault.exe` instead of `vault`.

### Core Operations

```bash
vault encrypt secrets.txt config.json
vault view secrets.txt
vault decrypt secrets.txt
vault edit secrets.txt
vault search "API_KEY" ./projects
```

### 📊 Monitoring & Analytics

```bash
vault analytics
```

### Configuration

```bash
vault config awsBucket my-vault-backup
vault config awsRegion us-east-1
vault config awsEndpoint http://localhost:4566
```

### Cloud Sync & Backup

```bash
vault push
vault pull
```

### Version Control

```bash
vault history secrets.txt
vault restore secrets.txt <version_id>
vault compare secrets.txt <old_version_id> <new_version_id>
```

### Batch Operations

```bash
vault batch-encrypt ./configs
vault batch-decrypt ./configs
```

## 🛠️ How It Works

- **Encryption**: AES-256-CBC with a 16-byte IV.
- **Key Derivation**: PBKDF2 (SHA-256, 10k iterations, salted).
- **Storage**: Encrypted files contain a `VAULT;` header.
- **Version History**: Stored locally under `.vault_history/<filename>/`.
- **Sync**: Tracks ETags in `.vault_history/sync_state.json`.
- **Analytics**: Usage metadata stored in `.vault_history/analytics.json`.

## 🤝 Contributing

Contributions are welcome and appreciated!

- Open an issue for bugs or feature requests.
- Run `npm run lint` and `npm run format:check` before submitting a PR.
