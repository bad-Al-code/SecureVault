export interface PasswordStrengthResult {
    score: number;
    feedback: string[];
    isStrong: boolean;
}

export enum PasswordStrengthDescription {
    VeryWeak = 'Very Weak',
    Weak = 'Weak',
    Moderate = 'Moderate',
    Strong = 'Strong',
    VeryStrong = 'Very Strong',
}

export interface VaultFileParts {
    salt: Buffer;
    iv: Buffer;
    encryptedContent: string;
}
