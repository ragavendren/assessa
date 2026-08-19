import { cn } from "@/lib/utils";
import { Check, Copy, QrCode, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { renderSVG } from "uqr";

export function arenaJoinUrl(arenaId: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/play/arena/${arenaId}`;
}

export function ArenaShareCard({
  arenaId,
  arenaName,
  compact,
}: {
  arenaId: string;
  arenaName: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const url = origin ? arenaJoinUrl(arenaId, origin) : "";
  const svg = useMemo(
    () =>
      url
        ? renderSVG(url, {
            border: 2,
            ecc: "M",
            pixelSize: compact ? 4 : 6,
            whiteColor: "#ffffff",
            blackColor: "#111827",
          })
        : "",
    [url, compact],
  );

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

  return (
    <div className={cn("rounded-2xl border border-border bg-card", compact ? "p-3" : "p-4 sm:p-5")}>
      <div
        className={cn(
          "flex gap-4",
          compact ? "items-center" : "flex-col sm:flex-row sm:items-start",
        )}
      >
        {svg ? (
          <div
            className="mx-auto shrink-0 overflow-hidden rounded-xl bg-white p-1 shadow-sm"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="mx-auto h-28 w-28 shrink-0 animate-pulse rounded-xl bg-secondary" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <QrCode className="h-4 w-4" />
            Invite participants
          </p>
          <p className="text-xs text-muted-foreground">
            Scan the QR or share the link. Anyone signed in can join a team from Play.
          </p>
          <p className="truncate rounded-md bg-secondary px-2 py-1.5 font-mono text-[11px]">
            {url}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => void shareLink()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
