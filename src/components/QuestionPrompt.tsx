import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";
import { useEffect, useState, type ReactNode, type Ref } from "react";

type QuestionPromptProps = {
  prompt: string;
  imageUrl?: string | null | undefined;
  titleId?: string;
  titleRef?: Ref<HTMLHeadingElement>;
  level?: "h2" | "h3" | "p";
  className?: string;
  showUrl?: boolean;
  meta?: ReactNode;
};

/** Prompt first, then the reference image underneath when `image_url` is set. */
export function QuestionPrompt({
  prompt,
  imageUrl,
  titleId,
  titleRef,
  level = "h2",
  className,
  showUrl = false,
  meta,
}: QuestionPromptProps) {
  const titleClass =
    level === "p"
      ? "text-base font-medium leading-snug text-foreground"
      : level === "h3"
        ? "text-base font-medium leading-snug text-foreground sm:text-lg"
        : "scroll-mt-36 text-xl font-semibold leading-snug tracking-tight text-foreground outline-none sm:text-2xl sm:leading-snug";

  const heading =
    level === "p" ? (
      <p className={titleClass}>{prompt}</p>
    ) : level === "h3" ? (
      <h3 id={titleId} className={titleClass}>
        {prompt}
      </h3>
    ) : (
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className={titleClass}>
        {prompt}
      </h2>
    );

  return (
    <div className={cn("space-y-3", className)}>
      {meta}
      {heading}
      <PromptImage src={imageUrl} showUrl={showUrl} />
    </div>
  );
}

export function ImagePreviewFallback({
  message,
  href,
  compact = false,
  className,
}: {
  message: string;
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={message}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/50 text-center text-muted-foreground",
        compact ? "min-h-28 px-3 py-5" : "min-h-40 px-4 py-8",
        className,
      )}
    >
      <ImageOff
        className={cn("text-muted-foreground/80", compact ? "h-7 w-7" : "h-9 w-9")}
        aria-hidden
      />
      <p className="text-xs font-medium text-foreground">{message}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-accent underline"
        >
          Open image_url
        </a>
      ) : null}
    </div>
  );
}

/** Renders `src` or a fallback tile — never a broken `<img>`. */
export function SafeImage({
  src,
  alt = "",
  className,
  compact = false,
  emptyMessage = "No image preview available",
  errorMessage = "Unable to render image",
  fallbackClassName,
}: {
  src?: string | null | undefined;
  alt?: string;
  className?: string;
  compact?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  fallbackClassName?: string;
}) {
  const href = src?.trim() ?? "";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [href]);

  if (!href) {
    return (
      <ImagePreviewFallback
        message={emptyMessage}
        compact={compact}
        className={fallbackClassName}
      />
    );
  }

  if (failed) {
    return (
      <ImagePreviewFallback
        message={errorMessage}
        href={href}
        compact={compact}
        className={fallbackClassName}
      />
    );
  }

  return (
    <img
      src={href}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function PromptImage({
  src,
  showUrl = false,
  alt = "Question prompt reference",
  className,
  compact = false,
}: {
  src?: string | null | undefined;
  showUrl?: boolean;
  alt?: string;
  className?: string;
  compact?: boolean;
}) {
  const href = src?.trim() ?? "";

  if (!href) return null;

  return (
    <figure className={cn("mt-1 space-y-1.5", className)}>
      <SafeImage
        src={href}
        alt={alt}
        compact={compact}
        className={cn(
          "mx-auto block h-auto w-auto max-w-full border border-border bg-card object-contain",
          compact ? "max-h-40 rounded-md" : "max-h-[min(28rem,70vh)] rounded-lg",
        )}
      />
      {showUrl ? (
        <figcaption className="break-all text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">image_url </span>
          {href}
        </figcaption>
      ) : null}
    </figure>
  );
}
