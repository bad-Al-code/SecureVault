import { ICommand } from '../core';
import { FileService, MultiKeyCryptoService } from '../services';
import { getPassword, LoadingIndicator } from '../utils';

export class RotateKeyCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Executes the rotate-key command.
   * @param args - [filename]
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length === 0) {
      throw new Error('The "rotate-key" command requires a filename.');
    }

    const filename = args[0];

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
      this.loadingIndicator.start('Rotating key...');

      // Get old password
      console.log('\nEnter the old password to rotate:');
      const oldPassword = await getPassword(false);

      // Verify old password works
      await MultiKeyCryptoService.decrypt(fileContent, oldPassword);

      // Get key slots to find which one to remove
      const keySlots = MultiKeyCryptoService.listKeys(fileContent);

      // Find the key slot that matches the old password
      let keySlotToRemove: string | null = null;
      for (const slot of keySlots) {
        try {
          // Try to decrypt with this slot - if it works, this is the one
          await MultiKeyCryptoService.decrypt(fileContent, oldPassword);
          keySlotToRemove = slot.id;
          break;
        } catch {
          continue;
        }
      }

      // Get new password
      console.log('\nEnter the new password:');
      const newPassword = await getPassword(true);

      // Add new key first
      let updatedContent = await MultiKeyCryptoService.addKey(
        fileContent,
        oldPassword,
        newPassword
      );

      // Remove old key if we have more than one key slot
      if (keySlotToRemove && keySlots.length > 1) {
        updatedContent = await MultiKeyCryptoService.removeKey(
          updatedContent,
          newPassword,
          keySlotToRemove
        );
      } else if (keySlots.length === 1) {
        // If only one key, just remove it after adding the new one
        const updatedKeySlots = MultiKeyCryptoService.listKeys(updatedContent);
        const oldKeySlot = updatedKeySlots.find(
          (slot) => slot.id !== keySlotToRemove
        );
        if (oldKeySlot) {
          updatedContent = await MultiKeyCryptoService.removeKey(
            updatedContent,
            newPassword,
            updatedKeySlots[0].id
          );
        }
      }

      // Write back to file
      await FileService.writeFile(filename, updatedContent);

      this.loadingIndicator.stop(
        `✔  Key rotated successfully for ${filename}`
      );
    } catch (error) {
      this.loadingIndicator.stop();
      throw error;
    }
  }
}
