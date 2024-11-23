import * as crypto from 'node:crypto';
import { VaultConfig, EncryptedData, VaultOptions } from '../types';
import { CustomRandom } from './customRandom';

export class Vault {
    private readonly config: VaultConfig;

    constructor(options?: VaultOptions) {
        this.config = {
            saltSize: 32,
            iterations: 10000,
            keyLength: 32,
            header: '$VAULT;1.1;AES256\n',
            ...options?.config,
        };
    }

    private async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(
                password,
                salt,
                this.config.iterations,
                this.config.keyLength,
                'sha256',
                (err, derivedKey) => {
                    if (err) reject(err);
                    else resolve(derivedKey);
                },
            );
        });
    }

    async encrypt(data: string, password: string): Promise<string> {
        CustomRandom.initialize();

        const salt = CustomRandom.randomBytes(this.config.saltSize);
        const iv = CustomRandom.randomBytes(16);

        const key = await this.deriveKey(password, salt);

        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return [
            this.config.header.trim(),
            salt.toString('hex'),
            iv.toString('hex'),
            encrypted,
        ].join('\n');
    }

    async decrypt(encryptedData: string, password: string): Promise<string> {
        const lines = encryptedData.split('\n');

        if (lines[0] !== this.config.header.trim()) {
            throw new Error('Invalid vault format');
        }

        const salt = Buffer.from(lines[1], 'hex');
        const iv = Buffer.from(lines[2], 'hex');
        const encrypted = lines[3];

        const key = await this.deriveKey(password, salt);

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}
