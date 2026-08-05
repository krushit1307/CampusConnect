import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useInView,
} from "framer-motion";
import { Users, MessageSquare, CalendarCheck, TrendingUp, RefreshCw } from "lucide-react";

/* ---------------------------------------------------------------
   AnimatedCounter
   - useMotionValue(0) holds the raw number outside React state
   - useSpring wraps it in physics (fast spin-up, damped settle)
   - useTransform formats it (commas) on Framer's render loop
   - bound to <motion.span>, so Framer writes to the DOM node
     directly — React never re-renders on the 60fps tick
----------------------------------------------------------------*/
function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  springConfig = { stiffness: 100, damping: 50 },
  className = "",
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });

  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, springConfig);

  const displayValue = useTransform(springValue, (latest) =>
    prefix + Math.round(latest).toLocaleString("en-US") + suffix
  );

  useEffect(() => {
    if (isInView) motionValue.set(value);
  }, [isInView, value, motionValue]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      motionValue.jump(value);
    }
  }, [value, motionValue]);

  return (
    <motion.span ref={ref} className={className}>
      {displayValue}
    </motion.span>
  );
}

/* ---------------------------------------------------------------
   Demo: Global Feed stat cards, styled like a campus ID card /
   bulletin board strip — ink navy ground, a single warm brass
   accent, monospace figures for the "data" feel, serif for label.
----------------------------------------------------------------*/
const STATS = [
  { icon: Users, label: "Active Members", value: 5432, suffix: "" },
  { icon: MessageSquare, label: "Posts This Week", value: 18209, suffix: "" },
  { icon: CalendarCheck, label: "Events Hosted", value: 312, suffix: "" },
  { icon: TrendingUp, label: "Engagement Rate", value: 94, suffix: "%" },
];

export default function GlobalFeedStatsDemo() {
  const [replayKey, setReplayKey] = useState(0);

  return (
    <div
      style={{
        background: "#12131a",
        minHeight: "100%",
        padding: "48px 20px",
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600&family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;500&display=swap');
        .cc-eyebrow { font-family: 'JetBrains Mono', monospace; letter-spacing: 0.18em; }
        .cc-label   { font-family: 'Fraunces', serif; }
        .cc-figure  { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
        .cc-card { transition: transform 0.25s ease, border-color 0.25s ease; }
        .cc-card:hover { transform: translateY(-3px); border-color: #C6A15B55; }
      `}</style>

      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              className="cc-eyebrow"
              style={{ color: "#C6A15B", fontSize: 11, marginBottom: 8 }}
            >
              GLOBAL FEED — LIVE
            </div>
            <h1
              className="cc-label"
              style={{
                color: "#F3EFE6",
                fontSize: 30,
                fontWeight: 600,
                margin: 0,
              }}
            >
              CampusConnect, right now
            </h1>
          </div>

          <button
            onClick={() => setReplayKey((k) => k + 1)}
            className="cc-eyebrow"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              border: "1px solid #C6A15B55",
              color: "#C6A15B",
              fontSize: 11,
              padding: "8px 14px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={13} strokeWidth={2.25} />
            REPLAY COUNT-UP
          </button>
        </div>

        <div
          key={replayKey}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 14,
          }}
        >
          {STATS.map(({ icon: Icon, label, value, suffix }) => (
            <div
              key={label}
              className="cc-card"
              style={{
                background: "#191b24",
                border: "1px solid #2A2D3A",
                borderRadius: 14,
                padding: "22px 20px",
              }}
            >
              <Icon size={18} color="#C6A15B" strokeWidth={1.75} />
              <div
                className="cc-figure"
                style={{
                  color: "#F3EFE6",
                  fontSize: 34,
                  fontWeight: 700,
                  marginTop: 14,
                  lineHeight: 1,
                }}
              >
                <AnimatedCounter value={value} suffix={suffix} />
              </div>
              <div
                className="cc-eyebrow"
                style={{
                  color: "#8B8E9C",
                  fontSize: 10.5,
                  marginTop: 10,
                }}
              >
                {label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        <p
          style={{
            color: "#5B5E6C",
            fontSize: 12,
            marginTop: 24,
            lineHeight: 1.6,
          }}
        >
          Scroll this card out of view and back in, or hit "replay" — each
          number spins up from zero on a damped spring and settles without
          overshoot. React renders once; Framer Motion drives the DOM
          directly on every animation frame.
        </p>
      </div>
    </div>
  );
}
