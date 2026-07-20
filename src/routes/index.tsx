import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { Sparkle } from "@/components/site/Sparkle";

function AnimatedCounter({ value }: { value: string }) {
  const [displayValue, setDisplayValue] = useState("0");
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimatedRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const match = value.match(/^([\d.,]+)(.*)$/);
    if (!match) {
      setDisplayValue(value);
      return;
    }

    const numberStr = match[1];
    const suffix = match[2];
    const target = parseFloat(numberStr.replace(/,/g, ""));

    if (isNaN(target)) {
      setDisplayValue(value);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;

          const duration = 1800;
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(target * easeProgress);

            if (numberStr.includes(".")) {
              const decimals = numberStr.split(".")[1].length;
              setDisplayValue(`${(target * easeProgress).toFixed(decimals)}${suffix}`);
            } else {
              setDisplayValue(`${current.toLocaleString()}${suffix}`);
            }

            if (progress < 1) {
              frameRef.current = requestAnimationFrame(animate);
            } else {
              frameRef.current = null;
              setDisplayValue(value);
            }
          };

          frameRef.current = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 },
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      if (currentRef) {
        observer.unobserve(currentRef);
      }

      observer.disconnect();
    };
  }, [value]);

  return <span ref={ref}>{displayValue}</span>;
}

function ScrollReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -40px 0px" },
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${isVisible ? "visible" : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

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

interface FAQItem {
  category: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    category: "General",
    question: "What is CampusConnect?",
    answer:
      "CampusConnect is a unified, open-source platform designed to streamline student club management, event planning, and digital check-ins for student communities.",
  },
  {
    category: "General",
    question: "Is CampusConnect free to use?",
    answer:
      "Yes! CampusConnect is 100% open-source and free for student communities. You can host your own instance or use the managed cloud version.",
  },
  {
    category: "Clubs",
    question: "How do I create a new club?",
    answer:
      "Registered students can request to create a new club from the Clubs Directory. Once approved by a system administrator, you can start customizing your page.",
  },
  {
    category: "Clubs",
    question: "How do I manage my club members?",
    answer:
      "Club admins can approve join requests, assign roles (member, admin), and view full member profiles directly from the club settings.",
  },
  {
    category: "Events",
    question: "How do I RSVP for an event?",
    answer:
      "Simply explore the active events feed, select the event you're interested in, and click the 'RSVP' button.",
  },
  {
    category: "Events",
    question: "How does the check-in system work?",
    answer:
      "When you RSVP, a custom ticket with a QR code is generated. Club organizers can scan your QR code at the door using any mobile device to check you in instantly.",
  },
  {
    category: "Security",
    question: "Is my student data secure?",
    answer:
      "Absolutely. CampusConnect is built with Supabase authentication and strict Row-Level Security (RLS) database policies to protect user and admin data.",
  },
  {
    category: "Security",
    question: "Who can see my personal profile details?",
    answer:
      "Only authorized members of your verified student community can see your profile page. You can customize your preferences at any time in your Settings.",
  },
];

