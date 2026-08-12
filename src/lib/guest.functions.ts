import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const participantSchema = z.object({
  examId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  organization: z.string().trim().max(120).optional().or(z.literal("")),
  participantId: z.string().trim().max(60).optional().or(z.literal("")),
  mobile: z.string().trim().max(40).optional().or(z.literal("")),
  extra: z.record(z.string(), z.string()).default({}),
});

/** Public exam briefing for share links — no login required. */
export const getPublicExamBriefing = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getExam } = await import("@/lib/platform.server");
    const { examAvailability } = await import("@/lib/exam-availability");
    const exam = await getExam(data.examId);
    if (exam.access !== "public") {
      throw new Error("This assessment requires an invitation. Contact your administrator.");
    }
    const availability = examAvailability(exam);
    return {
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        topic: exam.topic,
        mode: exam.mode,
        questionCount: exam.question_count,
        duration: exam.duration_minutes,
        passMark: exam.pass_mark,
        maxAttempts: exam.max_attempts,
        startsAt: exam.starts_at,
        endsAt: exam.ends_at ?? null,
        extraFields: exam.extra_fields ?? [],
        enableXp: exam.enable_xp,
        enableBadges: exam.enable_badges,
        enableLeaderboard: exam.enable_leaderboard,
      },
      availability,
    };
  });

/**
 * Collect participant details, provision a participant account session,
 * and start the attempt — no interactive login required.
 */
export const startGuestAttempt = createServerFn({ method: "POST" })
  .validator((input: unknown) => participantSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");
    const { getExam, startAttempt } = await import("@/lib/platform.server");
    const { examAvailability } = await import("@/lib/exam-availability");

    const exam = await getExam(data.examId);
    if (exam.access !== "public") {
      throw new Error("This assessment is not open for shared access.");
    }
    const availability = examAvailability(exam);
    if (!availability.ok) throw new Error(availability.reason);

    const email = data.email.toLowerCase();
    const password = `Guest#${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}Aa1`;

    let userId: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        guest: true,
      },
    });

    if (created.data.user?.id) {
      userId = created.data.user.id;
    } else {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      userId = existing?.id ?? null;
      if (!userId) {
        const { data: listed } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        userId = listed.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
      }
      if (!userId) {
        throw new Error(created.error?.message ?? "Could not create participant session.");
      }
      const updated = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName, guest: true },
      });
      if (updated.error) throw new Error(updated.error.message);
    }

    const { allocateParticipantIdForSave } = await import("@/lib/platform.server");
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("participant_id")
      .eq("id", userId)
      .maybeSingle();
    const participantId =
      existingProfile?.participant_id?.trim() ||
      (await allocateParticipantIdForSave(data.participantId || null));

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: data.fullName,
        organization: data.organization || null,
        participant_id: participantId,
        mobile: data.mobile || null,
      },
      { onConflict: "id" },
    );

    // Guests are always participants — never elevate to admin.
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "participant" }, { onConflict: "user_id,role" });
    await supabaseAdmin.from("user_streaks").upsert(
      [
        { user_id: userId, streak_type: "exam" },
        { user_id: userId, streak_type: "pass" },
        { user_id: userId, streak_type: "high_score" },
      ],
      { onConflict: "user_id,streak_type" },
    );

    const started = await startAttempt(userId, data.examId, data.extra);

    const url = process.env["SUPABASE_URL"];
    const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !publishable) throw new Error("Supabase is not configured on the server.");

    const authClient = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !sessionData.session) {
      throw new Error(signInError?.message ?? "Could not open participant session.");
    }

    return {
      attemptId: started.attemptId,
      resumed: started.resumed,
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    };
  });
