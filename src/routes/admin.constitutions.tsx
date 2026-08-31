import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import { ConstitutionReviewDashboard } from "@/components/admin/ConstitutionReviewDashboard";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";

export default function ConstitutionReviewAdmin() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let active = true;
    const initialise = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUser(currentUser);
      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .maybeSingle();
        if (active) setRole(profile?.role ?? null);
      }
      if (active) setAuthChecked(true);
    };
    void initialise();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (authChecked && (!user || role !== "student_union_admin")) {
    return <Navigate to="/" replace />;
  }

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-amber-100 px-4 py-12 md:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-black/65">
            Student Union moderation
          </p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase md:text-6xl">
            Constitution review
          </h1>
          <p className="mt-3 max-w-2xl font-mono text-sm text-black/70">
            Review policy violations and inspect exact paragraphs flagged as highly similar to
            active club constitutions.
          </p>
        </div>
      </section>
      {authChecked ? <ConstitutionReviewDashboard /> : null}
    </SiteShell>
  );
}
