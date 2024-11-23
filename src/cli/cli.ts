import * as fs from 'fs/promises';
import { Vault } from '../crypto/vault';
import { getPassword } from '../utils/password';

export class CLI {
    private readonly vault: Vault;

    constructor() {
        this.vault = new Vault();
    }

    async encryptFile(filename: string): Promise<void> {
        try {
            const data = await fs.readFile(filename, 'utf8');
            const password = await getPassword(true);

            const encrypted = await this.vault.encrypt(data, password);
            await fs.writeFile(filename, encrypted);

            console.log('Encryption successful');
        } catch (error: any) {
            console.error('Encryption failed:', error.message);
            process.exit(1);
        }
    }

    async decryptFile(filename: string): Promise<void> {
        try {
            const encryptedData = await fs.readFile(filename, 'utf8');
            const password = await getPassword();

            const decrypted = await this.vault.decrypt(encryptedData, password);
            await fs.writeFile(filename, decrypted);

            console.log('Decryption successful');
        } catch (error: any) {
            console.error('Decryption failed:', error.message);
            process.exit(1);
        }
    }

    async viewFile(filename: string): Promise<void> {
        try {
            const encryptedData = await fs.readFile(filename, 'utf8');
            const password = await getPassword();

            const decrypted = await this.vault.decrypt(encryptedData, password);
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
