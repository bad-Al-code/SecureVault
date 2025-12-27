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

export interface VaultConfig {
  awsBucket?: string;
  awsRegion?: string;
  awsEndpoint?: string;
  [key: string]: unknown;
}

export interface SyncStateEntry {
  etag: string;
  lastSynced: string;
}

export interface SyncState {
  [filename: string]: SyncStateEntry;
}

export interface CloudFileMetadata {
  key: string;
  lastModified: Date;
  size: number;
  etag?: string;
}

export interface S3FileMetadata {
  key: string;
  lastModified: Date;
  size: number;
}

export interface DownloadResult {
  content: string;
  etag: string;
}

export interface ICloudStorageProvider {
  /**
   * The unique name of the cloud storage provider (e.g., 'aws-s3').
   */
  name: string;

  /**
   * Uploads a string or buffer content to the cloud storage.
   * @param key - The path/key of the file.
   * @param body - The content of the file (string or Buffer).
   * @param previousEtag - Optional ETag of the version we expect to overwrite.
   * @returns The new ETag of the uploaded file.
   */
  upload(
    key: string,
    body: string | Buffer,
    previousEtag?: string
  ): Promise<string>;

  /**
   * Downloads a file's content and metadata from the cloud storage.
   * @param key - The path/key of the file.
   * @returns An object containing the file content as a string and its ETag.
   */
  download(key: string): Promise<DownloadResult>;

  /**
   * Lists all files in the cloud storage bucket/container.
   * @returns An array of metadata for each file.
   */
  listFiles(): Promise<CloudFileMetadata[]>;
}

export type VaultActionType =
  | 'view'
  | 'edit'
  | 'decrypt'
  | 'encrypt'
  | 'restore';

export interface FileUsageStats {
  accessCount: number;
  lastAccessed: string;
  firstTracked: string;
  actions: {
    [key in VaultActionType]?: number;
  };
}

export interface AnalyticsData {
  [filepath: string]: FileUsageStats;
}

export interface VaultHealthReport {
  totalFiles: number;
  totalSizeBytes: number;
  historySizeBytes: number;
  mostAccessedFiles: Array<{ name: string; count: number }>;
  warnings: Array<{
    file: string;
    message: string;
    severity: 'CRITICAL' | 'WARNING';
  }>;
}
