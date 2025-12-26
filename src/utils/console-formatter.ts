export class ConsoleFormatter {
  private static readonly RESET = '\x1b[0m';
  private static readonly RED = '\x1b[31m';
  private static readonly GREEN = '\x1b[32m';
  private static readonly YELLOW = '\x1b[33m';
  private static readonly CYAN = '\x1b[36m';
  private static readonly GRAY = '\x1b[90m';

  /**
   * Colors the given text in cyan.
   * @param text
   * @returns
   */
  public static cyan(text: string): string {
    return `${this.CYAN}${text}${this.RESET}`;
  }

  /**
   * Colors the given text in gray.
   * @param text
   * @returns
   */
  public static gray(text: string): string {
    return `${this.GRAY}${text}${this.RESET}`;
  }

  /**
   * Colors the given text in yellow.
   * @param text
   * @returns
   */
  public static yellow(text: string): string {
    return `${this.YELLOW}${text}${this.RESET}`;
  }

  /**
   * Colors the given text in green.
   * @param text
   * @returns
   */
  public static green(text: string): string {
    return `${this.GREEN}${text}${this.RESET}`;
  }

  /**
   * Colors the given text in red.
   * @param text
   * @returns
   */
  public static red(text: string): string {
    return `${this.RED}${text}${this.RESET}`;
  }

  /**
   * Highlights all occurrences of the term in the content string.
   * @param content - The content string.
   * @param term - The term to highlight.
   * @returns The content string with the term highlighted.
   */
  public static highlight(content: string, term: string): string {
    const regex = new RegExp(`(${term})`, 'gi');

    return content.replace(regex, `${this.YELLOW}$1${this.RESET}`);
  }
}
