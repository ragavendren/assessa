/** Resolve a CSV image cell to a URL, filename map entry, or site-relative path. */

const HTTP_URL = /^(https?:\/\/|\/)/i;

export function normalizeImageUrl(value: string): string | null {
  const ref = value.trim();
  if (!ref) return null;
  if (HTTP_URL.test(ref)) return ref;
  if (/^www\./i.test(ref)) return `https://${ref}`;
  return null;
}

export function resolveImageRef(
  imageRef: string,
  imageMap: Record<string, string> = {},
): string | null {
  const ref = imageRef.trim();
  if (!ref) return null;
  const asUrl = normalizeImageUrl(ref);
  if (asUrl) return asUrl;
  const key = ref.toLowerCase();
  return imageMap[key] ?? imageMap[decodeURIComponent(key)] ?? null;
}

/** Map a pasted image URL so CSV rows can use the full URL or the file name. */
export function imageMapFromUrl(url: string): Record<string, string> | null {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return null;
  const map: Record<string, string> = { [normalized.toLowerCase()]: normalized };
  try {
    const name = decodeURIComponent(new URL(normalized).pathname.split("/").pop() ?? "")
      .trim()
      .toLowerCase();
    if (name) map[name] = normalized;
  } catch {
    /* keep the raw URL key */
  }
  return map;
}
