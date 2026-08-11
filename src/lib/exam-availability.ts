export type AvailabilityExam = {
  active: boolean;
  starts_at: string | null;
  ends_at?: string | null;
};

export function examAvailability(exam: AvailabilityExam, now = new Date()) {
  if (!exam.active) {
    return {
      ok: false as const,
      reason: "This assessment is not currently published.",
    };
  }
  if (exam.starts_at && new Date(exam.starts_at) > now) {
    return {
      ok: false as const,
      reason: "This assessment has not opened yet.",
      notOpenYet: true,
    };
  }
  if (exam.ends_at && new Date(exam.ends_at) < now) {
    return {
      ok: false as const,
      reason: "This assessment is no longer available.",
      closed: true,
    };
  }
  return { ok: true as const };
}
