/**
 * Pulse event engine — Mentimeter-style slides. Server-only.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  aggregateSlide,
  generateJoinCode,
  normalizeJoinCode,
  wallVisible,
  type PulseRevealMode,
  type PulseResponsePayload,
  type PulseSlide,
  type PulseSlideInput,
  type PulseStatus,
} from "@/lib/play.pulse";
import { requireAdmin } from "@/lib/platform.server";

const db = supabaseAdmin;

type PulseRow = {
  id: string;
  name: string;
  join_code: string;
  status: PulseStatus;
  reveal_mode: PulseRevealMode;
  current_index: number;
  listed: boolean;
  activity_id: string | null;
  course_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type SlideRow = {
  id: string;
  pulse_id: string;
  sort_order: number;
  type: "mcq" | "text" | "rating";
  prompt: string;
  image_url: string | null;
  options: unknown;
  rating_max: number;
};

function mapSlide(row: SlideRow): PulseSlide {
  const options = Array.isArray(row.options)
    ? (row.options as unknown[]).map((o) => String(o))
    : [];
  return {
    id: row.id,
    sortOrder: row.sort_order,
    type: row.type,
    prompt: row.prompt,
    imageUrl: row.image_url,
    options,
    ratingMax: row.rating_max ?? 5,
  };
}

async function uniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateJoinCode(6);
    const { data } = await db.from("play_pulses").select("id").eq("join_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not allocate a join code. Try again.");
}

async function loadPulse(pulseId: string): Promise<PulseRow> {
  const { data, error } = await db.from("play_pulses").select("*").eq("id", pulseId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pulse not found.");
  return data as PulseRow;
}

async function loadSlides(pulseId: string): Promise<PulseSlide[]> {
  const { data, error } = await db
    .from("play_pulse_slides")
    .select("*")
    .eq("pulse_id", pulseId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapSlide(row as SlideRow));
}

function validateSlides(slides: PulseSlideInput[]) {
  if (slides.length < 1) throw new Error("Add at least one slide.");
  if (slides.length > 40) throw new Error("Maximum 40 slides.");
  for (const [i, slide] of slides.entries()) {
    if (!slide.prompt.trim()) throw new Error(`Slide ${i + 1} needs a prompt.`);
    if (slide.type === "mcq") {
      const options = (slide.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) throw new Error(`Slide ${i + 1}: MCQ needs at least two options.`);
      if (options.length > 8) throw new Error(`Slide ${i + 1}: MCQ supports at most 8 options.`);
    }
    if (slide.type === "rating") {
      const max = slide.ratingMax ?? 5;
      if (max < 2 || max > 10) throw new Error(`Slide ${i + 1}: rating max must be 2–10.`);
    }
  }
}

async function replaceSlides(pulseId: string, slides: PulseSlideInput[]) {
  validateSlides(slides);
  const { error: delError } = await db.from("play_pulse_slides").delete().eq("pulse_id", pulseId);
  if (delError) throw new Error(delError.message);
  const rows = slides.map((slide, index) => ({
    pulse_id: pulseId,
    sort_order: index,
    type: slide.type,
    prompt: slide.prompt.trim(),
    image_url: slide.imageUrl?.trim() || null,
    options: slide.type === "mcq" ? (slide.options ?? []).map((o) => o.trim()).filter(Boolean) : [],
    rating_max: slide.type === "rating" ? (slide.ratingMax ?? 5) : 5,
  }));
  const { error } = await db.from("play_pulse_slides").insert(rows);
  if (error) throw new Error(error.message);
}

export async function adminCreatePulse(
  userId: string,
  payload: {
    name: string;
    revealMode: PulseRevealMode;
    slides: PulseSlideInput[];
    activityId?: string | null;
    courseId?: string | null;
  },
) {
  await requireAdmin(userId);
  validateSlides(payload.slides);
  const joinCode = await uniqueJoinCode();
  const { data, error } = await db
    .from("play_pulses")
    .insert({
      name: payload.name.trim(),
      join_code: joinCode,
      status: "draft",
      reveal_mode: payload.revealMode,
      current_index: 0,
      listed: false,
      activity_id: payload.activityId ?? null,
      course_id: payload.courseId ?? null,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await replaceSlides(data.id, payload.slides);
  return { pulseId: data.id as string, joinCode };
}

export async function adminUpdatePulse(
  userId: string,
  payload: {
    pulseId: string;
    name?: string;
    revealMode?: PulseRevealMode;
    slides?: PulseSlideInput[];
    activityId?: string | null;
    courseId?: string | null;
  },
) {
  await requireAdmin(userId);
  const pulse = await loadPulse(payload.pulseId);
  if (pulse.status !== "draft" && pulse.status !== "lobby") {
    throw new Error("Only draft or lobby pulses can be edited.");
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined) patch.name = payload.name.trim();
  if (payload.revealMode !== undefined) patch.reveal_mode = payload.revealMode;
  if (payload.activityId !== undefined) patch.activity_id = payload.activityId;
  if (payload.courseId !== undefined) patch.course_id = payload.courseId;
  const { error } = await db.from("play_pulses").update(patch).eq("id", payload.pulseId);
  if (error) throw new Error(error.message);
  if (payload.slides) {
    if (pulse.status === "lobby") {
      throw new Error("Replace slides only while the pulse is still a draft.");
    }
    await replaceSlides(payload.pulseId, payload.slides);
  }
  return { ok: true as const };
}

export async function adminSetPulseListed(userId: string, pulseId: string, listed: boolean) {
  await requireAdmin(userId);
  const { error } = await db
    .from("play_pulses")
    .update({ listed, updated_at: new Date().toISOString() })
    .eq("id", pulseId);
  if (error) throw new Error(error.message);
  return { ok: true as const, listed };
}

export async function adminDeletePulse(userId: string, pulseId: string) {
  await requireAdmin(userId);
  const { error } = await db.from("play_pulses").delete().eq("id", pulseId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function adminListPulses(userId: string) {
  await requireAdmin(userId);
  const { data, error } = await db
    .from("play_pulses")
    .select("id, name, join_code, status, reveal_mode, listed, current_index, created_at")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return {
    pulses: (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      joinCode: row.join_code as string,
      status: row.status as PulseStatus,
      revealMode: row.reveal_mode as PulseRevealMode,
      listed: Boolean(row.listed),
      currentIndex: row.current_index as number,
      createdAt: row.created_at as string,
    })),
  };
}

export async function adminPulseAction(
  userId: string,
  payload: {
    pulseId: string;
    action: "openLobby" | "showSlide" | "reveal" | "next" | "finish";
    slideIndex?: number;
  },
) {
  await requireAdmin(userId);
  const pulse = await loadPulse(payload.pulseId);
  const slides = await loadSlides(payload.pulseId);
  if (slides.length === 0) throw new Error("Add slides before hosting.");

  const now = new Date().toISOString();
  let status = pulse.status;
  let currentIndex = pulse.current_index;

  switch (payload.action) {
    case "openLobby":
      // Start (or restart) live: first slide so participants can answer immediately.
      status = "prompt";
      currentIndex = 0;
      break;
    case "showSlide": {
      const index =
        payload.slideIndex !== undefined
          ? payload.slideIndex
          : pulse.status === "lobby"
            ? 0
            : currentIndex;
      if (index < 0 || index >= slides.length) throw new Error("Invalid slide.");
      status = "prompt";
      currentIndex = index;
      break;
    }
    case "reveal":
      if (pulse.status !== "prompt" && pulse.status !== "results") {
        throw new Error("Show a slide before revealing results.");
      }
      status = "results";
      break;
    case "next": {
      if (currentIndex >= slides.length - 1) {
        status = "complete";
      } else {
        currentIndex += 1;
        status = "prompt";
      }
      break;
    }
    case "finish":
      status = "complete";
      break;
    default:
      throw new Error("Unknown action.");
  }

  const { error } = await db
    .from("play_pulses")
    .update({ status, current_index: currentIndex, updated_at: now })
    .eq("id", payload.pulseId);
  if (error) throw new Error(error.message);
  return { ok: true as const, status, currentIndex };
}

async function participantCount(pulseId: string) {
  const { count, error } = await db
    .from("play_pulse_participants")
    .select("user_id", { count: "exact", head: true })
    .eq("pulse_id", pulseId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function responsesForSlide(pulseId: string, slideIndex: number) {
  const { data, error } = await db
    .from("play_pulse_responses")
    .select("user_id, payload, submitted_at")
    .eq("pulse_id", pulseId)
    .eq("slide_index", slideIndex);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    let payload = row.payload as PulseResponsePayload | string;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload) as PulseResponsePayload;
      } catch {
        payload = { text: payload };
      }
    }
    return {
      userId: row.user_id as string,
      payload: payload as PulseResponsePayload,
      submittedAt: row.submitted_at as string,
    };
  });
}

async function maybeAutoRevealAllIn(pulseId: string) {
  const pulse = await loadPulse(pulseId);
  if (pulse.reveal_mode !== "all_in" || pulse.status !== "prompt") return;
  const [participants, responses] = await Promise.all([
    participantCount(pulseId),
    responsesForSlide(pulseId, pulse.current_index),
  ]);
  if (participants > 0 && responses.length >= participants) {
    await db
      .from("play_pulses")
      .update({ status: "results", updated_at: new Date().toISOString() })
      .eq("id", pulseId)
      .eq("status", "prompt");
  }
}

export async function getPulseHost(userId: string, pulseId: string) {
  await requireAdmin(userId);
  const pulse = await loadPulse(pulseId);
  const slides = await loadSlides(pulseId);
  const [{ data: participantRows }, responses] = await Promise.all([
    db
      .from("play_pulse_participants")
      .select("user_id, joined_at")
      .eq("pulse_id", pulseId)
      .order("joined_at"),
    responsesForSlide(pulseId, pulse.current_index),
  ]);
  const userIds = (participantRows ?? []).map((row) => row.user_id as string);
  const { data: profiles } =
    userIds.length > 0
      ? await db.from("profiles").select("id, full_name, display_name, email").in("id", userIds)
      : {
          data: [] as Array<{
            id: string;
            full_name: string | null;
            display_name: string | null;
            email: string | null;
          }>,
        };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const slide = slides[pulse.current_index] ?? null;
  const wall = slide ? aggregateSlide({ slide, responses }) : null;
  const showWall = wallVisible({
    revealMode: pulse.reveal_mode,
    status: pulse.status,
    responseCount: responses.length,
    participantCount: (participantRows ?? []).length,
  });

  return {
    pulse: {
      id: pulse.id,
      name: pulse.name,
      joinCode: pulse.join_code,
      status: pulse.status,
      revealMode: pulse.reveal_mode,
      currentIndex: pulse.current_index,
      listed: pulse.listed,
      createdAt: pulse.created_at,
    },
    slides,
    participants: (participantRows ?? []).map((row) => {
      const profile = profileById.get(row.user_id as string);
      return {
        userId: row.user_id as string,
        joinedAt: row.joined_at as string,
        name: profile?.display_name || profile?.full_name || profile?.email || "Participant",
        email: profile?.email ?? null,
      };
    }),
    responseCount: responses.length,
    wall: showWall ? wall : null,
    wallVisible: showWall,
  };
}

export async function listOpenPulses() {
  const { data, error } = await db
    .from("play_pulses")
    .select("id, name, join_code, status, reveal_mode, current_index, created_at")
    .eq("listed", true)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return {
    pulses: (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      joinCode: row.join_code as string,
      status: row.status as PulseStatus,
      revealMode: row.reveal_mode as PulseRevealMode,
      currentIndex: row.current_index as number,
      createdAt: row.created_at as string,
    })),
  };
}

export async function resolvePulseIdByCode(code: string) {
  const normalized = normalizeJoinCode(code);
  if (normalized.length !== 6) throw new Error("Enter a 6-character join code.");
  const { data, error } = await db
    .from("play_pulses")
    .select("id, status")
    .eq("join_code", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No pulse found for that code.");
  if (data.status === "draft") throw new Error("This pulse is not open yet.");
  return { pulseId: data.id as string };
}

export async function joinPulse(userId: string, pulseId: string) {
  const pulse = await loadPulse(pulseId);
  if (pulse.status === "draft") throw new Error("This pulse is not open yet.");
  if (pulse.status === "complete") throw new Error("This pulse has finished.");
  const { error } = await db
    .from("play_pulse_participants")
    .upsert(
      { pulse_id: pulseId, user_id: userId },
      { onConflict: "pulse_id,user_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  return { ok: true as const, pulseId };
}

export async function joinPulseByCode(userId: string, code: string) {
  const { pulseId } = await resolvePulseIdByCode(code);
  return joinPulse(userId, pulseId);
}

export async function getPulsePlayer(userId: string, pulseId: string) {
  const pulse = await loadPulse(pulseId);
  if (pulse.status === "draft") throw new Error("This pulse is not open yet.");

  // Direct share links should enroll the signed-in participant immediately.
  const { error: joinError } = await db
    .from("play_pulse_participants")
    .upsert(
      { pulse_id: pulseId, user_id: userId },
      { onConflict: "pulse_id,user_id", ignoreDuplicates: true },
    );
  if (joinError) throw new Error(joinError.message);

  const slides = await loadSlides(pulseId);
  const { data: membership } = await db
    .from("play_pulse_participants")
    .select("user_id")
    .eq("pulse_id", pulseId)
    .eq("user_id", userId)
    .maybeSingle();
  const joined = Boolean(membership);
  const slide = slides[pulse.current_index] ?? null;
  const responses = await responsesForSlide(pulseId, pulse.current_index);
  const mine = responses.find((r) => r.userId === userId) ?? null;
  const participants = await participantCount(pulseId);
  const showWall = wallVisible({
    revealMode: pulse.reveal_mode,
    status: pulse.status,
    responseCount: responses.length,
    participantCount: participants,
  });
  // Always build aggregates for the current slide so the wall can render once reveal rules allow.
  const wall = slide ? aggregateSlide({ slide, responses }) : null;

  return {
    pulse: {
      id: pulse.id,
      name: pulse.name,
      joinCode: pulse.join_code,
      status: pulse.status,
      revealMode: pulse.reveal_mode,
      currentIndex: pulse.current_index,
    },
    joined,
    participantCount: participants,
    slideCount: slides.length,
    slide:
      slide &&
      (pulse.status === "prompt" || pulse.status === "results" || pulse.status === "complete")
        ? {
            index: pulse.current_index,
            type: slide.type,
            prompt: slide.prompt,
            imageUrl: slide.imageUrl,
            options: slide.options,
            ratingMax: slide.ratingMax,
          }
        : null,
    myResponse: mine?.payload ?? null,
    wall,
    wallVisible: showWall,
    canAnswer: joined && pulse.status === "prompt" && Boolean(slide) && !mine,
  };
}

export async function submitPulseResponse(
  userId: string,
  payload: { pulseId: string; slideIndex: number; response: PulseResponsePayload },
) {
  const pulse = await loadPulse(payload.pulseId);
  if (pulse.status !== "prompt") throw new Error("Responses are closed for this slide.");
  if (payload.slideIndex !== pulse.current_index) {
    throw new Error("This slide is no longer active.");
  }
  const { data: membership } = await db
    .from("play_pulse_participants")
    .select("user_id")
    .eq("pulse_id", payload.pulseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) throw new Error("Join the pulse before answering.");

  const slides = await loadSlides(payload.pulseId);
  const slide = slides[payload.slideIndex];
  if (!slide) throw new Error("Slide not found.");

  const response = payload.response;
  let stored: PulseResponsePayload;
  if (slide.type === "mcq") {
    if (!("choiceIndex" in response)) throw new Error("Pick an option.");
    if (response.choiceIndex < 0 || response.choiceIndex >= slide.options.length) {
      throw new Error("Invalid option.");
    }
    stored = { choiceIndex: response.choiceIndex };
  } else if (slide.type === "rating") {
    if (!("rating" in response)) throw new Error("Pick a rating.");
    if (response.rating < 1 || response.rating > slide.ratingMax) {
      throw new Error(`Rating must be between 1 and ${slide.ratingMax}.`);
    }
    stored = { rating: response.rating };
  } else {
    if (!("text" in response) || !response.text.trim()) throw new Error("Enter a response.");
    if (response.text.trim().length > 280) throw new Error("Keep responses under 280 characters.");
    stored = { text: response.text.trim() };
  }

  const { error } = await db.from("play_pulse_responses").upsert(
    {
      pulse_id: payload.pulseId,
      user_id: userId,
      slide_index: payload.slideIndex,
      payload: stored,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "pulse_id,user_id,slide_index" },
  );
  if (error) throw new Error(error.message);

  await maybeAutoRevealAllIn(payload.pulseId);
  return { ok: true as const };
}
