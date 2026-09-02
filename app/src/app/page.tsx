import Link from "next/link";

const features = [
  {
    label: "METER",
    title: "Usage metering",
    body: "Every request through the gateway is counted per API key in fixed time windows — rate limits and daily or monthly quotas.",
  },
  {
    label: "ENFORCE",
    title: "Live enforcement",
    body: "Limits are checked atomically on each request. Over the limit means 429 — no overshoot under concurrent load, no after-the-fact billing surprises.",
  },
  {
    label: "OBSERVE",
    title: "Control plane",
    body: "Issue and revoke keys, tune limits, and watch traffic land in real time — from a single dashboard.",
  },
];

export default function Home() {
  return (
    <div className="flex-1">
      <header className="border-b border-border">
        <div className="container-page flex h-14 items-center justify-between">
          <span className="font-mono text-sm font-semibold tracking-tight">
            quota
          </span>
          <Link
            href="/login"
            className="focus-ring rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-foreground/30"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container-page pt-20 pb-16 sm:pt-28 sm:pb-24">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            An API usage control plane.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted text-pretty">
            Quota meters who consumes your APIs, enforces rate limits and
            quotas live at the gateway, and shows it all in one dashboard.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              href="/login"
              className="focus-ring rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Open dashboard
            </Link>
            <a
              href="#gateway"
              className="focus-ring text-sm text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              See the gateway
            </a>
          </div>
        </section>

        {/* Features */}
        <section className="container-page grid gap-10 border-t border-border py-16 sm:grid-cols-3 sm:gap-8">
          {features.map((f) => (
            <div key={f.label}>
              <div className="font-mono text-xs font-medium tracking-widest text-accent">
                {f.label}
              </div>
              <h2 className="mt-3 text-base font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {f.body}
              </p>
            </div>
          ))}
        </section>

        {/* Gateway demo */}
        <section id="gateway" className="border-t border-border py-16">
          <div className="container-page">
            <h2 className="text-lg font-semibold tracking-tight">
              One request, enforced
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Point any client at the gateway with a bearer key. The response
              tells you exactly which limits applied — or why the request was
              rejected.
            </p>
            <pre className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-relaxed sm:text-sm">
              <code>
                <span className="text-muted">$</span> curl -X POST
                https://your-app/api/gateway/anything \{"\n"}
                {"    "}-H{" "}
                <span className="text-accent">
                  &quot;Authorization: Bearer qk_live_…&quot;
                </span>
                {"\n\n"}
                {"{"} <span className="text-muted">&quot;ok&quot;: true</span>
                , <span className="text-muted">&quot;results&quot;: [</span>{" "}
                <span className="text-muted">
                  {"{ meter: \u002260/min\u0022, used: 42 }"}, …{" "}
                </span>
                <span className="text-muted">] {"}"}</span>
              </code>
            </pre>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container-page flex items-center justify-between text-xs text-muted">
          <span>quota — full-stack demo</span>
          <span>Next.js · Postgres · Caddy</span>
        </div>
      </footer>
    </div>
  );
}
