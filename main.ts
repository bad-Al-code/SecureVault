#!/usr/bin/env node

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

/*
 * Utility class to display a spineer-based loading loadingIndicator
 */
class LoadingIndicator {
    private static spinnerFrames = [
        '⠋',
        '⠙',
        '⠹',
        '⠸',
        '⠼',
        '⠴',
        '⠦',
        '⠧',
        '⠇',
        '⠏',
    ];
    private intervalId: NodeJS.Timeout | null = null;
    private currentFrame = 0;

    /**
     * Starts the loading spinner with a message.
     * @param {string} message - The message to display alongside the spinner.
     */
    start(message: string): void {
        this.intervalId = setInterval(() => {
            const spinner = LoadingIndicator.spinnerFrames[this.currentFrame];
            process.stdout.write(`\r${spinner} ${message}`);
            this.currentFrame =
                (this.currentFrame + 1) % LoadingIndicator.spinnerFrames.length;
        }, 80);
    }

    /**
     * Stops the loading spinner and optionally displays a final message.
     * @param {string} [finalMessage] - The final message to display after stopping.
     */
    stop(finalMessage?: string): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            process.stdout.write(`\r\x1b[K`);

            if (finalMessage) {
                console.log(finalMessage);
            }
        }
    }
}

class VersionControl {
    private static VAULT_HISTORY_DIR = '.vault_history';

