import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DocumentUploadError } from "../../entities/errors/common";
import {
  FileStorageInterface,
  SavedFileResult,
  SaveFileOptions,
  UploadedFile,
  CreateUploadUrlOptions,
  UploadUrlResult,
} from "@/lib/application/services/file-storage.interface";

/** Upper bound for direct-to-R2 uploads (videos). */
export const DIRECT_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 5 * 60;

/**
 * Class representing a service for Cloudflare R2 storage operations using AWS S3 SDK.
 */
export class CloudflareR2Service extends FileStorageInterface {
  private readonly maxFileSize: number;
  private readonly client: S3Client;
  private readonly publicUrlBase: string;
  private readonly bucketName: string;

  constructor() {
    super();
    this.maxFileSize = 10 * 1024 * 1024; // 10 MB in bytes

    const requiredEnvVars = [
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_ACCOUNT_ID",
      "R2_BUCKET_NAME",
      "R2_PUBLIC_DOMAIN_URL",
    ] as const;

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Cloudflare R2: ${envVar} is not provided yet`);
      }
    }

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
      },
    });

    this.publicUrlBase = process.env.R2_PUBLIC_DOMAIN_URL as string;
    this.bucketName = process.env.R2_BUCKET_NAME as string;
  }

  private sanitizeFilename(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    const name = lastDotIndex !== -1 ? filename.slice(0, lastDotIndex) : filename;
    const ext = lastDotIndex !== -1 ? filename.slice(lastDotIndex + 1) : "";

    const safeName = name
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "");

    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "");

    return safeExt ? `${safeName}.${safeExt}` : safeName;
  }

  async createUploadUrl({ destination, filename, contentType, size }: CreateUploadUrlOptions): Promise<UploadUrlResult> {
    if (size <= 0 || size > DIRECT_UPLOAD_MAX_BYTES) {
      throw new DocumentUploadError(`Ukuran file maksimal ${DIRECT_UPLOAD_MAX_BYTES / (1024 * 1024)} MB`);
    }
    const blobName = `${Date.now()}-${this.sanitizeFilename(filename) || "file"}`;
    const key = `${destination.replace(/\/$/, "")}/${blobName}`;

    // Content-Type and Content-Length are part of the signature, so the
    // browser can only upload exactly the file that was approved.
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      signableHeaders: new Set(["content-type", "content-length"]),
    });

    return {
      uploadUrl,
      headers: { "Content-Type": contentType },
      fileurl: `${this.publicUrlBase}/${encodeURI(key)}`,
      filename: blobName,
      key,
    };
  }

  /**
   * Save a file to Cloudflare R2 storage.
   * Validates the file size before uploading.
   */
  async saveFile(
    file: UploadedFile,
    options: SaveFileOptions = {}
  ): Promise<SavedFileResult> {
    if (!this.validateFileSize(file.size, this.maxFileSize)) {
      throw new DocumentUploadError(
        `File size exceeds the maximum limit of ${this.maxFileSize / (1024 * 1024)}MB`
      );
    }

    const containerName = options.destination?.replace(/\/$/, "") ?? "default";

    const cleanOriginalName = this.sanitizeFilename(file.originalname);

    const blobName = `${Date.now()}-${cleanOriginalName}`;
    const key = `${containerName}/${blobName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.client.send(command);

      const encodedUrl = `${this.publicUrlBase}/${encodeURI(key)}`;

      return {
        fileurl: encodedUrl,
        filename: blobName,
        originalFilename: file.originalname,
        filepath: key,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new DocumentUploadError(
          `Failed to upload file to Cloudflare R2: ${error.message}`
        );
      }
      throw new DocumentUploadError(
        "Failed to upload file to Cloudflare R2: An unknown error occurred"
      );
    }
  }

  keyFromPublicUrl(url: string): string | null {
    const base = (this.publicUrlBase || "").replace(/\/+$/, "");
    if (!base || !url.startsWith(`${base}/`)) return null;
    const rest = url.slice(base.length + 1).split(/[?#]/)[0];
    try {
      const key = decodeURI(rest);
      // No path tricks: a key is plain segments.
      if (!key || key.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) return null;
      return key;
    } catch {
      return null;
    }
  }

  /**
   * Delete a file from Cloudflare R2 storage.
   */
  async deleteFile(filepath: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filepath,
      });

      await this.client.send(command);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to delete file from Cloudflare R2: ${error.message}`
        );
      }
      throw new Error(
        "Failed to delete file from Cloudflare R2: An unknown error occurred"
      );
    }
  }

  /**
   * Validate the file size.
   */
  protected validateFileSize(size: number, maxSize: number): boolean {
    return size <= maxSize;
  }
}
