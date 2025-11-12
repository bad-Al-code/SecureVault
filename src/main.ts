#!/usr/bin/env node

import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { CryptoService, VersionControlService } from './services';
import { LoadingIndicator, PasswordStrengthMeter } from './utils';

class VaultCLI {
    /**
     * Check if a file is already encrypted
     * @param filename - The path to the file to check
     * @returns A promise resolving to true, if the file is encrypted, otherwise false.
     * */
    static async isEncrypted(filename: string): Promise<boolean> {
        try {
            const content = await fs.readFile(filename, 'utf8');

            return CryptoService.isVaultFile(content);
        } catch (error) {
            return false;
        }
    }

    /**
     * Reads a password securely from the terminal.
     * @private
     * @param {boolean} [isNewVault=false] - Whether to prompt for password confirmation.
     * @returns {Promise<string>} - A promise that resolves to the entered password.
     * @throws {Error} If password confirmation fails
     */
    static async getPassword(isNewVault: boolean = false): Promise<string> {
        const stdin = process.stdin;
        const stdout = process.stdout;

        const question = (prompt: string): Promise<string> => {
            return new Promise((resolve) => {
                let password = '';

                stdout.write(prompt);
                stdin.setRawMode(true);
                stdin.resume();
                stdin.setEncoding('utf8');

                const onData = (char: string) => {
                    if (char === '\u0003') {
                        // Ctrl+C
                        stdout.write('\n');
                        process.exit(1);
                    } else if (char === '\b' || char === '\x7f') {
                        // Backspace Key
                        if (password.length > 0) {
                            password = password.slice(0, -1);
                            stdout.write('\b \b');
                        }
                    } else if (char === '\u0015') {
                        // Ctrl+U (Erase all)
                        password = '';
                        stdout.write('\r' + ' '.repeat(password.length) + '\r');
                        stdout.write(prompt);
                    } else if (char === '\r' || char === '\n') {
                        // Enter Key
                        stdout.write('\n');
                        stdin.setRawMode(false);
                        stdin.pause();
                        stdin.removeListener('data', onData);
                        resolve(password);
                    } else {
                        password += char;
                    }
                };

                stdin.on('data', onData);
            });
        };

        let password: string;
        if (isNewVault) {
            while (true) {
                password = await question('New Vault Password: ');
                try {
                    PasswordStrengthMeter.validate(password);

                    break;
                } catch (error: any) {
                    console.error(`\n${error.message}\n`);
                }
            }

            const confirmPassword = await question('Confirm Vault password: ');

            if (password !== confirmPassword) {
                console.error('Error: Passwords do not match');
                process.exit(1);
            }
        } else {
            password = await question('Vault Password: ');
        }

        return password;
    }