export default function Landing() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filteredFAQs =
    activeCategory === "All"
      ? FAQ_ITEMS
      : FAQ_ITEMS.filter((faq) => faq.category === activeCategory);

  return (
    <SiteShell>
      {/* HERO — PR 207 Image-backed with overlay */}
      <section className="relative h-96 w-full overflow-hidden animate-hero-bg md:h-[500px]">
        {/* Dynamic Animated Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {/* Blob 1 (Accent Color) */}
          <div className="absolute -top-[10%] -left-[10%] w-[300px] h-[300px] rounded-full bg-[#f5c66b]/22 blur-[80px] animate-blob-1 mix-blend-screen md:w-[450px] md:h-[450px]" />
          {/* Blob 2 (Primary Darker Tone) */}
          <div className="absolute bottom-[10%] right-[5%] w-[350px] h-[350px] rounded-full bg-[#1e5c8a]/55 blur-[90px] animate-blob-2 mix-blend-screen md:w-[500px] md:h-[500px]" />
          {/* Blob 3 (Accent Color Variant) */}
          <div className="absolute top-[30%] left-[30%] w-[250px] h-[250px] rounded-full bg-[#f5c66b]/18 blur-[70px] animate-blob-3 mix-blend-screen md:w-[350px] md:h-[350px]" />
        </div>

        {/* Ambient Overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#123a57]/70 via-[#123a57]/55 to-[#114c73]/45 z-0 pointer-events-none" />

        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white z-10">
          <p className="mb-3 font-mono text-sm font-bold uppercase tracking-widest text-[#f5c66b] animate-fade-in-up animate-delay-100">
            Student Communities Platform
          </p>
          <h1 className="mb-4 max-w-2xl font-display text-5xl font-bold leading-tight md:text-6xl animate-fade-in-up animate-delay-300">
            CampusConnect
          </h1>
          <p className="mx-auto max-w-xl font-mono text-base leading-relaxed md:text-lg text-white/90 animate-fade-in-up animate-delay-500">
            Clubs, events, and certificates. One open-source OS for student communities.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4 animate-fade-in-up animate-delay-700">
            <Link
              to="/auth"
              className="rounded-md bg-[#f5c66b] px-8 py-3 font-mono font-bold uppercase text-[#123a57] transition hover:bg-white active:scale-95"
            >
              Get Started
            </Link>
            <Link
              to="/events"
              className="rounded-md border-2 border-white/80 px-8 py-3 font-mono font-bold uppercase text-white transition hover:bg-white/10 active:scale-95"
            >
              Explore Events
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED FEATURES — 4-card grid (PR 207) */}
      <section className="bg-lime px-4 py-20 md:px-6 md:py-32 border-3 border-black">
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold text-red-900 md:text-6xl">
              Our Featured Features
            </h2>
            <p className="mx-auto max-w-3xl font-mono text-lg leading-relaxed text-gray-800">
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
              <ScrollReveal key={idx} delay={idx * 100}>
                <div className="flex flex-col items-center text-center p-6 border-2 border-transparent rounded-lg transition-all duration-300 hover:border-[#f5c66b]/20 hover:bg-gray-50/50 hover:shadow-xs">
                  <div className="mb-6 transition-transform duration-300 hover:scale-115 hover:rotate-3">
                    {feature.icon}
                  </div>
                  <h3 className="mb-3 font-display text-2xl font-bold text-[#123a57]">
                    {feature.title}
                  </h3>
                  <p className="font-mono text-sm leading-relaxed text-gray-600">{feature.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT THE PLATFORM (from main, restyled) */}
      <section className="bg-blue-300 border-t-2 border-gray-200 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>About the platform</SectionEyebrow>
          <h2 className="mb-12 max-w-2xl text-4xl font-bold text-red-900 md:text-5xl">
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
            ].map((c, idx) => (
              <ScrollReveal key={c.n} delay={idx * 150}>
                <article className="neu-border bg-rose-200 p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-[8px_8px_0_0_#123a57] hover:border-[#123a57]">
                  <div className="neu-border mb-4 inline-block bg-[#123a57] text-[#fef8eb] px-3 py-1 font-mono text-sm font-bold">
                    {c.n}
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-indigo-900">{c.t}</h3>
                  <p className="font-mono text-sm leading-relaxed text-gray-800">{c.d}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* KEY STATS (PR 207 + main core benefits combined) */}
      <section className="bg-red-500 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { stat: "500+", label: "Events Run" },
              { stat: "120", label: "Active Clubs" },
              { stat: "12K+", label: "Members Onboarded" },
              { stat: "100%", label: "Open Source" },
            ].map((item, idx) => (
              <ScrollReveal key={item.label} delay={idx * 100}>
                <div className="text-center">
                  <p className="font-display text-4xl font-bold text-amber-300 md:text-5xl">
                    <AnimatedCounter value={item.stat} />
                  </p>
                  <p className="mt-2 font-mono font-bold uppercase text-gray-800">{item.label}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES (PR 207) & HOW IT WORKS (main) */}
      <section className="border-y-2 border-gray-200 bg-teal-600 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-12">
          <div>
            <ScrollReveal>
              <SectionEyebrow>Everything You Need</SectionEyebrow>
              <h2 className="mb-4 font-display text-4xl font-bold text-[#123a57] md:text-5xl text-red-900">
                Create a club. Publish an event. Ship certificates.
              </h2>
              <p className="font-mono text-gray-800 leading-relaxed mb-6">
                CampusConnect collapses the tools clubs juggle — forms, spreadsheets, chat, posters,
                email — into one workflow that respects your time.
              </p>
              <div className="neu-border bg-rose-200 p-6">
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
                      <span className="font-mono text-sm font-semibold text-indigo-900">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
          <div className="flex flex-col justify-center">
            <ScrollReveal delay={200}>
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
                  <article
                    key={c.t}
                    className="neu-border bg-sky-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#123a57] hover:border-[#123a57]"
                  >
                    <h3 className="mb-2 text-xl font-bold text-indigo-900">{c.t}</h3>
                    <p className="font-mono text-sm leading-relaxed text-gray-800">{c.d}</p>
                  </article>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — Testimonial (PR 207) */}
      <section className="border-b-2 border-gray-200 bg-amber-200 px-4 py-16 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 font-mono text-lg uppercase tracking-widest text-amber-800 font-bold">
            Why students love CampusConnect
          </p>
          <p className="mb-6 font-mono italic leading-relaxed text-gray-800">
            "This platform completely transformed how we run our tech club. No more scattered
            spreadsheets or missed updates. Everything is in one place and our members actually
            engage now."
          </p>
          <p className="font-display font-bold text-[#123a57]">- Campus Club Leaders</p>
        </div>
      </section>

      {/* THE LANDSCAPE (main) */}
      <section className="bg-violet-400 border-b-2 border-gray-200 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>The landscape</SectionEyebrow>
          <h2 className="mb-12 max-w-2xl text-4xl font-bold text-red-900 md:text-5xl">
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
            ].map((c, idx) => (
              <ScrollReveal key={c.t} delay={idx * 150}>
                <article className="neu-border bg-rose-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#123a57] hover:border-[#123a57]">
                  <h3 className="mb-2 text-xl font-bold text-violet-900">{c.t}</h3>
                  <p className="font-mono text-sm leading-relaxed text-gray-800">{c.d}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* DEEP DIVE & TECH STACK (main) */}
      <section className="bg-amber-500 px-4 py-20 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
          <div>
            <ScrollReveal>
              <SectionEyebrow>Two ways to run your club</SectionEyebrow>
              <h2 className="text-4xl font-bold text-red-900 md:text-5xl mb-6">
                Hosted or self-hosted. Same features either way.
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="neu-border bg-rose-200 p-5 border-l-4 border-l-[#123a57] transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#123a57]">
                  <p className="eyebrow font-bold text-gray-800">Recommended</p>
                  <h3 className="mt-2 text-2xl font-bold text-blue-950">Cloud</h3>
                  <p className="mt-3 font-mono text-xs leading-relaxed text-gray-800">
                    Managed hosting, SSO with your college email, zero DevOps.
                  </p>
                </div>
                <div className="neu-border bg-rose-200 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000000]">
                  <p className="eyebrow font-bold text-gray-800">Fork it</p>
                  <h3 className="mt-2 text-2xl font-bold text-blue-950">Self-host</h3>
                  <p className="mt-3 font-mono text-xs leading-relaxed text-gray-800">
                    Docker Compose up. Own the database, own the data.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>

          <div>
            <ScrollReveal delay={200}>
              <SectionEyebrow>Under the hood</SectionEyebrow>
              <h2 className="mb-6 text-4xl font-bold text-amber-900 md:text-5xl">
                Boring, proven tech.
              </h2>
              <div className="neu-border overflow-hidden bg-white transition-all duration-300 hover:shadow-[6px_6px_0_0_#123a57] hover:border-[#123a57]">
                <table className="w-full font-mono text-sm text-left">
                  <thead>
                    <tr className="bg-[#123a57] text-[#fef8eb]">
                      <th className="border-b-2 border-black p-4 font-bold">Layer</th>
                      <th className="border-b-2 border-black p-4 font-bold">Choice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Frontend", "React + Vite"],
                      ["Styling", "Tailwind CSS v4"],
                      ["Backend", "Supabase (Postgres + Auth)"],
                      ["Certificates", "PDF-lib"],
                      ["Deploy", "Cloudflare Workers"],
                    ].map(([a, b], i) => (
                      <tr key={a} className={i % 2 ? "bg-gray-50" : "bg-sky-100"}>
                        <td className="border-b-2 border-black p-4 font-bold text-[#123a57]">
                          {a}
                        </td>
                        <td className="border-b-2 border-black p-4 text-gray-700">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* FEATURE HIGHLIGHT (main) */}
      <section className="bg-green-300 border-t-2 border-gray-200 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>Integrations & tools</SectionEyebrow>
          <h2 className="mb-12 max-w-2xl text-4xl font-bold text-red-900 md:text-5xl">
            Plays nice with the tools you already use.
          </h2>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { t: "Google Calendar", d: "Sync everywhere. iCal feed." },
              { t: "Discord + Slack", d: "Auto-post announcements." },
              { t: "GitHub", d: "Link hackathons to profiles." },
              { t: "Zapier", d: "Every action fires a webhook." },
            ].map((c, idx) => (
              <ScrollReveal key={c.t} delay={idx * 100}>
                <article className="neu-border bg-rose-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#123a57] hover:border-[#123a57]">
                  <h3 className="mb-2 text-xl font-bold text-[#123a57]">{c.t}</h3>
                  <p className="font-mono text-sm leading-relaxed text-gray-700">{c.d}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="bg-teal-100 border-t-2 border-gray-200 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <SectionEyebrow>Frequently Asked Questions</SectionEyebrow>
            <h2 className="mt-2 text-4xl font-bold text-red-900 md:text-5xl">
              Answers to your questions.
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {["All", "General", "Clubs", "Events", "Security"].map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  setOpenIndex(null);
                }}
                className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase transition-all duration-200 active:scale-95 cursor-pointer ${
                  activeCategory === category
                    ? "bg-black text-[#fef8eb] shadow-none translate-x-[2px] translate-y-[2px]"
                    : "bg-lime text-black hover:bg-gray-100 shadow-[2px_2px_0_0_#000000]"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredFAQs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className="neu-border bg-orange-100 transition-all duration-300 overflow-hidden shadow-[4px_4px_0_0_#000000] hover:shadow-[6px_6px_0_0_#123a57] hover:border-[#123a57]"
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left font-mono font-bold text-gray-900 hover:bg-gray-50/50 cursor-pointer"
                  >
                    <span className="text-base md:text-lg">{faq.question}</span>
                    <span className="ml-4 shrink-0 transition-transform duration-300">
                      {isOpen ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                      )}
                    </span>
                  </button>
                  <div
                    className="transition-all duration-300 ease-in-out overflow-hidden"
                    style={{
                      maxHeight: isOpen ? "300px" : "0px",
                      opacity: isOpen ? 1 : 0,
                    }}
                  >
                    <div className="p-5 pt-0 font-mono text-sm leading-relaxed text-gray-900 border-t border-dashed border-gray-200 mt-2">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA SECTION (PR 207) */}
      <section className="bg-gradient-to-r from-[#123a57] to-[#1a5a8c] px-4 py-20 text-center text-white md:px-6 md:py-28">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-4 font-display text-4xl font-bold">Ready to get started?</h2>
            <p className="mb-8 font-mono leading-relaxed text-[#fef8eb]">
              Launch your club page in seconds and start managing events like a pro.
            </p>
            <Link
              to="/auth"
              className="inline-block rounded-md bg-[#f5c66b] px-8 py-4 font-mono font-bold uppercase text-[#123a57] transition hover:bg-white active:scale-95"
            >
              Create Your Club Now
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </SiteShell>
  );
}
