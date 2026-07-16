import { CloudflareStorage } from './cloudflare.storage';
import { GcsStorage } from './gcs.storage';
import { IUploadProvider } from './upload.interface';
import { LocalStorage } from './local.storage';

export class UploadFactory {
  static createStorage(): IUploadProvider {
    const storageProvider = process.env.STORAGE_PROVIDER || 'local';

    switch (storageProvider) {
      case 'local':
        return new LocalStorage(process.env.UPLOAD_DIRECTORY!);
      case 'cloudflare':
        return new CloudflareStorage(
          process.env.CLOUDFLARE_ACCOUNT_ID!,
          process.env.CLOUDFLARE_ACCESS_KEY!,
          process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
          process.env.CLOUDFLARE_REGION!,
          process.env.CLOUDFLARE_BUCKETNAME!,
          process.env.CLOUDFLARE_BUCKET_URL!
        );
      case 'gcs':
        return new GcsStorage(
          process.env.GCS_BUCKET!,
          process.env.GCS_PUBLIC_URL ||
            `https://storage.googleapis.com/${process.env.GCS_BUCKET}`,
          process.env.GCS_PROJECT_ID
        );
      default:
        throw new Error(`Invalid storage type ${storageProvider}`);
    }
  }
}
