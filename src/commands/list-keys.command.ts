import { ICommand } from '../core';
import { FileService, MultiKeyCryptoService } from '../services';

export class ListKeysCommand implements ICommand {
  /**
   * Executes the list-keys command.
   * @param args - [filename]
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length === 0) {
      throw new Error('The "list-keys" command requires a filename.');
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

    // List keys
    const keySlots = MultiKeyCryptoService.listKeys(fileContent);

    console.log(`\n📋 Key slots for ${filename}:\n`);

    if (keySlots.length === 0) {
      console.log('  No key slots found.');
      return;
    }

    keySlots.forEach((slot, index) => {
      console.log(`  ${index + 1}. Key Slot`);
      console.log(`     ID: ${slot.id}`);
      console.log(`     Algorithm: ${slot.algorithm}`);
      console.log(`     Created: ${new Date(slot.createdAt).toLocaleString()}`);
      if (slot.label) {
        console.log(`     Label: ${slot.label}`);
      }
      console.log('');
    });

    console.log(`Total: ${keySlots.length} key slot(s)\n`);
  }
}
