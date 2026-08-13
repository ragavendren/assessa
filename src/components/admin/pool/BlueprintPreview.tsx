import type { TopicAllocation } from "@/lib/question-selection.math";

type Props = {
  allocations: TopicAllocation[];
  questionCount: number;
};

export function BlueprintPreview({ allocations, questionCount }: Props) {
  if (allocations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Select a blueprint to preview topic counts.</p>
    );
  }
  const total = allocations.reduce((s, a) => s + a.count, 0);
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Topic</th>
            <th className="px-3 py-2 font-medium">Weight</th>
            <th className="px-3 py-2 font-medium">Count</th>
            <th className="px-3 py-2 font-medium">E / M / H</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {allocations.map((row) => (
            <tr key={`${row.topic}-${row.subtopic ?? ""}`}>
              <td className="px-3 py-2">
                {row.topic}
                {row.subtopic ? (
                  <span className="text-muted-foreground"> · {row.subtopic}</span>
                ) : null}
              </td>
              <td className="px-3 py-2 tabular-nums">{row.weightage}%</td>
              <td className="px-3 py-2 tabular-nums font-medium">{row.count}</td>
              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                {row.difficulties.easy} / {row.difficulties.medium} / {row.difficulties.hard}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-secondary/40 text-xs">
            <td className="px-3 py-2 font-medium" colSpan={2}>
              Total
            </td>
            <td className="px-3 py-2 tabular-nums font-medium">
              {total}
              {total !== questionCount ? (
                <span className="ml-1 text-destructive">(expected {questionCount})</span>
              ) : null}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
