import { arenaJoinUrl } from "@/components/play/ArenaShareCard";
import { cn } from "@/lib/utils";
import { Check, Copy, QrCode, Share2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { renderSVG } from "uqr";

function sizedQrSvg(svg: string, size: number) {
  if (!svg) return "";
  if (/\swidth=/.test(svg) && /\sheight=/.test(svg)) return svg;
  return svg.replace(
    "<svg ",
    `<svg width="${size}" height="${size}" style="display:block;width:100%;height:100%" `,
  );
}

/** Compact QR / join-link popover — fixed (legacy) or inline next to play guide. */
export function ArenaShareFab({
  arenaId,
  arenaName,
  placement = "fixed",
  open: openProp,
  onOpenChange,
}: {
  arenaId: string;
  arenaName: string;
  placement?: "fixed" | "inline";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const controlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? Boolean(openProp) : internalOpen;
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  function setOpen(next: boolean) {
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const url = origin ? arenaJoinUrl(arenaId, origin) : "";
  const svg = useMemo(() => {
    if (!url.startsWith("http")) return "";
    try {
      return sizedQrSvg(
        renderSVG(url, {
          border: 2,
          ecc: "M",
          pixelSize: 5,
          whiteColor: "#ffffff",
          blackColor: "#111827",
        }),
        168,
      );
    } catch {
      return "";
    }
  }, [url]);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Join link copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy the link");
    }
  }

  async function shareLink() {
    if (typeof navigator.share !== "function") {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: arenaName,
        text: `Join ${arenaName} in Live Arena`,
        url,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyLink();
    }
  }

  const panel = (
    <div
      className={cn(
        "w-[17.5rem] rounded-2xl border border-violet-500/30 bg-card p-3 shadow-lg",
        placement === "inline" && "arena-guide-panel",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">Invite · QR & link</p>
        <button
          type="button"
          aria-label="Close invite"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {svg ? (
        <div
          className="mx-auto h-[184px] w-[184px] overflow-hidden rounded-xl border border-border/60 bg-white p-2"
          role="img"
          aria-label={`QR code to join ${arenaName}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="mx-auto flex h-[184px] w-[184px] items-center justify-center rounded-xl bg-secondary text-xs text-muted-foreground">
          Preparing QR…
        </div>
      )}
      <input
        readOnly
        value={url || "…"}
        className="field mt-2 h-8 w-full truncate font-mono text-[10px]"
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={() => void shareLink()}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
      </div>
    </div>
  );

  if (placement === "inline") {
    if (!open) return null;
    return panel;
  }

  return (
    <div className="fixed right-4 top-20 z-50 sm:right-6">
      {open ? (
        panel
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Show QR and join link"
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md",
            "hover:bg-secondary",
          )}
          aria-label="Show QR and join link"
        >
          <QrCode className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
