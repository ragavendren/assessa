import { PageLoader } from "@/components/platform";
import { getEscapeRooms } from "@/lib/play.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/play/escape")({
  head: () => ({ meta: [{ title: "Escape rooms — Assessa" }] }),
  component: EscapeListPage,
});

function EscapeListPage() {
  const fetchRooms = useServerFn(getEscapeRooms);
  const { data, isPending } = useQuery({ queryKey: ["escape-rooms"], queryFn: () => fetchRooms() });
  if (isPending || !data) return <PageLoader />;
  return (
    <div className="space-y-4">
      <Link to="/play" className="text-xs text-accent underline">
        Play
      </Link>
      <h1 className="font-display text-2xl">Escape rooms</h1>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scenarios yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((room) => (
            <li key={room.id}>
              <Link
                to="/play/escape/$scenarioId"
                params={{ scenarioId: room.id }}
                className="block rounded-md border border-border p-4 hover:bg-secondary"
              >
                <p className="font-medium">{room.name}</p>
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{room.intro}</p>
                <p className="mt-2 text-xs text-muted-foreground">{room.scenes.length} scenes</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
