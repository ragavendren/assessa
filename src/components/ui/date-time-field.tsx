import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string | undefined;
  hint?: string;
  className?: string;
};

function splitLocal(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [date = "", timePart = ""] = value.split("T");
  const time = timePart.slice(0, 5);
  return { date, time };
}

function joinLocal(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

/** Date + time controls that store `YYYY-MM-DDTHH:mm` (datetime-local compatible). */
export function DateTimeField({ label, value, onChange, min, hint, className }: Props) {
  const { date, time } = splitLocal(value);
  const minDate = min?.split("T")[0];
  const minTime = min && minDate === date ? min.split("T")[1]?.slice(0, 5) : undefined;

  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <div className="grid grid-cols-[1.35fr_1fr] gap-2">
        <label className="block text-sm">
          <span className="sr-only">Date</span>
          <input
            type="date"
            className="field"
            value={date}
            min={minDate}
            onChange={(event) => onChange(joinLocal(event.target.value, time))}
          />
        </label>
        <label className="block text-sm">
          <span className="sr-only">Time</span>
          <input
            type="time"
            className="field"
            value={time}
            min={minTime}
            disabled={!date}
            onChange={(event) => onChange(joinLocal(date, event.target.value))}
          />
        </label>
      </div>
      {value ? (
        <button
          type="button"
          className="mt-2 text-xs text-muted-foreground hover:text-foreground hover:underline"
          onClick={() => onChange("")}
        >
          Clear
        </button>
      ) : hint ? (
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export type ScheduleWindowStatus = {
  tone: "draft" | "scheduled" | "open" | "closed";
  label: string;
  hint: string;
};

/** Derive participant-facing availability from publish flag + schedule window. */
export function scheduleWindowStatus(
  active: boolean,
  startsAt: string,
  endsAt: string,
  now = new Date(),
): ScheduleWindowStatus {
  if (!active) {
    return {
      tone: "draft",
      label: "Draft",
      hint: "Not visible until you publish. Schedule still applies after publish.",
    };
  }
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  if (start && !Number.isNaN(start.getTime()) && start > now) {
    return {
      tone: "scheduled",
      label: "Scheduled",
      hint: `Opens ${start.toLocaleString()} — participants cannot start before then.`,
    };
  }
  if (end && !Number.isNaN(end.getTime()) && end < now) {
    return {
      tone: "closed",
      label: "Closed",
      hint: `Ended ${end.toLocaleString()} — no longer available.`,
    };
  }
  return {
    tone: "open",
    label: "Open now",
    hint: end
      ? `Available until ${end.toLocaleString()}.`
      : startsAt
        ? "Available now (no end date)."
        : "Available while published (no schedule window).",
  };
}
