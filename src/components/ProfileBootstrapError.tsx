import { BrandMark } from "@/components/BrandMark";
import { Link } from "@tanstack/react-router";

export function ProfileBootstrapError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <BrandMark className="h-10" showWordmark={false} markClassName="h-10 w-10" />
      <h1 className="font-display text-2xl">Could not load your profile</h1>
      <p className="text-sm text-muted-foreground">
        {message?.trim() ||
          "Sign-in worked, but Assessa could not bootstrap your profile. Try again or sign out and back in."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        ) : null}
        <Link to="/auth" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