    /**
     * Get file content hash
     * @param {string} filename - The path to the file
     * @returns {string} - Hash of the file content
     * */
    private static getFileHash(filename: string): string {
        try {
            const fileBuffer = readFileSync(filename);
            return crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (error) {
            return '';
        }
    }

    /**
     * Initialize version control for a file
     * @param {string} filename - The path to the file
     * @param {string} commitMessage - initial commit message
     * */
    static async intiVersionControl(
        filename: string,
        commitMessage: string,
    ): Promise<void> {
        const loadingIndicator = new LoadingIndicator();
        const fileBaseName = path.basename(filename);
        const fileHistoryDir = path.join(
            path.dirname(filename),
            this.VAULT_HISTORY_DIR,
            fileBaseName,
        );

        try {
            await fs.mkdir(fileHistoryDir, { recursive: true });

            const logFile = path.join(fileHistoryDir, 'version_log.json');
            let versionLog: any[] = [];

            try {
                const existingLog = await fs.readFile(logFile, 'utf8');
                versionLog = JSON.parse(existingLog);
            } catch (error) {
                // TODO: create a new log file, if log file doesn't exist
            }

            const versionId = crypto.randomBytes(16).toString('hex');

            const versionEntry = {
                id: versionId,
                timeStamp: new Date().toISOString(),
                message: commitMessage,
                originalHealth: this.getFileHash(filename),
            };

            versionLog.push(versionEntry);

            await fs.writeFile(logFile, JSON.stringify(versionLog, null, 2));

            const versionFile = path.join(fileHistoryDir, `${versionId}.enc`);

            await fs.copyFile(filename, versionFile);
        } catch (error: any) {
            loadingIndicator.start('');
            loadingIndicator.stop(
                `Version control initialization failed: ${error.message} `,
            );
        }
    }

    /**
     * Show version history for a file
     * @param {string} filename - The path to the file
     * */
    static async showHistory(filename: string): Promise<void> {
        const loadingIndicator = new LoadingIndicator();
        const fileBaseName = path.basename(filename);
        const fileHistoryDir = path.join(
            path.dirname(filename),
            this.VAULT_HISTORY_DIR,
            fileBaseName,
        );
        const logFile = path.join(fileHistoryDir, 'version_log.json');

        try {
            const logContent = await fs.readFile(logFile, 'utf8');
            const versionLog = JSON.parse(logContent);

            versionLog.forEach((entry: any, index: any) => {
                loadingIndicator.start('');

                const date = new Date(entry.timeStamp);
                const formattedDate = isNaN(date.getTime())
                    ? 'Invalid Date'
                    : date.toLocaleString();

                loadingIndicator.stop(`
${index + 1}. Version ID: ${entry.id}
Timestamp: ${formattedDate}
Message: ${entry.message}
				`);
            });
        } catch (error) {
            loadingIndicator.start('');
            loadingIndicator.stop(
                `Could not retrieve version history: ${error}`,
            );
        }
    }

    /**
     * Restore a file to a specific version
     * @param {string} filename - The path to the file
     * @param {string} versionId - The ID of the version to restore
     * */
    static async restoreVersion(
        filename: string,
        versionId: string,
    ): Promise<void> {
        const fileBaseName = path.basename(filename);
        const fileHistoryDir = path.join(
            path.dirname(filename),
            this.VAULT_HISTORY_DIR,
            fileBaseName,
        );
        const loadingIndicator = new LoadingIndicator();
        const logFile = path.join(fileHistoryDir, 'version_log.json');
        const versionFile = path.join(fileHistoryDir, `${versionId}.enc`);

        try {
            const logContent = await fs.readFile(logFile, 'utf8');
            const versionLog = JSON.parse(logContent);

            const versionEntry = versionLog.find(
                (entry: any) => entry.id === versionId,
            );

            if (!versionEntry) {
                throw new Error('Version not found');
            }

            const password = await VaultCLI.getPassword();

            loadingIndicator.start('');
            const encryptedData = await fs.readFile(versionFile, 'utf8');
            const lines = encryptedData.split('\n');

            const salt = Buffer.from(lines[1], 'hex');
            const iv = Buffer.from(lines[2], 'hex');
            const encrypted = lines[3];

            const key = await VaultCLI.deriveKey(password, salt);

            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            await fs.writeFile(filename, decrypted);

            loadingIndicator.stop(
                `Restored version ${versionId} from ${versionEntry.timeStamp}`,
            );
        } catch (error: any) {
            loadingIndicator.start('');
            loadingIndicator.stop(
                `Version restoration failed: ${error.message}`,
            );
            process.exit(1);
        }
    }

    /**
     * Caluculate differences between two file contents
     * @private
     * @param {string} content1 - The content of the first file
     * @param {string} content2 - The content of the second file
     * @returns {string[]} An array of lines present in content1 but not in content2.
     * */
    private static calculateDifferences(
        content1: string,
        content2: string,
    ): string[] {
        const lines1 = content1.split('\n');
        const lines2 = content2.split('\n');

        return lines1.filter((line) => !lines2.includes(line));
    }

    /**
     * Compare two versions of a file and return their metadata and differences.
     *
     * @static
     * @param {string} filename - The path to the file being compared.
     * @param {string} version1Id - The ID of the first version to compare.
     * @param {string} version2Id - The ID of the second version to compare.
     * @returns {Promise<object>} A promise resolving to an object containing
     * metadata of both versions and the differences between them.
     * @throws Will throw an error if version comparison fails.
     */
    static async compareVersions(
        filename: string,
        version1Id: string,
        version2Id: string,
    ): Promise<object> {
        const loadingIndicator = new LoadingIndicator();
        const fileBaseName = path.basename(filename);
        const fileHistoryDir = path.join(
            path.dirname(filename),
            this.VAULT_HISTORY_DIR,
            fileBaseName,
        );

        const logFile = path.join(fileHistoryDir, 'version_log.json');

        try {
            const exitingLog = await fs.readFile(logFile, 'utf8');
            const versionLog = JSON.parse(exitingLog);

            const version1File = path.join(fileHistoryDir, `${version1Id}.enc`);
            const version2File = path.join(fileHistoryDir, `${version2Id}.enc`);

            const version1Content = await fs.readFile(version1File, 'utf8');
            const version2Content = await fs.readFile(version2File, 'utf8');

            return {
                // version1: {
                //     id: version1Id,
                //     timestamp: versionLog.find((v: any) => v.id === version1Id)
                //         ?.timeStamp,
                //     size: version1Content.length,
                // },
                //
                // version2: {
                //     id: version2Id,
                //     timestamp: versionLog.find((v: any) => v.id === version2Id)
                //         ?.timeStamp,
                //     size: version1Content.length,
                // },

                differences: this.calculateDifferences(
                    version1Content,
                    version2Content,
                ),
            };
        } catch (error: any) {
            loadingIndicator.start('');
            loadingIndicator.stop(
                `Version comparison failed: ${error.message}`,
            );

            throw error;
        }
    }
}

/**
 * Core class for handling file encryption, decryption, and editing operations.
 */
class VaultCLI {
    private static readonly SALT_SIZE = 32;
    private static readonly ITERATIONS = 10000;
    private static readonly KEY_LENGTH = 32;
    private static readonly HEADER =
        '$VAULTCLI;VERSION=1.0;CIPHER=AES-256-CBC\n';

    /**
     * Check if a file is already encrypted
     * @param {string} filename - The path to the file to check
     * @returns {Promise<boolean>} - Whether the file is encrypted
     * */
    private static async isEncrypted(filename: string): Promise<boolean> {
        try {
            const content = await fs.readFile(filename, 'utf8');
            return content.startsWith(this.HEADER.trim());
        } catch (error) {
            return false;
        }
    }

