import { BrandMark } from "@/components/BrandMark";
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
      { property: "og:image", content: "/brand/assessa-icon-512.png" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:image", content: "/brand/assessa-icon-512.png" },
      { name: "theme-color", content: "#2A2420" },
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,_oklch(0.9_0.05_80/_0.55),_transparent_50%),linear-gradient(165deg,_oklch(0.99_0.008_92)_0%,_oklch(0.965_0.02_85)_55%,_oklch(0.94_0.03_75)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-[url('/brand/assessa-icon-512.png')] bg-[length:min(72vw,34rem)] bg-[position:right_-4rem_top_4rem] bg-no-repeat opacity-[0.08] mix-blend-multiply md:bg-[position:right_6%_top_10%] md:opacity-[0.12]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-8%] h-[26rem] w-[26rem] rounded-full bg-accent/25 blur-3xl animate-brand-glow"
      />

      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <BrandMark />
        <Link
          to="/auth"
          search={{ mode: "signin" }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in
        </Link>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-4 pb-20 pt-8 md:pb-28">
        <div className="max-w-2xl animate-brand-rise">
          <BrandMark
            showWordmark={false}
            markClassName="mb-6 h-14 w-14 rounded-2xl md:h-16 md:w-16"
          />
          <h1 className="font-display text-5xl leading-[0.98] tracking-tight text-foreground md:text-7xl">
            Assessa
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
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
              className="rounded-md border border-input bg-card/70 px-5 py-2.5 text-sm font-medium backdrop-blur transition-colors hover:bg-secondary"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-border bg-secondary/40 py-16">
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

      <footer className="relative z-10 mx-auto flex max-w-6xl flex-col gap-2 px-4 py-10 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <BrandMark showWordmark={false} markClassName="h-6 w-6 rounded-md" />
          <span>Built for teams, training organisations, institutions and recruiters.</span>
        </div>
        <p>© {new Date().getFullYear()} Assessa</p>
      </footer>
    </div>
  );
}
