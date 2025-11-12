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
  vault batch-encrypt ./configs
`);
}
