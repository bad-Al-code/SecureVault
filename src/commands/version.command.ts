import os from 'node:os';

import { ICommand } from '../types';
import { ConsoleFormatter } from '../utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('../../package.json');

export class VersionCommand implements ICommand {
  public async execute(_args: string[]): Promise<void> {
    const version = packageJson.version;
    const platform = os.platform();
    const release = os.release();
    const arch = os.arch();
    const nodeVersion = process.version;

    console.log(ConsoleFormatter.cyan(`SecureVault CLI v${version}`));
    console.log(`Platform: ${platform} ${release} (${arch})`);
    console.log(`Node:     ${nodeVersion}`);
  }
}
