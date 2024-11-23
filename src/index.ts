#!/usr/bin/env node

import { CLI } from './cli/cli';
import { VaultCommand } from './types';

async function main() {
    const args = process.argv.slice(2);

    if (
        args.length < 1 ||
        args[0] === 'help' ||
        args[0] === '--help' ||
        args[0] === '-h'
    ) {
        CLI.showHelp();
        process.exit(0);
    }

    if (args.length < 2) {
        console.error('Error: Please provide both command and filename');
        CLI.showHelp();
        process.exit(1);
    }

    const command = args[0] as VaultCommand;
    const filename = args[1];
    const cli = new CLI();

    switch (command) {
        case 'encrypt':
            await cli.encryptFile(filename);
            break;
        case 'decrypt':
            await cli.decryptFile(filename);
            break;
        case 'view':
            await cli.viewFile(filename);
            break;
        default:
            console.error('Error: Unknown command');
            CLI.showHelp();
            process.exit(1);
    }
}

main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
