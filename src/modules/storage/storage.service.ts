import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, S3File } from 'bun';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Force load the .env file in case ConfigModule failed
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const getEnv = (key: string, fallback: string) => {
      return process.env[key] || this.configService.get<string>(key) || fallback;
    };

    this.bucketName = getEnv('R2_BUCKET_NAME', 'majestan-assets');
    const accountId = getEnv('R2_ACCOUNT_ID', 'account-id-placeholder');
    
    console.log(`[StorageService] Initializing R2 Client with Account ID: ${accountId}`);
    
    this.s3Client = new S3Client({
      accessKeyId: getEnv('R2_ACCESS_KEY_ID', 'placeholder-access-key'),
      secretAccessKey: getEnv('R2_SECRET_ACCESS_KEY', 'placeholder-secret-key'),
      bucket: this.bucketName,
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    });
  }

  /**
   * Generates a pre-signed URL for client-side uploads directly to Cloudflare R2
   * using Bun's native high-performance S3 client.
   */
  async generatePresignedUrl(fileName: string, fileType: string): Promise<{ url: string; key: string }> {
    const key = `uploads/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // URL expires in 15 minutes (900 seconds)
    const url = this.s3Client.presign(key, {
      method: "PUT",
      expiresIn: 900,
      type: fileType,
    });

    return { url, key };
  }
}
