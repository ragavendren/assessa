import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const uuid = z.string().uuid();
const slideSchema = z.object({
  type: z.enum(["mcq", "text", "rating"]),
  prompt: z.string().trim().min(1).max(500),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
  ratingMax: z.number().int().min(2).max(10).optional(),
});

export const createPlayPulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        revealMode: z.enum(["live", "all_in", "host"]),
        slides: z.array(slideSchema).min(1).max(40),
        activityId: uuid.nullable().optional(),
        courseId: uuid.nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminCreatePulse } = await import("@/lib/play.pulse.server");
    return adminCreatePulse(context.userId, {
      name: data.name,
      revealMode: data.revealMode,
      slides: data.slides.map((s) => ({
        type: s.type,
        prompt: s.prompt,
        imageUrl: s.imageUrl || null,
        options: s.options,
        ratingMax: s.ratingMax,
      })),
      activityId: data.activityId,
      courseId: data.courseId,
    });
  });

export const updatePlayPulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        pulseId: uuid,
        name: z.string().trim().min(2).max(120).optional(),
        revealMode: z.enum(["live", "all_in", "host"]).optional(),
        slides: z.array(slideSchema).min(1).max(40).optional(),
        activityId: uuid.nullable().optional(),
        courseId: uuid.nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminUpdatePulse } = await import("@/lib/play.pulse.server");
    return adminUpdatePulse(context.userId, {
      pulseId: data.pulseId,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.revealMode !== undefined ? { revealMode: data.revealMode } : {}),
      ...(data.slides
        ? {
            slides: data.slides.map((s) => ({
              type: s.type,
              prompt: s.prompt,
              imageUrl: s.imageUrl || null,
              options: s.options,
              ratingMax: s.ratingMax,
            })),
          }
        : {}),
      ...(data.activityId !== undefined ? { activityId: data.activityId } : {}),
      ...(data.courseId !== undefined ? { courseId: data.courseId } : {}),
    });
  });

export const setPulseListed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ pulseId: uuid, listed: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { adminSetPulseListed } = await import("@/lib/play.pulse.server");
    return adminSetPulseListed(context.userId, data.pulseId, data.listed);
  });

export const deletePlayPulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ pulseId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { adminDeletePulse } = await import("@/lib/play.pulse.server");
    return adminDeletePulse(context.userId, data.pulseId);
  });

export const listAdminPulses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminListPulses } = await import("@/lib/play.pulse.server");
    return adminListPulses(context.userId);
  });

export const runPulseAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        pulseId: uuid,
        action: z.enum(["openLobby", "showSlide", "reveal", "next", "finish"]),
        slideIndex: z.number().int().min(0).max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminPulseAction } = await import("@/lib/play.pulse.server");
    return adminPulseAction(context.userId, {
      pulseId: data.pulseId,
      action: data.action,
      ...(data.slideIndex !== undefined ? { slideIndex: data.slideIndex } : {}),
    });
  });

export const getPulseHostState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ pulseId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { getPulseHost } = await import("@/lib/play.pulse.server");
    return getPulseHost(context.userId, data.pulseId);
  });

export const listPlayPulses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listOpenPulses } = await import("@/lib/play.pulse.server");
    return listOpenPulses();
  });

export const joinPlayPulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ pulseId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { joinPulse } = await import("@/lib/play.pulse.server");
    return joinPulse(context.userId, data.pulseId);
  });

export const joinPlayPulseByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ code: z.string().trim().min(4).max(12) }).parse(input))
  .handler(async ({ context, data }) => {
    const { joinPulseByCode } = await import("@/lib/play.pulse.server");
    return joinPulseByCode(context.userId, data.code);
  });

export const getPulsePlayerState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ pulseId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { getPulsePlayer } = await import("@/lib/play.pulse.server");
    return getPulsePlayer(context.userId, data.pulseId);
  });

export const submitPlayPulseResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        pulseId: uuid,
        slideIndex: z.number().int().min(0).max(80),
        response: z.union([
          z.object({ choiceIndex: z.number().int().min(0).max(20) }),
          z.object({ text: z.string().trim().min(1).max(280) }),
          z.object({ rating: z.number().int().min(1).max(10) }),
        ]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { submitPulseResponse } = await import("@/lib/play.pulse.server");
    return submitPulseResponse(context.userId, data);
  });

export const resolvePulseCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ code: z.string().trim().min(4).max(12) }).parse(input))
  .handler(async ({ data }) => {
    const { resolvePulseIdByCode } = await import("@/lib/play.pulse.server");
    return resolvePulseIdByCode(data.code);
  });
