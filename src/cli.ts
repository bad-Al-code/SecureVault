#!/usr/bin/env node

import {
  AnalyticsCommand,
  CompareCommand,
  ConfigCommand,
  DecryptCommand,
  EditCommand,
  EncryptCommand,
  HistoryCommand,
  RestoreCommand,
  SearchCommand,
  showHelp,
  SyncPullCommand,
  SyncPushCommand,
  ViewCommand,
} from './commands';
import { BatchDecryptCommand, BatchEncryptCommand } from './commands/batch';
import { AnalyticsListener } from './services';
import { ICommand } from './types';

async function main() {
  AnalyticsListener.init();

  const commands = new Map<string, ICommand>([
    ['encrypt', new EncryptCommand()],
    ['decrypt', new DecryptCommand()],
    ['edit', new EditCommand()],
    ['view', new ViewCommand()],
    ['history', new HistoryCommand()],
    ['restore', new RestoreCommand()],
    ['compare', new CompareCommand()],
    ['search', new SearchCommand()],
    ['config', new ConfigCommand()],
    ['push', new SyncPushCommand()],
    ['pull', new SyncPullCommand()],
    ['analytics', new AnalyticsCommand()],
    ['batch-encrypt', new BatchEncryptCommand()],
    ['batch-decrypt', new BatchDecryptCommand()],
  ]);

  const args = process.argv.slice(2);
  const commandName = args[0];
  const commandArgs = args.slice(1);

  if (args.length < 1 || ['help', '--help', '-h'].includes(commandName)) {
    showHelp();
    process.exit(0);
  }

  const command = commands.get(commandName);

  if (!command) {
    console.error(`✘ Error: Unknown command '${commandName}'`);
    showHelp();
    process.exit(1);
  }

  try {
    await command.execute(commandArgs);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`✘ An unexpected error occurred: ${errorMessage}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled critical error:', error);
  process.exit(1);
});
