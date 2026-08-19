import { PromptImage, SafeImage } from "@/components/QuestionPrompt";
import { IMAGE_FILE_ACCEPT, imageMapFromUrl, uploadQuestionImages } from "@/lib/question-images";
import { cn } from "@/lib/utils";
import { Check, Copy, ImagePlus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type PromptImageFieldProps = {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  compact?: boolean;
};

export function PromptImageField({
  value,
  onChange,
  folder,
  compact = false,
}: PromptImageFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const src = value.trim();

  async function onPick(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true);
    const result = await uploadQuestionImages([files[0]], folder);
    setBusy(false);
    const url = Object.values(result.map)[0];
    if (url) {
      onChange(url);
      toast.success("Image uploaded");
      return;
    }
    toast.error(result.errors[0] ?? "Could not upload image");
  }

  async function copyUrl() {
    if (!src) return;
    try {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy image URL");
    }
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <p className="text-xs text-muted-foreground">Prompt image (optional)</p>
      {src ? (
        <div className="space-y-1.5">
          <PromptImage src={src} showUrl alt="Question prompt" />
          <button
            type="button"
            onClick={() => void copyUrl()}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied image_url" : "Copy image_url"}
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
        >
          {src ? <Upload className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {busy ? "Uploading…" : src ? "Replace file" : "Upload file"}
        </button>
        {src ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void onPick(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </div>
      <input
        className="field h-8 w-full text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste an image URL (https://… .png .jpg .webp .avif)"
        maxLength={4096}
      />
    </div>
  );
}

/** Paste a public image URL into a CSV filename map. */
export function ImageUrlPaste({
  onApply,
  compact = false,
}: {
  onApply: (map: Record<string, string>) => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function apply() {
    const map = imageMapFromUrl(draft);
    if (!map) {
      toast.error("Paste a full http(s) image URL");
      return;
    }
    onApply(map);
    setDraft("");
    toast.success("Image URL added");
  }

  return (
    <div className={compact ? "flex min-w-[14rem] flex-1 gap-1" : "flex gap-1"}>
      <input
        className="field h-8 min-w-0 flex-1 text-xs"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        }}
        placeholder="Paste image URL"
        maxLength={4096}
      />
      <button
        type="button"
        onClick={apply}
        className="shrink-0 rounded-md border border-input px-2 py-1 text-xs hover:bg-secondary"
      >
        Add URL
      </button>
    </div>
  );
}

export function ImageMapPreview({
  map,
  className,
}: {
  map: Record<string, string>;
  className?: string;
}) {
  const rows: Array<{ label: string; url: string }> = [];
  const seen = new Set<string>();
  for (const [label, url] of Object.entries(map)) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const file = label.includes("/") ? (label.split("/").pop() ?? label) : label;
    rows.push({ label: file, url });
  }
  if (rows.length === 0) return null;

  return (
    <ul className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {rows.map((row) => (
        <li
          key={row.url}
          className="overflow-hidden rounded-md border border-border bg-card text-xs"
        >
          <SafeImage
            src={row.url}
            alt=""
            compact
            className="mx-auto block h-auto max-h-40 w-auto max-w-full object-contain bg-secondary/40"
          />
          <div className="space-y-0.5 px-2 py-1.5">
            <p className="truncate font-medium">{row.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.url}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
