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
        maxVersions: number = 10,
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
            let versionLog: {
                id: string;
                timeStamp: string;
                message: string;
                originalHealth: string;
            }[] = [];

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

            versionLog.sort(
                (a, b) =>
                    new Date(b.timeStamp).getTime() -
                    new Date(a.timeStamp).getTime(),
            );

            while (versionLog.length > maxVersions) {
                const oldestVersion = versionLog.pop();
                if (oldestVersion) {
                    const versionFile = path.join(
                        fileHistoryDir,
                        `${oldestVersion.id}.enc`,
                    );

                    try {
                        await fs.unlink(versionFile);
                    } catch (error) {
                        // Ignore errors if file doesn't exist
                    }
                }
            }

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
            const versionLog: {
                id: string;
                timeStamp: string;
                message: string;
            }[] = JSON.parse(logContent);

            versionLog.forEach((entry, index) => {
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
            const versionLog: { id: string; timeStamp: string }[] =
                JSON.parse(logContent);

            const versionEntry = versionLog.find(
                (entry) => entry.id === versionId,
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
    ): Promise<{ differences: string[] }> {
        const loadingIndicator = new LoadingIndicator();
        const fileBaseName = path.basename(filename);
        const fileHistoryDir = path.join(
            path.dirname(filename),
            this.VAULT_HISTORY_DIR,
            fileBaseName,
        );

        try {
            const password = await VaultCLI.getPassword();
            const logFile = path.join(fileHistoryDir, 'version_log.json');
            const exitingLog = await fs.readFile(logFile, 'utf8');
            const versionLog: { id: string; timeStamp: string }[] =
                JSON.parse(exitingLog);

            const version1File = path.join(fileHistoryDir, `${version1Id}.enc`);
            const version2File = path.join(fileHistoryDir, `${version2Id}.enc`);

            const decryptVersion = async (versionFile: string) => {
                const encryptedData = await fs.readFile(versionFile, 'utf8');
                const lines = encryptedData.split('\n');
                const salt = Buffer.from(lines[1], 'hex');
                const iv = Buffer.from(lines[2], 'hex');
                const encrypted = lines[3];

                const key = await VaultCLI.deriveKey(password, salt);
                const decipher = crypto.createDecipheriv(
                    'aes-256-cbc',
                    key,
                    iv,
                );
                let decrypted = decipher.update(encrypted, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                return decrypted;
            };

            const version1Content = await decryptVersion(version1File);
            const version2Content = await decryptVersion(version2File);

            return {
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
 * Represnt the result of password stregth
 */
interface PasswordStrengthResult {
    score: number;
    feedback: string[];
    isStrong: boolean;
}

/**
 * Password strngth evaluation Utility
 */
class PasswordStrengthMeter {
    private static readonly MIN_LENGTH = 4;
    private static readonly KEYBOARD_PATTERNS = [
        'qwerty',
        'asdfgh',
        'zxcvbn',
        '123456',
        'qazwsx',
    ];
    private static readonly COMMON_PASSWORDS = [
        'password',
        '123456',
        'qwerty',
        'admin',
        'letmein',
        'welcome',
        'monkey',
        'password1',
        'abc123',
        'passw0rd',
        'login',
        'secret',
    ];

    /**
     * Calucalte entropy of the password
     * @private
     * @param {string} password - Password to check
     * @returns {number} Entripy score
     */
    private static calculateEntropy(password: string): number {
        const charsets: { [key: string]: number } = {
            lowercase: 26,
            uppercase: 26,
            numbers: 10,
            symbols: 32,
        };

        let possibleChars = 0;
        // CHATGPT
        if (/[a-z]/.test(password)) possibleChars += charsets.lowercase;
        if (/[A-Z]/.test(password)) possibleChars += charsets.uppercase;
        if (/[0-9]/.test(password)) possibleChars += charsets.numbers;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
            possibleChars += charsets.symbols;

        return Math.log2(Math.pow(possibleChars, password.length));
    }

    /**
     * Check for command keyboard patterns
     * @param {string} password - Password to check
     * @returns {boolean} True if pattern found
     */
    private static hasKeyboardPattern(password: string): boolean {
        const lowerPassword = password.toLowerCase();
        return this.KEYBOARD_PATTERNS.some((pattern) => {
            lowerPassword.includes(pattern);
        });
    }

    /**
     * Analyze password strngth comprehensively
     * @param {string} password - Passwrod to evaluate
     * @returns {PasswordStrengthResult} Detailed stregth checket
     */
    static analyzePassword(password: string): PasswordStrengthResult {
        const feedback: string[] = [];

        if (password.length < this.MIN_LENGTH) {
            feedback.push(
                `Password must be at least ${this.MIN_LENGTH} characters long`,
            );
        }

        const complexityChecks = [
            {
                regex: /[A-Z]/,
                message: 'Include at least one uppercase letter',
            },
            {
                regex: /[a-z]/,
                message: 'Include at least one lowercase letter',
            },
            {
                regex: /[0-9]/,
                message: 'Include at least one number',
            },
            {
                regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
                message: 'Include at least one special character',
            },
        ];

        complexityChecks.forEach((check) => {
            if (!check.regex.test(password)) {
                feedback.push(check.message);
            }
        });

        if (this.COMMON_PASSWORDS.includes(password.toLowerCase())) {
            feedback.push(`Avoid using common passwords`);
        }

        if (this.hasKeyboardPattern(password)) {
            feedback.push(`Avoid using simple keyboard patterns`);
        }

        const entropy = this.calculateEntropy(password);

        let score = 0;
        if (password.length >= this.MIN_LENGTH) score++;
        complexityChecks.forEach((check) => {
            if (check.regex.test(password)) score++;
        });

        if (entropy > 40) score++;
        if (!this.COMMON_PASSWORDS.includes(password.toLowerCase())) score++;
        if (!this.hasKeyboardPattern(password)) score++;

        const isStrong =
            score >= 5 &&
            password.length >= this.MIN_LENGTH &&
            complexityChecks.every((check) => check.regex.test(password));

        return {
            score: Math.min(score, 4),
            feedback,
            isStrong,
        };
    }

    /**
     * Provides a human-readable strngth description
     * @param {number} score - Password strength score (0-4)
     * @returns {string} strength level
     */
    static getStrengthDesription(score: number): string {
        const descriptions = [
            'Very Weak',
            'Weak',
            'Moderate',
            'Strong',
            'Very Strong',
        ];
        return descriptions[score] || 'Unknown';
    }

    /**
     * Validate password meets minimum security requirements
     * @param {string} password - Password to validate
     * @throws {Error} If password does not meet minimum requirements
     */
    static validatePassword(password: string): void {
        const analysis = this.analyzePassword(password);

        if (!analysis.isStrong) {
            const errorMessage = [
                `Password does not meet security requirements: `,
                ...analysis.feedback,
            ].join('\n');

            throw new Error(errorMessage);
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
    private static readonly HEADER = 'VAULT;\n';

    /**
     * Check if a file is already encrypted
     * @param {string} filename - The path to the file to check
     * @returns {Promise<boolean>} - Whether the file is encrypted
     * */
    static async isEncrypted(filename: string): Promise<boolean> {
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
        while (true) {
            password = await question(
                isNewVault ? 'New Vault Password: ' : 'Vault Password: ',
            );

            try {
                PasswordStrengthMeter.validatePassword(password);
                break;
            } catch (error: any) {
                console.error(error.message);
            }
        }

        if (isNewVault) {
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
                const encryptedData = await fs.readFile(filename, 'utf8');
                const lines = encryptedData.split('\n');

                if (lines[0] === this.HEADER.trim()) {
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
                    await VersionControl.restoreVersion(file, versionId);
                    this.loadingIndicator.stop(`✔ ${file} restored`);
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
                await VersionControl.showHistory(filenames[0]);
                break;
            case VaultCommand.RESTORE:
                await VersionControl.restoreVersion(filenames[0], filenames[1]);
                break;
            case VaultCommand.COMPARE:
                const result = await VersionControl.compareVersions(
                    filenames[0],
                    filenames[1],
                    filenames[2],
                );
                loadingIndicator.start('');
                loadingIndicator.stop(
                    `Comparison Result: ${JSON.stringify(result, null, 2)}`,
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
