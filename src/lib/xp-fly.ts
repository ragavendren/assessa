export type XpGainEvent = {
  amount: number;
  origin: DOMRect | null;
};

type Listener = (event: XpGainEvent) => void;

const listeners = new Set<Listener>();

export function announceXpGain(amount: number, originEl?: HTMLElement | null) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const origin = originEl?.getBoundingClientRect() ?? null;
  for (const listener of listeners) listener({ amount: Math.round(amount), origin });
}

export function onXpGain(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const FLOWN = "assessa:xp-flown:";

export function flyXpOnce(key: string, amount: number, originEl?: HTMLElement | null) {
  if (typeof sessionStorage === "undefined") {
    announceXpGain(amount, originEl);
    return;
  }
  try {
    if (sessionStorage.getItem(FLOWN + key)) return;
    sessionStorage.setItem(FLOWN + key, "1");
  } catch {
    /* private mode */
  }
  announceXpGain(amount, originEl);
}
