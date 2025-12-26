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

export interface VersionLogEntry {
  id: string;
  timeStamp: string;
  message: string;
  originalHash: string;
}

export interface VersionComparison {
  version1: VersionLogEntry;
  version2: VersionLogEntry;
  addedLines: string[];
  removedLines: string[];
}

export interface EditorCommand {
  command: string;
  args: string[];
}

export interface ICommand {
  execute(args: string[]): Promise<void>;
}

export interface BatchFindOptions {
  recursive?: boolean;
  filePattern?: RegExp;
  excludePattern?: RegExp;
}

export interface KeySlot {
  id: string;
  algorithm: string;
  iterations: number;
  salt: Buffer;
  encryptedDEK: Buffer;
  iv: Buffer;
  createdAt: string;
  label?: string;
}

export interface VaultV2Metadata {
  version: number;
  algorithm: string;
  createdAt: string;
  modifiedAt: string;
}

export interface VaultV2FileParts {
  metadata: VaultV2Metadata;
  keySlots: KeySlot[];
  iv: Buffer;
  authTag: Buffer;
  encryptedContent: string;
}
