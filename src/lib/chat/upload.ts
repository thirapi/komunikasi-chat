import { createUploadUrlAction, uploadFileAction } from "@/app/(with-sidebar)/channels/[roomId]/messages.action";

export type UploadedAttachment = { url: string; key: string; fileType: string; size: number };

/**
 * Files up to this size can still go through the server action. Vercel caps
 * function request bodies at ~4.5 MB, so anything larger must be uploaded
 * directly to R2.
 */
const SERVER_UPLOAD_MAX = 4 * 1024 * 1024;

function putWithProgress(url: string, file: File, headers: Record<string, string>, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload gagal (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload gagal. Periksa koneksi lalu coba lagi."));
    xhr.onabort = () => reject(new Error("Upload dibatalkan"));
    xhr.send(file);
  });
}

/**
 * Upload a file for a message, avatar or banner.
 *
 * Preferred path: ask the server for a presigned URL and PUT the file straight
 * to R2 (works for large videos, shows progress). If that is not possible —
 * e.g. the bucket's CORS rule is missing — small files fall back to the old
 * server-action upload.
 */
export async function uploadFile(
  file: File,
  destination: string,
  onProgress?: (pct: number) => void,
): Promise<UploadedAttachment> {
  const contentType = file.type || "application/octet-stream";
  let directError: Error | null = null;

  const presign = await createUploadUrlAction({ destination, filename: file.name, contentType, size: file.size });
  if (presign.status === "success" && presign.data) {
    try {
      await putWithProgress(presign.data.uploadUrl, file, presign.data.headers, onProgress);
      return { url: presign.data.fileurl, key: presign.data.filename, fileType: contentType, size: file.size };
    } catch (err) {
      directError = err as Error;
      console.warn("[upload] direct upload failed, trying server upload", err);
    }
  } else {
    directError = new Error(presign.error?.message || "Gagal menyiapkan upload");
  }

  if (file.size > SERVER_UPLOAD_MAX) throw directError;

  const formData = new FormData();
  formData.append("file", file);
  const res = await uploadFileAction(formData, destination);
  if (res.status !== "success" || !res.data) {
    throw new Error(res.error?.message || directError?.message || `Gagal mengunggah ${file.name}`);
  }
  onProgress?.(100);
  return { url: res.data.fileurl, key: res.data.filename, fileType: res.data.mimetype, size: res.data.size };
}

/** uploadFile in the `{ status, data, error }` shape the settings screens expect. */
export async function uploadFileResult(file: File, destination: string) {
  try {
    const a = await uploadFile(file, destination);
    return {
      status: "success" as const,
      data: { fileurl: a.url, filename: a.key, size: a.size, mimetype: a.fileType },
      error: null,
    };
  } catch (err) {
    return { status: "error" as const, data: null, error: { message: (err as Error).message } };
  }
}
