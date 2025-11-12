import { constants, Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';

export class FileService {
  /**
   * Reads the content of a file as a UTF-8 string.
   * @param filePath The path to the file.
   * @returns A promise that resolves to the file content as string.
   */
  public static async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * Reads the conent of a file as a Buffer.
   * @param filePath The path to the file.
   * @returns A promise that resolves to the file content as a Buffer.
   */
  public static async readFileBuffer(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  /**
   * Reads the contents of a directory, returning an array of Dirent objects.
   * @param currentDir The path to the directory.
   * @returns A promise that resolves to an array of Dirent objects.
   */
  public static async readDirectory(currentDir: string): Promise<Dirent[]> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    return entries;
  }

  /**
   * Writes content to a file, overwriting it if it exists.
   * @param filePath The path to the file.
   * @param content The string content to write.
   */
  public static async writeFile(
    filePath: string,
    content: string
  ): Promise<void> {
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Copies a file from a source path to a destination path.
   * @param source The path to the file to copy.
   * @param destination The path to the destination.
   */
  public static async copyFile(
    source: string,
    destination: string
  ): Promise<void> {
    await fs.copyFile(source, destination);
  }

  /**
   * Deletes a file.
   * @param filePath The path to the file to delete.
   */
  public static async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  /**
   * Creates a directory, including any necessary parent directories.
   * @param dirPath The path of the directory to create.
   */
  public static async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Checks if a file exists and is accessible.
   * @param filePath The path to the file.
   * @returns A promise resolving to true if the file exists, false otherwis.
   */
  public static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, constants.F_OK);

      return true;
    } catch (_err) {
      return false;
    }
  }
}
