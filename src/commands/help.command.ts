export function showHelp(): void {
  console.log(`
Usage: vault <command> [arguments]

Commands:
  encrypt <path...>                     Encrypt one or more files (V2 format)
  decrypt <path...>                     Decrypt one or more files
  view <file>                           View encrypted file contents
  edit <file>                           Edit an encrypted file
  history <file>                        Show version history for a file
  restore <file> <versionId>            Restore a file to a specific version
  compare <file> <v1_id> <v2_id>        Compare two versions of a file.

Multi-Key Management:
  add-key <file> [label]                Add a new password to an encrypted file
  remove-key <file> [key-id]            Remove a password from an encrypted file
  list-keys <file>                      List all key slots for a file
  rotate-key <file>                     Replace an existing password with a new one
  upgrade <file>                        Upgrade V1 vault file to V2 format

Batch Commands:
  batch-encrypt <dir>                   Recursively encrypt all files in a directory.
  batch-decrypt <dir>                   Recursively decrypt all files in a directory.

Other Commands:
  help, -h, --help                      Show this help message.


Examples:
  vault encrypt secrets.txt
  vault add-key secrets.txt "Bob's key"
  vault list-keys secrets.txt
  vault rotate-key secrets.txt
  vault upgrade old-vault-file.txt
  vault batch-encrypt ./configs
`);
}
