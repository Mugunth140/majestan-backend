import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, S3File } from 'bun';

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
    const key = `uploads/temp/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // URL expires in 15 minutes (900 seconds)
    const url = this.s3Client.presign(key, {
      method: "PUT",
      expiresIn: 900,
      type: fileType,
    });

    return { url, key };
  }

  /**
   * Generates a URL for reading a file from R2.
   * If R2_PUBLIC_URL is configured, returns the public URL.
   * Otherwise falls back to a 7-day presigned GET URL.
   */
  generateReadUrl(key: string): string {
    // If it's already a full URL, return as-is
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    
    const publicUrl = process.env.R2_PUBLIC_URL || this.configService.get<string>('R2_PUBLIC_URL');
    if (publicUrl) {
      // Ensure no double slashes between URL and key
      const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
      const fileKey = key.startsWith('/') ? key.slice(1) : key;
      return `${baseUrl}/${fileKey}`;
    }

    return this.s3Client.presign(key, {
      method: "GET",
      expiresIn: 604800, // 7 days
    });
  }

  /**
   * Deletes a single file from R2 by its key.
   */
  async deleteFile(key: string): Promise<void> {
    if (!key || key.startsWith('http://') || key.startsWith('https://')) return;
    try {
      await this.s3Client.delete(key);
    } catch (err) {
      console.error(`[StorageService] Failed to delete R2 file: ${key}`, err);
    }
  }

  /**
   * Deletes multiple files from R2 in parallel by their keys.
   */
  async deleteFiles(keys: string[]): Promise<void> {
    const validKeys = keys.filter(k => k && !k.startsWith('http://') && !k.startsWith('https://'));
    if (validKeys.length === 0) return;
    await Promise.all(validKeys.map(key => this.deleteFile(key)));
  }

  /**
   * Processes an image via imgproxy and uploads the optimized webp to R2 final destination.
   */
  async processAndUploadImage(originalKey: string): Promise<string> {
    if (!originalKey.includes('uploads/temp/')) return originalKey;

    const publicUrl = process.env.R2_PUBLIC_URL || this.configService.get<string>('R2_PUBLIC_URL');
    if (!publicUrl) {
      console.warn('[StorageService] R2_PUBLIC_URL missing. Skipping imgproxy.');
      return originalKey;
    }
    
    const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    const fileUrl = `${baseUrl}/${originalKey}`;

    // Compress, webp, and watermark. 
    // Watermark uses 1 opacity since SVG has its own opacity, centered (ce), scale 0.8 to make it large
    const processingString = 'rs:fit:1920:1080:0/q:85/wm:1:ce:0:0:0.8/format:webp';
    const imgproxyUrl = `http://imgproxy:8080/insecure/${processingString}/plain/${fileUrl}`;

    try {
      const response = await fetch(imgproxyUrl);
      if (!response.ok) {
        throw new Error(`Imgproxy failed: ${response.status} ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error('Imgproxy returned empty body');
      }

      // Construct new key: move from uploads/temp/ to uploads/properties/ and change extension to .webp
      const filename = originalKey.split('/').pop() || Date.now().toString();
      const finalKey = `uploads/properties/${filename.replace(/\.[^/.]+$/, "")}.webp`;

      // Stream directly into R2 — avoids materialising the full image in the Node heap
      await this.s3Client.write(finalKey, response.body, {
        type: 'image/webp'
      });

      // Fire and forget delete of the raw original temp file
      this.deleteFile(originalKey).catch(console.error);

      return finalKey;
    } catch (err) {
      console.error(`[StorageService] Failed to process image ${originalKey} via imgproxy`, err);
      // Fallback: if imgproxy fails, just use the original temp file
      return originalKey;
    }
  }

  /**
   * Transforms an array of image objects by resolving their keys to signed read URLs.
   */
  resolveImageUrls<T extends { imageUrl?: string; imageKey?: string }>(images: T[]): T[] {
    return images.map(img => ({
      ...img,
      imageUrl: img.imageUrl ? this.generateReadUrl(img.imageUrl) : img.imageUrl,
    }));
  }
}
