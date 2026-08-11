import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Assessa — Online Assessment Platform" },
      {
        name: "description",
        content:
          "Create and share online assessments with server-side scoring, availability windows, and participant progress analytics.",
      },
      { property: "og:title", content: "Assessa — Online Assessment Platform" },
      {
        property: "og:description",
        content:
          "Admin-managed assessments with shareable participant links, secure scoring, and cohort insights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    step: "Create",
    title: "Question banks & CSV import",
    body: "Build assessments manually or upload a CSV template with single and multi-select answers.",
  },
  {
    step: "Share",
    title: "No-login participant links",
    body: "Share a public assessment link. Participants enter their details and start immediately.",
  },
  {
    step: "Control",
    title: "Availability windows",
    body: "Publish assessments and open or close them for specific dates under admin control.",
  },
  {
    step: "Evaluate",
    title: "Authoritative server scoring",
    body: "Scores, answer keys, timers and attempt limits are calculated and enforced on the server only.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-display text-sm text-primary-foreground">
            As
          </span>
          <span className="font-display text-lg">Assessa</span>
        </div>
        <Link
          to="/auth"
          search={{ mode: "signin" }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 md:pt-20">
        <div className="max-w-3xl">
          <p className="text-hairline text-muted-foreground">
            Online assessment & examination platform
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] md:text-6xl">
            Assessa
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Create and publish assessments, or open a shared link to take an exam — participants can
            also start without an account when a public share link is used.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Create an account
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="rounded-md border border-input bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-2xl">Create → Share → Control → Evaluate</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar) => (
              <article key={pillar.step} className="surface-paper p-5">
                <p className="text-hairline text-accent">{pillar.step}</p>
                <h3 className="mt-2 text-base font-semibold">{pillar.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{pillar.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-10 text-sm text-muted-foreground">
        <p>Built for teams, training organisations, institutions and recruiters.</p>
        <p>© {new Date().getFullYear()} Assessa</p>
      </footer>
    </div>
  );
}
