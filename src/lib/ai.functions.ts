import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";

/** AI performance coach for the signed-in participant, grounded in real results. */
export const getParticipantInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { aiConfigured, createAssessaModel } =
      await import("@/lib/ai-gateway.server");
    if (!aiConfigured()) {
      return {
        text: null,
        error:
          "AI insights are not configured yet. Set GEMINI_API_KEY in .env and restart the server.",
      };
    }

    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { participantStats, getXpTotal, getLevels } =
      await import("@/lib/platform.server");
    const { resolveLevel } = await import("@/lib/gamification");
    const userId = context.userId;

    const stats = await participantStats(userId);
    if (stats.completed === 0) {
      return {
        text: null,
        error:
          "Complete your first assessment to unlock personalised AI coaching.",
      };
    }

    const [{ data: mastery }, { data: attempts }] = await Promise.all([
      supabaseAdmin
        .from("topic_mastery")
        .select("topic, subtopic, mastery")
        .eq("user_id", userId),
      supabaseAdmin
        .from("exam_attempts")
        .select("score, passed, submitted_at, exams(title, topic)")
        .eq("user_id", userId)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true }),
    ]);

    const level = resolveLevel(await getXpTotal(userId), await getLevels());
    const history = (attempts ?? []).map((a) => {
      const exam = a.exams as unknown as {
        title: string;
        topic: string;
      } | null;
      return `${exam?.title ?? "Assessment"} (${exam?.topic ?? ""}): ${a.score}% ${a.passed ? "passed" : "not passed"}`;
    });

    const facts = [
      `Assessments completed: ${stats.completed}`,
      `Average score: ${stats.average}%`,
      `Best score: ${stats.best}%`,
      `Pass rate: ${stats.passRate}%`,
      `Level ${level.level} (${level.name}) with ${level.xp} XP; ${level.xpToNext} XP to level ${level.nextLevel ?? level.level}`,
      `Result history (oldest first): ${history.join(" | ")}`,
      `Topic mastery: ${
        (mastery ?? [])
          .map((m) => `${m.topic}/${m.subtopic} ${m.mastery}%`)
          .join(", ") || "none recorded"
      }`,
    ].join("\n");

    const { streamText } = await import("ai");

    try {
      const result = streamText({
        model: createAssessaModel(),
        system:
          "You are an assessment performance coach. Use ONLY the supplied data — never invent scores or topics. " +
          "Reply in 4 short paragraphs, no markdown headings, no bullet lists: (1) score trajectory with real numbers, " +
          "(2) strongest area, (3) biggest opportunity, (4) one concrete recommended next step plus the XP needed for the next level. " +
          "Warm, direct, under 150 words total.",
        prompt: facts,
      });
      return { text: await result.text, error: null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI request failed";
      console.error("[ai] participant insight failed:", message);
      if (message.includes("429"))
        return { text: null, error: "AI is busy — try again shortly." };
      if (message.includes("402") || /quota|billing|exceeded/i.test(message))
        return {
          text: null,
          error: "AI quota exhausted. Check your Gemini API key limits.",
        };
      if (/no longer available|not found|404/i.test(message))
        return {
          text: null,
          error:
            "AI model unavailable. Set GEMINI_MODEL to gemini-3.5-flash-lite.",
        };
      return { text: null, error: "Could not generate insights right now." };
    }
  });

/** AI cohort insight for administrators. */
export const getTeamInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { aiConfigured, createAssessaModel } =
      await import("@/lib/ai-gateway.server");
    if (!aiConfigured()) {
      return {
        text: null,
        error:
          "AI insights are not configured yet. Set GEMINI_API_KEY in .env and restart the server.",
      };
    }

    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/platform.server");
    await requireAdmin(context.userId);

    const [{ data: attempts }, { data: mastery }, { data: profiles }] =
      await Promise.all([
        supabaseAdmin
          .from("exam_attempts")
          .select("user_id, score, passed, submitted_at, exams(title, topic)")
          .eq("status", "submitted")
          .order("submitted_at", { ascending: true }),
        supabaseAdmin.from("topic_mastery").select("topic, subtopic, mastery"),
        supabaseAdmin.from("profiles").select("id, department"),
      ]);

    if ((attempts ?? []).length === 0) {
      return {
        text: null,
        error: "No submitted assessments yet — insights unlock with results.",
      };
    }

    const byTopic = new Map<string, number[]>();
    for (const a of attempts ?? []) {
      const exam = a.exams as unknown as { topic: string } | null;
      const topic = exam?.topic ?? "General";
      const list = byTopic.get(topic) ?? [];
      list.push(Number(a.score ?? 0));
      byTopic.set(topic, list);
    }
    const perUser = new Map<string, number[]>();
    for (const a of attempts ?? []) {
      const list = perUser.get(a.user_id) ?? [];
      list.push(Number(a.score ?? 0));
      perUser.set(a.user_id, list);
    }
    const improved = [...perUser.values()].filter(
      (scores) =>
        scores.length >= 2 &&
        (scores[scores.length - 1] ?? 0) - (scores[0] ?? 0) >= 10,
    ).length;

    const facts = [
      `Participants with results: ${perUser.size} of ${(profiles ?? []).length}`,
      `Total submitted assessments: ${(attempts ?? []).length}`,
      `Average by topic: ${[...byTopic.entries()]
        .map(
          ([topic, list]) =>
            `${topic} ${Math.round(list.reduce((s, v) => s + v, 0) / list.length)}%`,
        )
        .join(", ")}`,
      `Weakest subtopics: ${(mastery ?? [])
        .sort((a, b) => Number(a.mastery) - Number(b.mastery))
        .slice(0, 6)
        .map((m) => `${m.topic}/${m.subtopic} ${m.mastery}%`)
        .join(", ")}`,
      `Participants improving by 10 points or more: ${improved}`,
    ].join("\n");

    const { streamText } = await import("ai");

    try {
      const result = streamText({
        model: createAssessaModel(),
        system:
          "You are an L&D analytics advisor. Use ONLY the supplied cohort data — never invent numbers. " +
          "Reply in 3 short paragraphs with no markdown headings: cohort trend, weakest topic with its real average, " +
          "and one concrete training recommendation. Under 150 words.",
        prompt: facts,
      });
      return { text: await result.text, error: null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI request failed";
      console.error("[ai] team insight failed:", message);
      if (message.includes("429"))
        return { text: null, error: "AI is busy — try again shortly." };
      if (message.includes("402") || /quota|billing|exceeded/i.test(message))
        return {
          text: null,
          error: "AI quota exhausted. Check your Gemini API key limits.",
        };
      if (/no longer available|not found|404/i.test(message))
        return {
          text: null,
          error:
            "AI model unavailable. Set GEMINI_MODEL to gemini-3.5-flash-lite.",
        };
      return {
        text: null,
        error: "Could not generate cohort insights right now.",
      };
    }
  });
