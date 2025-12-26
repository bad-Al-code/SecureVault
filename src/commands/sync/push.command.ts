import fs from 'node:fs/promises';
import path from 'node:path';

import { CryptoService, FileService, S3Service } from '../../services';
import { ICommand } from '../../types';
import { ConsoleFormatter, findFiles, LoadingIndicator } from '../../utils';

export class SyncPushCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Determines if a file should be uploaded based on its existence and hash comparison.
   * @param _args - Local file path.
   */
  public async execute(_args: string[]): Promise<void> {
    this.loadingIndicator.start('Initializing sync...');

    try {
      const remoteFiles = await S3Service.listFiles();
      const remoteMap = new Map(remoteFiles.map((file) => [file.key, file]));

      const localFiles = await findFiles('.', {
        excludePattern: /(\.vault_history|\.git|node_modules|dist|coverage)/,
      });

      this.loadingIndicator.stop();

      let uploadCount = 0;
      let skippedCount = 0;

      for (const filePath of localFiles) {
        const content = await FileService.readFile(filePath);
        if (!CryptoService.isVaultFile(content)) {
          continue;
        }

        const relativePath = path.relative(process.cwd(), filePath);
        const s3Key = relativePath.split(path.sep).join('/');

        const shouldUpload = await this._shouldUpload(
          filePath,
          s3Key,
          remoteMap
        );

        if (shouldUpload) {
          this.loadingIndicator.stop();
          console.log(ConsoleFormatter.green(`⬆  Uploading: ${s3Key}`));
          this.loadingIndicator.start('Syncing...');

          await S3Service.upload(s3Key, content);
          uploadCount++;
        } else {
          skippedCount++;
        }
      }

      this.loadingIndicator.stop();
      this._printSummary(uploadCount, skippedCount);
    } catch (err) {
      this.loadingIndicator.stop();
      const error = err as Error;

      console.error(ConsoleFormatter.red(`✘ Push failed: ${error.message}`));

      process.exit(1);
    }
  }

  /**
   * Determines if a local file should be uploaded to S3 by comparing its last modified time with the remote file's last modified time.
   * @param localPath - Path to the local file.
   * @param s3Key - Corresponding S3 key for the file.
   * @param remoteMap - Map of remote files with their last modified dates.
   * @returns A boolean indicating whether the file should be uploaded.
   */
  private async _shouldUpload(
    localPath: string,
    s3Key: string,
    remoteMap: Map<string, { lastModified: Date }>
  ): Promise<boolean> {
    const remoteFile = remoteMap.get(s3Key);
    if (!remoteFile) return true;

    const stats = await fs.stat(localPath);

    return stats.mtime.getTime() > remoteFile.lastModified.getTime() + 1000;
  }

  /**
   * Prints a summary of the sync operation.
   * @param uploaded - Number of files uploaded.
   * @param skipped - Number of files skipped.
   */
  private _printSummary(uploaded: number, skipped: number): void {
    console.log('\n' + ConsoleFormatter.cyan('--- Sync Summary ---'));
    console.log(`Uploaded: ${uploaded}`);
    console.log(`Skipped:  ${skipped} (Up to date)`);
    console.log('--------------------');
  }
}
