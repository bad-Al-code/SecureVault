import { VersionControlService } from '../services';
import { ICommand, VersionComparison } from '../types';
import { getPassword, LoadingIndicator } from '../utils';

export class CompareCommand implements ICommand {
  /**
   * Executes the compare command.
   * @param args - An array containing the file path, version 1 ID, and version 2 ID.
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length !== 3) {
      throw new Error(
        'The "compare" command requires a filename and two version IDs.'
      );
    }

    const [filename, version1Id, version2Id] = args;
    const loadingIndicator = new LoadingIndicator();

    try {
      const password = await getPassword();
      loadingIndicator.start('Decrypting and comparing versions...');

      const result = await VersionControlService.compareVersions(
        filename,
        version1Id,
        version2Id,
        password
      );

      loadingIndicator.stop('Comparison complete.');

      this._formatOutput(result);
    } catch (err) {
      const error = err as Error;

      loadingIndicator.stop();
      console.error(`✘ Comparison failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Formats and prints the comparison result to the console.
   * @param result - The structured comparison object.
   */
  private _formatOutput(result: VersionComparison): void {
    console.log(`--- Comparison ---`);
    console.log(
      `Older: ${result.version1.id.substring(0, 12)} (${new Date(result.version1.timeStamp).toLocaleString()})`
    );
    console.log(
      `Newer: ${result.version2.id.substring(0, 12)} (${new Date(result.version2.timeStamp).toLocaleString()})`
    );
    console.log(`------------------`);

    if (result.removedLines.length === 0 && result.addedLines.length === 0) {
      console.log('No differences found.');

      return;
    }

    result.removedLines.forEach((line) => {
      console.log(`\x1b[31m- ${line}\x1b[0m`);
    });

    result.addedLines.forEach((line) => {
      console.log(`\x1b[32m+ ${line}\x1b[0m`);
    });
  }
}
