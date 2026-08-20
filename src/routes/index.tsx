import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { Sparkle } from "@/components/site/Sparkle";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import Users from "lucide-react/dist/esm/icons/users";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import GraduationCap from "lucide-react/dist/esm/icons/graduation-cap";
import { useExperimentStore } from "@/store/useExperimentStore";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { HomeEventFeed } from "@/components/home/HomeEventFeed";
import { HeroBackground } from "@/components/home/HeroBackground";
import { HeroMidground } from "@/components/home/HeroMidground";
import { HeroForeground } from "@/components/home/HeroForeground";
import { EventCardSkeleton } from "@/components/EventCardSkeleton";
import { useTranslation } from "react-i18next";
import { Marquee } from "@/components/ui/Marquee";

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
  qKey: string;
  aKey: string;
}

const FAQ_ITEMS = [
  { category: "general", qKey: "home.faq.items.q1", aKey: "home.faq.items.a1" },
  { category: "general", qKey: "home.faq.items.q2", aKey: "home.faq.items.a2" },
  { category: "clubs", qKey: "home.faq.items.q3", aKey: "home.faq.items.a3" },
  { category: "clubs", qKey: "home.faq.items.q4", aKey: "home.faq.items.a4" },
  { category: "events", qKey: "home.faq.items.q5", aKey: "home.faq.items.a5" },
  { category: "events", qKey: "home.faq.items.q6", aKey: "home.faq.items.a6" },
  { category: "security", qKey: "home.faq.items.q7", aKey: "home.faq.items.a7" },
  { category: "security", qKey: "home.faq.items.q8", aKey: "home.faq.items.a8" },
];