    /**
     * Encrypts the contents of a file.
     * @param {string[]} filenames - Array of file path to encrypt
     */
    static async encryptFile(filenames: string[]): Promise<void> {
        const loadingIndicator = new LoadingIndicator();
        const encryptedFiles: string[] = [];
        const unencryptedFiles: string[] = [];

        try {
            for (const filename of filenames) {
                if (await this.isEncrypted(filename)) {
                    encryptedFiles.push(filename);
                } else {
                    unencryptedFiles.push(filename);
                }
            }

            if (encryptedFiles.length > 0) {
                loadingIndicator.start('');
                loadingIndicator.stop(
                    `⚠️ Skipping already encrypted files: ${encryptedFiles.join(', ')}`,
                );
            }

            if (unencryptedFiles.length === 0) {
                loadingIndicator.start('');
                loadingIndicator.stop('✘ No files to encrypt');
                process.exit(0);
            }

            const password = await this.getPassword(true);

            for (const filename of unencryptedFiles) {
                loadingIndicator.start(`Encrypting ${filename}...`);
                const plainText = await fs.readFile(filename, 'utf-8');

                const encryptedOutput = await CryptoService.encrypt(
                    plainText,
                    password,
                );

                await fs.writeFile(filename, encryptedOutput);

                await VersionControlService.init(
                    filename,
                    `Initial encryption of ${path.basename(filename)}`,
                );

                loadingIndicator.stop(`✔ ${filename} encrypted successfully`);
            }
        } catch (err) {
            let error = err as Error;
            loadingIndicator.start('');
            loadingIndicator.stop(`✘ Encryption failed: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * Decrypts the contents of a file.
     * @param {string[]} filenames - Array of path to decrypt
     */
    static async decryptFile(filenames: string[]): Promise<void> {
        const loadingIndicator = new LoadingIndicator();
        const encryptedFiles: string[] = [];
        const unencryptedFiles: string[] = [];

        try {
            for (const filename of filenames) {
                if (await this.isEncrypted(filename)) {
                    encryptedFiles.push(filename);
                } else {
                    unencryptedFiles.push(filename);
                }
            }

            if (unencryptedFiles.length > 0) {
                loadingIndicator.start('');
                loadingIndicator.stop(
                    `⚠️ Skipping non-encrypted files: ${unencryptedFiles.join(', ')}`,
                );
            }

            if (encryptedFiles.length === 0) {
                loadingIndicator.start('');
                loadingIndicator.stop('✘ No encrypted files to decrypt');
                process.exit(0);
            }

            const password = await this.getPassword();

            for (const filename of encryptedFiles) {
                try {
                    loadingIndicator.start(`Decrypting ${filename}...`);

                    const encryptedData = await fs.readFile(filename, 'utf8');
                    const decryptedText = await CryptoService.decrypt(
                        encryptedData,
                        password,
                    );

                    await fs.writeFile(filename, decryptedText);

                    loadingIndicator.stop(
                        `✔ ${filename} decrypted successfully`,
                    );
                } catch (err) {
                    const error = err as Error;
                    loadingIndicator.stop();

                    console.error(
                        `✘ Failed to decrypt ${filename}: Invalid password or corrupted file.`,
                        error.message,
                    );
                }
            }
        } catch (err) {
            let error = err as Error;
            // loadingIndicator.start('');
            loadingIndicator.stop(`✘ Decryption failed: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * Displays the contents of an encrypted file.
     * @param {string} filename - The path to the file to view.
     */
    static async viewFile(filename: string): Promise<void> {
        const loadingIndicator = new LoadingIndicator();

        try {
            const encryptedData = await fs.readFile(filename, 'utf8');

            if (!CryptoService.isVaultFile(encryptedData)) {
                loadingIndicator.stop(
                    '✘ Error: File is not an encrypted vault file.',
                );
                process.exit(1);
            }

            loadingIndicator.stop();
            const password = await this.getPassword();

            loadingIndicator.start('Decrypting...');
            const decryptedText = await CryptoService.decrypt(
                encryptedData,
                password,
            );

            loadingIndicator.stop();
            console.log(decryptedText);
        } catch (err) {
            let error = err as Error;
            loadingIndicator.stop(`✘ View failed: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * Select the most approriate text editor based on OS and environment.
     * @returns {Object} An object containing the editor command and its arguments
     * @property {string} command - The executable command for the text editor
     * @property {string[]} args - Additional arguments for the editor command
     * */
    private static selectEditor(): { command: string; args: string[] } {
        const envEditor = process.env.EDITOR;
        if (envEditor) {
            return { command: envEditor, args: [] };
        }

        const platform = os.platform();
        switch (platform) {
            case 'win32':
                const windowsEditor = [
                    { command: 'notepad.exe', args: [] },
                    { command: 'code.cmd', args: ['-w'] },
                    { command: 'notepad++.exe', args: [] },
                ];
                for (const editor of windowsEditor) {
                    try {
                        execSync(`where ${editor.command}`, {
                            stdio: 'ignore',
                        });
                        return editor;
                    } catch (error) {
                        continue;
                    }
                }
                break;

            case 'darwin':
                return {
                    command: 'open',
                    args: ['-e'],
                };

            case 'linux':
                const linuxEditors = [
                    { command: 'vim', args: [] },
                    { command: 'code', args: ['-w'] },
                    { command: 'nano', args: [] },
                    { command: 'emacs', args: [] },
                ];

                for (const editor of linuxEditors) {
                    try {
                        execSync(`which ${editor.command}`, {
                            stdio: 'ignore',
                        });
                        return editor;
                    } catch (error) {
                        continue;
                    }
                }
                break;
        }

        return {
            command: platform === 'win32' ? 'notepad.exe' : 'nano',
            args: [],
        };
    }

    /**
     * Edit the contents of a file.
     * @param {string} filename - The path to the file to edit.
     */
    static async editFile(filename: string): Promise<void> {
        const loadingIndicator = new LoadingIndicator();
        let originalContent: string | null = null;

        try {
            loadingIndicator.start(`Reading ${filename}...`);
            const encryptedData = await fs.readFile(filename, 'utf8');
            originalContent = encryptedData;

            if (!CryptoService.isVaultFile(encryptedData)) {
                loadingIndicator.stop(
                    '✘ Error: File is not an encrypted vault file.',
                );
                process.exit(1);
            }

            loadingIndicator.stop();
            const password = await this.getPassword();

            loadingIndicator.start('Decrypting for editing...');
            const decrypted = await CryptoService.decrypt(
                encryptedData,
                password,
            );
            loadingIndicator.stop();

            await fs.writeFile(filename, decrypted);

            const editor = this.selectEditor();
            const editProcess = spawn(
                editor.command,
                [...editor.args, filename],
                { stdio: 'inherit' },
            );

            await new Promise((resolve, reject) => {
                editProcess.on('close', (code) => {
                    if (code === 0) resolve(true);
                    else reject(new Error('Edit process failed'));
                });
            });

            loadingIndicator.start('Re-encrypting edited file...');

            const editedContent = await fs.readFile(filename, 'utf8');

            const newOutput = await CryptoService.encrypt(
                editedContent,
                password,
            );

            await fs.writeFile(filename, newOutput);

            await VersionControlService.init(
                filename,
                `Edited ${path.basename(filename)}`,
            );

            loadingIndicator.stop(
                '✔ File edited and re-encrypted successfully',
            );
        } catch (err) {
            const error = err as Error;
            loadingIndicator.stop(`✘ Edit failed: ${error.message}`);

            if (originalContent) {
                await fs.writeFile(filename, originalContent);
            }

            process.exit(1);
        }
    }

    /**
     * Displays the CLI usage help.
     */
    static showHelp(): void {
        console.log(`
Usage: vault <command> <file>

Commands:
  encrypt <path>    			Encrypt a file
  decrypt <path>    			Decrypt a file
  view <file>       			View encrypted file contents
  edit <file>					Edit and encrypted file
  history <file>				Show version history for an encrypted file
  restore <file> <versionId> 	Restore a specific version of an encrypted file
  compare <file> <version1Id> <version2Id> 		Compare between two versions of an encrypted file
  help              Show this help message

Examples:
  vault encrypt secrets.txt
  vault encrypt secrets.txt test.json
  vault decrypt secrets.txt
  vault decrypt secrets.txt test.json
  vault view secrets.txt
  vault edit secrets.txt
  vault history secrets.txt
  vault compare secrets.txt 607f3f729345c2ba6aa075b124ca313a aacc8981bf16cf76ada50a4ede8cc937
    `);
    }
}

interface BatchProcessOptions {
    recursive?: boolean;
    filePattern?: RegExp;
    excludePattern?: RegExp;
    dryRun?: boolean;
    logFile?: string;
}

class BatchProcessor {
    private loadingIndicator: LoadingIndicator;

    constructor() {
        this.loadingIndicator = new LoadingIndicator();
    }

    /**
     * Recursively find files matching processing criteria
     * @param {string} directory - Starting directory for file search
     * @param {BatchProcessOptions} options - Processing configuration options
     * @returns {Promise<string[]>} List of files matching criteria
     */
    async findFiles(
        directory: string,
        options: BatchProcessOptions = {},
    ): Promise<string[]> {
        const {
            recursive = false,
            filePattern = /.*/,
            excludePattern = /^$/,
        } = options;

        const foundFiles: string[] = [];

        const processDirectory = async (currentDir: string) => {
            const entries = await fs.readdir(currentDir, {
                withFileTypes: true,
            });

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);

                if (entry.isDirectory() && recursive) {
                    await processDirectory(fullPath);
                } else if (entry.isFile()) {
                    if (
                        filePattern.test(entry.name) &&
                        !excludePattern.test(entry.name)
                    ) {
                        foundFiles.push(fullPath);
                    }
                }
            }
        };

        await processDirectory(directory);
        return foundFiles;
    }

    /**
     * Batch encrypt files in a directory
     * @param {string} directory - Directory containing files to encrypt
     * @param {BatchProcessOptions} options - Processing configuration
     */
    async batchEncrypt(
        directory: string,
        options: BatchProcessOptions = {},
    ): Promise<void> {
        try {
            const files = await this.findFiles(directory, options);
            const password = await VaultCLI.getPassword(true);

            for (const file of files) {
                try {
                    if (!(await VaultCLI.isEncrypted(file))) {
                        await VaultCLI.encryptFile([file]);
                        this.loadingIndicator.start(`Encrypting ${file}...`);
                        this.loadingIndicator.stop(`✔ ${file} encrypted`);
                    } else {
                        this.loadingIndicator.stop(
                            `⚠️ ${file} already encrypted`,
                        );
                    }
                } catch (error) {
                    this.loadingIndicator.stop(
                        `✘ Failed to encrypt ${file}: ${error}`,
                    );
                }
            }
        } catch (error) {
            this.loadingIndicator.stop(`Batch encryption failed: ${error}`);
        }
    }

    /**
     * Batch decrypt files in a directory
     * @param {string} directory - Directory containing encrypted files
     * @param {BatchProcessOptions} options - Processing configuration
     */
    async batchDecrypt(
        directory: string,
        options: BatchProcessOptions = {},
    ): Promise<void> {
        try {
            const files = await this.findFiles(directory, {
                ...options,
                filePattern: /.*\.enc$/, // Only target encrypted files
            });
            const password = await VaultCLI.getPassword();

            for (const file of files) {
                this.loadingIndicator.start(`Decrypting ${file}...`);
                try {
                    await VaultCLI.decryptFile([file]);
                    this.loadingIndicator.stop(`✔ ${file} decrypted`);
                } catch (error) {
                    this.loadingIndicator.stop(
                        `✘ Failed to decrypt ${file}: ${error}`,
                    );
                }
            }
        } catch (error) {
            this.loadingIndicator.stop(`Batch decryption failed: ${error}`);
        }
    }

    /**
     * Batch restore file versions
     * @param {string} directory - Directory containing versioned files
     * @param {string} versionId - Version identifier to restore
     * @param {BatchProcessOptions} options - Processing configuration
     */
    async batchRestore(
        directory: string,
        versionId: string,
        options: BatchProcessOptions = {},
    ): Promise<void> {
        try {
            const files = await this.findFiles(directory, options);

            for (const file of files) {
                this.loadingIndicator.start(`Restoring version for ${file}...`);
                try {
                    // await VersionControlService.restore(file, versionId);
                    // this.loadingIndicator.stop(`✔ ${file} restored`);
                } catch (error) {
                    this.loadingIndicator.stop(
                        `✘ Failed to restore ${file}: ${error}`,
                    );
                }
            }
        } catch (error) {
            this.loadingIndicator.stop(`Batch restoration failed: ${error}`);
        }
    }

    /**
     * Log batch processing results
     * @param {string} logFile - Path to log file
     * @param {string} operation - Type of batch operation
     * @param {any[]} results - Processing results
     */
    async logResults(
        logFile: string,
        operation: string,
        results: any[],
    ): Promise<void> {
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp} - ${operation}\n${JSON.stringify(results, null, 2)}\n`;
        await fs.appendFile(logFile, logEntry);
    }
}

/**
 * Enum representing available commands for the Vault CLI
 */
enum VaultCommand {
    ENCRYPT = 'encrypt',
    DECRYPT = 'decrypt',
    VIEW = 'view',
    EDIT = 'edit',
    HISTORY = 'history',
    RESTORE = 'restore',
    COMPARE = 'compare',
    HELP = 'help',
    BATCH_ENCRYPT = 'batch-encrypt',
    BATCH_DECRYPT = 'batch-decrypt',
    BATCH_RESTORE = 'batch-restore',
}

/**
 * Validates command arguments based on the specific requirements of each command
 *
 * @param {VaultCommand} command - The command to be executed
 * @param {string[]} filenames - Array of filenames passed to the command
 * @throws {Error} If the number of filenames doesn't match the command's requirements
 */
function validateArguments(command: VaultCommand, filenames: string[]): void {
    switch (command) {
        case VaultCommand.VIEW:
        case VaultCommand.EDIT:
        case VaultCommand.HISTORY:
            if (filenames.length !== 1) {
                throw new Error(
                    `${command} command supports only one file at a time`,
                );
            }
            break;

        case VaultCommand.RESTORE:
            if (filenames.length !== 2) {
                throw new Error(
                    'Restore command requires a filename and a version ID',
                );
            }
            break;

        case VaultCommand.COMPARE:
            if (filenames.length !== 3) {
                throw new Error(
                    'Compare command requires a filename and two version IDs',
                );
            }
            break;

        case VaultCommand.ENCRYPT:
        case VaultCommand.DECRYPT:
            if (filenames.length < 1) {
                throw new Error(
                    `${command} command requires at least one filename`,
                );
            }
            break;
    }
}

/**
 * Main entry point for the Vault CLI application
 *
 * Processes command-line arguments, validates them, and executes the corresponding command
 * Handles error scenarios and displays help information when needed
 *
 * @async
 * @throws {Error} For invalid commands or argument configurations
 */
async function main() {
    const args = process.argv.slice(2);
    const loadingIndicator = new LoadingIndicator();
    const batchProcessor = new BatchProcessor();

    try {
        if (
            args.length < 1 ||
            args[0] === 'help' ||
            args[0] === '--help' ||
            args[0] === '-h'
        ) {
            VaultCLI.showHelp();
            process.exit(0);
        }

        const command = args[0] as VaultCommand;
        const filenames = args.slice(1);

        if (!Object.values(VaultCommand).includes(command)) {
            throw new Error(`Unknown command: ${command}`);
        }

        validateArguments(command, filenames);

        switch (command) {
            case VaultCommand.ENCRYPT:
                await VaultCLI.encryptFile(filenames);
                break;
            case VaultCommand.DECRYPT:
                await VaultCLI.decryptFile(filenames);
                break;
            case VaultCommand.VIEW:
                await VaultCLI.viewFile(filenames[0]);
                break;
            case VaultCommand.EDIT:
                await VaultCLI.editFile(filenames[0]);
                break;
            case VaultCommand.HISTORY:
                await VersionControlService.showHistory(filenames[0]);
                break;
            case VaultCommand.RESTORE:
                const loadingIndicator = new LoadingIndicator();
                try {
                    const password = await VaultCLI.getPassword();
                    loadingIndicator.start(
                        `Restoring version ${filenames[1]}...`,
                    );
                    await VersionControlService.restore(
                        filenames[0],
                        filenames[1],
                        password,
                    );

                    loadingIndicator.stop(
                        `✔ Restored version ${filenames[1]} successfully.`,
                    );
                } catch (err) {
                    let error = err as Error;
                    loadingIndicator.stop(
                        `✘ Restoration failed: ${error.message}`,
                    );

                    process.exit(1);
                }
                break;
            case VaultCommand.COMPARE:
                // const result = await VersionControl.compareVersions(
                //     filenames[0],
                //     filenames[1],
                //     filenames[2],
                // );
                // loadingIndicator.start('');
                // loadingIndicator.stop(
                //     `Comparison Result: ${JSON.stringify(result, null, 2)}`,
                // );
                console.log(
                    'Compare command is temporarily disabled during refactoring.',
                );

                break;
            case VaultCommand.BATCH_ENCRYPT:
                await batchProcessor.batchEncrypt(filenames[0], {
                    recursive: args.includes('--recursive'),
                    filePattern: args.includes('--pattern')
                        ? new RegExp(args[args.indexOf('--pattern') + 1])
                        : undefined,
                });
                break;
            case VaultCommand.BATCH_DECRYPT:
                await batchProcessor.batchDecrypt(filenames[0], {
                    recursive: args.includes('--recursive'),
                });
                break;
            case VaultCommand.BATCH_RESTORE:
                await batchProcessor.batchRestore(filenames[0], filenames[1], {
                    recursive: args.includes('--recursive'),
                });
                break;
        }
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : String(error);
        loadingIndicator.start('');
        loadingIndicator.stop(`✘ Error: ${errorMessage}`);
        VaultCLI.showHelp();
        process.exit(1);
    }
}

// Execute main function and handle any unhandled errors
main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
