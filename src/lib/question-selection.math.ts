export type Difficulty = "easy" | "medium" | "hard";

export type BlueprintRuleInput = {
  topic: string;
  subtopic?: string | null;
  weightage: number;
  min_questions?: number;
  max_questions?: number | null;
  easy_percentage: number;
  medium_percentage: number;
  hard_percentage: number;
};

export type TopicAllocation = {
  topic: string;
  subtopic: string | null;
  count: number;
  weightage: number;
  easy_percentage: number;
  medium_percentage: number;
  hard_percentage: number;
  difficulties: Record<Difficulty, number>;
};

export type Shortage = {
  topic: string;
  subtopic: string | null;
  difficulty: Difficulty | "any";
  required: number;
  available: number;
  shortage: number;
};

/** Largest-remainder so allocated integers always sum to `total`. */
export function allocateByWeightage(weights: number[], total: number): number[] {
  if (total <= 0) return weights.map(() => 0);
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const base = Math.floor(total / weights.length);
    const rem = total - base * weights.length;
    return weights.map((_, i) => base + (i < rem ? 1 : 0));
  }
  const exact = weights.map((w) => (w / sum) * total);
  const floors = exact.map((v) => Math.floor(v));
  const remaining = total - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < remaining; k++) {
    const target = order[k % order.length]!;
    out[target.i] = (out[target.i] ?? 0) + 1;
  }
  return out;
}

export function allocateDifficulties(
  count: number,
  easyPct: number,
  mediumPct: number,
  hardPct: number,
): Record<Difficulty, number> {
  const [easy, medium, hard] = allocateByWeightage([easyPct, mediumPct, hardPct], count);
  return { easy: easy ?? 0, medium: medium ?? 0, hard: hard ?? 0 };
}

export function finalizeAllocations(
  rules: BlueprintRuleInput[],
  questionCount: number,
): TopicAllocation[] {
  if (rules.length === 0) throw new Error("Blueprint has no rules.");
  const weightSum = rules.reduce((s, r) => s + Number(r.weightage), 0);
  if (Math.abs(weightSum - 100) > 0.05) {
    throw new Error(`Blueprint weightage must total 100% (currently ${weightSum}%).`);
  }
  if (questionCount < 1) throw new Error("Question count must be at least 1.");

  const counts = allocateByWeightage(
    rules.map((r) => Number(r.weightage)),
    questionCount,
  );

  // Honour min_questions by borrowing from the largest flexible buckets.
  for (let i = 0; i < rules.length; i++) {
    const minQ = rules[i]!.min_questions ?? 0;
    while ((counts[i] ?? 0) < minQ) {
      const donor = counts
        .map((c, idx) => ({ idx, c, max: rules[idx]!.max_questions ?? Infinity }))
        .filter((d) => d.idx !== i && d.c > (rules[d.idx]!.min_questions ?? 0))
        .sort((a, b) => b.c - a.c)[0];
      if (!donor) break;
      counts[donor.idx] = donor.c - 1;
      counts[i] = (counts[i] ?? 0) + 1;
    }
  }

  // Honour max_questions by giving overflow to under-capacity topics.
  for (let i = 0; i < rules.length; i++) {
    const maxQ = rules[i]!.max_questions;
    if (maxQ == null) continue;
    while ((counts[i] ?? 0) > maxQ) {
      const receiver = counts
        .map((c, idx) => ({
          idx,
          c,
          max: rules[idx]!.max_questions ?? Infinity,
        }))
        .filter((d) => d.idx !== i && d.c < d.max)
        .sort((a, b) => a.c - b.c)[0];
      if (!receiver) break;
      counts[i] = (counts[i] ?? 0) - 1;
      counts[receiver.idx] = receiver.c + 1;
    }
  }

  // Final exact-sum correction
  let total = counts.reduce((a, b) => a + b, 0);
  while (total < questionCount) {
    const idx = counts
      .map((c, i) => ({
        i,
        c,
        max: rules[i]!.max_questions ?? Infinity,
        w: Number(rules[i]!.weightage),
      }))
      .filter((x) => x.c < x.max)
      .sort((a, b) => b.w - a.w)[0]?.i;
    if (idx == null) break;
    counts[idx] = (counts[idx] ?? 0) + 1;
    total += 1;
  }
  while (total > questionCount) {
    const idx = counts
      .map((c, i) => ({ i, c, min: rules[i]!.min_questions ?? 0, w: Number(rules[i]!.weightage) }))
      .filter((x) => x.c > x.min)
      .sort((a, b) => a.w - b.w)[0]?.i;
    if (idx == null) break;
    counts[idx] = (counts[idx] ?? 0) - 1;
    total -= 1;
  }

  return rules.map((rule, i) => {
    const count = counts[i] ?? 0;
    const easy_percentage = Number(rule.easy_percentage);
    const medium_percentage = Number(rule.medium_percentage);
    const hard_percentage = Number(rule.hard_percentage);
    return {
      topic: rule.topic,
      subtopic: rule.subtopic ?? null,
      count,
      weightage: Number(rule.weightage),
      easy_percentage,
      medium_percentage,
      hard_percentage,
      difficulties: allocateDifficulties(
        count,
        easy_percentage,
        medium_percentage,
        hard_percentage,
      ),
    };
  });
}

