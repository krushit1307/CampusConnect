import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { ArrowLeft, Home, MapPinned } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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

      <div className="neu-border relative z-10 max-w-md bg-white p-8 text-center sm:p-10">
        <div className="neu-border mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-lavender">
          <MapPinned className="h-8 w-8" strokeWidth={2.5} />
        </div>

        <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">
          Error 404
        </p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Page not found</h1>
        <p className="mt-3 text-sm text-gray-600 sm:text-base">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="neu-border neu-press inline-flex items-center justify-center gap-2 bg-black px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-cream"
          >
            <Home className="h-4 w-4" strokeWidth={2.5} />
            Go home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="neu-border neu-press inline-flex items-center justify-center gap-2 bg-white px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
            Go back
          </button>
        </div>
      </div>
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

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="neu-border neu-press inline-flex items-center justify-center gap-2 bg-black px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-cream"
          >
            Try again
          </button>
          <Link
            to="/"
            className="neu-border neu-press inline-flex items-center justify-center gap-2 bg-white px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider"
          >
            <Home className="h-4 w-4" strokeWidth={2.5} />
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CampusConnect Hub" },
      {
        name: "description",
        content:
          "Open-source community and event management platform for college clubs and tech communities. Run events, grow clubs, issue certificates.",
      },
      { name: "author", content: "CampusConnect" },
      { property: "og:title", content: "CampusConnect Hub" },
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
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap",
      },
    ],
  }),
  notFoundComponent: NotFoundComponent,
  shellComponent: RootShell,
  component: RootComponent,
  errorComponent: ErrorComponent,
});

function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border-2 focus:border-black focus:bg-lime focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:font-bold focus:uppercase focus:tracking-wide focus:shadow-[4px_4px_0_0_#000] focus:outline-none"
    >
      Skip to content
    </a>
  );
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider delayDuration={200}>
          <SkipToContent />
          {children}
          <Toaster />
          <ScrollToTop />
        </TooltipProvider>
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
