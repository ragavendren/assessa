/** Fixed human avatar catalog: man, woman, boy, girl. */

export type AvatarCategory = "man" | "woman" | "boy" | "girl";

export type AvatarOption = {
  id: string;
  label: string;
  category: AvatarCategory;
  /** Public path to illustrated SVG */
  src: string;
};

export const AVATARS: AvatarOption[] = [
  { id: "man-1", label: "Alex", category: "man", src: "/avatars/man-1.svg" },
  { id: "man-2", label: "Jordan", category: "man", src: "/avatars/man-2.svg" },
  { id: "man-3", label: "Sam", category: "man", src: "/avatars/man-3.svg" },
  { id: "man-4", label: "Chris", category: "man", src: "/avatars/man-4.svg" },
  { id: "woman-1", label: "Ava", category: "woman", src: "/avatars/woman-1.svg" },
  { id: "woman-2", label: "Maya", category: "woman", src: "/avatars/woman-2.svg" },
  { id: "woman-3", label: "Nina", category: "woman", src: "/avatars/woman-3.svg" },
  { id: "woman-4", label: "Priya", category: "woman", src: "/avatars/woman-4.svg" },
  { id: "boy-1", label: "Leo", category: "boy", src: "/avatars/boy-1.svg" },
  { id: "boy-2", label: "Max", category: "boy", src: "/avatars/boy-2.svg" },
  { id: "boy-3", label: "Kai", category: "boy", src: "/avatars/boy-3.svg" },
  { id: "boy-4", label: "Omar", category: "boy", src: "/avatars/boy-4.svg" },
  { id: "girl-1", label: "Mia", category: "girl", src: "/avatars/girl-1.svg" },
  { id: "girl-2", label: "Zoe", category: "girl", src: "/avatars/girl-2.svg" },
  { id: "girl-3", label: "Ivy", category: "girl", src: "/avatars/girl-3.svg" },
  { id: "girl-4", label: "Noor", category: "girl", src: "/avatars/girl-4.svg" },
];

export const AVATAR_IDS = AVATARS.map((a) => a.id);

export function getAvatar(id: string | null | undefined): AvatarOption | null {
  if (!id) return null;
  return AVATARS.find((a) => a.id === id) ?? null;
}

export function isAvatarId(value: string | null | undefined): value is string {
  return !!value && AVATAR_IDS.includes(value);
}
