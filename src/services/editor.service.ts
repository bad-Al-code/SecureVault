import { execSync } from 'node:child_process';
import * as os from 'node:os';
import { EditorCommand } from '../types';

export class EditorService {
  /**
   * Selects the bes available text editor.
   * Prioritizes the EDITOR environment variable, then checks for common editors based on the operating system.
   * @returns An object containing the editor command and its arguments.
   */
  public static selectEditor(): EditorCommand {
    const envEditor = process.env.EDITOR;
    if (envEditor) {
      return { command: envEditor, args: [] };
    }

    const platform = os.platform();
    switch (platform) {
      case 'win32':
        return this.findWindowsEditor();
      case 'darwin':
        return { command: 'open', args: ['-e'] };
      case 'linux':
      default:
        return this.findLinuxEditor();
    }
  }

  /**
   * Finds the first available editor on Windows.
   * @returns Editor command and arguments.
   */
  private static findWindowsEditor(): EditorCommand {
    const editors: EditorCommand[] = [
      { command: 'code.cmd', args: ['-w'] },
      { command: 'notepad++.exe', args: [] },
      { command: 'notepad.exe', args: [] },
    ];

    return this.findFirstAvailableEditor(editors, 'where');
  }

  /**
   * Finds the first available editor on Linux.
   * @returns Editor command and arguments.
   */
  private static findLinuxEditor(): EditorCommand {
    const editors: EditorCommand[] = [
      { command: 'vim', args: [] },
      { command: 'nano', args: [] },
      { command: 'code', args: ['-w'] },
      { command: 'emacs', args: [] },
    ];

    return this.findFirstAvailableEditor(editors, 'which');
  }

  /**
   * Finds the first editor available in the system path.
   * @param editors List of editors to check.
   * @param checkCommand Command used to check editor existence.
   * @returns The first available editor or a default one.
   */
  private static findFirstAvailableEditor(
    editors: EditorCommand[],
    checkCommand: string
  ): EditorCommand {
    for (const editor of editors) {
      try {
        execSync(`${checkCommand} ${editor.command}`, { stdio: 'ignore' });

        return editor;
      } catch (_error) {
        // Command not found.
      }
    }

    return os.platform() === 'win32'
      ? { command: 'notepad.exe', args: [] }
      : { command: 'nano', args: [] };
  }
}
