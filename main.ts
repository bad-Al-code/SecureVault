#!/usr/bin/env node

import * as crypto from 'crypto';
import * as fs from 'fs/promises';

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
        try {
            const data = await fs.readFile(filename, 'utf8');

            const password = await this.getPassword(true);

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

            console.log('Writing encrypted content to file...');
            await fs.writeFile(filename, output);
            console.log('Encryption successful. File updated.');
        } catch (error: any) {
            console.error('Encryption failed:', error.message);
            process.exit(1);
        }
    }

    static async decryptFile(filename: string): Promise<void> {
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

            await fs.writeFile(filename, decrypted);
            console.log('Decryption successful');
        } catch (error: any) {
            console.error('Decryption failed:', error.message);
            process.exit(1);
        }
    }

    static async viewFile(filename: string): Promise<void> {
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

            console.log(decrypted);
        } catch (error: any) {
            console.error('View failed:', error.message);
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
  help             Show this help message

Examples:
  ./main.js encrypt secrets.txt
  ./main.js decrypt secrets.txt
  ./main.js view secrets.txt
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
