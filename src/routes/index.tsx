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
      {/* HERO — Image-backed with overlay */}
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

      {/* FEATURED FEATURES — 4-card grid */}
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
                  <svg viewBox="0 0 100 100" className="h-16 w-16 stroke-[#FF6B6B] fill-none">
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
                  <svg viewBox="0 0 100 100" className="h-16 w-16 stroke-[#D946EF] fill-none">
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

      {/* HOW IT WORKS — Testimonial / Quote Section */}
      <section className="border-t-2 border-gray-200 bg-gray-50 px-4 py-16 md:px-6">
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

      {/* KEY STATS */}
      <section className="bg-white px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { stat: "500+", label: "Events Run" },
              { stat: "120", label: "Active Clubs" },
              { stat: "12K+", label: "Students Engaged" },
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

      {/* CORE CAPABILITIES */}
      <section className="border-y-2 border-gray-200 bg-gray-50 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-4xl font-bold text-[#123a57] md:text-5xl">
              Everything You Need
            </h2>
            <p className="mx-auto max-w-2xl font-mono text-gray-600">
              Streamline club operations and member engagement with powerful features.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              "Automated event check-ins",
              "Member roster management",
              "Digital certificate generation",
              "Integrated discussion feed",
              "CSV data export",
              "Calendar sync (iCal)",
              "Role-based permissions",
              "Multi-club dashboards",
              "Attendance reports",
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-3 rounded-lg bg-white p-4">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#f5c66b]" />
                <p className="font-mono text-sm font-semibold text-[#123a57]">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="bg-gradient-to-r from-[#123a57] to-[#1a5a8c] px-4 py-20 text-center text-white md:px-6 md:py-28">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 font-display text-4xl font-bold">Ready to get started?</h2>
          <p className="mb-8 font-mono leading-relaxed">
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
