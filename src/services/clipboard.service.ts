import clipboardy from 'clipboardy';

import { ConsoleFormatter } from '../utils';

export class ClipboardService {
  /**
   * Copies text to system clipboard.
   * @param text
   */
  public static async write(text: string): Promise<void> {
    await clipboardy.write(text);
  }

  /**
   * Reads text from the system clipboard.
   * @returns clipboard content
   */
  public static async read(): Promise<string> {
    return clipboardy.read();
  }

  /**
   * Clears the clipboard (writes empty string).
   */
  public static async clear(): Promise<void> {
    await clipboardy.write('');
  }

  /**
   * Copies text to clipboard and clears it after a delay.
   * Keeps the process alive during the duration.
   *
   * @param text - The secret to copy.
   * @param ttlSeconds - How long to keep it (default 30s).
   */
  public static async writeWithAutoClear(
    text: string,
    ttlSeconds: number = 30
  ): Promise<void> {
    await this.write(text);
    this.logCopySuccess(ttlSeconds);

    return new Promise<void>((resolve) => {
      const timeout = this.scheduleAutoClear(text, ttlSeconds);

      this.registerSigintHandler(timeout);
    });
  }

  /**
   * Logs clipboard copy success and countdown message.
   * @param ttlSeconds
   */
  private static logCopySuccess(ttlSeconds: number): void {
    console.log(ConsoleFormatter.green(`✔  Secret copied to clipboard!`));

    console.log(
      ConsoleFormatter.yellow(
        `⏳ Clearing clipboard in ${ttlSeconds} seconds... (Press Ctrl+C to clear immediately)`
      )
    );
  }

  /**
   * Schedules clipboard auto-clear after TTL.
   * @param originalText - Text that was initially copied
   * @param ttlSeconds - Delay before clearing
   * @returns timeout reference
   */
  private static scheduleAutoClear(
    originalText: string,
    ttlSeconds: number
  ): NodeJS.Timeout {
    return setTimeout(async () => {
      try {
        const currentContent = await this.read();

        if (currentContent === originalText) {
          await this.clear();

          console.log(
            ConsoleFormatter.gray('\n✔  Clipboard cleared automatically.')
          );
        } else {
          console.log(
            ConsoleFormatter.gray(
              '\nℹClipboard changed externally. Skipped clearing.'
            )
          );
        }
      } catch {
        // intentionally ignored
      }
    }, ttlSeconds * 1000);
  }

  /**
   * Registers SIGINT handler to clear clipboard immediately.
   * @param timeout - Auto-clear timeout reference
   */
  private static registerSigintHandler(timeout: NodeJS.Timeout): void {
    process.on('SIGINT', async () => {
      clearTimeout(timeout);
      await this.clear();

      console.log(ConsoleFormatter.gray('\n✔  Clipboard cleared. Exiting.'));

      process.exit(0);
    });
  }
}
