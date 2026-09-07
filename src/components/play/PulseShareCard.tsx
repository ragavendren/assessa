import { pulseCodeUrl, pulseJoinUrl } from "@/lib/play.pulse";
import { cn } from "@/lib/utils";
import { Check, Copy, Share2 } from "lucide-react";
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

export function PulseShareCard({
  pulseId,
  pulseName,
  joinCode,
  compact,
}: {
  pulseId: string;
  pulseName: string;
  joinCode: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const url = origin ? pulseJoinUrl(pulseId, origin) : pulseJoinUrl(pulseId, "");
  const codeUrl = origin ? pulseCodeUrl(joinCode, origin) : pulseCodeUrl(joinCode, "");
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

  async function copy(text: string, kind: "link" | "code") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(kind === "code" ? "Join code copied" : "Join link copied");
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function shareLink() {
    if (typeof navigator.share !== "function") {
      await copy(url, "link");
      return;
    }
    try {
      await navigator.share({
        title: pulseName,
        text: `Join ${pulseName} on Assessa Pulse (code ${joinCode})`,
        url: codeUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy(url, "link");
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
              aria-label={`QR code to join ${pulseName}`}
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
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold">{pulseName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Share the link or 6-character code. Players must be signed in.
            </p>
          </div>
          <p className="font-mono text-2xl font-semibold tracking-[0.2em]">{joinCode}</p>
          <p className="break-all text-xs text-muted-foreground">{url}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
              onClick={() => void copy(joinCode, "code")}
            >
              {copied === "code" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Code
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
              onClick={() => void copy(url, "link")}
            >
              {copied === "link" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Link
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
              onClick={() => void shareLink()}
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
