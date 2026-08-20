import { cn } from "@/lib/utils";
import { Check, Copy, QrCode, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { renderSVG } from "uqr";

export function arenaJoinUrl(arenaId: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/play/arena/${arenaId}`;
}

function sizedQrSvg(svg: string, size: number) {
  if (!svg) return "";
  if (/\swidth=/.test(svg) && /\sheight=/.test(svg)) return svg;
  return svg.replace(
    "<svg ",
    `<svg width="${size}" height="${size}" style="display:block;width:100%;height:100%" `,
  );
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
  const url = origin ? arenaJoinUrl(arenaId, origin) : arenaJoinUrl(arenaId, "");
  const qrSize = compact ? 132 : 180;
  const svg = useMemo(() => {
    if (!url || !url.startsWith("http")) return "";
    try {
      return sizedQrSvg(
        renderSVG(url, {
          border: 2,
          ecc: "M",
          pixelSize: compact ? 4 : 5,
          whiteColor: "#ffffff",
          blackColor: "#111827",
        }),
        qrSize,
      );
    } catch {
      return "";
    }
  }, [url, compact, qrSize]);

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
          compact
            ? "flex-col items-stretch sm:flex-row sm:items-center"
            : "flex-col sm:flex-row sm:items-start",
        )}
      >
        <div className="mx-auto shrink-0 text-center sm:mx-0">
          {svg ? (
            <div
              className={cn(
                "overflow-hidden rounded-xl border border-border/60 bg-white p-2 shadow-sm",
                compact ? "h-[148px] w-[148px]" : "h-[196px] w-[196px]",
              )}
              role="img"
              aria-label={`QR code to join ${arenaName}`}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div
              className={cn(
                "flex items-center justify-center rounded-xl border border-dashed border-border bg-secondary/60 text-xs text-muted-foreground",
                compact ? "h-[148px] w-[148px]" : "h-[196px] w-[196px]",
              )}
            >
              Preparing QR…
            </div>
          )}
          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Scan to join
          </p>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <QrCode className="h-4 w-4" />
            Invite participants
          </p>
          <p className="text-xs text-muted-foreground">
            Share both the QR code and the join link. Anyone signed in can join a team from Play.
          </p>
          <label className="block text-[11px] font-medium text-muted-foreground">
            Join link
            <input
              readOnly
              value={url || "…"}
              className="field mt-1 h-9 w-full truncate font-mono text-[11px]"
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              disabled={!url}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => void shareLink()}
              disabled={!url}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
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
