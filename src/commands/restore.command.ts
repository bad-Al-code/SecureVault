import { ICommand } from '../core';
import { VersionControlService } from '../services';
import { getPassword, LoadingIndicator } from '../utils';

export class RestoreCommand implements ICommand {
  /**
   * Executes the restore command.
   * @param args - An array containing the file path and the version ID.
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length !== 2) {
      throw new Error(
        'The "restore" command requires a filename and a version ID.'
      );
    }

    const [filename, versionId] = args;
    const loadingIndicator = new LoadingIndicator();

    try {
      const password = await getPassword();
      loadingIndicator.start(`Restoring version ${versionId}...`);

      await VersionControlService.restore(filename, versionId, password);

      loadingIndicator.stop(`✔  Restored version ${versionId} successfully.`);
    } catch (err) {
      const error = err as Error;

      loadingIndicator.stop();
      console.error(`✘ Restoration failed: ${error.message}`);
      process.exit(1);
    }
  }
}
