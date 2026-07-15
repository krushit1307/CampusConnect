import { Link } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

function GradientCode({ code }: { code: string }) {
  return (
    <svg
      viewBox="0 0 800 240"
      className="w-full max-w-[18rem] select-none sm:max-w-md"
      aria-hidden="true"
    >
      {/* Neobrutalist Solid Shadow Text */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-black font-black tracking-tighter"
        style={{ fontSize: "16rem", transform: "translate(6px, 6px)" }}
      >
        {code}
      </text>
      {/* Front Outline/Dashed Text */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-lime stroke-black font-black tracking-tighter"
        style={{ fontSize: "16rem" }}
        strokeWidth="6"
        strokeDasharray="24 12"
      >
        {code}
      </text>
    </svg>
  );
}

export function NotFoundPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-4 py-16 sm:px-6">
      {/* Dotted Grid Background */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, black 2.5px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Floating Neobrutalist Background Shapes */}
      <div className="absolute -left-12 top-10 h-32 w-32 rotate-12 border-4 border-black bg-sky shadow-[6px_6px_0_0_#000] sm:h-44 sm:w-44" />
      <div className="absolute -right-10 bottom-12 h-28 w-28 -rotate-12 border-4 border-black bg-peach shadow-[6px_6px_0_0_#000] sm:h-40 sm:w-40" />

      <section className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center text-center border-4 border-black bg-white p-6 shadow-[10px_10px_0_0_#000] sm:p-10">
        {/* Lime Squared Grid Background inside the Card */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-25"
          style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 19px, var(--lime) 19px, var(--lime) 20px),
              repeating-linear-gradient(90deg, transparent, transparent 19px, var(--lime) 19px, var(--lime) 20px)
            `,
            backgroundSize: "20px 20px, 20px 20px",
          }}
        />

        {/* Content Wrapper */}
        <div className="relative z-10 flex w-full flex-col items-center">
          {/* Cute Lost Mascot */}
          <div className="relative mb-2 flex flex-col items-center">
            {/* Speech Bubble */}
            <div className="neu-border relative mb-3 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-[3px_3px_0_0_#000]">
              Where are we?
              <div className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-4 border-t-8 border-x-transparent border-t-black" />
            </div>

            {/* Mascot Box */}
            <div className="neu-border flex h-24 w-28 flex-col items-center justify-center bg-peach p-2 shadow-[4px_4px_0_0_#000]">
              {/* Eyes */}
              <div className="flex gap-4">
                <div className="h-3 w-3 rounded-full bg-black animate-pulse" />
                <div className="h-3 w-3 rounded-full bg-black animate-pulse" />
              </div>
              {/* Squiggly Sad Mouth */}
              <div className="mt-3 font-mono text-xl font-bold leading-none">(﹏)</div>
            </div>
          </div>

          {/* Giant dashed SVG code */}
          <GradientCode code="404" />

          {/* Text Details */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <h1 className="font-display text-2xl font-black leading-snug text-black sm:text-3xl">
              No, no, that's right.
            </h1>
            <p className="mx-auto max-w-xs font-mono text-xs leading-relaxed text-gray-700 sm:max-w-sm sm:text-sm">
              This is a 404 page. And this page exists, no matter what anyone says.
            </p>
          </div>

          {/* Navigation Action */}
          <Button
            asChild
            className="neu-border mt-8 bg-lime text-black hover:bg-lime/90 font-mono font-bold uppercase tracking-wider px-6 py-3 h-auto shadow-[4px_4px_0_0_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0_0_#000]"
          >
            <Link to="/">
              <Home aria-hidden="true" className="mr-2 h-4 w-4" />
              Go back home
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export default NotFoundPage;
