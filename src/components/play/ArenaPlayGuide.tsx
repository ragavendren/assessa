import { ArenaShareFab } from "@/components/play/ArenaShareFab";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  Layers,
  PanelTopOpen,
  QrCode,
  Timer,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export type ArenaPlayGuideConfig = {
  name: string;
  segmentCount: number;
  questionsPerSegment: number;
  totalQuestions: number;
  perQuestionSeconds: number;
  correctMarks: number;
  wrongMarks: number;
  timeBonusMax: number;
  earlyLockBonus: number;
};

type Panel = "guide" | "qr" | null;

/** Guide + QR icons for the title row (right side). Guide opens a full one-screen modal. */
export function ArenaPlayGuide({
  config,
  share,
  className,
  defaultOpen = false,
}: {
  config: ArenaPlayGuideConfig;
  share?: { arenaId: string; arenaName: string };
  className?: string;
  defaultOpen?: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(defaultOpen ? "guide" : null);
  const guideId = useId();

  function toggle(next: Panel) {
    setPanel((prev) => (prev === next ? null : next));
  }

  const firstCorrect = config.correctMarks + config.earlyLockBonus;
  const firstCorrectMax = firstCorrect + (config.timeBonusMax > 0 ? config.timeBonusMax : 0);

  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      <ToolbarIcon
        active={panel === "guide"}
        label="Game guide"
        onClick={() => toggle("guide")}
        tone="guide"
        ariaControls={guideId}
        ariaExpanded={panel === "guide"}
      >
        <BookOpen className="h-4 w-4" />
      </ToolbarIcon>

      {share ? (
        <ToolbarIcon
          active={panel === "qr"}
          label="Invite QR and join link"
          onClick={() => toggle("qr")}
          tone="qr"
          ariaExpanded={panel === "qr"}
        >
          <QrCode className="h-4 w-4" />
        </ToolbarIcon>
      ) : null}

      <Modal
        open={panel === "guide"}
        onClose={() => setPanel(null)}
        title="Game guide"
        description={config.name}
        size="2xl"
        className="arena-guide-panel max-h-[min(94vh,56rem)] overflow-hidden"
      >
        <div id={guideId} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <RuleCard
              delay={0}
              tone="teal"
              icon={<Layers className="h-5 w-5" />}
              label="Structure"
              value={`${config.segmentCount}×${config.questionsPerSegment}`}
              hint={`${config.totalQuestions} questions · ${config.segmentCount} segments`}
            />
            <RuleCard
              delay={1}
              tone="amber"
              icon={<Timer className="h-5 w-5 arena-guide-pulse" />}
              label="Timer"
              value={`${config.perQuestionSeconds}s`}
              hint="Per question — lock before time ends"
            />
            <RuleCard
              delay={2}
              tone="emerald"
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Correct"
              value={`+${config.correctMarks}`}
              hint="Base points when the answer is right"
            />
            <RuleCard
              delay={3}
              tone="rose"
              icon={<XCircle className="h-5 w-5" />}
              label="Wrong"
              value={`−${config.wrongMarks}`}
              hint="Deducted when the answer is wrong"
            />
            <RuleCard
              delay={4}
              tone="sky"
              icon={<Timer className="h-5 w-5" />}
              label="Time bonus"
              value={config.timeBonusMax > 0 ? `up to +${config.timeBonusMax}` : "Off"}
              hint={
                config.timeBonusMax > 0
                  ? "More time left → more bonus (correct only)"
                  : "Not enabled for this arena"
              }
            />
            <RuleCard
              delay={5}
              tone="amber"
              icon={<Zap className="h-5 w-5 arena-guide-zap" />}
              label="First lock"
              value={config.earlyLockBonus > 0 ? `+${config.earlyLockBonus}` : "Off"}
              hint={
                config.earlyLockBonus > 0
                  ? "Exclusive to the earliest correct lock"
                  : "Not enabled for this arena"
              }
            />
          </div>

          {(config.timeBonusMax > 0 || config.earlyLockBonus > 0) && (
            <p className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent px-4 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-100">
              First-correct winner can earn{" "}
              <span className="font-semibold tabular-nums">
                {firstCorrect}
                {config.timeBonusMax > 0 ? `–${firstCorrectMax}` : ""} pts
              </span>{" "}
              on a question ({config.correctMarks} correct
              {config.earlyLockBonus > 0 ? ` + ${config.earlyLockBonus} first` : ""}
              {config.timeBonusMax > 0 ? ` + up to ${config.timeBonusMax} time` : ""}). Bonuses are
              saved separately at reveal for the leaderboard Time / First columns.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                icon: <BookOpen className="h-4 w-4" />,
                title: "Answer & lock",
                body: "Pick as a team, then lock. You can change until the host locks or time runs out.",
              },
              {
                icon: <CheckCircle2 className="h-4 w-4" />,
                title: "Reveal scores",
                body: "Host reveals the key. Points and bonuses are written per question to the database.",
              },
              {
                icon: <Layers className="h-4 w-4" />,
                title: "Segments",
                body: "After a segment’s last question, publish that segment board before the next segment.",
              },
              {
                icon: <Trophy className="h-4 w-4" />,
                title: "Overall winner",
                body: "When every segment is published, the host announces the overall leaderboard.",
              },
            ].map((step, index) => (
              <div
                key={step.title}
                className="arena-guide-step rounded-2xl border border-border/70 bg-secondary/35 p-4"
                style={{ animationDelay: `${80 + index * 60}ms` }}
              >
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300">
                    {step.icon}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{index + 1}.</span>
                  {step.title}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>

          {share ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <PanelTopOpen className="h-4 w-4 shrink-0 text-teal-600" />
              Host tip: undock the scoreboard from the table for the audience screen. Use the QR
              icon next to this guide to invite players.
            </p>
          ) : null}
        </div>
      </Modal>

      {panel === "qr" && share ? (
        <div className="arena-guide-panel absolute right-0 top-[calc(100%+0.55rem)] z-40">
          <ArenaShareFab
            arenaId={share.arenaId}
            arenaName={share.arenaName}
            placement="inline"
            open
            onOpenChange={(open) => {
              if (!open) setPanel(null);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ToolbarIcon({
  children,
  active,
  label,
  onClick,
  tone,
  ariaControls,
  ariaExpanded,
}: {
  children: ReactNode;
  active: boolean;
  label: string;
  onClick: () => void;
  tone: "guide" | "qr";
  ariaControls?: string;
  ariaExpanded?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      onClick={onClick}
      className={cn(
        "arena-guide-fab inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition",
        tone === "guide"
          ? "border-teal-500/40 bg-gradient-to-br from-teal-500/25 to-sky-500/20 text-teal-800 dark:text-teal-200"
          : "border-violet-500/40 bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 text-violet-800 dark:text-violet-200",
        active && "ring-2 ring-offset-2 ring-offset-background",
        active && tone === "guide" && "ring-teal-500/50",
        active && tone === "qr" && "ring-violet-500/50",
        "hover:scale-[1.04]",
      )}
    >
      {children}
    </button>
  );
}

function RuleCard({
  icon,
  label,
  value,
  hint,
  tone,
  delay,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "teal" | "amber" | "emerald" | "rose" | "sky";
  delay: number;
}) {
  const tones = {
    teal: "border-teal-500/35 bg-teal-500/10 text-teal-900 dark:text-teal-100",
    amber: "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100",
    emerald: "border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
    rose: "border-rose-500/35 bg-rose-500/10 text-rose-950 dark:text-rose-100",
    sky: "border-sky-500/35 bg-sky-500/10 text-sky-950 dark:text-sky-100",
  } as const;
  return (
    <div
      className={cn("arena-guide-card rounded-2xl border px-3 py-3", tones[tone])}
      style={{ animationDelay: `${delay * 45}ms` }}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-2 text-[11px] leading-snug opacity-75">{hint}</p>
    </div>
  );
}
