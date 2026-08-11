import { createServerFn } from "@tanstack/react-start";

/**
 * Demo admin seeding is disabled in production.
 * Enable locally only with ALLOW_SEED_ADMIN=true — never expose passwords to clients.
 */
export const ensureSeedAdmin = createServerFn({ method: "POST" }).handler(async () => {
  if (process.env["ALLOW_SEED_ADMIN"] !== "true") {
    return { ok: false as const, reason: "Seed admin is disabled." };
  }

  const email = process.env["SEED_ADMIN_EMAIL"];
  const password = process.env["SEED_ADMIN_PASSWORD"];
  if (!email || !password || password.length < 12) {
    return {
      ok: false as const,
      reason: "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 12 chars) in the environment.",
    };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let userId: string | null = null;

  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Platform Administrator" },
  });

  if (created.data?.user?.id) {
    userId = created.data.user.id;
  } else {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (profile?.id) {
      userId = profile.id;
    } else {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      userId = list?.users.find((u) => u.email === email)?.id ?? null;
    }
    if (userId) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
    }
  }

  if (!userId) return { ok: false as const, reason: "Could not provision administrator." };

  await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, email, full_name: "Platform Administrator" }, { onConflict: "id" });
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  await supabaseAdmin.from("user_streaks").upsert(
    [
      { user_id: userId, streak_type: "exam" },
      { user_id: userId, streak_type: "pass" },
      { user_id: userId, streak_type: "high_score" },
    ],
    { onConflict: "user_id,streak_type" },
  );

  // Never return the password to the client.
  return { ok: true as const, email };
});
