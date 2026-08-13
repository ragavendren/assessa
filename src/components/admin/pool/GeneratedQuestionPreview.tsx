type Props = {
  count: number;
  distribution: Record<string, number>;
};

export function GeneratedQuestionPreview({ count, distribution }: Props) {
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-4">
      <p className="text-sm font-medium">
        Generated {count} question{count === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Clones are loaded into this assessment. Preview and publish as usual.
      </p>
      {entries.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          {entries.map(([topic, n]) => (
            <li
              key={topic}
              className="rounded-md border border-border bg-card px-2 py-1 tabular-nums"
            >
              {topic}: {n}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
