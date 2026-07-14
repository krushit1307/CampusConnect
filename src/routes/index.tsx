import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteShell } from "@/components/site/SiteShell";

import { Sparkle } from "@/components/site/Sparkle";

export const Route = createFileRoute("/")({
  component: Landing,
});

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="eyebrow flex items-center gap-2 font-bold"
      style={{ letterSpacing: "0.1em", fontSize: "12px" }}
    >
      <Sparkle size={10} />

      {children}
    </p>
  );
}

function Landing() {
  return (
    <SiteShell>
      {/* 1. HERO — lime */}

      <section className="relative border-b-2 border-black bg-lime px-4 py-28 md:px-6 md:py-36">
        <Sparkle className="absolute left-6 top-6" size={22} />

        <Sparkle className="absolute right-6 top-6" size={22} />

        <Sparkle className="absolute bottom-6 left-6" size={16} />

        <Sparkle className="absolute bottom-6 right-6" size={16} />

        <div className="mx-auto max-w-5xl text-center">
          <SectionEyebrow>CampusConnect × Open-Source Student Communities</SectionEyebrow>

          <h1
            className="mt-8 font-bold"
            style={{
              fontSize: "clamp(48px, 8vw, 88px)",

              lineHeight: 1.02,

              letterSpacing: "-0.03em",
            }}
          >
            Every club. Every event.
            <br />
            One brutally simple OS.
          </h1>

          <p className="mx-auto mt-8 max-w-[640px] font-mono text-sm leading-relaxed md:text-base">
            CampusConnect is an open-source operating system for college clubs and tech communities.
            Run events, grow membership, ship certificates — without the spreadsheet chaos.
          </p>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link
              to="/auth"
              className="neu-border neu-press bg-black px-6 py-3 font-mono text-sm font-bold uppercase text-cream hover:bg-cream hover:text-black"
              style={{ letterSpacing: "0.08em" }}
            >
              Start a club →
            </Link>

            <Link
              to="/events"
              className="neu-border neu-press bg-cream px-6 py-3 font-mono text-sm font-bold uppercase text-black hover:bg-black hover:text-cream"
              style={{ letterSpacing: "0.08em" }}
            >
              Browse events
            </Link>
          </div>
        </div>
      </section>

      {/* 2. ABOUT — cream, numbered cards */}

      <section className="border-b-2 border-black bg-cream px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>About the platform</SectionEyebrow>

          <h2 className="mb-12 max-w-2xl text-4xl font-bold md:text-5xl">
            Built for the way student communities actually work.
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                n: "01",

                tone: "bg-lime",

                t: "Clubs first",

                d: "Every club gets a home page, member roster, and an event calendar — no more Google Docs bureaucracy.",
              },

              {
                n: "02",

                tone: "bg-sky",

                t: "Events that ship",

                d: "RSVPs, check-ins, feedback, and post-event reports in one flow. Nothing lost to Instagram DMs.",
              },

              {
                n: "03",

                tone: "bg-peach",

                t: "Proof of work",

                d: "Auto-issued certificates and portable member profiles for hackathons, workshops, and volunteer hours.",
              },
            ].map((c) => (
              <article key={c.n} className="neu-border neu-press bg-white p-6">
                <div
                  className={`neu-border ${c.tone} mb-4 inline-block px-3 py-1 font-mono text-sm font-bold`}
                >
                  {c.n}
                </div>

                <h3 className="mb-3 text-2xl font-bold">{c.t}</h3>

                <p className="font-mono text-sm leading-relaxed">{c.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 3. CORE BENEFITS — sky, 4 label cards */}

      <section className="border-b-2 border-black bg-sky px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>Core benefits</SectionEyebrow>

          <h2 className="mb-12 max-w-2xl text-4xl font-bold md:text-5xl">
            Less admin. More building.
          </h2>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["500+", "Events run"],

              ["120", "Active clubs"],

              ["12k", "Members onboarded"],

              ["100%", "Open source"],
            ].map(([v, l]) => (
              <div key={l} className="neu-border bg-white p-5">
                <p className="font-display text-4xl font-bold">{v}</p>

                <div className="my-3 border-t-2 border-black" />

                <p className="eyebrow font-bold">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS — lavender, 2 col + checklist */}

      <section className="border-b-2 border-black bg-lavender px-4 py-20 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
          <div>
            <SectionEyebrow>How it works, in one line</SectionEyebrow>

            <h2 className="text-4xl font-bold md:text-5xl">
              Create a club. Publish an event. Ship certificates.
            </h2>

            <p className="mt-6 max-w-md font-mono text-sm leading-relaxed">
              CampusConnect collapses the tools clubs juggle — forms, spreadsheets, chat, posters,
              email — into one workflow that respects your time.
            </p>
          </div>

          <div className="neu-border bg-white p-6">
            <ul className="space-y-4">
              {[
                "Spin up a club page in under 60 seconds",

                "Publish events with automatic RSVP + calendar sync",

                "Check members in at the door with a QR scan",

                "Auto-generate signed PDF certificates",

                "Post updates to a shared discussion feed",

                "Export data as CSV whenever you want",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-black bg-black text-cream">
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                    >
                      <path d="M4 12l6 6L20 6" />
                    </svg>
                  </span>

                  <span className="font-mono text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 5. WHY THIS MATTERS — peach, 3 problem cards */}

      <section className="border-b-2 border-black bg-peach px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>Why this matters</SectionEyebrow>

          <h2 className="mb-12 max-w-3xl text-4xl font-bold md:text-5xl">
            Student communities deserve infrastructure, not workarounds.
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                t: "Handoff hell",

                d: "Every year, club leadership rotates, and half the knowledge dies in a personal Notion.",
              },

              {
                t: "Data locked in DMs",

                d: "Attendance in a WhatsApp group, RSVPs in a form, feedback nowhere. Never joined up.",
              },

              {
                t: "No proof, no trust",

                d: "Members do real work but leave with nothing verifiable to show recruiters.",
              },
            ].map((c) => (
              <article key={c.t} className="neu-border neu-press bg-white p-6">
                <h3 className="mb-3 text-2xl font-bold">{c.t}</h3>

                <p className="font-mono text-sm leading-relaxed">{c.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 6. LANDSCAPE — sky, 2x2 comparison cards */}

      <section className="border-b-2 border-black bg-sky px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>The landscape</SectionEyebrow>

          <h2 className="mb-12 max-w-2xl text-4xl font-bold md:text-5xl">
            Where CampusConnect fits.
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                t: "vs. Google Forms + Sheets",

                d: "Great for one event. Falls apart across a year, across clubs, across handoffs.",
              },

              {
                t: "vs. Discord / WhatsApp",

                d: "Perfect for chatter. Not designed to be a source of truth for membership or attendance.",
              },

              {
                t: "vs. Eventbrite / Luma",

                d: "Solid for the general public. Doesn't understand semesters, clubs, or student verification.",
              },

              {
                t: "vs. Custom college portals",

                d: "Locked to one campus, no interop, no open-source community driving improvements.",
              },
            ].map((c) => (
              <article key={c.t} className="neu-border bg-white p-6">
                <h3 className="mb-2 text-xl font-bold">{c.t}</h3>

                <p className="font-mono text-sm leading-relaxed">{c.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 7. DEEP DIVE — lavender, 2 col + side-by-side tag boxes */}

      <section className="border-b-2 border-black bg-lavender px-4 py-20 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
          <div>
            <SectionEyebrow>Two ways to run your club</SectionEyebrow>

            <h2 className="text-4xl font-bold md:text-5xl">
              Hosted or self-hosted. Same features either way.
            </h2>

            <p className="mt-6 font-mono text-sm leading-relaxed">
              Grab the managed cloud instance and start today, or fork the repo and deploy on your
              college's infra. The core is MIT-licensed and hackable to the bone.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="neu-border bg-lime p-5">
              <p className="eyebrow font-bold">Recommended</p>

              <h3 className="mt-2 text-2xl font-bold">Cloud</h3>

              <p className="mt-3 font-mono text-xs leading-relaxed">
                Managed hosting, SSO with your college email, zero DevOps.
              </p>
            </div>

            <div className="neu-border bg-white p-5">
              <p className="eyebrow font-bold">Fork it</p>

              <h3 className="mt-2 text-2xl font-bold">Self-host</h3>

              <p className="mt-3 font-mono text-xs leading-relaxed">
                Docker Compose up. Own the database, own the data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. TECH STACK TABLE — peach */}

      <section className="border-b-2 border-black bg-peach px-4 py-20 md:px-6">
        <div className="mx-auto max-w-4xl">
          <SectionEyebrow>Under the hood</SectionEyebrow>

          <h2 className="mb-8 text-4xl font-bold md:text-5xl">Boring, proven tech.</h2>

          <div className="neu-border overflow-hidden bg-white">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="bg-lime">
                  <th className="border-b-2 border-black p-4 text-left font-bold">Layer</th>

                  <th className="border-b-2 border-black p-4 text-left font-bold">Choice</th>
                </tr>
              </thead>

              <tbody>
                {[
                  ["Frontend", "React + TanStack Start"],

                  ["Styling", "Tailwind CSS v4"],

                  ["Backend", "Supabase (Postgres + Auth + Storage)"],

                  ["Certificates", "PDF-lib, signed server-side"],

                  ["Auth", "Email + Google OAuth"],

                  ["Deploy", "Cloudflare Workers"],
                ].map(([a, b], i) => (
                  <tr key={a} className={i % 2 ? "bg-cream" : "bg-white"}>
                    <td className="border-b-2 border-black p-4 font-bold">{a}</td>

                    <td className="border-b-2 border-black p-4">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 9. FEATURE HIGHLIGHT — lime, 2x2 */}

      <section className="border-b-2 border-black bg-lime px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>Integrations & tools</SectionEyebrow>

          <h2 className="mb-12 max-w-2xl text-4xl font-bold md:text-5xl">
            Plays nice with the tools you already use.
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                t: "Google Calendar",

                d: "Publish once, sync everywhere. Members subscribe to a club's iCal feed.",
              },

              {
                t: "Discord + Slack",

                d: "Auto-post event announcements, ping RSVPs, close the loop with reminders.",
              },

              {
                t: "GitHub",

                d: "Link hackathon submissions and workshop repos directly to member profiles.",
              },

              {
                t: "Zapier / Webhooks",

                d: "Every action fires a webhook. Wire it into whatever weird workflow you love.",
              },
            ].map((c) => (
              <article key={c.t} className="neu-border neu-press bg-white p-6">
                <h3 className="mb-2 text-2xl font-bold">{c.t}</h3>

                <p className="font-mono text-sm leading-relaxed">{c.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 10. KNOWN ISSUES — cream */}

      <section className="border-b-2 border-black bg-cream px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>Known issues & notes</SectionEyebrow>

          <h2 className="mb-8 text-4xl font-bold md:text-5xl">We ship honestly.</h2>

          <div className="grid gap-6 md:grid-cols-2">
            <article className="neu-border bg-white p-6">
              <span className="neu-border bg-peach px-2 py-1 font-mono text-xs font-bold uppercase">
                Rate limited
              </span>

              <h3 className="mt-4 mb-2 text-xl font-bold">Certificate generation</h3>

              <p className="font-mono text-sm leading-relaxed">
                Bulk certificate jobs are throttled to 200/min on the shared cloud tier. Self-host
                to lift the cap.
              </p>
            </article>

            <article className="neu-border bg-white p-6">
              <span className="neu-border bg-lime px-2 py-1 font-mono text-xs font-bold uppercase">
                In progress
              </span>

              <h3 className="mt-4 mb-2 text-xl font-bold">Mobile check-in app</h3>

              <p className="font-mono text-sm leading-relaxed">
                The native iOS/Android app for door-scanning is in alpha. PWA works today.
              </p>
            </article>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
