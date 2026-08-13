import { Avatar, AVATAR_LIST, type AvatarCategory } from "@/components/avatars";
import { getAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";
import { Camera, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AvatarPickerProps = {
  value: string | null;
  name?: string;
  onChange: (avatarId: string | null) => void;
  sizeClassName?: string;
};

/** Compact picker tabs — legacy man/woman/boy/girl roll into People. */
const PICKER_TABS: Array<{ id: string; label: string; categories?: AvatarCategory[] }> = [
  { id: "all", label: "All" },
  { id: "professional", label: "Pro", categories: ["professional"] },
  { id: "casual", label: "Casual", categories: ["casual"] },
  { id: "technical", label: "Tech", categories: ["technical"] },
  { id: "creative", label: "Creative", categories: ["creative"] },
  { id: "student", label: "Student", categories: ["student"] },
  { id: "people", label: "People", categories: ["man", "woman", "boy", "girl", "generic"] },
  { id: "robot", label: "Robots", categories: ["robot"] },
  { id: "mascot", label: "Mascots", categories: ["mascot"] },
];

/**
 * Profile avatar picker — categories, search, preview, reset to initials.
 */
export function AvatarPicker({
  value,
  name,
  onChange,
  sizeClassName = "h-20 w-20",
}: AvatarPickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = getAvatar(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = PICKER_TABS.find((t) => t.id === tab);
    const allowed = active?.categories;

    return AVATAR_LIST.filter((avatar) => {
      if (avatar.kind === "initials") return false;
      if (allowed && !allowed.includes(avatar.category)) return false;
      if (!q) return true;
      return (
        avatar.id.toLowerCase().includes(q) ||
        avatar.label.toLowerCase().includes(q) ||
        avatar.category.toLowerCase().includes(q)
      );
    });
  }, [tab, query]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function choose(avatarId: string | null) {
    onChange(avatarId);
    setOpen(false);
    setQuery("");
    setTab("all");
  }

  const dialog =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden p-3 sm:p-4">
            <button
              type="button"
              aria-label="Close avatar list"
              className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label="Choose an avatar"
              className="animate-dash-pop relative z-[201] flex h-[min(88vh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xl"
            >
              <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Choose avatar</p>
                  <p className="text-xs text-muted-foreground">{filtered.length} available</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="relative mb-3 shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search avatars…"
                  className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none ring-accent focus:ring-2"
                  aria-label="Search avatars"
                />
              </div>

              <div
                className="mb-3 flex shrink-0 gap-1.5 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Avatar categories"
              >
                {PICKER_TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      tab === item.id
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {selected ? (
                <div className="mb-3 flex shrink-0 items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2">
                  <Avatar type={selected.id} size={40} {...(name ? { name } : {})} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{selected.label}</p>
                    <p className="truncate text-xs capitalize text-muted-foreground">{selected.category}</p>
                  </div>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
                {filtered.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No avatars match.</p>
                ) : (
                  <ul
                    className="grid grid-cols-4 gap-2 sm:grid-cols-5"
                    role="listbox"
                    aria-label="Available avatars"
                  >
                    {filtered.map((avatar) => {
                      const isActive = value === avatar.id;
                      return (
                        <li key={avatar.id} role="option" aria-selected={isActive}>
                          <button
                            type="button"
                            onClick={() => choose(avatar.id)}
                            aria-label={`Select avatar ${avatar.label}`}
                            title={avatar.label}
                            className={cn(
                              "flex w-full items-center justify-center rounded-xl border p-1.5 transition-colors",
                              isActive
                                ? "border-accent bg-accent/10 ring-2 ring-accent/35"
                                : "border-border hover:border-accent/40 hover:bg-secondary/40",
                            )}
                          >
                            <Avatar type={avatar.id} size={40} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <button
                type="button"
                onClick={() => choose(null)}
                className="mt-3 w-full shrink-0 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Reset to initials
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative z-[60] inline-flex flex-col items-start gap-2">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label="Change avatar"
        className={cn(
          "group relative overflow-hidden rounded-full bg-secondary shadow-sm ring-4 ring-background transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          sizeClassName,
        )}
      >
        <Avatar type={value} size={80} {...(name ? { name } : {})} />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-foreground/55 py-1 text-[10px] font-medium text-background opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="h-3 w-3" />
          Change
        </span>
      </button>
      <p className="text-xs text-muted-foreground">Click avatar to change</p>
      {dialog}
    </div>
  );
}
