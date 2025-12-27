import path from 'node:path';
import { CryptoService, FileService } from '../services';
import { ICommand } from '../types';
import {
  ConsoleFormatter,
  findFiles,
  getPassword,
  LoadingIndicator,
} from '../utils';

interface SearchMatch {
  line: number;
  content: string;
}

export class SearchCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Executes the search command.
   * @param args - An array containing the search query and optional directory path.
   */
  public async execute(args: string[]): Promise<void> {
    const { query, directory } = this._parseArgs(args);

    try {
      const password = await getPassword();
      this.loadingIndicator.start(
        `Searching for "${query}" in ${directory}...`
      );

      const allFiles = await findFiles(directory, {
        excludePattern:
          /(\.vault_history|\.git|node_modules|dist|coverage|iac)/,
      });
      const encryptedFiles = await this._filterEncryptedFiles(allFiles);
      const results = await this._searchFiles(encryptedFiles, query, password);

      this.loadingIndicator.stop();

      this._displayResults(results, query);
    } catch (err) {
      this.loadingIndicator.stop();
      const error = err as Error;

      console.error(ConsoleFormatter.red(`Search failed: ${error.message}`));

      process.exit(1);
    }
  }

  /**
   * Parses and validate command arguments.
   * @param args - The command arguments.
   * @returns An object containing the search query and directory path.
   */
  private _parseArgs(args: string[]): { query: string; directory: string } {
    if (args.length < 1) {
      throw new Error('The "search" command requires a search term.');
    }

    const query = args[0];
    const directory = args[1] || '.';

    return { query, directory };
  }

  /**
   * Filter files to only include valid Vault files.
   * @param filenames - An array of filenames to filter.
   * @returns An array of filenames that are valid Vault files.
   */
  private async _filterEncryptedFiles(filenames: string[]): Promise<string[]> {
    const encryptedFiles: string[] = [];

    for (const filename of filenames) {
      try {
        const content = await FileService.readFile(filename);
        if (CryptoService.isVaultFile(content)) {
          encryptedFiles.push(filename);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        console.warn(
          ConsoleFormatter.yellow(
            `\n Skipping inaccessible file "${filename}": ${msg}`
          )
        );
      }
    }

    return encryptedFiles;
  }

  /**
   * Iterates through files, decrypt them in memory, and look for matches
   * @param filenames
   * @param query
   * @param password
   * @returns
   */
  private async _searchFiles(
    filenames: string[],
    query: string,
    password: string
  ): Promise<Map<string, SearchMatch[]>> {
    const matches = new Map<string, SearchMatch[]>();

    for (const filename of filenames) {
      try {
        const encryptedContent = await FileService.readFile(filename);
        const decryptedContent = await CryptoService.decrypt(
          encryptedContent,
          password,
          filename
        );

        const fileMatches = this._findMatchesInText(decryptedContent, query);
        if (fileMatches.length > 0) {
          matches.set(filename, fileMatches);
        }
      } catch (_error) {
        this.loadingIndicator.stop();
        console.warn(
          ConsoleFormatter.yellow(
            `Warning: Could not decrypt ${path.basename(filename)}. It might use a different password.`
          )
        );
      }
    }

    return matches;
  }

  /**
   * Finds occurences of a query in text and returs line numners (1-based).
   * @param text - The text to search within.
   * @param query - The search query.
   * @returns An array of line numbers where the query was found.
   */
  private _findMatchesInText(text: string, query: string): SearchMatch[] {
    const results: SearchMatch[] = [];
    const lines = text.split('\n');
    const lowerCaseQuery = query.toLowerCase();

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(lowerCaseQuery)) {
        results.push({ line: index + 1, content: line });
      }
    });

    return results;
  }

  /**
   * Formats and prints the search results to the console
   * @param results - A map of filenames to line numbers where matches were found.
   * @param query - The search query.
   * @returns void
   */
  private _displayResults(
    results: Map<string, SearchMatch[]>,
    query: string
  ): void {
    if (results.size === 0) {
      console.log(`No matches found for "${query}".`);

      return;
    }

    console.log(`\nFound matches for "${query}":\n`);

    results.forEach((matches, filename) => {
      const relativePath = path.relative(process.cwd(), filename);
      console.log(`📄 ${ConsoleFormatter.cyan(relativePath)}`);

      matches.forEach((match) => {
        const highlightedContent = ConsoleFormatter.highlight(
          match.content,
          query
        );
        console.log(
          `  ${ConsoleFormatter.gray(match.line.toString() + ':')} ${highlightedContent}`
        );
      });

      console.log('');
    });
  }
}
