import fs from 'node:fs/promises';
import path from 'node:path';

import {
  CloudStorageFactory,
  CryptoService,
  FileService,
  SyncStateService,
} from '../../services';
import { ICloudStorageProvider, ICommand } from '../../types';
import { ConsoleFormatter, findFiles, LoadingIndicator } from '../../utils';

export class SyncPushCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();
  private readonly cloudProvder: ICloudStorageProvider;

  constructor() {
    this.cloudProvder = CloudStorageFactory.getProvider();
  }

  /**
   * Determines if a file should be uploaded based on its existence and hash comparison.
   * @param _args - Local file path.
   */
  public async execute(_args: string[]): Promise<void> {
    this.loadingIndicator.start('Initializing sync...');

    try {
      const remoteFiles = await this.cloudProvder.listFiles();
      const remoteMap = new Map(remoteFiles.map((file) => [file.key, file]));

      const localFiles = await findFiles('.', {
        excludePattern:
          /(\.vault_history|\.git|node_modules|dist|coverage|iac)/,
      });

      this.loadingIndicator.stop();
      console.log(
        ConsoleFormatter.cyan(
          `Found ${localFiles.length} local files. Checking status...`
        )
      );
      this.loadingIndicator.start('Syncing...');

      let uploadCount = 0;
      let skippedCount = 0;
      let conflictCount = 0;

      for (const filePath of localFiles) {
        try {
          const header = await FileService.readFirstBytes(filePath, 6);
          if (!CryptoService.isVaultFile(header)) {
            continue;
          }
        } catch (error) {
          console.warn(
            ConsoleFormatter.yellow(
              `Could not read file ${filePath}: ${(error as Error).message}`
            )
          );
          continue;
        }

        const content = await FileService.readFile(filePath);
        const relativePath = path.relative(process.cwd(), filePath);
        const s3Key = relativePath.split(path.sep).join('/');

        const shouldUpload = await this._shouldUpload(
          filePath,
          s3Key,
          remoteMap
        );

        if (shouldUpload) {
          const previousEtag = await SyncStateService.getFileETag(relativePath);

          this.loadingIndicator.stop();
          console.log(ConsoleFormatter.green(`⬆  Uploading: ${s3Key}`));
          this.loadingIndicator.start('Syncing...');

          try {
            const newEtag = await this.cloudProvder.upload(
              s3Key,
              content,
              previousEtag || undefined
            );

            await SyncStateService.updateFileState(relativePath, newEtag);
            uploadCount++;
          } catch (err) {
            const error = err as Error;
            if (error.message.includes('Remote file has changed')) {
              this.loadingIndicator.stop();

              try {
                const { content: remoteContent } =
                  await this.cloudProvder.download(s3Key);
                const conflictFile = `${filePath}.conflicted.${Date.now()}`;

                await FileService.writeFile(conflictFile, remoteContent);

                console.error(
                  ConsoleFormatter.red(
                    `✘ CONFLICT: ${s3Key} has changed on remote.`
                  )
                );

                console.error(
                  ConsoleFormatter.yellow(
                    `  ➜ Remote version saved to: ${path.basename(conflictFile)}`
                  )
                );
              } catch (_downloadError) {
                console.error(
                  ConsoleFormatter.red(
                    `✘ CONFLICT detected, but failed to download remote version.`
                  )
                );
              }

              this.loadingIndicator.start('Syncing...');
              conflictCount++;
            } else {
              throw error;
            }
          }
        } else {
          skippedCount++;
        }
      }

      this.loadingIndicator.stop();
      this._printSummary(uploadCount, skippedCount, conflictCount);
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
   * @param conflicts - Number of conflicts encountered.
   */
  private _printSummary(
    uploaded: number,
    skipped: number,
    conflicts: number
  ): void {
    console.log('\n' + ConsoleFormatter.cyan('--- Sync Summary ---'));
    console.log(`Uploaded:  ${uploaded}`);
    console.log(`Skipped:   ${skipped}`);
    if (conflicts > 0) {
      console.log(ConsoleFormatter.red(`Conflicts: ${conflicts}`));
    }
    console.log('--------------------');
  }
}
