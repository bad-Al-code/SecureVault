import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ConsoleFormatter } from '../utils';
import { FileService } from './file.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('../../package.json');

interface UpdateState {
  lastChecked: number;
  latestVersion: string;
}

export class UpdateService {
  private static readonly HOME_DIR = os.homedir();
  private static readonly VAULT_DIR = path.join(
    UpdateService.HOME_DIR,
    '.vault'
  );
  private static readonly UPDATE_FILE = path.join(
    UpdateService.VAULT_DIR,
    'update_check.json'
  );
  private static readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 Hours
  private static readonly GITHUB_API =
    'https://github.com/bad-Al-code/SecureVault/releases/latest';

  /**
   * Checks if an update is available.
   * Handles caching and fetching from GitHub.
   * @returns The latest version string if an update is available, otherwise null.
   */
  public static async checkForUpdates(): Promise<string | null> {
    try {
      const state = await this.readState();
      const now = Date.now();
      const currentVersion = packageJson.version;

      let latestVersion: string | null = state?.latestVersion ?? null;

      if (!state || now - state.lastChecked > this.CHECK_INTERVAL) {
        try {
          latestVersion = await this.fetchLatestVersion();
          if (latestVersion) {
            await this.writeState({ lastChecked: now, latestVersion });
          }
        } catch {
          // If fetch fails (offline), just use whatever we have or skip
        }
      }

      if (latestVersion && latestVersion !== currentVersion) {
        const cleanLatest = latestVersion.replace(/^v/, '');
        const cleanCurrent = currentVersion.replace(/^v/, '');

        if (cleanLatest !== cleanCurrent) {
          return latestVersion;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Displays the update notification box.
   * @param latestVersion
   */
  public static notify(latestVersion: string): void {
    const currentVersion = packageJson.version;
    const border = '─'.repeat(50);

    console.log('');
    console.log(ConsoleFormatter.yellow(`╭${border}╮`));
    console.log(
      ConsoleFormatter.yellow(
        `│  Update available ${currentVersion} → ${ConsoleFormatter.green(latestVersion).padEnd(28)}   │`
      )
    );
    console.log(ConsoleFormatter.yellow(`│${' '.repeat(50)}│`));
    console.log(
      ConsoleFormatter.yellow(
        `│  Run the following to upgrade:${' '.repeat(19)}│`
      )
    );
    console.log(
      ConsoleFormatter.yellow(
        `│  https://github.com/bad-Al-code/SecureVault/releases  │`
      )
    );
    console.log(ConsoleFormatter.yellow(`╰${border}╯`));
    console.log('');
  }

  private static async fetchLatestVersion(): Promise<string | null> {
    try {
      const response = await fetch(this.GITHUB_API, {
        headers: {
          'User-Agent': 'SecureVault-CLI',
        },

        signal: AbortSignal.timeout(2000),
      });

      console.log(response);

      if (!response.ok) return null;

      const data = (await response.json()) as { tag_name: string };

      return data.tag_name;
    } catch {
      return null;
    }
  }

  private static async readState(): Promise<UpdateState | null> {
    try {
      const content = await FileService.readFile(this.UPDATE_FILE);

      return JSON.parse(content) as UpdateState;
    } catch {
      return null;
    }
  }

  private static async writeState(state: UpdateState): Promise<void> {
    try {
      await fs.mkdir(this.VAULT_DIR, { recursive: true });
      await fs.writeFile(this.UPDATE_FILE, JSON.stringify(state));
    } catch {
      // Ignore
    }
  }
}
