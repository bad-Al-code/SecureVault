export interface VaultConfig {
    saltSize: number;
    iterations: number;
    keyLength: number;
    header: string;
}

export interface EncryptedData {
    salt: Buffer;
    iv: Buffer;
    encrypted: string;
}

export interface VaultOptions {
    config?: Partial<VaultConfig>;
}

export type VaultCommand = 'encrypt' | 'decrypt' | 'view';
