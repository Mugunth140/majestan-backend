import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, S3File } from 'bun';
import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import sharp from 'sharp';

const MAX_LOCAL_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB — admin temp uploads only

/**
 * Resolves the local upload dir identically for the static server (main.ts)
 * and file reads/writes (localPathForKey). resolve — never join — so an
 * absolute LOCAL_UPLOAD_DIR is honored instead of being nested under cwd.
 */
export function resolveLocalUploadDir(uploadDirEnv: string | undefined, cwd: string): string {
  return resolve(cwd, uploadDirEnv || './uploads');
}
// Local-driver key namespace. The `local/` prefix is what distinguishes
// disk-stored files from R2 keys everywhere (read URLs, deletes, finalize),
// so R2-hosted assets (e.g. property images) keep resolving to R2 even when
// the local driver is active.
const LOCAL_KEY_PREFIX = 'local/';
const LOCAL_TEMP_PREFIX = 'local/temp/';
const TEMP_KEY_PATTERN = /^local\/temp\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

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
   * Storage driver: 'r2' (default, production/staging/VPS) or 'local'
   * (local dev: files land in LOCAL_UPLOAD_DIR, served by this API).
   */
  private get storageDriver(): 'r2' | 'local' {
    const raw =
      process.env.STORAGE_DRIVER || this.configService.get<string>('STORAGE_DRIVER') || 'r2';
    return raw.toLowerCase() === 'local' ? 'local' : 'r2';
  }

  isLocalDriver(): boolean {
    return this.storageDriver === 'local';
  }

  private localUploadDir(): string {
    return resolveLocalUploadDir(
      process.env.LOCAL_UPLOAD_DIR || this.configService.get<string>('LOCAL_UPLOAD_DIR'),
      process.cwd(),
    );
  }

  private localBaseUrl(): string {
    const base =
      process.env.LOCAL_UPLOAD_BASE_URL || this.configService.get<string>('LOCAL_UPLOAD_BASE_URL');
    if (base) return base.endsWith('/') ? base.slice(0, -1) : base;
    const port = this.configService.get<number>('app.port') ?? 5000;
    return `http://localhost:${port}`;
  }

  private localApiPrefix(): string {
    const prefix = this.configService.get<string>('app.apiPrefix') ?? 'api/v1';
    return prefix.replace(/^\/+|\/+$/g, '');
  }

  private localPathForKey(key: string): string {
    return join(this.localUploadDir(), key);
  }

  /**
   * Generates a pre-signed URL for client-side uploads directly to Cloudflare R2
   * using Bun's native high-performance S3 client.
   * On the local driver it returns a same-origin PUT target instead — the
   * browser flow is identical, only the destination differs.
   */
  async generatePresignedUrl(fileName: string, fileType: string): Promise<{ url: string; key: string }> {
    if (this.isLocalDriver()) {
      const key = `local/temp/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const url = `${this.localBaseUrl()}/${this.localApiPrefix()}/admin/media/upload-temp?key=${encodeURIComponent(key)}`;
      return { url, key };
    }

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
   * Writes a raw upload body to local disk (local driver only).
   * The key must be a temp key minted by generatePresignedUrl — anything else
   * (including path traversal) is rejected.
   */
  async writeLocalTempFile(
    key: string,
    body: AsyncIterable<Uint8Array>,
  ): Promise<{ key: string }> {
    if (!key || !TEMP_KEY_PATTERN.test(key)) {
      throw new BadRequestException('Invalid upload key');
    }
    const dest = this.localPathForKey(key);
    await fs.mkdir(dirname(dest), { recursive: true });
    let bytes = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      const buf = Buffer.from(chunk);
      bytes += buf.length;
      if (bytes > MAX_LOCAL_UPLOAD_BYTES) {
        throw new PayloadTooLargeException('File too large (max 15MB)');
      }
      chunks.push(buf);
    }
    if (bytes === 0) {
      throw new BadRequestException('Empty upload body');
    }
    await fs.writeFile(dest, Buffer.concat(chunks));
    return { key };
  }

  /**
   * Generates a URL for reading a file from R2.
   * If R2_PUBLIC_URL is configured, returns the public URL.
   * Otherwise falls back to a 7-day presigned GET URL.
   */
  generateReadUrl(key: string): string {
    // If it's already a full URL, return as-is
    if (key.startsWith('http://') || key.startsWith('https://')) return key;

    // Disk-stored files live under the local/ namespace and resolve to the
    // local base URL — in ANY driver mode, so R2-hosted assets (e.g. property
    // images) keep resolving to R2 even when the local driver is active.
    if (key === 'local' || key.startsWith(LOCAL_KEY_PREFIX)) {
      return `${this.localBaseUrl()}/${key}`;
    }

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
   * Deletes a single file — from local disk for local/ namespaced keys,
   * from R2 otherwise.
   */
  async deleteFile(key: string): Promise<void> {
    if (!key || key.startsWith('http://') || key.startsWith('https://')) return;
    if (key === 'local' || key.startsWith(LOCAL_KEY_PREFIX)) {
      try {
        await fs.unlink(this.localPathForKey(key));
      } catch (err) {
        console.error(`[StorageService] Failed to delete local file: ${key}`, err);
      }
      return;
    }
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
    // Watermark is barely-visible by design: the SVG itself is solid black
    // (no built-in opacity), so imgproxy opacity stays low (~0.15), centered
    // (ce), scale 0.8 to make it large
    const processingString = 'rs:fit:1920:1080:0/q:85/wm:0.15:ce:0:0:0.8/format:webp';
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

      // Read as Blob — Bun S3Client accepts Blob natively without a JS-side buffer copy
      const blob = await response.blob();
      await this.s3Client.write(finalKey, blob, {
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

  private imgproxyBase(): string {
    return process.env.IMGPROXY_URL || 'http://imgproxy:8080';
  }

  /**
   * Ad-creative finalize: imgproxy fit-bounds + webp, deliberately WITHOUT
   * any watermark param. Bounds cap the long edge; fit never crops, so the
   * 32:9 (desktop) / 4:5 (mobile) compositions uploaded from CRM survive.
   */
  async processAdImage(originalKey: string, slot: 'desktop' | 'mobile'): Promise<string> {
    if (!originalKey.includes('uploads/temp/') && !originalKey.startsWith(LOCAL_TEMP_PREFIX)) return originalKey;

    // Local driver: same fit-bounds + webp finalize, processed with sharp on
    // disk instead of imgproxy + R2.
    if (this.isLocalDriver()) {
      const bounds = slot === 'desktop' ? { width: 1920, height: 540 } : { width: 1080, height: 1350 };
      const filename = originalKey.split('/').pop() || Date.now().toString();
      const finalKey = `local/ads/${filename.replace(/\.[^/.]+$/, '')}.webp`;
      await fs.mkdir(dirname(this.localPathForKey(finalKey)), { recursive: true });
      await sharp(this.localPathForKey(originalKey))
        .resize(bounds.width, bounds.height, { fit: 'inside' })
        .webp({ quality: 82 })
        .toFile(this.localPathForKey(finalKey));
      await this.deleteFile(originalKey);
      return finalKey;
    }

    const publicUrl = process.env.R2_PUBLIC_URL || this.configService.get<string>('R2_PUBLIC_URL');
    if (!publicUrl) {
      console.warn('[StorageService] R2_PUBLIC_URL missing. Skipping ad finalize.');
      return originalKey;
    }

    const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    const fileUrl = `${baseUrl}/${originalKey}`;
    const bounds = slot === 'desktop' ? 'rs:fit:1920:540:0' : 'rs:fit:1080:1350:0';
    const imgproxyUrl = `${this.imgproxyBase()}/insecure/${bounds}/q:82/format:webp/plain/${fileUrl}`;

    const response = await fetch(imgproxyUrl);
    if (!response.ok) {
      throw new Error(`Imgproxy ad finalize failed: ${response.status}`);
    }
    const filename = originalKey.split('/').pop() || Date.now().toString();
    const finalKey = `uploads/ads/${filename.replace(/\.[^/.]+$/, '')}.webp`;
    const blob = await response.blob();
    await this.s3Client.write(finalKey, blob, { type: 'image/webp' });
    this.deleteFile(originalKey).catch(console.error);
    return finalKey;
  }

  async getImageDimensions(fileUrl: string): Promise<{ width: number; height: number }> {
    // Disk-stored files (local/ namespace) are measured with sharp instead
    // of imgproxy — in any driver mode.
    const basePrefix = `${this.localBaseUrl()}/`;
    if (fileUrl.startsWith(basePrefix) && fileUrl.slice(basePrefix.length).startsWith(LOCAL_KEY_PREFIX)) {
      const meta = await sharp(this.localPathForKey(fileUrl.slice(basePrefix.length))).metadata();
      if (!meta.width || !meta.height) {
        throw new Error('Local image missing width/height');
      }
      return { width: meta.width, height: meta.height };
    }

    const response = await fetch(`${this.imgproxyBase()}/insecure/info/plain/${fileUrl}`);
    if (!response.ok) {
      throw new Error(`Imgproxy info failed: ${response.status}`);
    }
    const info = (await response.json()) as { width?: number; height?: number };
    if (!info.width || !info.height) {
      throw new Error('Imgproxy info missing width/height');
    }
    return { width: info.width, height: info.height };
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
