export function showHelp(): void {
  console.log(`
Usage: vault <command> [arguments]

Commands:
  encrypt <path...>                     Encrypt one or more files
  decrypt <path...>                     Decrypt one or more files
  view <file>                           View encrypted file contents
  edit <file>                           Edit an encrypted file
  history <file>                        Show version history for a file
  restore <file> <versionId>            Restore a file to a specific version
  compare <file> <v1_id> <v2_id>        Compare two versions of a file.
  search <query> [dir]                  Search for text within encrypted files
  config [key] [value]                  Get or Set configuration values
  push                                  Upload encrypted files to S3 (Backup)
  pull                                  Download encrypted files from S3
  analytics                             Show vault health and usage statistics
  logout                                Clear cached credentials (sudo-like timeout)
  completion setup                      Install shell auto-completion hooks
  copy <file>                           Copy decrypted content to clipboard (Auto-clears)
  paste <file>                          Paste clipboard content into an encrypted file
  version, v                            Show CLI version information

Batch Commands:
  batch-encrypt <dir>                     Recursively encrypt all files in a directory.
  batch-decrypt <dir>                     Recursively decrypt all files in a directory.

Other Commands:
  help, -h, --help                      Show this help message.


Examples:
  vault encrypt secrets.txt
  vault encrypt secrets.txt config.json
  vault view secrets.txt
  vault edit secrets.txt
  vault history secrets.txt
  vault search "API_KEY" ./projects
  vault batch-encrypt ./configs
`);
}
