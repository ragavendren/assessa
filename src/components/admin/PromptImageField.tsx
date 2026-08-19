import { IMAGE_FILE_ACCEPT, imageMapFromUrl, uploadQuestionImages } from "@/lib/question-images";
import { ImagePlus, Trash2, Upload } from "lucide-react";
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

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <p className="text-xs text-muted-foreground">Prompt image (optional)</p>
      {value ? (
        <div className="overflow-hidden rounded-md border border-border bg-secondary/30">
          <img src={value} alt="Question prompt" className="max-h-40 w-full object-contain" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
        >
          {value ? <Upload className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {busy ? "Uploading…" : value ? "Replace file" : "Upload file"}
        </button>
        {value ? (
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
