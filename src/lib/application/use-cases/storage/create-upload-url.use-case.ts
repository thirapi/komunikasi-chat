import { FileStorageInterface, UploadUrlResult } from "../../services/file-storage.interface";

/** MIME types users may upload: images, video, and common documents. */
const ALLOWED_TYPES = [
  /^image\/(png|jpe?g|gif|webp|avif|heic|heif)$/i,
  /^video\/(mp4|webm|ogg|quicktime)$/i,
  /^application\/pdf$/i,
  /^application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/i,
  /^text\/plain$/i,
];

export class CreateUploadUrlUseCase {
  constructor(private storage: FileStorageInterface) {}

  async execute(input: { destination: string; filename: string; contentType: string; size: number }): Promise<UploadUrlResult> {
    const contentType = (input.contentType || "").toLowerCase();
    if (!ALLOWED_TYPES.some((re) => re.test(contentType))) {
      throw new Error("Jenis file ini tidak didukung");
    }
    if (!input.filename || input.filename.length > 200) {
      throw new Error("Nama file tidak valid");
    }
    return this.storage.createUploadUrl({ ...input, contentType });
  }
}
