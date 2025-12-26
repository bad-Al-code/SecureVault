import path from 'node:path';
import { SyncState } from '../types';
import { FileService } from './file.service';

export class SyncStateService {
  private static readonly STATE_DIR = '.vault_history';
  private static readonly STATE_FILE = 'sync_state.json';

  /**
   * Retrieves the current sync state from the state file.
   * @returns
   */
  public static async getState(): Promise<SyncState> {
    const statePath = this.getStatePath();
    if (!(await FileService.fileExists(statePath))) {
      return {};
    }

    try {
      const content = await FileService.readFile(statePath);

      return JSON.parse(content) as SyncState;
    } catch {
      return {};
    }
  }

  /**
   * Updates the state for a specific file with the given ETag and current timestamp.
   * @param filename - The relative path of the file.
   * @param etag - The ETag string to store.
   */
  public static async updateFileState(
    filename: string,
    etag: string
  ): Promise<void> {
    const currentState = await this.getState();
    const normalizedKey = path.normalize(filename);

    const newState: SyncState = {
      ...currentState,
      [normalizedKey]: {
        etag,
        lastSynced: new Date().toISOString(),
      },
    };

    await this._writeState(newState);
  }

  /**
   * Gets the stored ETag for a given file.
   * @param filename - The name of the file.
   * @returns The ETag string if it exists, otherwise null.
   */
  public static async getFileETag(filename: string): Promise<string | null> {
    const state = await this.getState();
    const normalizedKey = path.normalize(filename);

    return state[normalizedKey]?.etag || null;
  }

  /**
   * Updates the sync state for a specific file.
   * @param state - The current sync state object.
   */
  private static async _writeState(state: SyncState): Promise<void> {
    await FileService.createDirectory(this.STATE_DIR);
    await FileService.writeFile(
      this.getStatePath(),
      JSON.stringify(state, null, 2)
    );
  }

  /**
   * Constructs the full path to the sync state file.
   * @returns The full path as a string.
   */
  private static getStatePath(): string {
    return path.join(this.STATE_DIR, this.STATE_FILE);
  }
}
