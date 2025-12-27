import { spawn } from 'node:child_process';
import * as path from 'node:path';

import { VaultEvents } from '../core';
import {
  CryptoService,
  EditorService,
  EventService,
  FileService,
  VersionControlService,
} from '../services';
import { ICommand } from '../types';
import { getPassword, LoadingIndicator } from '../utils';

/**
 * Handles the secure editing of an encrypted file.
 */
export class EditCommand implements ICommand {
  /**
   * Executes the edit command.
   * @param args - An array containing the single file path to edit.
   */
  public async execute(args: string[]): Promise<void> {
    if (args.length !== 1) {
      throw new Error('The "edit" command requires exactly one filename.');
    }
    const filename = args[0];
    const loadingIndicator = new LoadingIndicator();
    let originalContent: string | null = null;

    try {
      loadingIndicator.start(`Preparing ${filename} for editing...`);
      const encryptedData = await FileService.readFile(filename);
      originalContent = encryptedData;

      if (!CryptoService.isVaultFile(encryptedData)) {
        throw new Error('File is not an encrypted vault file.');
      }
      loadingIndicator.stop();

      const password = await getPassword();
      const decrypted = await this._decryptForEditing(
        encryptedData,
        password,
        loadingIndicator,
        filename
      );

      await FileService.writeFile(filename, decrypted);

      await this._launchEditor(filename);

      await this._reEncryptAfterEditing(filename, password, loadingIndicator);
    } catch (err) {
      const error = err as Error;
      loadingIndicator.stop();
      console.error(`✘ Edit failed: ${error.message}`);

      if (originalContent) {
        await FileService.writeFile(filename, originalContent);
        console.log('ℹ️  Original file has been restored.');
      }
      process.exit(1);
    }
  }

  private async _decryptForEditing(
    data: string,
    pass: string,
    ind: LoadingIndicator,
    filename: string
  ): Promise<string> {
    ind.start('Decrypting...');
    const decrypted = await CryptoService.decrypt(data, pass, filename);
    ind.stop();
    return decrypted;
  }

  private _launchEditor(filename: string): Promise<void> {
    const editor = EditorService.selectEditor();
    const editProcess = spawn(editor.command, [...editor.args, filename], {
      stdio: 'inherit',
    });

    return new Promise((resolve, reject) => {
      editProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error('Editor process exited with a non-zero status code.')
          );
        }
      });
    });
  }

  private async _reEncryptAfterEditing(
    filename: string,
    pass: string,
    ind: LoadingIndicator
  ): Promise<void> {
    ind.start('Re-encrypting edited file...');
    const editedContent = await FileService.readFile(filename);
    const newOutput = await CryptoService.encrypt(editedContent, pass);
    await FileService.writeFile(filename, newOutput);

    await VersionControlService.init(
      filename,
      `Edited ${path.basename(filename)}`
    );

    EventService.getInstance().emit(VaultEvents.ACTION_COMPLETED, {
      file: filename,
      action: 'encrypt',
    });
    ind.stop('✔  File edited and re-encrypted successfully');
  }
}
