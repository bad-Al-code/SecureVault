#!/usr/bin/env node

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

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

    start(message: string): void {
        this.intervalId = setInterval(() => {
            const spinner = LoadingIndicator.spinnerFrames[this.currentFrame];
            process.stdout.write(`\r${spinner} ${message}`);
            this.currentFrame =
                (this.currentFrame + 1) % LoadingIndicator.spinnerFrames.length;
        }, 80);
    }

    stop(finalMessage?: string): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            process.stdout.write(`\r\x1b[K]`);

            if (finalMessage) {
                console.log(finalMessage);
            }
        }
    }
}

class VaultCLI {
    private static readonly SALT_SIZE = 32;
    private static readonly ITERATIONS = 10000;
    private static readonly KEY_LENGTH = 32;
    private static readonly HEADER =
        '$VAULTCLI;VERSION=1.0;CIPHER=AES-256-CBC\n';

    private static async getPassword(
        confirm: boolean = false,
    ): Promise<string> {
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
                    } else if (char === '\r' || char === '\n') {
                        // Enter Key
                        stdout.write('\n');
                        stdin.setRawMode(false);
                        stdin.pause();
                        stdin.removeListener('data', onData);
                        resolve(password);
                    } else {
                        password += char;
                        stdout.write('*');
                    }
                };

                stdin.on('data', onData);
            });
        };

        const password = await question('New Vault password: ');

        if (confirm) {
            const confirmPassword = await question(
                'Confirm New Vault password: ',
            );
            if (password !== confirmPassword) {
                console.error('Error: Passwords do not match');
                process.exit(1);
            }
        }

        return password;
    }

    private static async deriveKey(
        password: string,
        salt: Buffer,
    ): Promise<Buffer> {
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

    static async encryptFile(filename: string): Promise<void> {
        const loadingIndicator = new LoadingIndicator();

        try {
            const data = await fs.readFile(filename, 'utf8');

            const password = await this.getPassword(true);
            loadingIndicator.start(`Encrypting ${filename}...`);

            const salt = crypto.randomBytes(this.SALT_SIZE);
            const iv = crypto.randomBytes(16);

            const key = await this.deriveKey(password, salt);

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

            loadingIndicator.stop('✔ Encryption successful. File updated.');
        } catch (error: any) {
            loadingIndicator.stop(`✘ Encryption failed: ${error.message}`);
            process.exit(1);
        }
    }

    static async decryptFile(filename: string): Promise<void> {
        const loadingIndicator = new LoadingIndicator();

        try {
            const encryptedData = await fs.readFile(filename, 'utf8');
            const lines = encryptedData.split('\n');

            if (lines[0] !== this.HEADER.trim()) {
                throw new Error('Invalid vault format');
            }

            const password = await this.getPassword();
            const salt = Buffer.from(lines[1], 'hex');
            const iv = Buffer.from(lines[2], 'hex');
            const encrypted = lines[3];

            const key = await this.deriveKey(password, salt);

            loadingIndicator.start(`Decrypting ${filename}...`);

            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            await fs.writeFile(filename, decrypted);

            loadingIndicator.stop('✔ Decryption successful');
        } catch (error: any) {
            loadingIndicator.stop(`✘ Decryption failed: ${error.message}`);
            process.exit(1);
        }
    }

    static async viewFile(filename: string): Promise<void> {
        const loadingIndicator = new LoadingIndicator();

        try {
            const encryptedData = await fs.readFile(filename, 'utf8');
            const lines = encryptedData.split('\n');

            if (lines[0] !== this.HEADER.trim()) {
                throw new Error('Invalid vault format');
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

    static async editFile(filename: string): Promise<void> {
        const loadingIndicator = new LoadingIndicator();

        try {
            const tempDir = os.tmpdir();
            const tempFile = path.join(tempDir, `vault_edit_${Date.now()}`);

            const encryptedData = await fs.readFile(filename, 'utf8');
            const lines = encryptedData.split('\n');

            if (lines[0] !== this.HEADER.trim()) {
                throw new Error('Inalid vault format');
            }

            const password = await this.getPassword();

            loadingIndicator.start(`Preparing to edit ${filename}...`);

            const salt = Buffer.from(lines[1], 'hex');
            const iv = Buffer.from(lines[2], 'hex');
            const encrypted = lines[3];

            const key = await this.deriveKey(password, salt);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final(`utf8`);

            await fs.writeFile(tempFile, decrypted);

            loadingIndicator.stop('✔ File decrypted for editing');

            const editor = process.env.EDITOR || 'nano';
            const editProcess = spawn(editor, [tempFile], { stdio: 'inherit' });

            await new Promise((resolve, reject) => {
                editProcess.on('close', (code) => {
                    if (code === 0) resolve(true);
                    else reject(new Error('Edit process failed'));
                });
            });

            loadingIndicator.start('Re-encrypting edited file...');

            const editedContent = await fs.readFile(tempFile, 'utf8');

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

            await fs.unlink(tempFile);

            loadingIndicator.stop(
                '✔ File edited and re-encrypted successfully',
            );
        } catch (error: any) {
            loadingIndicator.stop(`✘ Edit failed: ${error.message}`);
            process.exit(1);
        }
    }

    static showHelp(): void {
        console.log(`
Usage: ./main.js <command> <file>

Commands:
  encrypt <file>    Encrypt a file
  decrypt <file>    Decrypt a file
  view <file>       View encrypted file contents
  edit <file>		Edit and encrypted file
  help              Show this help message

Examples:
  ./main.js encrypt secrets.txt
  ./main.js decrypt secrets.txt
  ./main.js view secrets.txt
  ./main.js edit secrets.txt
    `);
    }
}

async function main() {
    const args = process.argv.slice(2);

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
        console.error('Error: Please provide both command and filename');
        VaultCLI.showHelp();
        process.exit(1);
    }

    const command = args[0];
    const filename = args[1];

    switch (command) {
        case 'encrypt':
            await VaultCLI.encryptFile(filename);
            break;
        case 'decrypt':
            await VaultCLI.decryptFile(filename);
            break;
        case 'view':
            await VaultCLI.viewFile(filename);
            break;
        case 'edit':
            await VaultCLI.editFile(filename);
            break;
        default:
            console.error('Error: Unknown command');
            VaultCLI.showHelp();
            process.exit(1);
    }
}

main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
