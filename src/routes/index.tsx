import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { Sparkle } from "@/components/site/Sparkle";

export const Route = createFileRoute("/")({
  component: Landing,
});

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="eyebrow flex items-center gap-2 font-bold text-[#123a57]"
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
      {/* HERO — PR 207 Image-backed with overlay */}
      <section
        className="relative h-96 w-full overflow-hidden bg-cover bg-center md:h-[500px]"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(18, 58, 87, 0.65) 0%, rgba(17, 76, 115, 0.55) 100%), url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500"><defs><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%2387CE3E;stop-opacity:0.2" /><stop offset="100%" style="stop-color:%237CC2A2;stop-opacity:0.2" /></linearGradient></defs><rect fill="url(%23grad1)" width="1200" height="500"/><circle cx="200" cy="150" r="120" fill="%2387CE3E" opacity="0.15"/><circle cx="1000" cy="350" r="180" fill="%237CC2A2" opacity="0.12"/></svg>')`,
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
          <p className="mb-3 font-mono text-sm font-bold uppercase tracking-widest text-[#f5c66b]">
            Student Communities Platform
          </p>
          <h1 className="mb-4 max-w-2xl font-display text-5xl font-bold leading-tight md:text-6xl">
            CampusConnect
          </h1>
          <p className="mx-auto max-w-xl font-mono text-base leading-relaxed md:text-lg">
            Clubs, events, and certificates. One open-source OS for student communities.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/auth"
              className="rounded-md bg-[#f5c66b] px-8 py-3 font-mono font-bold uppercase text-[#123a57] transition hover:bg-white"
            >
              Get Started
            </Link>
            <Link
              to="/events"
              className="rounded-md border-2 border-white/80 px-8 py-3 font-mono font-bold uppercase text-white transition hover:bg-white/10"
            >
              Explore Events
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED FEATURES — 4-card grid (PR 207) */}
      <section className="bg-white px-4 py-20 md:px-6 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold text-[#123a57] md:text-6xl">
              Our Featured Features
            </h2>
            <p className="mx-auto max-w-3xl font-mono text-lg leading-relaxed text-gray-700">
              Everything you need to run student clubs and community events—all in one platform.
            </p>
          </div>

          <div className="grid gap-12 md:grid-cols-4">
            {[
              {
                icon: (
                  <svg viewBox="0 0 100 100" className="h-16 w-16 stroke-[#123a57] fill-none">
                    <circle cx="30" cy="25" r="8" />
                    <path
                      d="M20 38h20a2 2 0 012 2v12a2 2 0 01-2 2H20a2 2 0 01-2-2V40a2 2 0 012-2z"
                      strokeWidth="2"
                    />
                    <circle cx="70" cy="25" r="8" />
                    <path
                      d="M60 38h20a2 2 0 012 2v12a2 2 0 01-2 2H60a2 2 0 01-2-2V40a2 2 0 012-2z"
                      strokeWidth="2"
                    />
                    <circle cx="50" cy="60" r="8" />
                    <path
                      d="M40 73h20a2 2 0 012 2v8a2 2 0 01-2 2H40a2 2 0 01-2-2v-8a2 2 0 012-2z"
                      strokeWidth="2"
                    />
                  </svg>
                ),
                title: "Club Management",
                desc: "Create pages, manage rosters, and organize your club—without the spreadsheet chaos.",
              },
              {
                icon: (
                  <svg viewBox="0 0 100 100" className="h-16 w-16 stroke-[#f5c66b] fill-none">
                    <rect x="15" y="20" width="70" height="60" rx="4" strokeWidth="3" />
                    <line x1="15" y1="35" x2="85" y2="35" strokeWidth="3" />
                    <line x1="30" y1="45" x2="30" y2="75" strokeWidth="2" />
                    <line x1="50" y1="45" x2="50" y2="75" strokeWidth="2" />
                    <line x1="70" y1="45" x2="70" y2="75" strokeWidth="2" />
                  </svg>
                ),
                title: "Event Planning",
                desc: "RSVPs, check-ins, feedback forms, and post-event reports in one flow.",
              },
              {
                icon: (
                  <svg viewBox="0 0 100 100" className="h-16 w-16 stroke-[#10B981] fill-none">
                    <rect x="10" y="15" width="80" height="60" rx="4" strokeWidth="3" />
                    <circle cx="50" cy="45" r="12" strokeWidth="2" />
                    <path d="M45 35 L55 55 M55 35 L45 55" strokeWidth="2" />
                    <line x1="10" y1="80" x2="90" y2="80" strokeWidth="3" />
                  </svg>
                ),
                title: "Digital Interaction",
                desc: "Interactive registration, real-time updates, and seamless member engagement.",
              },
              {
                icon: (
                  <svg viewBox="0 0 100 100" className="h-16 w-16 fill-[#3B82F6]">
                    <path d="M50 10 L65 40 L95 45 L70 65 L80 95 L50 75 L20 95 L30 65 L5 45 L35 40 Z" />
                  </svg>
                ),
                title: "Certificates & Proof",
                desc: "Auto-generate signed certificates and portable profiles for any workshop or event.",
              },
            ].map((feature, idx) => (
              <div key={idx} className="flex flex-col items-center text-center">
                <div className="mb-6 transition-transform hover:scale-110">{feature.icon}</div>
                <h3 className="mb-3 font-display text-2xl font-bold text-[#123a57]">
                  {feature.title}
                </h3>
                <p className="font-mono text-sm leading-relaxed text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT THE PLATFORM (from main, restyled) */}
      <section className="bg-gray-50 border-t-2 border-gray-200 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>About the platform</SectionEyebrow>
          <h2 className="mb-12 max-w-2xl text-4xl font-bold text-[#123a57] md:text-5xl">
            Built for the way student communities actually work.
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Clubs first",
                d: "Every club gets a home page, member roster, and an event calendar — no more Google Docs bureaucracy.",
              },
              {
                n: "02",
                t: "Events that ship",
                d: "RSVPs, check-ins, feedback, and post-event reports in one flow. Nothing lost to Instagram DMs.",
              },
              {
                n: "03",
                t: "Proof of work",
                d: "Auto-issued certificates and portable member profiles for hackathons, workshops, and volunteer hours.",
              },
            ].map((c) => (
              <article key={c.n} className="neu-border bg-white p-6">
                <div className="neu-border mb-4 inline-block bg-[#123a57] text-[#fef8eb] px-3 py-1 font-mono text-sm font-bold">
                  {c.n}
                </div>
                <h3 className="mb-3 text-2xl font-bold text-[#123a57]">{c.t}</h3>
                <p className="font-mono text-sm leading-relaxed text-gray-700">{c.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* KEY STATS (PR 207 + main core benefits combined) */}
      <section className="bg-white px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { stat: "500+", label: "Events Run" },
              { stat: "120", label: "Active Clubs" },
              { stat: "12K+", label: "Members Onboarded" },
              { stat: "100%", label: "Open Source" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="font-display text-4xl font-bold text-[#f5c66b] md:text-5xl">
                  {item.stat}
                </p>
                <p className="mt-2 font-mono font-bold uppercase text-gray-600">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES (PR 207) & HOW IT WORKS (main) */}
      <section className="border-y-2 border-gray-200 bg-gray-50 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-12">
          <div>
            <SectionEyebrow>Everything You Need</SectionEyebrow>
            <h2 className="mb-4 font-display text-4xl font-bold text-[#123a57] md:text-5xl">
              Create a club. Publish an event. Ship certificates.
            </h2>
            <p className="font-mono text-gray-600 leading-relaxed mb-6">
              CampusConnect collapses the tools clubs juggle — forms, spreadsheets, chat, posters,
              email — into one workflow that respects your time.
            </p>
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
                    <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-black bg-[#123a57] text-[#fef8eb]">
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
                    <span className="font-mono text-sm font-semibold text-[#123a57]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <div className="grid gap-4">
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
                <article key={c.t} className="neu-border bg-white p-6">
                  <h3 className="mb-2 text-xl font-bold text-[#123a57]">{c.t}</h3>
                  <p className="font-mono text-sm leading-relaxed text-gray-700">{c.d}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — Testimonial (PR 207) */}
      <section className="border-b-2 border-gray-200 bg-white px-4 py-16 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 font-mono text-sm uppercase tracking-widest text-[#123a57]">
            Why students love CampusConnect
          </p>
          <p className="mb-6 font-mono italic leading-relaxed text-gray-700">
            "This platform completely transformed how we run our tech club. No more scattered
            spreadsheets or missed updates. Everything is in one place and our members actually
            engage now."
          </p>
          <p className="font-display font-bold text-[#123a57]">- Campus Club Leaders</p>
        </div>
      </section>

      {/* THE LANDSCAPE (main) */}
      <section className="bg-gray-50 border-b-2 border-gray-200 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>The landscape</SectionEyebrow>
          <h2 className="mb-12 max-w-2xl text-4xl font-bold text-[#123a57] md:text-5xl">
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
                <h3 className="mb-2 text-xl font-bold text-[#123a57]">{c.t}</h3>
                <p className="font-mono text-sm leading-relaxed text-gray-700">{c.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* DEEP DIVE & TECH STACK (main) */}
      <section className="bg-white px-4 py-20 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
          <div>
            <SectionEyebrow>Two ways to run your club</SectionEyebrow>
            <h2 className="text-4xl font-bold text-[#123a57] md:text-5xl mb-6">
              Hosted or self-hosted. Same features either way.
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="neu-border bg-white p-5 border-l-4 border-l-[#123a57]">
                <p className="eyebrow font-bold text-[#123a57]">Recommended</p>
                <h3 className="mt-2 text-2xl font-bold text-[#123a57]">Cloud</h3>
                <p className="mt-3 font-mono text-xs leading-relaxed text-gray-600">
                  Managed hosting, SSO with your college email, zero DevOps.
                </p>
              </div>
              <div className="neu-border bg-white p-5">
                <p className="eyebrow font-bold text-gray-500">Fork it</p>
                <h3 className="mt-2 text-2xl font-bold">Self-host</h3>
                <p className="mt-3 font-mono text-xs leading-relaxed text-gray-600">
                  Docker Compose up. Own the database, own the data.
                </p>
              </div>
            </div>
          </div>

          <div>
            <SectionEyebrow>Under the hood</SectionEyebrow>
            <h2 className="mb-6 text-4xl font-bold text-[#123a57] md:text-5xl">
              Boring, proven tech.
            </h2>
            <div className="neu-border overflow-hidden bg-white">
              <table className="w-full font-mono text-sm text-left">
                <thead>
                  <tr className="bg-[#123a57] text-[#fef8eb]">
                    <th className="border-b-2 border-black p-4 font-bold">Layer</th>
                    <th className="border-b-2 border-black p-4 font-bold">Choice</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Frontend", "React + TanStack Start"],
                    ["Styling", "Tailwind CSS v4"],
                    ["Backend", "Supabase (Postgres + Auth)"],
                    ["Certificates", "PDF-lib"],
                    ["Deploy", "Cloudflare Workers"],
                  ].map(([a, b], i) => (
                    <tr key={a} className={i % 2 ? "bg-gray-50" : "bg-white"}>
                      <td className="border-b-2 border-black p-4 font-bold text-[#123a57]">{a}</td>
                      <td className="border-b-2 border-black p-4 text-gray-700">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE HIGHLIGHT (main) */}
      <section className="bg-gray-50 border-t-2 border-gray-200 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>Integrations & tools</SectionEyebrow>
          <h2 className="mb-12 max-w-2xl text-4xl font-bold text-[#123a57] md:text-5xl">
            Plays nice with the tools you already use.
          </h2>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { t: "Google Calendar", d: "Sync everywhere. iCal feed." },
              { t: "Discord + Slack", d: "Auto-post announcements." },
              { t: "GitHub", d: "Link hackathons to profiles." },
              { t: "Zapier", d: "Every action fires a webhook." },
            ].map((c) => (
              <article key={c.t} className="neu-border bg-white p-6">
                <h3 className="mb-2 text-xl font-bold text-[#123a57]">{c.t}</h3>
                <p className="font-mono text-sm leading-relaxed text-gray-700">{c.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION (PR 207) */}
      <section className="bg-gradient-to-r from-[#123a57] to-[#1a5a8c] px-4 py-20 text-center text-white md:px-6 md:py-28">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 font-display text-4xl font-bold">Ready to get started?</h2>
          <p className="mb-8 font-mono leading-relaxed text-[#fef8eb]">
            Launch your club page in seconds and start managing events like a pro.
          </p>
          <Link
            to="/auth"
            className="inline-block rounded-md bg-[#f5c66b] px-8 py-4 font-mono font-bold uppercase text-[#123a57] transition hover:bg-white"
          >
            Create Your Club Now
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
