import { supabase } from "@/integrations/supabase/client";
import { imageMapFromUrl, resolveImageRef } from "./question-image-ref.ts";
import {
  createQuestionImageUpload,
  mimeFromFileName,
  QUESTION_IMAGE_BUCKET,
} from "./question-images.functions.ts";

export { imageMapFromUrl, resolveImageRef } from "./question-image-ref.ts";
export { QUESTION_IMAGE_BUCKET } from "./question-images.functions.ts";

const IMAGE_EXT = /\.(avif|png|jpe?g|gif|webp|svg|heic|heif|bmp)$/i;

export const IMAGE_FILE_ACCEPT =
  "image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.avif,.gif,.svg";

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXT.test(file.name);
}

/** Upload original image bytes (PNG-safe) via a signed Storage URL. */
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

  const map: Record<string, string> = {};
  const errors: string[] = [];
  let uploaded = 0;

  for (const file of images) {
    const contentType =
      file.type && file.type.startsWith("image/") ? file.type : mimeFromFileName(file.name);
    try {
      const ticket = await createQuestionImageUpload({
        data: {
          folder,
          name: file.name,
          type: contentType,
        },
      });
      const { error } = await supabase.storage
        .from(QUESTION_IMAGE_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: ticket.contentType,
        });
      if (error) {
        errors.push(`${file.name}: ${error.message}`);
        continue;
      }
      map[file.name.trim().toLowerCase()] = ticket.publicUrl;
      uploaded += 1;
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : "Upload failed"}`);
    }
  }

  return { map, uploaded, errors };
}
