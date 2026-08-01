import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { Sparkle } from "@/components/site/Sparkle";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { Users, Calendar, GraduationCap } from "lucide-react";
import { useExperimentStore } from "@/store/useExperimentStore";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { FeaturedEvents } from "@/components/home/FeaturedEvents";
import { HeroBackground } from "@/components/home/HeroBackground";
import { HeroMidground } from "@/components/home/HeroMidground";
import { HeroForeground } from "@/components/home/HeroForeground";
import { EventCardSkeleton } from "@/components/EventCardSkeleton";
import { useTranslation } from "react-i18next";

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
      className="eyebrow flex items-center gap-2 font-bold text-brand-blue-dark"
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
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState("All");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const supabase = createClient();
  const { data: featuredEvents, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["featured-events"],
    queryFn: async () => {
      // The magazine grid (issue #1852) ranks cards by popularity_score so
      // we ask the DB to do that ordering for us. is_featured is surfaced as
      // a tie-breaker; see sortFeaturedEvents() in <FeaturedEvents />.
      const { data, error } = await supabase
        .from("events")
        .select(
          `
          id,
          title,
          description,
          event_date,
          banner_url,
          popularity_score,
          is_featured,
          clubs(name)
        `,
        )
        .neq("status", "archived")
        .gte("event_date", new Date().toISOString())
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("event_date", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  const variant = useExperimentStore((state) => state.variant);
  const initializeVariant = useExperimentStore((state) => state.initializeVariant);

  useEffect(() => {
    initializeVariant();
  }, [initializeVariant]);

  const { scrollYProgress } = useScroll();
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const shouldDisableParallax = prefersReducedMotion || isMobile;

  // Map scrollYProgress to Y translations for multi-layer parallax
  // Background: 0.2x speed, Midground: 0.5x, Foreground: 0.8x
  const bgLayerYRaw = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const midLayerYRaw = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const fgLayerYRaw = useTransform(scrollYProgress, [0, 1], [0, 160]);

  const floatY1Raw = useTransform(scrollYProgress, [0, 1], [0, -250]);
  const floatY2Raw = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const floatY3Raw = useTransform(scrollYProgress, [0, 1], [0, -180]);

  const heroTextYRaw = useTransform(scrollYProgress, [0, 1], [0, -60]);

  // Fallbacks for disabled parallax (0 translations)
  const yBgLayer = shouldDisableParallax ? 0 : bgLayerYRaw;
  const yMidLayer = shouldDisableParallax ? 0 : midLayerYRaw;
  const yFgLayer = shouldDisableParallax ? 0 : fgLayerYRaw;

  const yFloat1 = shouldDisableParallax ? 0 : floatY1Raw;
  const yFloat2 = shouldDisableParallax ? 0 : floatY2Raw;
  const yFloat3 = shouldDisableParallax ? 0 : floatY3Raw;

  const yHeroText = shouldDisableParallax ? 0 : heroTextYRaw;

  const filteredFAQs =
    activeCategory === "All"
      ? FAQ_ITEMS
      : FAQ_ITEMS.filter((faq) => faq.category === activeCategory);

  return (
    <SiteShell>
      {/* HERO — Multi-layered parallax with 3 SVG depth layers */}
      <section className="relative h-96 w-full overflow-hidden md:h-[500px]">
        {/* Parallax image layers: Background (0.2x), Midground (0.5x), Foreground (0.8x) */}
        <HeroBackground y={yBgLayer} />
        <HeroMidground y={yMidLayer} />
        <HeroForeground y={yFgLayer} />

        {/* Floating community icons (visible only on desktop for parallax depth) */}
        <motion.div
          style={{ y: yFloat1 }}
          className="absolute left-[8%] top-[30%] z-10 hidden md:flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-[#f5c66b] shadow-lg opacity-75 pointer-events-none"
        >
          <Users size={32} />
        </motion.div>
        <motion.div
          style={{ y: yFloat2 }}
          className="absolute right-[8%] top-[20%] z-10 hidden md:flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-[#10B981] shadow-lg opacity-75 pointer-events-none"
        >
          <Calendar size={28} />
        </motion.div>
        <motion.div
          style={{ y: yFloat3 }}
          className="absolute left-[15%] bottom-[10%] z-10 hidden md:flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-[#f5c66b] shadow-lg opacity-60 pointer-events-none"
        >
          <GraduationCap size={24} />
        </motion.div>

        {/* Ambient Overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-dark/70 via-brand-blue-dark/55 to-brand-blue-muted/45 z-[3] pointer-events-none" />

        <motion.div
          style={{ y: yHeroText }}
          className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white z-10"
        >
          {variant === "B" ? (
            <>
              <p className="mb-3 font-mono text-sm font-bold uppercase tracking-widest text-[#a3e635] animate-fade-in-up animate-delay-100">
                Unlock Your Potential
              </p>
              <h1 className="mb-4 max-w-3xl font-display text-5xl font-bold leading-tight md:text-6xl animate-fade-in-up animate-delay-300">
                Supercharge Your Campus Life
              </h1>
              <p className="mx-auto max-w-2xl font-mono text-base leading-relaxed md:text-lg text-white/90 animate-fade-in-up animate-delay-500">
                Discover top student clubs, attend workshops, and earn certificates to build your
                future.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4 animate-fade-in-up animate-delay-700">
                <Link
                  to="/auth"
                  className="rounded-md bg-brand-peach-light px-8 py-3 font-mono font-bold uppercase text-brand-blue-dark transition hover:bg-white active:scale-95"
                >
                  Join CampusConnect
                </Link>
                <Link
                  to="/events"
                  className="rounded-md border-2 border-white/80 px-8 py-3 font-mono font-bold uppercase text-white transition hover:bg-white/10 active:scale-95"
                >
                  See Upcoming Events
                </Link>
              </div>
            </>
          ) : (
            <>
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
                  className="rounded-md bg-brand-peach-light px-8 py-3 font-mono font-bold uppercase text-brand-blue-dark transition hover:bg-white active:scale-95"
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
            </>
          )}
        </motion.div>
      </section>

      {/* FEATURED EVENTS — Magazine layout */}
      <section className="bg-cream px-4 py-20 md:px-6 md:py-28 border-t-2 border-black">
        <div className="mx-auto max-w-7xl">
          <ScrollReveal>
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <SectionEyebrow>Upcoming</SectionEyebrow>
                <h2 className="mt-2 font-display text-4xl font-bold text-brand-blue-dark md:text-5xl">
                  Featured Events
                </h2>
              </div>
              <Link
                to="/events"
                className="neu-border inline-flex items-center justify-center bg-white px-6 py-3 font-mono text-sm font-bold uppercase transition hover:bg-brand-peach-light"
              >
                View all events
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            {isLoadingEvents ? (
              <div className="flex overflow-hidden gap-4" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex-[0_0_85%] md:flex-[0_0_45%] shrink-0">
                    <EventCardSkeleton index={i} />
                  </div>
                ))}
              </div>
            ) : (
              <FeaturedEvents events={featuredEvents || []} />
            )}
          </ScrollReveal>
        </div>
      </section>

      {/* FEATURED FEATURES — 4-card grid (PR 207) */}
      <section
        id="features"
        className="bg-lime px-4 py-20 md:px-6 md:py-32 border-3 border-black scroll-mt-24"
      >
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
                icon: <Icon name="club-management" className="h-16 w-16 text-brand-blue-dark" />,
                title: "Club Management",
                desc: "Create pages, manage rosters, and organize your club—without the spreadsheet chaos.",
              },
              {
                icon: <Icon name="event-planning" className="h-16 w-16 text-brand-peach-light" />,
                title: "Event Planning",
                desc: "RSVPs, check-ins, feedback forms, and post-event reports in one flow.",
              },
              {
                icon: (
                  <Icon name="digital-interaction" className="h-16 w-16 text-brand-emerald-base" />
                ),
                title: "Digital Interaction",
                desc: "Interactive registration, real-time updates, and seamless member engagement.",
              },
              {
                icon: <Icon name="star" className="h-16 w-16 text-brand-blue-base-500" />,
                title: "Certificates & Proof",
                desc: "Auto-generate signed certificates and portable profiles for any workshop or event.",
              },
            ].map((feature, idx) => (
              <ScrollReveal key={idx} delay={idx * 100}>
                <div className="flex flex-col items-center text-center p-6 border-2 border-transparent rounded-lg transition-all duration-300 hover:border-brand-peach-light/20 hover:bg-gray-50/50 hover:shadow-xs">
                  <div className="mb-6 transition-transform duration-300 hover:scale-115 hover:rotate-3">
                    {feature.icon}
                  </div>
                  <h3 className="mb-3 font-display text-2xl font-bold text-brand-blue-dark">
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
                <article className="neu-border bg-rose-200 p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-[8px_8px_0_0_var(--color-brand-blue-dark)] hover:border-brand-blue-dark">
                  <div className="neu-border mb-4 inline-block bg-brand-blue-dark text-brand-yellow-bg-alt px-3 py-1 font-mono text-sm font-bold">
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
              <h2 className="mb-4 font-display text-4xl font-bold text-brand-blue-dark md:text-5xl text-red-900">
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
                      <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-black bg-brand-blue-dark text-brand-yellow-bg-alt">
                        <Icon name="check" size={12} />
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
                    className="neu-border bg-sky-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-brand-blue-dark)] hover:border-brand-blue-dark"
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
          <p className="font-display font-bold text-brand-blue-dark">- Campus Club Leaders</p>
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
                <article className="neu-border bg-rose-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-brand-blue-dark)] hover:border-brand-blue-dark">
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
                <div className="neu-border bg-rose-200 p-5 border-l-4 border-l-[#123a57] transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-brand-blue-dark)]">
                  <p className="eyebrow font-bold text-gray-800">Recommended</p>
                  <h3 className="mt-2 text-2xl font-bold text-blue-950">Cloud</h3>
                  <p className="mt-3 font-mono text-xs leading-relaxed text-gray-800">
                    Managed hosting, SSO with your college email, zero DevOps.
                  </p>
                </div>
                <div className="neu-border bg-rose-200 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-ink)]">
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
              <div className="neu-border overflow-hidden bg-white transition-all duration-300 hover:shadow-[6px_6px_0_0_var(--color-brand-blue-dark)] hover:border-brand-blue-dark">
                <table className="w-full font-mono text-sm text-left">
                  <thead>
                    <tr className="bg-brand-blue-dark text-brand-yellow-bg-alt">
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
                        <td className="border-b-2 border-black p-4 font-bold text-brand-blue-dark">
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
                <article className="neu-border bg-rose-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-brand-blue-dark)] hover:border-brand-blue-dark">
                  <h3 className="mb-2 text-xl font-bold text-brand-blue-dark">{c.t}</h3>
                  <p className="font-mono text-sm leading-relaxed text-gray-700">{c.d}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section
        id="faq"
        className="bg-teal-100 border-t-2 border-gray-200 px-4 py-20 md:px-6 scroll-mt-24"
      >
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
                    ? "bg-black text-brand-yellow-bg-alt shadow-none translate-x-[2px] translate-y-[2px]"
                    : "bg-lime text-black hover:bg-gray-100 shadow-[2px_2px_0_0_var(--color-ink)]"
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
                  className="neu-border bg-orange-100 transition-all duration-300 overflow-hidden shadow-[4px_4px_0_0_var(--color-ink)] hover:shadow-[6px_6px_0_0_var(--color-brand-blue-dark)] hover:border-brand-blue-dark"
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left font-mono font-bold text-gray-900 hover:bg-gray-50/50 cursor-pointer"
                  >
                    <span className="text-base md:text-lg">{faq.question}</span>
                    <span className="ml-4 shrink-0 transition-transform duration-300">
                      {isOpen ? (
                        <Icon name="minus" className="w-5 h-5" />
                      ) : (
                        <Icon name="plus" className="w-5 h-5" />
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
      <section className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-alt px-4 py-20 text-center text-white md:px-6 md:py-28">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-4 font-display text-4xl font-bold">Ready to get started?</h2>
            <p className="mb-8 font-mono leading-relaxed text-brand-yellow-bg-alt">
              Launch your club page in seconds and start managing events like a pro.
            </p>
            <Link
              to="/auth"
              className="inline-block rounded-md bg-brand-peach-light px-8 py-4 font-mono font-bold uppercase text-brand-blue-dark transition hover:bg-white active:scale-95"
            >
              Create Your Club Now
            </Link>
          </div>
        </ScrollReveal>
      </section>
      {/* CONTACT SECTION */}
      <section
        id="contact"
        className="bg-white border-t-2 border-gray-200 px-4 py-20 md:px-6 scroll-mt-24"
      >
        <div className="mx-auto max-w-4xl text-center">
          <SectionEyebrow>Contact</SectionEyebrow>

          <h2 className="mt-2 text-4xl font-bold text-red-900 md:text-5xl">
            Get in touch with us.
          </h2>

          <p className="mt-6 font-mono text-gray-700">
            Have questions about CampusConnect? Reach out to our team.
          </p>

          <a
            href="mailto:support@campusconnect.com"
            className="mt-8 inline-block neu-border bg-lime px-6 py-3 font-mono font-bold uppercase"
          >
            Contact Support
          </a>
        </div>
      </section>
    </SiteShell>
  );
}
