import {
  _Object,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import {
  CloudFileMetadata,
  DownloadResult,
  ICloudStorageProvider,
} from '../../types';
import { ConfigService } from '../config.service';

export class AwsS3Provider implements ICloudStorageProvider {
  public readonly name = 'aws-s3';
  private client: S3Client | null = null;
  private bucket: string | null = null;

  /**
   * Initializes the S3 client and bucket from ConfigService.
   * @returns Promise<void>
   */
  private async init(): Promise<void> {
    if (this.client && this.bucket) return;

    const config = await ConfigService.get();

    if (!config.awsRegion || !config.awsBucket) {
      throw new Error(
        "AWS Region and Bucket not configured. Run 'vault config' to set them."
      );
    }

    this.bucket = config.awsBucket;
    this.client = new S3Client({
      region: config.awsRegion,
      endpoint: config.awsEndpoint,
      forcePathStyle: !!config.awsEndpoint,
    });
  }

  public async upload(
    key: string,
    body: string | Buffer,
    previousEtag?: string
  ): Promise<string> {
    await this.init();

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: body,
        IfMatch: previousEtag,
      });

      const response = await this.client?.send(command);

      return response?.ETag?.replace(/"/g, '') || '';
    } catch (error) {
      if ((error as S3ServiceException).name === 'PreconditionFailed') {
        throw new Error(
          'Remote file has changed since last sync. Aborting upload to prevent overwriting changes.'
        );
      }

      throw this.handleError(error, `Failed to upload ${key}`);
    }
  }

  public async download(key: string): Promise<DownloadResult> {
    await this.init();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket!,
        Key: key,
      });

      const response = await this.client?.send(command);

      if (!response?.Body) {
        throw new Error('Empty resource body from S3.');
      }

      const content = await this.streamToString(response.Body as Readable);
      const etag = response.ETag?.replace(/"/g, '') || '';

      return { content, etag };
    } catch (error) {
      throw this.handleError(error, `Failed to download ${key}`);
    }
  }

  public async listFiles(): Promise<CloudFileMetadata[]> {
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

  private streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  }

  /**
   *
   * @param error
   * @param context
   * @returns
   */
  private handleError(error: unknown, context: string): Error {
    const awsError = error as S3ServiceException;
    const message = awsError.message || 'Unknown S3 error';

    if (awsError.name === 'CredentialsProviderError') {
      return new Error(
        'AWS Credentials not found. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.'
      );
    }

    return new Error(`${context}: ${message}`);
  }
}