    /**
     * Derives a cryptographic key from a password and salt using PBKDF2.
     * @private
     * @param {string} password - The password to derive the key from.
     * @param {Buffer} salt - The cryptographic salt.
     * @returns {Promise<Buffer>} - A promise that resolves to the derived key.
     * @throws {Error} If key derivation fails.
     */
    static async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(
                password,
                salt,
                this.ITERATIONS,
                this.KEY_LENGTH,
                'sha256',
                (err, derivedKey) => {
                    if (err) reject(err);
                    else resolve(derivedKey);
                },
            );
        });
    }

    /**
     * Reads a password securely from the terminal.
     * @private
     * @param {boolean} [confirm=false] - Whether to prompt for password confirmation.
     * @returns {Promise<string>} - A promise that resolves to the entered password.
     * @throws {Error} If password confirmation fails
     */
    static async getPassword(confirm: boolean = false): Promise<string> {
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

        const password = await question('Vault password: ');

        if (confirm) {
            const confirmPassword = await question('Confirm Vault password: ');
            if (password !== confirmPassword) {
                console.error('Error: Passwords do not match');
                process.exit(1);
            }
        }

        return password;
    }

    /**
     * Encrypts the contents of a file.
     * @param {string[]} filenames - Array of file path to encrypt
     */
    static async encryptFile(filenames: string[]): Promise<void> {
        const loadingIndicator = new LoadingIndicator();

        try {
            for (const filename of filenames) {
                if (await this.isEncrypted(filename)) {
                    loadingIndicator.start('');
                    loadingIndicator.stop(
                        `✘ Error:  ${filename} File is already encrypted`,
                    );
                    process.exit(1);
                }
            }

            const password = await this.getPassword(true);

            for (const filename of filenames) {
                loadingIndicator.start(`Encrypting ${filename}...`);
                const salt = crypto.randomBytes(this.SALT_SIZE);
                const iv = crypto.randomBytes(16);

                const key = await this.deriveKey(password, salt);
                const data = await fs.readFile(filename, 'utf8');

                const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
                let encrypted = cipher.update(data, 'utf8', 'hex');
                encrypted += cipher.final('hex');

                const output = [
                    this.HEADER.trim(),
                    salt.toString('hex'),
                    iv.toString('hex'),
                    encrypted,
                ].join('\n');

                await fs.writeFile(filename, output);

                await VersionControl.intiVersionControl(
                    filename,
                    `Initial encryption of ${path.basename(filename)}`,
                );

                loadingIndicator.stop(`✔ ${filename} encrypted successfully`);
            }
        } catch (error: any) {
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

        try {
            for (const filename of filenames) {
                const encryptedData = await fs.readFile(filename, 'utf8');
                const lines = encryptedData.split('\n');

                if (lines[0] !== this.HEADER.trim()) {
                    loadingIndicator.start('');
                    loadingIndicator.stop('✘ Error: File is not encrypted');
                    process.exit(1);
                }
            }

            const password = await this.getPassword();

            for (const filename of filenames) {
                loadingIndicator.start(`Decrypting ${filename}...`);

                const encryptedData = await fs.readFile(filename, 'utf8');
                const lines = encryptedData.split('\n');

                const salt = Buffer.from(lines[1], 'hex');
                const iv = Buffer.from(lines[2], 'hex');
                const encrypted = lines[3];

                const key = await this.deriveKey(password, salt);

                const decipher = crypto.createDecipheriv(
                    'aes-256-cbc',
                    key,
                    iv,
                );
                let decrypted = decipher.update(encrypted, 'hex', 'utf8');
                decrypted += decipher.final('utf8');

                await fs.writeFile(filename, decrypted);

                await VersionControl.intiVersionControl(
                    filename,
                    `Decryption of ${path.basename(filename)}`,
                );

                loadingIndicator.stop(`✔ ${filename} decrypted successfully`);
            }
        } catch (error: any) {
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
            const lines = encryptedData.split('\n');

            if (lines[0] !== this.HEADER.trim()) {
                loadingIndicator.start('');
                loadingIndicator.stop('✘ Error: File is not encrypted');
                process.exit(1);
            }

            const password = await this.getPassword();

            const salt = Buffer.from(lines[1], 'hex');
            const iv = Buffer.from(lines[2], 'hex');
            const encrypted = lines[3];

            const key = await this.deriveKey(password, salt);

            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            await VersionControl.intiVersionControl(
                filename,
                `Viewed ${path.basename(filename)}`,
            );

            loadingIndicator.stop();
            console.log(decrypted);
        } catch (error: any) {
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

        try {
            const encryptedData = await fs.readFile(filename, 'utf8');
            const lines = encryptedData.split('\n');

            if (lines[0] !== this.HEADER.trim()) {
                loadingIndicator.start('');
                loadingIndicator.stop('✘ Error: File is not encrypted');
                process.exit(1);
            }

            const password = await this.getPassword();

            const salt = Buffer.from(lines[1], 'hex');
            const iv = Buffer.from(lines[2], 'hex');
            const encrypted = lines[3];

            const key = await this.deriveKey(password, salt);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final(`utf8`);

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

            const newSalt = crypto.randomBytes(this.SALT_SIZE);
            const newIv = crypto.randomBytes(16);

            const newKey = await this.deriveKey(password, newSalt);

            const cipher = crypto.createCipheriv('aes-256-cbc', newKey, newIv);
            let newEncrypted = cipher.update(editedContent, 'utf8', 'hex');
            newEncrypted += cipher.final('hex');

            const newOutput = [
                this.HEADER.trim(),
                newSalt.toString('hex'),
                newIv.toString('hex'),
                newEncrypted,
            ].join(`\n`);

            await fs.writeFile(filename, newOutput);

            await VersionControl.intiVersionControl(
                filename,
                `Edited ${path.basename(filename)}`,
            );

            loadingIndicator.stop(
                '✔ File edited and re-encrypted successfully',
            );
        } catch (error: any) {
            loadingIndicator.stop(`✘ Edit failed: ${error.message}`);
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
  help              Show this help message

Examples:
  vault encrypt secrets.txt
  vault encrypt secrets.txt test.json
  vault decrypt secrets.txt
  vault decrypt secrets.txt test.json
  vault view secrets.txt
  vault edit secrets.txt
  vault history secrets.txt
    `);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const loadingIndicator = new LoadingIndicator();

    if (
        args.length < 1 ||
        args[0] === 'help' ||
        args[0] === '--help' ||
        args[0] === '-h'
    ) {
        VaultCLI.showHelp();
        process.exit(0);
    }

    if (args.length < 2) {
        loadingIndicator.start('');
        loadingIndicator.stop(
            '✘ Error: Please provide both command and filename',
        );
        VaultCLI.showHelp();
        process.exit(1);
    }

    const command = args[0];
    const filenames = args.slice(1);

    switch (command) {
        case 'encrypt':
            await VaultCLI.encryptFile(filenames);
            break;
        case 'decrypt':
            await VaultCLI.decryptFile(filenames);
            break;
        case 'view':
            if (filenames.length > 1) {
                loadingIndicator.start('');
                loadingIndicator.stop(
                    '✘ Error: View command supports only one file at a time',
                );
                process.exit(1);
            }
            await VaultCLI.viewFile(filenames[0]);
            break;
        case 'edit':
            if (filenames.length > 1) {
                loadingIndicator.start('');
                loadingIndicator.stop(
                    '✘ Error: Edit command supports only one file at a time',
                );
                process.exit(1);
            }
            await VaultCLI.editFile(filenames[0]);
            break;
        case 'history':
            if (filenames.length > 1) {
                loadingIndicator.start('');
                loadingIndicator.stop(
                    '✘ Error: History command supports only one file at a time',
                );
                process.exit(1);
            }
            await VersionControl.showHistory(filenames[0]);
            break;
        case 'restore':
            if (filenames.length > 2) {
                loadingIndicator.start('');
                loadingIndicator.stop(
                    '✘ Error: Restire command supports only two args at a time',
                );
                process.exit(1);
            }
            await VersionControl.restoreVersion(filenames[0], filenames[1]);
            break;
        case 'compare':
            if (filenames.length !== 3) {
                loadingIndicator.start('');
                loadingIndicator.stop(
                    '✘ Error: Compare command requires a filename and two version IDs',
                );
                process.exit(1);
            }
            const filename = filenames[0];
            const version1Id = filenames[1];
            const version2Id = filenames[2];
            const result = await VersionControl.compareVersions(
                filename,
                version1Id,
                version2Id,
            );
            loadingIndicator.start('');
            loadingIndicator.stop(
                `Comparison Result: ${JSON.stringify(result, null, 2)}`,
            );
            break;

        default:
            loadingIndicator.start('');
            loadingIndicator.stop('✘ Error: Unknown command');
            VaultCLI.showHelp();
            process.exit(1);
    }
}

main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
