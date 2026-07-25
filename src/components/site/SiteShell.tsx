import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

export function SiteShell({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const emailVerified = useEmailVerification();

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

  const isEmailUnverified = !!user && !emailVerified;

  return (
    <div className="college-shell flex min-h-screen flex-col bg-cream text-black transition-colors dark:bg-brand-gray-base-900 dark:text-cream">
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
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
