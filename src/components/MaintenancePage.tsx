import { useState } from "react";
import { Mail, RefreshCw } from "lucide-react";

interface MaintenancePageProps {
  /** Called when the user clicks "Try Again". Should re-run the DB health check. */
  onRetry?: () => void | Promise<void>;
}

export function MaintenancePage({ onRetry }: MaintenancePageProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <main
      role="alert"
      aria-live="polite"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-4 py-16 sm:px-6"
    >
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
      <div className="absolute -right-10 bottom-12 h-28 w-28 -rotate-12 border-4 border-black bg-lime shadow-[6px_6px_0_0_#000] sm:h-40 sm:w-40" />

      <section className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center text-center border-4 border-black bg-white p-6 shadow-[10px_10px_0_0_#000] sm:p-10">
        {/* Mascot */}
        <div className="relative mb-2 flex flex-col items-center">
          <div className="neu-border relative mb-3 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-[3px_3px_0_0_#000]">
            brb, fixing stuff
            <div className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-4 border-t-8 border-x-transparent border-t-black" />
          </div>
          <div className="neu-border flex h-24 w-28 flex-col items-center justify-center bg-peach p-2 shadow-[4px_4px_0_0_#000]">
            <div className="flex gap-4">
              <div className="h-3 w-3 rounded-full bg-black" />
              <div className="h-3 w-3 rounded-full bg-black" />
            </div>
            <div className="mt-3 font-mono text-xl font-bold leading-none">(-_-) zzz</div>
          </div>
        </div>

        {/* Copy */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <h1 className="font-display text-2xl font-black leading-snug text-black sm:text-3xl">
            Under Maintenance
          </h1>
          <p className="mx-auto max-w-xs font-mono text-xs leading-relaxed text-gray-700 sm:max-w-sm sm:text-sm">
            We couldn't reach CampusConnect's servers. We're on it — this usually clears up in a few
            minutes. Sit tight and try again shortly.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="neu-border bg-lime text-black hover:bg-lime/90 font-mono font-bold uppercase tracking-wider px-6 py-3 shadow-[4px_4px_0_0_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0_0_#000] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw
                aria-hidden="true"
                className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
              />
              {isRetrying ? "Checking..." : "Try Again"}
            </span>
          </button>

          {/* Add support email here. */}
          <a
            href=""
            className="neu-border bg-white text-black hover:bg-gray-50 font-mono font-bold uppercase tracking-wider px-6 py-3 shadow-[4px_4px_0_0_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0_0_#000]"
          >
            <span className="inline-flex items-center gap-2">
              <Mail aria-hidden="true" className="h-4 w-4" />
              Contact Support
            </span>
          </a>
        </div>

        <a
          href="https://github.com/krushit1307/CampusConnect/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 font-mono text-xs font-bold uppercase text-gray-600 underline underline-offset-4 hover:text-black"
        >
          Report a problem on GitHub
        </a>
      </section>
    </main>
  );
}

export default MaintenancePage;
