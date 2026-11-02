export abstract class FileStorageInterface {
  abstract saveFile(file: UploadedFile, options?: SaveFileOptions): Promise<SavedFileResult>;
  abstract deleteFile(filepath: string): Promise<void>;
  /**
   * A short-lived URL the browser can PUT the file to directly, so large files
   * never pass through the app server (Vercel caps request bodies ~4.5 MB).
   */
  abstract createUploadUrl(options: CreateUploadUrlOptions): Promise<UploadUrlResult>;
  /**
   * The storage key behind one of our own public file URLs, or null when the
   * URL is not ours (another host, a proxy URL, anything unparseable).
   */
  abstract keyFromPublicUrl(url: string): string | null;

  protected validateFileSize(size: number, maxSize: number): boolean {
    return size <= maxSize;
  }
}

export interface UploadedFile {
  size: number;
  fieldname: string;
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

export interface SaveFileOptions {
  destination?: string;
}

export interface SavedFileResult {
  fileurl: string;
  filename: string;
  originalFilename: string;
  filepath: string;
  size: number;
  mimetype: string;
}
export interface CreateUploadUrlOptions {
  destination: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface UploadUrlResult {
  /** Presigned PUT URL. */
  uploadUrl: string;
  /** Headers the PUT must send exactly as signed. */
  headers: Record<string, string>;
  /** Public URL the file will have once uploaded. */
  fileurl: string;
  filename: string;
  key: string;
}