export default function Landing() {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<
    "all" | "general" | "clubs" | "events" | "security"
  >("all");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const supabase = createClient();
  const { data: featuredEvents, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["featured-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          `
          id,
          title,
          description,
          tldr_summary,
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

  const bgLayerYRaw = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const midLayerYRaw = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const fgLayerYRaw = useTransform(scrollYProgress, [0, 1], [0, 160]);

  const floatY1Raw = useTransform(scrollYProgress, [0, 1], [0, -250]);
  const floatY2Raw = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const floatY3Raw = useTransform(scrollYProgress, [0, 1], [0, -180]);

  const heroTextYRaw = useTransform(scrollYProgress, [0, 1], [0, -60]);

  const yBgLayer = shouldDisableParallax ? 0 : bgLayerYRaw;
  const yMidLayer = shouldDisableParallax ? 0 : midLayerYRaw;
  const yFgLayer = shouldDisableParallax ? 0 : fgLayerYRaw;

  const yFloat1 = shouldDisableParallax ? 0 : floatY1Raw;
  const yFloat2 = shouldDisableParallax ? 0 : floatY2Raw;
  const yFloat3 = shouldDisableParallax ? 0 : floatY3Raw;

  const yHeroText = shouldDisableParallax ? 0 : heroTextYRaw;

  const filteredFAQs =
    activeCategory === "all"
      ? FAQ_ITEMS
      : FAQ_ITEMS.filter((faq) => faq.category === activeCategory);

  return (
    <SiteShell>
      <Marquee>{t("home.marquee")}</Marquee>

      <section className="relative h-96 w-full overflow-hidden md:h-[500px]">
        <HeroBackground y={yBgLayer} />
        <HeroMidground y={yMidLayer} />
        <HeroForeground y={yFgLayer} />

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

        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-dark/70 via-brand-blue-dark/55 to-brand-blue-muted/45 z-[3] pointer-events-none" />

        <motion.div
          style={{ y: yHeroText }}
          className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white z-10"
        >
          {variant === "B" ? (
            <>
              <p className="mb-3 font-mono text-sm font-bold uppercase tracking-widest text-[#a3e635] animate-fade-in-up animate-delay-100">
                {t("home.hero_variant_b.eyebrow")}
              </p>
              <h1 className="mb-4 max-w-3xl font-display text-5xl font-bold leading-tight md:text-6xl animate-fade-in-up animate-delay-300">
                {t("home.hero_variant_b.title")}
              </h1>
              <p className="mx-auto max-w-2xl font-mono text-base leading-relaxed md:text-lg text-white/90 animate-fade-in-up animate-delay-500">
                {t("home.hero_variant_b.subtitle")}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4 animate-fade-in-up animate-delay-700">
                <Link
                  to="/auth"
                  className="rounded-md bg-brand-peach-light px-8 py-3 font-mono font-bold uppercase text-brand-blue-dark transition hover:bg-white active:scale-95"
                >
                  {t("home.hero_variant_b.cta_primary")}
                </Link>
                <Link
                  to="/events"
                  className="rounded-md border-2 border-white/80 px-8 py-3 font-mono font-bold uppercase text-white transition hover:bg-white/10 active:scale-95"
                >
                  {t("home.hero_variant_b.cta_secondary")}
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 font-mono text-sm font-bold uppercase tracking-widest text-[#f5c66b] animate-fade-in-up animate-delay-100">
                {t("home.hero_variant_a.eyebrow")}
              </p>
              <h1 className="mb-4 max-w-2xl font-display text-5xl font-bold leading-tight md:text-6xl animate-fade-in-up animate-delay-300">
                {t("home.hero_variant_a.title")}
              </h1>
              <p className="mx-auto max-w-xl font-mono text-base leading-relaxed md:text-lg text-white/90 animate-fade-in-up animate-delay-500">
                {t("home.hero_variant_a.subtitle")}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4 animate-fade-in-up animate-delay-700">
                <Link
                  to="/auth"
                  className="rounded-md bg-brand-peach-light px-8 py-3 font-mono font-bold uppercase text-brand-blue-dark transition hover:bg-white active:scale-95"
                >
                  {t("home.hero_variant_a.cta_primary")}
                </Link>
                <Link
                  to="/events"
                  className="rounded-md border-2 border-white/80 px-8 py-3 font-mono font-bold uppercase text-white transition hover:bg-white/10 active:scale-95"
                >
                  {t("home.hero_variant_a.cta_secondary")}
                </Link>
              </div>
            </>
          )}
        </motion.div>
      </section>

      <section className="bg-cream px-4 py-20 md:px-6 md:py-28 border-t-2 border-black">
        <div className="mx-auto max-w-7xl">
          <ScrollReveal>
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <SectionEyebrow>{t("home.featured_events.eyebrow")}</SectionEyebrow>
                <h2 className="mt-2 font-display text-4xl font-bold text-brand-blue-dark md:text-5xl">
                  {t("home.featured_events.title")}
                </h2>
              </div>
              <Link
                to="/events"
                className="neu-border inline-flex items-center justify-center bg-white px-6 py-3 font-mono text-sm font-bold uppercase transition hover:bg-brand-peach-light"
              >
                {t("home.featured_events.view_all")}
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
              <HomeEventFeed />
            )}
          </ScrollReveal>
        </div>
      </section>

      <section
        id="features"
        className="bg-lime px-4 py-20 md:px-6 md:py-32 border-3 border-black scroll-mt-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold text-red-900 md:text-6xl">
              {t("home.features.title")}
            </h2>
            <p className="mx-auto max-w-3xl font-mono text-lg leading-relaxed text-gray-800">
              {t("home.features.subtitle")}
            </p>
          </div>

          <div className="grid gap-12 md:grid-cols-4">
            {[
              {
                icon: <Icon name="club-management" className="h-16 w-16 text-brand-blue-dark" />,
                title: t("home.features.club_management.title"),
                desc: t("home.features.club_management.desc"),
              },
              {
                icon: <Icon name="event-planning" className="h-16 w-16 text-brand-peach-light" />,
                title: t("home.features.event_planning.title"),
                desc: t("home.features.event_planning.desc"),
              },
              {
                icon: (
                  <Icon name="digital-interaction" className="h-16 w-16 text-brand-emerald-base" />
                ),
                title: t("home.features.digital_interaction.title"),
                desc: t("home.features.digital_interaction.desc"),
              },
              {
                icon: <Icon name="star" className="h-16 w-16 text-brand-blue-base-500" />,
                title: t("home.features.certificates.title"),
                desc: t("home.features.certificates.desc"),
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

      <section className="bg-blue-300 border-t-2 border-gray-200 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>{t("home.about.eyebrow")}</SectionEyebrow>
          <h2 className="mb-12 max-w-2xl text-4xl font-bold text-red-900 md:text-5xl">
            {t("home.about.title")}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                n: "01",
                t: t("home.about.card_01_title"),
                d: t("home.about.card_01_desc"),
              },
              {
                n: "02",
                t: t("home.about.card_02_title"),
                d: t("home.about.card_02_desc"),
              },
              {
                n: "03",
                t: t("home.about.card_03_title"),
                d: t("home.about.card_03_desc"),
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

      <section className="bg-red-500 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { stat: "500+", label: t("home.stats.events_run") },
              { stat: "120", label: t("home.stats.active_clubs") },
              { stat: "12K+", label: t("home.stats.members_onboarded") },
              { stat: "100%", label: t("home.stats.open_source") },
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

      <section className="border-y-2 border-gray-200 bg-teal-600 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-12">
          <div>
            <ScrollReveal>
              <SectionEyebrow>{t("home.capabilities.eyebrow")}</SectionEyebrow>
              <h2 className="mb-4 font-display text-4xl font-bold text-brand-blue-dark md:text-5xl text-red-900">
                {t("home.capabilities.title")}
              </h2>
              <p className="font-mono text-gray-800 leading-relaxed mb-6">
                {t("home.capabilities.subtitle")}
              </p>
              <div className="neu-border bg-rose-200 p-6">
                <ul className="space-y-4">
                  {[
                    t("home.capabilities.list_1"),
                    t("home.capabilities.list_2"),
                    t("home.capabilities.list_3"),
                    t("home.capabilities.list_4"),
                    t("home.capabilities.list_5"),
                    t("home.capabilities.list_6"),
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
                    t: t("home.capabilities.pain_1_title"),
                    d: t("home.capabilities.pain_1_desc"),
                  },
                  {
                    t: t("home.capabilities.pain_2_title"),
                    d: t("home.capabilities.pain_2_desc"),
                  },
                  {
                    t: t("home.capabilities.pain_3_title"),
                    d: t("home.capabilities.pain_3_desc"),
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

      <section className="border-b-2 border-gray-200 bg-amber-200 px-4 py-16 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 font-mono text-lg uppercase tracking-widest text-amber-800 font-bold">
            {t("home.testimonial.eyebrow")}
          </p>
          <p className="mb-6 font-mono italic leading-relaxed text-gray-800">
            {t("home.testimonial.quote")}
          </p>
          <p className="font-display font-bold text-brand-blue-dark">
            {t("home.testimonial.attribution")}
          </p>
        </div>
      </section>

      <section className="bg-violet-400 border-b-2 border-gray-200 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>{t("home.landscape.eyebrow")}</SectionEyebrow>
          <h2 className="mb-12 max-w-2xl text-4xl font-bold text-red-900 md:text-5xl">
            {t("home.landscape.title")}
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              { t: t("home.landscape.vs_forms_title"), d: t("home.landscape.vs_forms_desc") },
              { t: t("home.landscape.vs_discord_title"), d: t("home.landscape.vs_discord_desc") },
              {
                t: t("home.landscape.vs_eventbrite_title"),
                d: t("home.landscape.vs_eventbrite_desc"),
              },
              { t: t("home.landscape.vs_portals_title"), d: t("home.landscape.vs_portals_desc") },
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

      <section className="bg-amber-500 px-4 py-20 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
          <div>
            <ScrollReveal>
              <SectionEyebrow>{t("home.hosting.eyebrow")}</SectionEyebrow>
              <h2 className="text-4xl font-bold text-red-900 md:text-5xl mb-6">
                {t("home.hosting.title")}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="neu-border bg-rose-200 p-5 border-l-4 border-l-[#123a57] transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-brand-blue-dark)]">
                  <p className="eyebrow font-bold text-gray-800">
                    {t("home.hosting.cloud_eyebrow")}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-blue-950">
                    {t("home.hosting.cloud_title")}
                  </h3>
                  <p className="mt-3 font-mono text-xs leading-relaxed text-gray-800">
                    {t("home.hosting.cloud_desc")}
                  </p>
                </div>
                <div className="neu-border bg-rose-200 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-ink)]">
                  <p className="eyebrow font-bold text-gray-800">
                    {t("home.hosting.selfhost_eyebrow")}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-blue-950">
                    {t("home.hosting.selfhost_title")}
                  </h3>
                  <p className="mt-3 font-mono text-xs leading-relaxed text-gray-800">
                    {t("home.hosting.selfhost_desc")}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>

          <div>
            <ScrollReveal delay={200}>
              <SectionEyebrow>{t("home.hosting.tech_eyebrow")}</SectionEyebrow>
              <h2 className="mb-6 text-4xl font-bold text-amber-900 md:text-5xl">
                {t("home.hosting.tech_title")}
              </h2>
              <div className="neu-border overflow-hidden bg-white transition-all duration-300 hover:shadow-[6px_6px_0_0_var(--color-brand-blue-dark)] hover:border-brand-blue-dark">
                <table className="w-full font-mono text-sm text-left">
                  <thead>
                    <tr className="bg-brand-blue-dark text-brand-yellow-bg-alt">
                      <th className="border-b-2 border-black p-4 font-bold">
                        {t("home.hosting.tech_layer")}
                      </th>
                      <th className="border-b-2 border-black p-4 font-bold">
                        {t("home.hosting.tech_choice")}
                      </th>
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

      <section className="bg-green-300 border-t-2 border-gray-200 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>{t("home.integrations.eyebrow")}</SectionEyebrow>
          <h2 className="mb-12 max-w-2xl text-4xl font-bold text-red-900 md:text-5xl">
            {t("home.integrations.title")}
          </h2>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { t: t("home.integrations.gcal_title"), d: t("home.integrations.gcal_desc") },
              { t: t("home.integrations.discord_title"), d: t("home.integrations.discord_desc") },
              { t: t("home.integrations.github_title"), d: t("home.integrations.github_desc") },
              { t: t("home.integrations.zapier_title"), d: t("home.integrations.zapier_desc") },
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

      <section
        id="faq"
        className="bg-teal-100 border-t-2 border-gray-200 px-4 py-20 md:px-6 scroll-mt-24"
      >
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <SectionEyebrow>{t("home.faq.eyebrow")}</SectionEyebrow>
            <h2 className="mt-2 text-4xl font-bold text-red-900 md:text-5xl">
              {t("home.faq.title")}
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {(["all", "general", "clubs", "events", "security"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setOpenIndex(null);
                }}
                className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase transition-all duration-200 active:scale-95 cursor-pointer ${
                  activeCategory === cat
                    ? "bg-black text-brand-yellow-bg-alt shadow-none translate-x-[2px] translate-y-[2px]"
                    : "bg-lime text-black hover:bg-gray-100 shadow-[2px_2px_0_0_var(--color-ink)]"
                }`}
              >
                {t(`home.faq.categories.${cat}`)}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredFAQs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={faq.qKey}
                  className="neu-border bg-orange-100 transition-all duration-300 overflow-hidden shadow-[4px_4px_0_0_var(--color-ink)] hover:shadow-[6px_6px_0_0_var(--color-brand-blue-dark)] hover:border-brand-blue-dark"
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left font-mono font-bold text-gray-900 hover:bg-gray-50/50 cursor-pointer"
                  >
                    <span className="text-base md:text-lg">{t(faq.qKey)}</span>
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
                      {t(faq.aKey)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-alt px-4 py-20 text-center text-white md:px-6 md:py-28">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-4 font-display text-4xl font-bold">{t("home.cta.title")}</h2>
            <p className="mb-8 font-mono leading-relaxed text-brand-yellow-bg-alt">
              {t("home.cta.subtitle")}
            </p>
            <Link
              to="/auth"
              className="inline-block rounded-md bg-brand-peach-light px-8 py-4 font-mono font-bold uppercase text-brand-blue-dark transition hover:bg-white active:scale-95"
            >
              {t("home.cta.button")}
            </Link>
          </div>
        </ScrollReveal>
      </section>
      <section
        id="contact"
        className="bg-white border-t-2 border-gray-200 px-4 py-20 md:px-6 scroll-mt-24"
      >
        <div className="mx-auto max-w-4xl text-center">
          <SectionEyebrow>{t("home.contact.eyebrow")}</SectionEyebrow>

          <h2 className="mt-2 text-4xl font-bold text-red-900 md:text-5xl">
            {t("home.contact.title")}
          </h2>

          <p className="mt-6 font-mono text-gray-700">{t("home.contact.subtitle")}</p>

          <a
            href="mailto:support@campusconnect.com"
            className="mt-8 inline-block neu-border bg-lime px-6 py-3 font-mono font-bold uppercase"
          >
            {t("home.contact.button")}
          </a>
        </div>
      </section>
    </SiteShell>
  );
}
