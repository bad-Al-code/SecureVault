import { ICloudStorageProvider } from '../../types';
import { AwsS3Provider } from '../providers';

export class CloudStorageFactory {
  /**
   * Returns the appropriate cloud storage provider based on configuration.
   * Currently default to AWS S3.
   */
  public static getProvider(): ICloudStorageProvider {
    //   const config = await ConfigService.get();
    //   if(config.provider === 'gcp') return new GoogleProvider();

    return new AwsS3Provider();
  }
}
