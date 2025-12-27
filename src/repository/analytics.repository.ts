import path from 'node:path';

import { FileService } from '../services';
import { AnalyticsData, FileUsageStats, VaultActionType } from '../types';

export class AnalyticsRepository {
  private static readonly HISTORY_DIR = '.vault_history';
  private static readonly DATA_FILE = 'analytics.json';

  /**
   * Loads analytics data from disk.
   * @returns Parsed analytics data or an empty object.
   */
  public static async getData(): Promise<AnalyticsData> {
    const filePath = this.getFilePath();

    if (!(await FileService.fileExists(filePath))) {
      return {};
    }

    try {
      const content = await FileService.readFile(filePath);

      return JSON.parse(content) as AnalyticsData;
    } catch {
      return {};
    }
  }

  /**
   * Records an action for a specific file.
   * @param filename - The relative path of the file.
   * @param action - The type of action performed (view, edit, etc.).
   */

  public static async recordAction(
    filename: string,
    action: VaultActionType
  ): Promise<void> {
    const data = await this.getData();
    const normalizedKey = path.normalize(filename);

    const now = new Date().toISOString();
    const entry = data[normalizedKey] || this._createEmptyStats(now);

    entry.accessCount++;
    entry.lastAccessed = now;
    entry.actions[action] = (entry.actions[action] || 0) + 1;

    data[normalizedKey] = entry;
    await this._saveData(data);
  }

  /**
   * Creates an empty usage stats object.
   * @param timestamp - Initial timestamp for the entry.
   * @returns A new FileUsageStats instance.
   */
  private static _createEmptyStats(timestamp: string): FileUsageStats {
    return {
      accessCount: 0,
      lastAccessed: timestamp,
      firstTracked: timestamp,
      actions: {},
    };
  }

  /**
   * Persists analytics data to disk.
   * @param data - Analytics data to save.
   */
  private static async _saveData(data: AnalyticsData): Promise<void> {
    await FileService.createDirectory(this.HISTORY_DIR);
    await FileService.writeFile(
      this.getFilePath(),
      JSON.stringify(data, null, 2)
    );
  }

  /**
   * Resolves the full path to the analytics file.
   * @returns Absolute analytics file path.
   */
  private static getFilePath(): string {
    return path.join(this.HISTORY_DIR, this.DATA_FILE);
  }
}
