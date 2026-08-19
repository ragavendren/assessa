import { imageMapFromUrl, resolveImageRef } from "./question-image-ref.ts";
import { mimeFromFileName, uploadQuestionImageFiles } from "./question-images.functions.ts";

export { imageMapFromUrl, resolveImageRef } from "./question-image-ref.ts";

const IMAGE_EXT = /\.(avif|png|jpe?g|gif|webp|svg|heic|heif|bmp)$/i;

export const IMAGE_FILE_ACCEPT = "image/*,.avif,.heic,.heif,image/avif,image/webp";

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXT.test(file.name);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

/** Upload prompt images to the public question-bank bucket and map filename → URL. */
export async function uploadQuestionImages(
  files: File[],
  folder: string,
): Promise<{ map: Record<string, string>; uploaded: number; errors: string[] }> {
  const images = files.filter(isImageFile);
  if (images.length === 0) {
    return {
      map: {},
      uploaded: 0,
      errors: ["Select image files (PNG, JPG, WEBP, AVIF, GIF, or SVG)."],
    };
  }

  const payloads = await Promise.all(
    images.map(async (file) => ({
      name: file.name,
      type: file.type || mimeFromFileName(file.name),
      data: await fileToBase64(file),
    })),
  );

  return uploadQuestionImageFiles({
    data: { folder, files: payloads },
  });
}
