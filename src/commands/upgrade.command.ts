import { ICommand } from '../core';
import { CryptoService, FileService, MultiKeyCryptoService } from '../services';
import { getPassword, LoadingIndicator } from '../utils';

export class UpgradeCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Executes the upgrade command to convert V1 vault files to V2 format.
   * @param args - [filename]
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length === 0) {
      throw new Error('The "upgrade" command requires a filename.');
    }

    const filename = args[0];

    // Check if file exists
    if (!(await FileService.fileExists(filename))) {
      throw new Error(`File not found: ${filename}`);
    }

    // Read the file
    const fileContent = await FileService.readFile(filename);

    // Check version
    const version = CryptoService.getVaultVersion(fileContent);

    if (version === 0) {
      throw new Error(`${filename} is not a vault file.`);
    }

    if (version === 2) {
      console.log(`✔  ${filename} is already in V2 format.`);
      return;
    }

    try {
      this.loadingIndicator.start(`Upgrading ${filename} to V2 format...`);

      // Get password to decrypt V1 file
      console.log('\nEnter the password for this vault file:');
      const password = await getPassword(false);

      // Decrypt V1 file
      const plainText = await CryptoService.decrypt(fileContent, password);

      // Re-encrypt using V2 format
      const encryptedV2 = await MultiKeyCryptoService.encrypt(plainText, [
        password,
      ]);

      // Write back to file
      await FileService.writeFile(filename, encryptedV2);

      this.loadingIndicator.stop(
        `✔  ${filename} upgraded successfully to V2 format`
      );
      console.log('\n💡 You can now add additional keys using "vault add-key"');
    } catch (error) {
      this.loadingIndicator.stop();
      throw error;
    }
  }
}
