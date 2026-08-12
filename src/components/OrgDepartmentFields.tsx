import { listOrgCatalog } from "@/lib/platform.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

type Props = {
  organization: string;
  department: string;
  onOrganizationChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Cascading organisation → team/group selects from the admin catalog. */
export function OrgDepartmentFields({
  organization,
  department,
  onOrganizationChange,
  onDepartmentChange,
  required = true,
  disabled = false,
  className,
}: Props) {
  const fetchCatalog = useServerFn(listOrgCatalog);
  const { data, isPending } = useQuery({
    queryKey: ["org-catalog"],
    queryFn: () => fetchCatalog(),
    staleTime: 5 * 60_000,
  });

  const orgs = data?.organizations ?? [];
  const teams = useMemo(() => {
    const selected = orgs.find((org) => org.name === organization);
    if (!selected) return [];
    return (data?.departments ?? []).filter((dept) => dept.organization_id === selected.id);
  }, [data?.departments, organization, orgs]);

  const emptyCatalog = !isPending && orgs.length === 0;

  return (
    <div className={className ?? "grid gap-4 sm:grid-cols-2"}>
      <label className="block text-sm">
        <span className="text-xs text-muted-foreground">Organisation{required ? " *" : ""}</span>
        <select
          className="field mt-1.5"
          value={organization}
          disabled={disabled || isPending || emptyCatalog}
          required={required}
          onChange={(event) => {
            onOrganizationChange(event.target.value);
            onDepartmentChange("");
          }}
        >
          <option value="">{emptyCatalog ? "No organisations yet" : "Select organisation"}</option>
          {orgs.map((org) => (
            <option key={org.id} value={org.name}>
              {org.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-xs text-muted-foreground">Team / Group{required ? " *" : ""}</span>
        <select
          className="field mt-1.5"
          value={department}
          disabled={disabled || isPending || !organization || teams.length === 0}
          required={required}
          onChange={(event) => onDepartmentChange(event.target.value)}
        >
          <option value="">
            {!organization
              ? "Select organisation first"
              : teams.length === 0
                ? "No teams/groups for this organisation"
                : "Select team / group"}
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.name}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      {emptyCatalog ? (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          An administrator must add organisations and teams/groups before you can continue.
        </p>
      ) : null}
    </div>
  );
}
