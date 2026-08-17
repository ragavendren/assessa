import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export function LeaderboardTabs({
  active,
  playEnabled = true,
  tone = "default",
}: {
  active: "assessments" | "play";
  playEnabled?: boolean;
  tone?: "default" | "banner";
}) {
  if (!playEnabled) return null;

  const banner = tone === "banner";

  return (
    <div
      className={cn(
        "inline-flex gap-1 rounded-lg p-1",
        banner
          ? "border border-primary-foreground/20 bg-primary-foreground/10"
          : "border border-border bg-secondary/50",
      )}
    >
      <Link
        to="/leaderboard"
        className={cn(
          "rounded-md px-3 py-1.5 text-sm transition-colors",
          active === "assessments"
            ? banner
              ? "bg-primary-foreground font-medium text-primary shadow-sm"
              : "bg-background font-medium text-foreground shadow-sm"
            : banner
              ? "text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
        )}
      >
        Assessments
      </Link>
      <Link
        to="/play/leaderboard"
        className={cn(
          "rounded-md px-3 py-1.5 text-sm transition-colors",
          active === "play"
            ? banner
              ? "bg-primary-foreground font-medium text-primary shadow-sm"
              : "bg-background font-medium text-foreground shadow-sm"
            : banner
              ? "text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
        )}
      >
        Play
      </Link>
    </div>
  );
}
