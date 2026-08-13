/** Thin presentational helper used by QuestionGenerationConfiguration. */
type Props = {
  pools: Array<{ id: string; name: string }>;
  value: string | null;
  disabled?: boolean;
  onChange: (poolId: string | null) => void;
};

export function QuestionPoolSelector({ pools, value, disabled, onChange }: Props) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">Question pool</span>
      <select
        className="field w-full"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Select pool…</option>
        {pools.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
