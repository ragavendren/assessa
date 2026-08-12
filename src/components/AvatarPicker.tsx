import { AVATARS, getAvatar } from "@/lib/avatars";
import { initials } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { Camera, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AvatarPickerProps = {
  value: string | null;
  name?: string;
  onChange: (avatarId: string | null) => void;
  /** Size of the clickable avatar trigger */
  sizeClassName?: string;
};

export function AvatarPicker({
  value,
  name,
  onChange,
  sizeClassName = "h-20 w-20",
}: AvatarPickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = getAvatar(value);

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
  }

  const dialog =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
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
              className="animate-dash-pop relative z-[201] w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Choose avatar</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ul className="grid grid-cols-4 gap-2" role="listbox" aria-label="Available avatars">
                {AVATARS.map((avatar) => {
                  const isActive = value === avatar.id;
                  return (
                    <li key={avatar.id} role="option" aria-selected={isActive}>
                      <button
                        type="button"
                        onClick={() => choose(avatar.id)}
                        aria-label={`Select avatar ${avatar.id}`}
                        className={cn(
                          "flex w-full items-center justify-center rounded-xl border p-1.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                          isActive
                            ? "border-accent bg-accent/10 ring-2 ring-accent/35"
                            : "border-border hover:-translate-y-0.5 hover:border-accent/40 hover:bg-secondary/40",
                        )}
                      >
                        <span className="h-12 w-12 overflow-hidden rounded-full bg-secondary">
                          <img
                            src={avatar.src}
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={() => choose(null)}
                className="mt-3 w-full rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Use initials instead
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
        {selected ? (
          <img
            key={selected.id}
            src={selected.src}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-accent text-xl font-semibold text-accent-foreground">
            {initials(name ?? "")}
          </span>
        )}
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
