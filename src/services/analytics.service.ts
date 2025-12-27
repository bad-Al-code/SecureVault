import fs from 'node:fs/promises';
import path from 'node:path';

import { AnalyticsRepository } from '../repository';
import { VaultHealthReport } from '../types';
import { findFiles } from '../utils';
import { CryptoService } from './crypto.service';
import { FileService } from './file.service';

export class AnalyticsService {
  private static readonly ROTATION_WARNING_DAYS = 90;
  private static readonly ROTATION_CRITICAL_DAYS = 180;
  private static readonly MAX_MOST_ACCESSED = 5;

  /**
   * Generates a vault health report.
   * @returns Vault health report.
   */
  public static async generateReport(): Promise<VaultHealthReport> {
    const report = this.createEmptyReport();
    const files = await this.findLocalFiles();
    const analyticsData = await AnalyticsRepository.getData();

    for (const filePath of files) {
      if (!(await this.isVaultFile(filePath))) {
        continue;
      }

      await this.processVaultFile(filePath, analyticsData, report);
    }

    this.finalizeMostAccessed(report);
    return report;
  }

  /**
   * Creates an empty vault health report.
   */
  private static createEmptyReport(): VaultHealthReport {
    return {
      totalFiles: 0,
      totalSizeBytes: 0,
      historySizeBytes: 0,
      mostAccessedFiles: [],
      warnings: [],
    };
  }

  /**
   * Finds all local files excluding ignored directories.
   */
  private static async findLocalFiles(): Promise<string[]> {
    return findFiles('.', {
      excludePattern: /(\.vault_history|\.git|node_modules|dist|coverage|iac)/,
    });
  }

  /**
   * Determines whether a file is a vault file.
   * @param filePath
   */
  private static async isVaultFile(filePath: string): Promise<boolean> {
    try {
      const header = await FileService.readFirstBytes(filePath, 6);
      return CryptoService.isVaultFile(header);
    } catch {
      return false;
    }
  }

  /**
   * Processes a single vault file and updates the report.
   * @param filePath
   * @param analyticsData
   * @param report
   */
  private static async processVaultFile(
    filePath: string,
    analyticsData: Awaited<ReturnType<typeof AnalyticsRepository.getData>>,
    report: VaultHealthReport
  ): Promise<void> {
    report.totalFiles++;

    const relativePath = path.relative(process.cwd(), filePath);

    report.totalSizeBytes += await FileService.getFileSize(filePath);
    report.historySizeBytes += await this.getHistorySize(filePath);

    this.addAccessStats(relativePath, analyticsData, report);
    await this.addRotationWarnings(filePath, relativePath, report);
  }

  /**
   * Calculates history directory size for a vault file.
   * @param filePath
   */
  private static async getHistorySize(filePath: string): Promise<number> {
    const historyDir = path.join('.vault_history', path.basename(filePath));
    return FileService.getDirectorySize(historyDir);
  }

  /**
   * Adds file access statistics to the report.
   * @param relativePath
   * @param analyticsData
   * @param report
   */
  private static addAccessStats(
    relativePath: string,
    analyticsData: Awaited<ReturnType<typeof AnalyticsRepository.getData>>,
    report: VaultHealthReport
  ): void {
    const stats =
      analyticsData[relativePath] ||
      analyticsData[path.normalize(relativePath)];

    if (stats) {
      report.mostAccessedFiles.push({
        name: relativePath,
        count: stats.accessCount,
      });
    }
  }

  /**
   * Evaluates file age and adds rotation warnings if needed.
   * @param filePath
   * @param relativePath
   * @param report
   */
  private static async addRotationWarnings(
    filePath: string,
    relativePath: string,
    report: VaultHealthReport
  ): Promise<void> {
    const stats = await fs.stat(filePath);
    const ageInDays = this.calculateFileAgeInDays(stats.mtime);

    if (ageInDays > this.ROTATION_CRITICAL_DAYS) {
      report.warnings.push({
        file: relativePath,
        severity: 'CRITICAL',
        message: `Secret not rotated in ${ageInDays} days.`,
      });
    } else if (ageInDays > this.ROTATION_WARNING_DAYS) {
      report.warnings.push({
        file: relativePath,
        severity: 'WARNING',
        message: `Secret is ${ageInDays} days old. Consider rotating.`,
      });
    }
  }

  /**
   * Calculates file age in days.
   * @param modifiedTime
   */
  private static calculateFileAgeInDays(modifiedTime: Date): number {
    const ageInMs = Date.now() - modifiedTime.getTime();
    return Math.floor(ageInMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Sorts and limits the most accessed files list.
   * @param report
   */
  private static finalizeMostAccessed(report: VaultHealthReport): void {
    report.mostAccessedFiles.sort((a, b) => b.count - a.count);
    report.mostAccessedFiles = report.mostAccessedFiles.slice(
      0,
      this.MAX_MOST_ACCESSED
    );
  }
}