export function distributionMap(allocations: TopicAllocation[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of allocations) {
    out[a.topic] = (out[a.topic] ?? 0) + a.count;
  }
  return out;
}

export function shuffleInPlace<T>(items: T[], random: () => number = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

export type SelectablePoolQuestion = {
  id: string;
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
};

export function selectQuestionsFromPool(args: {
  allocations: TopicAllocation[];
  eligible: SelectablePoolQuestion[];
  random?: () => number;
}): { selectedIds: string[]; shortages: Shortage[] } {
  const { allocations, eligible, random = Math.random } = args;
  const remaining = [...eligible];
  const selectedIds: string[] = [];
  const shortages: Shortage[] = [];

  const removeId = (id: string) => {
    const idx = remaining.findIndex((r) => r.id === id);
    if (idx >= 0) remaining.splice(idx, 1);
  };

  for (const alloc of allocations) {
    const topicMatch = (q: SelectablePoolQuestion) =>
      q.topic === alloc.topic &&
      (alloc.subtopic == null || alloc.subtopic === "" || q.subtopic === alloc.subtopic);

    let takenForTopic = 0;

    for (const diff of ["easy", "medium", "hard"] as Difficulty[]) {
      const need = alloc.difficulties[diff] ?? 0;
      if (need <= 0) continue;
      const matches = remaining.filter((q) => topicMatch(q) && q.difficulty === diff);
      shuffleInPlace(matches, random);
      const picked = matches.slice(0, need);
      for (const q of picked) {
        selectedIds.push(q.id);
        removeId(q.id);
        takenForTopic += 1;
      }
      if (picked.length < need) {
        shortages.push({
          topic: alloc.topic,
          subtopic: alloc.subtopic,
          difficulty: diff,
          required: need,
          available: picked.length,
          shortage: need - picked.length,
        });
      }
    }

    const stillNeeded = alloc.count - takenForTopic;
    if (stillNeeded > 0) {
      const matches = remaining.filter(topicMatch);
      shuffleInPlace(matches, random);
      const picked = matches.slice(0, stillNeeded);
      for (const q of picked) {
        selectedIds.push(q.id);
        removeId(q.id);
        takenForTopic += 1;
      }
      if (picked.length < stillNeeded) {
        // Replace fine-grained difficulty shortages with a topic-level shortage
        for (let i = shortages.length - 1; i >= 0; i--) {
          if (shortages[i]!.topic === alloc.topic) shortages.splice(i, 1);
        }
        shortages.push({
          topic: alloc.topic,
          subtopic: alloc.subtopic,
          difficulty: "any",
          required: alloc.count,
          available: takenForTopic,
          shortage: alloc.count - takenForTopic,
        });
      } else {
        // Filled via fallback — clear difficulty shortages for this topic
        for (let i = shortages.length - 1; i >= 0; i--) {
          if (shortages[i]!.topic === alloc.topic) shortages.splice(i, 1);
        }
      }
    }
  }

  return { selectedIds, shortages: shortages.filter((s) => s.shortage > 0) };
}
