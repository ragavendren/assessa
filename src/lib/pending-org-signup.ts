const STORAGE_KEY = "assessa.pendingOrg";

export type PendingOrgSignup = {
  organization: string;
  department: string;
};

/** Stash org/team before Google OAuth redirect (custom claims cannot travel through the IdP). */
export function stashPendingOrgSignup(data: PendingOrgSignup) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      organization: data.organization.trim(),
      department: data.department.trim(),
    }),
  );
}

export function readPendingOrgSignup(): PendingOrgSignup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOrgSignup;
    if (!parsed.organization?.trim() || !parsed.department?.trim()) return null;
    return {
      organization: parsed.organization.trim(),
      department: parsed.department.trim(),
    };
  } catch {
    return null;
  }
}

export function clearPendingOrgSignup() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
