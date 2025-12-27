import { AnalyticsService } from '../services';
import { ICommand, VaultHealthReport } from '../types';
import { ConsoleFormatter, LoadingIndicator } from '../utils';

export class AnalyticsCommand implements ICommand {
  private readonly loadingIndicator = new LoadingIndicator();

  /**
   * Executes the analytics command.
   * @param _args - CLI arguments (unused).
   */
  public async execute(_args: string[]): Promise<void> {
    this.startLoading();

    try {
      const report = await AnalyticsService.generateReport();

      this.stopLoading();
      this.printDashboard(report);
    } catch (err) {
      this.stopLoading();
      this.printError(err);
    }
  }

  /**
   * Starts the loading indicator.
   */
  private startLoading(): void {
    this.loadingIndicator.start('Analyzing vault health...');
  }

  /**
   * Stops the loading indicator.
   */
  private stopLoading(): void {
    this.loadingIndicator.stop();
  }

  /**
   * Prints an error message to the console.
   * @param err
   */
  private printError(err: unknown): void {
    console.error(
      ConsoleFormatter.red(
        `Failed to generate report: ${(err as Error).message}`
      )
    );
  }

  /**
   * Prints the analytics dashboard.
   * @param report
   */
  private printDashboard(report: VaultHealthReport): void {
    this.printHeader();
    this.printUsageStats(report);
    this.printWarnings(report);
    this.printMostAccessedFiles(report);
  }

  /**
   * Prints the dashboard header.
   */
  private printHeader(): void {
    console.log(ConsoleFormatter.cyan('\n📊 Vault Analytics Report\n'));
  }

  /**
   * Prints vault usage statistics.
   * @param report
   */
  private printUsageStats(report: VaultHealthReport): void {
    console.log('📌 Usage Stats');
    console.log('--------------------------------------------------');
    console.log(`Total Files:       ${report.totalFiles}`);
    console.log(
      `Total Size:        ${(report.totalSizeBytes / 1024).toFixed(2)} KB`
    );
    console.log(
      `History Overhead:  ${(report.historySizeBytes / 1024).toFixed(2)} KB`
    );

    const ratio =
      report.totalSizeBytes > 0
        ? (report.historySizeBytes / report.totalSizeBytes).toFixed(1)
        : '0';

    console.log(`Bloat Factor:      ${ratio}x\n`);
  }

  /**
   * Prints security warnings if present.
   * @param report
   */
  private printWarnings(report: VaultHealthReport): void {
    if (report.warnings.length === 0) {
      console.log(ConsoleFormatter.green('✔  No security warnings found.\n'));
      return;
    }

    console.log('🚨 Security Warnings');
    console.log('--------------------------------------------------');

    report.warnings.forEach((warning) => {
      const severityTag = `[${warning.severity}]`;
      const coloredTag =
        warning.severity === 'CRITICAL'
          ? ConsoleFormatter.red(severityTag)
          : ConsoleFormatter.yellow(severityTag);

      console.log(`${coloredTag} ${warning.file}`);
      console.log(`   - ${warning.message}`);
    });

    console.log('');
  }

  /**
   * Prints the most accessed files.
   * @param report
   */
  private printMostAccessedFiles(report: VaultHealthReport): void {
    if (report.mostAccessedFiles.length === 0) {
      return;
    }

    console.log('📉 Top Accessed Files');
    console.log('--------------------------------------------------');

    report.mostAccessedFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name} (${file.count} access)`);
    });

    console.log('');
  }
}
