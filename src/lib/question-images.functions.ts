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
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
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

export const uploadQuestionImageFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        folder: z.string().trim().min(1).max(200),
        files: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(240),
              type: z.string().trim().max(120).optional().default(""),
              data: z.string().min(1),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await adminStorage(context.userId);
    const bucketError = await ensureBucket(admin);
    const map: Record<string, string> = {};
    const errors: string[] = [];
    let uploaded = 0;
    const folder = data.folder.replace(/\/+$/, "");

    if (bucketError) {
      return {
        map,
        uploaded: 0,
        errors: [`Could not create image bucket: ${bucketError}`],
      };
    }

    for (const file of data.files) {
      const path = `${folder}/${Date.now()}-${safeFileName(file.name)}`;
      const bytes = Uint8Array.from(atob(file.data), (char) => char.charCodeAt(0));
      const contentType = file.type || mimeFromFileName(file.name);
      const { error } = await admin.storage.from(QUESTION_IMAGE_BUCKET).upload(path, bytes, {
        upsert: true,
        contentType,
      });
      if (error) {
        errors.push(`${file.name}: ${error.message}`);
        continue;
      }
      const { data: publicUrl } = admin.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path);
      if (publicUrl.publicUrl) {
        map[file.name.trim().toLowerCase()] = publicUrl.publicUrl;
        uploaded += 1;
      }
    }

    return { map, uploaded, errors };
  });
