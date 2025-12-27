import {
  _Object,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

import { ConfigService } from './config.service';

export interface S3FileMetadata {
  key: string;
  lastModified: Date;
  size: number;
}

export interface DownloadResult {
  content: string;
  etag: string;
}

export class S3Service {
  private static client: S3Client | null = null;
  private static bucket: string | null = null;

  /**
   * Initializes the S3 client and bucket from ConfigService.
   */
  private static async init(): Promise<void> {
    if (this.client && this.bucket) return;

    const config = await ConfigService.get();
    if (!config.awsRegion || !config.awsBucket) {
      throw new Error(
        'AWS Region and Bucket not configured. Run "vault config" to set them.'
      );
    }

    this.bucket = config.awsBucket;

    this.client = new S3Client({
      region: config.awsRegion,
      endpoint: config.awsEndpoint,
      forcePathStyle: !!config.awsEndpoint,
    });
  }

  /**
   * Uploads a string or buffer content to S3.
   * @param key - The S3 object key.
   * @param body - The content to upload (string or Buffer).
   * @param previousEtag - Optional ETag of the version we expect to overwrite.
   */
  public static async upload(
    key: string,
    body: string | Buffer,
    previousEtag?: string
  ): Promise<void> {
    await this.init();

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: body,
        IfMatch: previousEtag,
      });

      await this.client?.send(command);
    } catch (error) {
      if ((error as S3ServiceException).name === 'PreconditionFailed') {
        throw new Error(
          `Remote file has changed since last sync. Pull the latest changes before uploading.`
        );
      }

      this.handleError(error, `Failed to upload object with key: ${key}`);
    }
  }

  /**
   * Downloads content from S3 as a string.
   * @param key - The S3 object key.
   * @returns The file content as a string.
   */
  public static async download(key: string): Promise<DownloadResult> {
    await this.init();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket!,
        Key: key,
      });

      const response = await this.client?.send(command);

      if (!response || !response.Body) {
        throw new Error('Empty resource body from S3');
      }

      const content = await this.streamToString(response.Body as Readable);
      const etag = response.ETag?.replace(/"/g, '') || '';

      return { content, etag };
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to download object with key: ${key}`
      );
    }
  }

  /**
   * List all objects in the configured S3 bucket.
   * @returns An array of metadata for objects in the bucket.
   */
  public static async listFiles(): Promise<S3FileMetadata[]> {
    await this.init();

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket!,
      });

      const response = await this.client?.send(command);
      const contents: _Object[] = response?.Contents || [];

      return contents
        .filter((c) => c.Key !== undefined)
        .map((c) => ({
          key: c.Key!,
          lastModified: c.LastModified || new Date(0),
          size: c.Size || 0,
          etag: c.ETag?.replace(/"/g, ''),
        }));
    } catch (error) {
      throw this.handleError(error, 'Failed to list files');
    }
  }

  /**
   * Helper to convert a Node.js readable stream to a string.
   * @param stream
   * @returns
   */
  private static streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  }
  /**
   * Centralized error handling for S3 operations.
   * @param error - The caught error.
   * @param context - Contextual message for the error.
   * @returns A formatted Error object.
   */
  private static handleError(error: unknown, context: string): Error {
    const awsError = error as S3ServiceException;
    const message = awsError.message || 'Unknown S3 error';

    if (awsError.name === 'CredentialsProviderError') {
      return new Error(
        'AWS Credentials not found. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
      );
    }

    return new Error(`${context}. ${message}`);
  }
}
