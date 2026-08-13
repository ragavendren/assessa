import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function parseEmails(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\s\n]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

function serialize(emails: string[]) {
  return emails.join(", ");
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/** Invite list: Space / Enter / comma commits an email chip. */
export function EmailChipInput({
  value,
  onChange,
  placeholder = "type email and press Enter or Space",
  disabled,
  className,
  id,
}: Props) {
  const emails = useMemo(() => parseEmails(value), [value]);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  function commit(raw: string) {
    const next = raw
      .trim()
      .replace(/[,;]+$/g, "")
      .toLowerCase();
    if (!next) {
      setDraft("");
      setInvalid(false);
      return;
    }
    if (!EMAIL_RE.test(next)) {
      setInvalid(true);
      return;
    }
    if (!emails.includes(next)) {
      onChange(serialize([...emails, next]));
    }
    setDraft("");
    setInvalid(false);
  }

  function remove(email: string) {
    onChange(serialize(emails.filter((item) => item !== email)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === " " || event.key === ",") {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && !draft && emails.length > 0) {
      remove(emails[emails.length - 1]!);
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 text-sm",
        "focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_22%,transparent)]",
        invalid && "border-destructive",
        disabled && "opacity-60",
        className,
      )}
      onClick={(event) => {
        if (disabled) return;
        const input = (event.currentTarget as HTMLElement).querySelector("input");
        input?.focus();
      }}
    >
      {emails.map((email) => (
        <span
          key={email}
          className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-medium text-foreground"
        >
          <span className="truncate">{email}</span>
          {!disabled ? (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-primary/15 hover:text-foreground"
              aria-label={`Remove ${email}`}
              onClick={(event) => {
                event.stopPropagation();
                remove(email);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}
      <input
        id={id}
        type="email"
        disabled={disabled}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (invalid) setInvalid(false);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text");
          if (!/[,;\s\n]/.test(text)) return;
          event.preventDefault();
          const pasted = parseEmails(`${serialize(emails)} ${text} ${draft}`);
          onChange(serialize(pasted));
          setDraft("");
          setInvalid(false);
        }}
        placeholder={emails.length === 0 ? placeholder : "Add another…"}
        className="min-w-[10rem] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
        autoComplete="off"
      />
    </div>
  );
}
