import { CryptoService, FileService, VaultActionService } from '../../services';
import { ICommand } from '../../types';
import { LoadingIndicator, findFiles, getPassword } from '../../utils';

export class BatchEncryptCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Executes the batch encryption command.
   * @param args - An array containing the single directory path.
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length !== 1) {
      throw new Error(
        'The "batch-encrypt" command requires exactly one directory path.'
      );
    }

    const directory = args[0];

    this.loadingIndicator.start(`Finding files in ${directory}...`);

    const allFiles = await findFiles(directory);
    const filesToEncrypt = await this._filterUnencryptedFiles(allFiles);

    this.loadingIndicator.stop();

    if (filesToEncrypt.length === 0) {
      console.log('No unencrypted files found to process.');
      return;
    }

    console.log(`Found ${filesToEncrypt.length} file(s) to encrypt.`);

    await this._processFiles(filesToEncrypt);
  }

  /**
   * Filters a list of file paths, returning only those that are not already encrypted.
   * @param filenames - A list of file paths to check.
   * @returns A promise that resolves to an array of unencrypted file paths.
   */
  private async _filterUnencryptedFiles(
    filenames: string[]
  ): Promise<string[]> {
    const unencryptedFiles = [];

    for (const filename of filenames) {
      const content = await FileService.readFile(filename);

      if (!CryptoService.isVaultFile(content)) {
        unencryptedFiles.push(filename);
      }
    }

    return unencryptedFiles;
  }

  /**
   * Encrypts a list of files using a single password prompt.
   * @param filesToEncrypt - The list of file paths to encrypt.
   */
  private async _processFiles(filesToEncrypt: string[]): Promise<void> {
    const password = await getPassword(true);

    for (const filename of filesToEncrypt) {
      await VaultActionService.encryptFile(filename, password);
    }
  }
}
