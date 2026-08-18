import { supabase } from "@/integrations/supabase/client";

export { resolveImageRef } from "./question-image-ref.ts";

const BUCKET = "question-bank-images";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Upload prompt images to the public question-bank bucket and map filename → URL. */
export async function uploadQuestionImages(
  files: File[],
  folder: string,
): Promise<{ map: Record<string, string>; uploaded: number; errors: string[] }> {
  const images = files.filter((file) => file.type.startsWith("image/"));
  if (images.length === 0) {
    return { map: {}, uploaded: 0, errors: ["Select image files only."] };
  }
  const map: Record<string, string> = {};
  const errors: string[] = [];
  let uploaded = 0;

  for (const file of images) {
    const path = `${folder.replace(/\/+$/, "")}/${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) {
      errors.push(`${file.name}: ${error.message}`);
      continue;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (data.publicUrl) {
      map[file.name.trim().toLowerCase()] = data.publicUrl;
      uploaded += 1;
    }
  }

  return { map, uploaded, errors };
}
