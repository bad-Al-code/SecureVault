import { ICommand } from '../core';
import { FileService, MultiKeyCryptoService } from '../services';
import { getPassword, LoadingIndicator } from '../utils';

export class RemoveKeyCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Executes the remove-key command.
   * @param args - [filename, optional-key-slot-id]
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length === 0) {
      throw new Error('The "remove-key" command requires a filename.');
    }

    const filename = args[0];
    const keySlotId = args[1]; // Optional key slot ID

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
      // List available keys
      const keySlots = MultiKeyCryptoService.listKeys(fileContent);

      if (keySlots.length <= 1) {
        console.log(
          '⚠️  Cannot remove the last key. At least one key must remain.'
        );
        return;
      }

      console.log('\nAvailable key slots:');
      keySlots.forEach((slot, index) => {
        console.log(
          `  ${index + 1}. ID: ${slot.id.substring(0, 8)}... ${slot.label ? `(${slot.label})` : ''}`
        );
        console.log(
          `     Created: ${new Date(slot.createdAt).toLocaleString()}`
        );
      });

      // Determine which key to remove
      let selectedKeySlotId: string;

      if (keySlotId) {
        // Key slot ID provided as argument
        selectedKeySlotId = keySlotId;
      } else {
        // Prompt user to select
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const selection = await new Promise<string>((resolve) => {
          rl.question(
            '\nEnter the number of the key slot to remove: ',
            (answer: string) => {
              rl.close();
              resolve(answer);
            }
          );
        });

        const index = parseInt(selection, 10) - 1;
        if (index < 0 || index >= keySlots.length) {
          throw new Error('Invalid selection.');
        }

        selectedKeySlotId = keySlots[index].id;
      }

      this.loadingIndicator.start('Removing key...');

      // Get authentication password
      console.log('\nEnter a password to authenticate:');
      const authPassword = await getPassword(false);

      // Remove the key
      const updatedContent = await MultiKeyCryptoService.removeKey(
        fileContent,
        authPassword,
        selectedKeySlotId
      );

      // Write back to file
      await FileService.writeFile(filename, updatedContent);

      this.loadingIndicator.stop(
        `✔  Key removed successfully from ${filename}`
      );
    } catch (error) {
      this.loadingIndicator.stop();
      throw error;
    }
  }
}
