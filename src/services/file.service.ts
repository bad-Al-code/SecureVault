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
}
