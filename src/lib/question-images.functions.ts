import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const QUESTION_IMAGE_BUCKET = "question-bank-images";

const MIME_BY_EXT: Record<string, string> = {
  avif: "image/avif",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
};

export function mimeFromFileName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "image/png";
}

export function safeImageFileName(name: string) {
  const trimmed = name.trim() || "image.png";
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.toLowerCase().endsWith(".png") || /\.[a-z0-9]+$/i.test(cleaned)
    ? cleaned
    : `${cleaned}.png`;
}

async function adminStorage(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { requireAdmin } = await import("@/lib/platform.server");
  await requireAdmin(userId);
  return supabaseAdmin;
}

async function ensureBucket(
  admin: Awaited<ReturnType<typeof adminStorage>>,
): Promise<string | null> {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) return error.message;
  if (
    buckets?.some(
      (bucket) => bucket.id === QUESTION_IMAGE_BUCKET || bucket.name === QUESTION_IMAGE_BUCKET,
    )
  ) {
    return null;
  }
  const { error: createError } = await admin.storage.createBucket(QUESTION_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: 10485760,
  });
  if (createError && !/already exists/i.test(createError.message)) {
    return createError.message;
  }
  return null;
}

export const createQuestionImageUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        folder: z.string().trim().min(1).max(200),
        name: z.string().trim().min(1).max(240),
        type: z.string().trim().max(120).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await adminStorage(context.userId);
    const bucketError = await ensureBucket(admin);
    if (bucketError) throw new Error(`Could not create image bucket: ${bucketError}`);

    const folder = data.folder.replace(/\/+$/, "");
    const path = `${folder}/${Date.now()}-${safeImageFileName(data.name)}`;
    const { data: signed, error } = await admin.storage
      .from(QUESTION_IMAGE_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });
    if (error || !signed) throw new Error(error?.message ?? "Could not start image upload");

    const { data: publicUrl } = admin.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path);
    return {
      bucket: QUESTION_IMAGE_BUCKET,
      path: signed.path,
      token: signed.token,
      publicUrl: publicUrl.publicUrl,
      contentType: data.type || mimeFromFileName(data.name),
    };
  });
