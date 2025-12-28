import fs from 'node:fs';
import omelette from 'omelette';

export class CompletionService {
  private static completion = omelette('vault');

  public static init(): void {
    this.completion.tree({
      encrypt: this.getFiles,
      decrypt: this.getFiles,
      view: this.getFiles,
      edit: this.getFiles,
      history: this.getFiles,
      restore: this.getFiles,
      compare: this.getFiles,
      search: [],
      config: [
        'awsBucket',
        'awsRegion',
        'awsEndpoint',
        'enableNotifications',
        'sessionTimeout',
      ],
      push: [],
      pull: [],
      logout: [],
      analytics: [],
      'batch-encrypt': this.getDirectories,
      'batch-decrypt': this.getDirectories,
      help: [],
      completion: ['setup'],
    });

    this.completion.init();
  }

  /**
   * Triggers the interactive shell setup wizard provided by omelette.
   */
  public static setup(): void {
    try {
      this.completion.setupShellInitFile();
    } catch (_error) {
      throw new Error(
        'Failed to set up completion. ' +
          'Please ensure you are using Bash, Zsh, or Fish.'
      );
    }
  }

  /**
   * Helper to list files in the current directory.
   * @returns
   */
  private static getFiles(): string[] {
    try {
      return fs.readdirSync('.').filter((f) => {
        try {
          return fs.statSync(f).isFile();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  }

  /**
   * Helper to list directories in the current directory.
   * @returns
   */
  private static getDirectories(): string[] {
    try {
      return fs.readdirSync('.').filter((f) => {
        try {
          return fs.statSync(f).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  }
}
