/** Thin presentational helper used by QuestionGenerationConfiguration. */
type Props = {
  blueprints: Array<{ id: string; name: string; version: number; is_default?: boolean }>;
  value: string | null;
  disabled?: boolean;
  onChange: (blueprintId: string | null) => void;
};

export function BlueprintSelector({ blueprints, value, disabled, onChange }: Props) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">Blueprint</span>
      <select
        className="field w-full"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Select blueprint…</option>
        {blueprints.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} (v{b.version}){b.is_default ? " · default" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
