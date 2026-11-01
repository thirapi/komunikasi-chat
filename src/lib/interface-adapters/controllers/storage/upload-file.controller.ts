import { UploadFileUseCase } from "@/lib/application/use-cases/storage/upload-file.use-case";
import { CreateUploadUrlUseCase } from "@/lib/application/use-cases/storage/create-upload-url.use-case";
import { CloudflareR2Service } from "@/lib/infrastructure/services/cloudflare-r2.service";
import { UploadedFile } from "@/lib/application/services/file-storage.interface";

const storageService = new CloudflareR2Service();
const uploadFileUseCase = new UploadFileUseCase(storageService);
const createUploadUrlUseCase = new CreateUploadUrlUseCase(storageService);

export async function createUploadUrlController(input: {
  destination: string;
  filename: string;
  contentType: string;
  size: number;
}) {
  return createUploadUrlUseCase.execute(input);
}

export async function uploadFileController(
  file: File,
  destination?: string
): Promise<{ fileurl: string; filename: string; size: number; mimetype: string }> {
  if (!file) {
    throw new Error("File is required");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  
  const uploadedFile: UploadedFile = {
    size: file.size,
    fieldname: "file",
    originalname: file.name,
    buffer,
    mimetype: file.type,
  };

  return await uploadFileUseCase.execute(uploadedFile, destination);
}
