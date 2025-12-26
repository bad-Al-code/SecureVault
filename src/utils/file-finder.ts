import * as path from 'node:path';
import { FileService } from '../services';
import { BatchFindOptions } from '../types';

/**
 * Recursively finds files in a directory that match the given criteria.
 * @param directory - The starting directory for the search.
 * @param options - Configuration options for the search (e.g., recursive, patterns).
 * @returns A promise that resolves to an array of full file paths.
 */
export async function findFiles(
  directory: string,
  options: BatchFindOptions = {}
): Promise<string[]> {
  const {
    recursive = true,
    filePattern = /.*/,
    excludePattern = /^$/,
  } = options;

  const foundFiles: string[] = [];

  async function processDirectory(currentDir: string): Promise<void> {
    const entries = await FileService.readDirectory(currentDir);

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && recursive) {
        if (!excludePattern.test(entry.name)) {
          await processDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        if (filePattern.test(entry.name) && !excludePattern.test(entry.name)) {
          foundFiles.push(fullPath);
        }
      }
    }
  }

  await processDirectory(directory);

  return foundFiles;
}
