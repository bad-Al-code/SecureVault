import path from 'node:path';
import { VaultConfig } from '../core';
import { FileService } from './file.service';

export class ConfigService {
  private static readonly CONFIG_DIR = '.vault_history';
  private static readonly CONFIG_FILE = 'config.json';

  /**
   * Retrieves the current configuration.
   * @returns A Promise resolving to the VaultConfig object
   */
  public static async get(): Promise<VaultConfig> {
    const configPath = this.getConfigFilePath();

    if (!(await FileService.fileExists(configPath))) {
      return {} as VaultConfig;
    }

    try {
      const content = await FileService.readFile(configPath);

      return JSON.parse(content) as VaultConfig;
    } catch {
      return {};
    }
  }

  /**
   * Updates a specific configuration key
   * @param key - The configuration key
   * @param value - The value to store.
   */
  public static async set(
    key: keyof VaultConfig,
    value: string
  ): Promise<void> {
    const currentConfig = await this.get();

    await FileService.createDirectory(this.CONFIG_DIR);

    const newConfig = {
      ...currentConfig,
      [key]: value,
    };

    await FileService.writeFile(
      this.getConfigFilePath(),
      JSON.stringify(newConfig, null, 2)
    );
  }

  private static getConfigFilePath(): string {
    return path.join(this.CONFIG_DIR, this.CONFIG_FILE);
  }
}
