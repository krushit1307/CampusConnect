import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { ArrowLeft, Home, MapPinned } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ScrollToTop } from "@/components/ScrollToTop";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { createClient } from "../lib/supabase/client";
import { ThemeProvider } from "../components/ThemeToggle";

function NotFoundComponent() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-4 py-12 sm:px-6">
      <div
        aria-hidden="true"
        className="absolute -left-12 top-10 h-32 w-32 rotate-12 border-2 border-black bg-sky sm:h-44 sm:w-44"
      />
      <div
        aria-hidden="true"
        className="absolute -right-10 bottom-12 h-28 w-28 -rotate-12 border-2 border-black bg-peach sm:h-40 sm:w-40"
      />

      <section className="relative z-10 w-full max-w-4xl border-2 border-black bg-white p-5 shadow-[8px_8px_0_0_#000] sm:p-8 lg:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <div className="relative mx-auto flex aspect-square w-full max-w-72 items-center justify-center border-2 border-black bg-lavender shadow-[6px_6px_0_0_#000]">
            <div className="absolute left-4 top-4 border-2 border-black bg-lime px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.18em]">
              Lost route
            </div>
            <MapPinned aria-hidden="true" className="h-28 w-28 stroke-[1.5] sm:h-36 sm:w-36" />
            <span className="absolute -bottom-5 -right-3 rotate-3 border-2 border-black bg-peach px-4 py-2 font-display text-3xl font-bold shadow-[3px_3px_0_0_#000] sm:text-4xl">
              404
            </span>
          </div>

          <div className="text-center lg:text-left">
            <p className="eyebrow mb-3">CampusConnect navigation desk</p>
            <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl">This page skipped class.</h1>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base lg:mx-0">
              The page you are looking for does not exist, may have moved, or the link may be
              incorrect. Let&apos;s get you back to the campus feed.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                to="/"
                className="neu-press inline-flex items-center justify-center gap-2 border-2 border-black bg-lime px-5 py-3 font-mono text-sm font-bold uppercase tracking-wide shadow-[4px_4px_0_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                <Home aria-hidden="true" className="h-4 w-4" />
                Go back home
              </Link>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="neu-press inline-flex items-center justify-center gap-2 border-2 border-black bg-sky px-5 py-3 font-mono text-sm font-bold uppercase tracking-wide shadow-[4px_4px_0_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Previous page
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn&apos;t load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CampusConnect — Community & event OS for college clubs" },
      {
        name: "description",
        content:
          "Open-source community and event management platform for college clubs and tech communities. Run events, grow clubs, issue certificates.",
      },
      { name: "author", content: "CampusConnect" },
      { property: "og:title", content: "CampusConnect — Community & event OS for college clubs" },
      {
        property: "og:description",
        content:
          "Open-source community and event management for college clubs and tech communities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@CampusConnect" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <ScrollToTop />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
