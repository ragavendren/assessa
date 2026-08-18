/** Resolve a CSV image cell to a URL, filename map entry, or site-relative path. */
export function resolveImageRef(
  imageRef: string,
  imageMap: Record<string, string> = {},
): string | null {
  const ref = imageRef.trim();
  if (!ref) return null;
  if (/^https?:\/\//i.test(ref) || ref.startsWith("/")) return ref;
  return imageMap[ref.toLowerCase()] ?? null;
}
