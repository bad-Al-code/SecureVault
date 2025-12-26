import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { ICommand } from '../../core';
import { FileService, S3Service } from '../../services';
import { ConsoleFormatter, LoadingIndicator } from '../../utils';

export class SyncPullCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Executes the sync pull command.
   * @param _args - Command line arguments (not used).
   */
  public async execute(_args: string[]): Promise<void> {
    this.loadingIndicator.start('Fetching remote file list...');

    try {
      const remoteFiles = await S3Service.listFiles();

      this.loadingIndicator.stop();
      console.log(
        ConsoleFormatter.cyan(
          `Found ${remoteFiles.length} remote files. Checking status...`
        )
      );
      this.loadingIndicator.start('Syncing...');

      let downloadedCount = 0;
      let skippedCount = 0;

      for (const remoteFile of remoteFiles) {
        const localPath = path.join(
          process.cwd(),
          ...remoteFile.key.split('/')
        );

        const shouldDownload = await this._shouldDownload(
          localPath,
          remoteFile.lastModified
        );

        if (shouldDownload) {
          this.loadingIndicator.stop();
          console.log(
            ConsoleFormatter.green(`⬇  Downloading: ${remoteFile.key}`)
          );
          this.loadingIndicator.start('Syncing...');

          await FileService.createDirectory(path.dirname(localPath));

          const content = await S3Service.download(remoteFile.key);
          await FileService.writeFile(localPath, content);

          downloadedCount++;
        } else {
          skippedCount++;
        }
      }

      this.loadingIndicator.stop();
      this._printSummary(downloadedCount, skippedCount);
    } catch (err) {
      this.loadingIndicator.stop();

      const error = err as Error;
      console.error(ConsoleFormatter.red(`✘ Pull failed: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Determines if a file should be downloaded based on existence and modification time.
   * @param localPath - The local file path.
   * @param remoteDate - The last modified date of the remote file.
   * @returns True if the file should be downloaded, false otherwise.
   */
  private async _shouldDownload(
    localPath: string,
    remoteDate: Date
  ): Promise<boolean> {
    const exists = await FileService.fileExists(localPath);

    if (!exists) {
      return true;
    }

    const stats = await fs.stat(localPath);

    return remoteDate.getTime() > stats.mtime.getTime();
  }

  /**
   * Prints a summary of the sync operation.
   * @param downloaded - Number of files downloaded.
   * @param skipped - Number of files skipped.
   */
  private _printSummary(downloaded: number, skipped: number): void {
    console.log('\n' + ConsoleFormatter.cyan('--- Sync Summary ---'));
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Skipped:    ${skipped} (Local is up to date)`);
    console.log('--------------------');
  }
}
