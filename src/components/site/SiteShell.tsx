import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import * as JoyrideModule from "react-joyride";
const JoyrideComponent =
  (JoyrideModule as any).default || (JoyrideModule as any).Joyride || JoyrideModule;
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { BugReportWidget } from "@/components/BugReportWidget";
import { AutoBreadcrumbs } from "@/components/ui/AutoBreadcrumbs";
import { LiveAnnouncer } from "@/components/events/LiveAnnouncer";

export function SiteShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const emailVerified = useEmailVerification();
  const [hasCompletedTour, setHasCompletedTour] = useState<boolean>(
    () => localStorage.getItem("hasCompletedTour") === "true",
  );

  // Automated session inactivity timeout (30 mins default, triggers Supabase signOut)
  useIdleTimeout({
    onTimeout: async () => {
      if (user) {
        await supabase.auth.signOut();
        localStorage.clear();
        sessionStorage.clear();
        navigate("/login?reason=timeout", { replace: true });
      }
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleJoyrideCallback = (data: Record<string, unknown>) => {
    const { status } = data as { status: string };
    const finishedStatuses: string[] = ["finished", "skipped"];

    if (finishedStatuses.includes(status)) {
      setHasCompletedTour(true);
      localStorage.setItem("hasCompletedTour", "true");
      if (user) {
        supabase
          .from("profiles")
          .update({ has_completed_tour: true })
          .eq("id", user.id)
          .then(({ error }) => {
            if (error) {
              console.error("Failed to save tour completion status:", error.message);
            }
          });
      }
    }
  };

  const steps = [
    {
      target: ".navbar-logo",
      content: "Welcome to CampusConnect! Let's take a quick tour to help you get started.",
      disableBeacon: true,
    },
    {
      target: "#nav-link-events",
      content:
        "Discover exciting events happening around campus. RSVP, check-in, or join waitlists.",
    },
    {
      target: "#nav-link-clubs",
      content: "Browse student clubs, check membership statuses, or explore club details.",
    },
    {
      target: "#nav-link-feed",
      content: "See what's trending, post updates, comment on discussions, and react to posts.",
    },
    {
      target: "#nav-link-dashboard",
      content: "Track your personal RSVPs, saved bookmarks, and events calendar in your dashboard.",
    },
    {
      target: "#nav-profile-trigger",
      content:
        "Access your profile configuration, view achievements, or change application settings.",
    },
  ];

  const isEmailUnverified = !!user && !emailVerified;

  return (
    <div className="college-shell flex min-h-screen flex-col bg-cream text-black transition-colors dark:bg-brand-gray-base-900 dark:text-cream">
      <JoyrideComponent
        steps={steps}
        run={!hasCompletedTour}
        continuous
        showSkipButton
        showProgress
        callback={handleJoyrideCallback}
        styles={
          {
            options: {
              arrowColor: "#fff",
              backgroundColor: "#fff",
              overlayColor: "rgba(0, 0, 0, 0.65)",
              primaryColor: "#a3e635",
              textColor: "#000",
              zIndex: 10000,
            },
            tooltip: {
              borderRadius: "0px",
              border: "3px solid #000",
              fontFamily: "monospace",
              boxShadow: "6px 6px 0px 0px #000",
              padding: "20px",
            },
            tooltipContainer: {
              textAlign: "left",
            },
            buttonNext: {
              backgroundColor: "#a3e635",
              borderRadius: "0px",
              color: "#000",
              border: "2px solid #000",
              fontFamily: "monospace",
              fontWeight: "bold",
              boxShadow: "2px 2px 0px 0px #000",
              outline: "none",
            },
            buttonBack: {
              color: "#000",
              fontFamily: "monospace",
              fontWeight: "bold",
              marginRight: "12px",
            },
            buttonSkip: {
              color: "#666",
              fontFamily: "monospace",
              fontWeight: "bold",
            },
          } as any
        }
      />
      <LiveAnnouncer />
      <Navbar />
      {isEmailUnverified && (
        <div
          role="alert"
          className="neu-border border-x-0 border-t-0 bg-peach px-4 py-3 text-center font-mono text-sm font-bold uppercase text-black"
        >
          Please verify your email to RSVP to events and create posts. Check your inbox for the
          confirmation link.
        </div>
      )}
      <main id="main-content" tabIndex={-1} className="flex-1 pb-16 md:pb-0">
        <AutoBreadcrumbs />
        {children}
      </main>
      <Footer />
      <BugReportWidget />
    </div>
  );
}
