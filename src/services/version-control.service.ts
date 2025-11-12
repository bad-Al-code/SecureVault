import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { VersionLogEntry } from '../core';
import { CryptoService } from './crypto.service';

export class VersionControlService {
  private static readonly VAULT_HISTORY_DIR = '.vault_history';
  private static readonly LOG_FILE_NAME = 'version_log.json';
  private static readonly MAX_VERSIONS = 10;

  /**
   * Initializes version control for a file by creating the first version snapshot.
   * @param filename The path to the file.
   * @param commitMessage The initial commit message.
   */
  public static async init(
    filename: string,
    commitMessage: string
  ): Promise<void> {
    const fileHistoryDir = this.getFileHistoryDir(filename);
    await fs.mkdir(fileHistoryDir, { recursive: true });

    const logFile = path.join(fileHistoryDir, this.LOG_FILE_NAME);
    const versionLog = await this.readVersionLog(logFile);

    const versionId = crypto.randomBytes(16).toString('hex');

    const newEntry: VersionLogEntry = {
      id: versionId,
      timeStamp: new Date().toISOString(),
      message: commitMessage,
      originalHash: this.getFileHash(filename),
    };

    versionLog.unshift(newEntry);

    await this.pruneOldVersions(versionLog, fileHistoryDir);
    await this.writeVersionLog(logFile, versionLog);

    const versionFile = path.join(fileHistoryDir, `${versionId}.enc`);
    await fs.copyFile(filename, versionFile);
  }

  /**
   * Displays the version history for a given file.
   * @param filename - The path to the file.
   */
  public static async showHistory(filename: string): Promise<void> {
    const fileHistoryDir = this.getFileHistoryDir(filename);
    const logFile = path.join(fileHistoryDir, this.LOG_FILE_NAME);
    const versionLog = await this.readVersionLog(logFile);

    if (versionLog.length === 0) {
      console.log('No version history found for this file.');

      return;
    }

    console.log(`Version history for ${path.basename(filename)}: \n`);
    versionLog.forEach((entry, index) => {
      const date = new Date(entry.timeStamp);
      const formattedDate = isNaN(date.getTime())
        ? 'Invalid Date'
        : date.toLocaleString();

      console.log(
        `[${index + 1}] Commit: ${entry.id}\n` +
          `    Date:    ${formattedDate}\n` +
          `    Message: ${entry.message}\n`
      );
    });
  }

  /**
   * Restores a file to a specific version from its history.
   * @param filename The path to the file to restore.
   * @param versionId The Id of the version to restore to.
   * @param password The password to decrypt to the version snapshot.
   */
  public static async restore(
    filename: string,
    versionId: string,
    password: string
  ): Promise<void> {
    const fileHistoryDir = this.getFileHistoryDir(filename);
    const logFile = path.join(fileHistoryDir, this.LOG_FILE_NAME);
    const versionLog = await this.readVersionLog(logFile);

    const versionEntry = versionLog.find((entry) => entry.id === versionId);
    if (!versionEntry) {
      throw new Error(`Version with ID "${versionId}" not found.`);
    }

    const versionFile = path.join(fileHistoryDir, `${versionId}.enc`);
    const encryptedDate = await fs.readFile(versionFile, 'utf-8');

    const decryptedContent = await CryptoService.decrypt(
      encryptedDate,
      password
    );

    await fs.writeFile(filename, decryptedContent);
  }

  /**
   * Gets the history directory for a file.
   * @param filename File path to get history directory for.
   * @returns Path to the file's history directory.
   */
  private static getFileHistoryDir(filename: string): string {
    const fileBaseName = path.basename(filename);

    return path.join(
      path.dirname(filename),
      this.VAULT_HISTORY_DIR,
      fileBaseName
    );
  }

  /**
   * Reads and parses the version log file.
   * @param logFilePath Path to the version log file.
   * @returns Parsed version log entries or an empty list.
   */
  private static async readVersionLog(
    logFilePath: string
  ): Promise<VersionLogEntry[]> {
    try {
      const content = await fs.readFile(logFilePath, 'utf-8');

      return JSON.parse(content) as VersionLogEntry[];
    } catch {
      return [];
    }
  }

  /**
   * Generates a SHA-256 hash for a file.
   * @param filename File to hash.
   * @returns File hash or an empty string on error.
   */
  private static getFileHash(filename: string): string {
    try {
      const fileBuffer = readFileSync(filename);

      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch {
      return '';
    }
  }

  private static async writeVersionLog(
    logFilePath: string,
    log: VersionLogEntry[]
  ): Promise<void> {
    await fs.writeFile(logFilePath, JSON.stringify(log, null, 2));
  }

  /**
   * Removes old file versions if they exceed the limit.
   * @param log List of version log entries.
   * @param historyDir Directory containing version files.
   */
  private static async pruneOldVersions(
    log: VersionLogEntry[],
    historyDir: string
  ): Promise<void> {
    while (log.length > this.MAX_VERSIONS) {
      const oldest = log.pop();

      if (oldest) {
        const versionFile = path.join(historyDir, `${oldest.id}.enc`);

        try {
          await fs.unlink(versionFile);
        } catch {
          /* empty */
        }
      }
    }
  }
}
