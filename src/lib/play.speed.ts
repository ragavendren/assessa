export type SpeedZone = "ok" | "half" | "quarter" | "ten" | "five" | "red";

export const SPEED_ALERTS: Array<{
  at: number;
  zone: Exclude<SpeedZone, "ok">;
  title: string;
  body: string;
}> = [
  { at: 0.5, zone: "half", title: "50% left", body: "Halfway. Keep your pace." },
  {
    at: 0.25,
    zone: "quarter",
    title: "25% left",
    body: "Three quarters gone — lock answers faster.",
  },
  { at: 0.1, zone: "ten", title: "10% left", body: "Time is tight. Trust your first read." },
  { at: 0.05, zone: "five", title: "5% left", body: "Red zone. Finish what you can." },
];

export function speedZoneOf(remaining: number, durationSeconds: number): SpeedZone {
  if (durationSeconds <= 0) return "ok";
  const pct = remaining / durationSeconds;
  if (pct <= 0.05) return "red";
  if (pct <= 0.1) return "ten";
  if (pct <= 0.25) return "quarter";
  if (pct <= 0.5) return "half";
  return "ok";
}

export function crossedSpeedAlert(prevPct: number, nextPct: number) {
  return SPEED_ALERTS.find((alert) => prevPct > alert.at && nextPct <= alert.at) ?? null;
}
