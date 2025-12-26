import { ICommand } from '../core';
import { FileService, MultiKeyCryptoService } from '../services';
import { getPassword, LoadingIndicator } from '../utils';

export class AddKeyCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Executes the add-key command.
   * @param args - [filename, optional-label]
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length === 0) {
      throw new Error('The "add-key" command requires a filename.');
    }

    const filename = args[0];
    const label = args[1]; // Optional label for the new key

    // Check if file exists
    if (!(await FileService.fileExists(filename))) {
      throw new Error(`File not found: ${filename}`);
    }

    // Read the file
    const fileContent = await FileService.readFile(filename);

    // Check if it's a V2 vault file
    if (!MultiKeyCryptoService.isVaultFileV2(fileContent)) {
      throw new Error(
        `${filename} is not a V2 vault file. Use "vault upgrade" first.`
      );
    }

    try {
      this.loadingIndicator.start('Adding new key...');

      // Get existing password
      console.log('\nEnter an existing password to authenticate:');
      const existingPassword = await getPassword(false);

      // Get new password
      console.log('\nEnter the new password to add:');
      const newPassword = await getPassword(true);

      // Add the new key
      const updatedContent = await MultiKeyCryptoService.addKey(
        fileContent,
        existingPassword,
        newPassword,
        label
      );

      // Write back to file
      await FileService.writeFile(filename, updatedContent);

      this.loadingIndicator.stop(
        `✔  New key added successfully to ${filename}`
      );

      if (label) {
        console.log(`   Label: ${label}`);
      }
    } catch (error) {
      this.loadingIndicator.stop();
      throw error;
    }
  }
}
