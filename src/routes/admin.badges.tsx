// =============================================================================
// Route: /admin/badges
// Issue: #3171 - Develop a 'Custom Interactive Badges' Editor
// Description: Admin-only page hosting the Badge Studio, where the Student
// Union can visually design and publish new gamification badges.
// =============================================================================

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { withAuth, WithAuthProps } from "@/hoc/withAuth";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import { BadgeStudio } from "@/components/gamification/BadgeStudio";

function AdminBadgesPage({ user }: WithAuthProps) {
  const supabase = createClient();
  const [role, setRole] = useState<string | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchRole() {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile && active) setRole(profile.role);
      } catch (err) {
        console.error("Failed to load user role:", err);
      } finally {
        if (active) setIsRoleLoading(false);
      }
    }
    void fetchRole();
    return () => {
      active = false;
    };
  }, [user.id, supabase]);

  if (isRoleLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white font-mono">
        Loading admin profile...
      </div>
    );
  }

  if (role !== "system_admin" && role !== "admin") {
    return (
      <SiteShell>
        <section className="bg-cream px-4 py-20 md:px-6">
          <div className="neu-border mx-auto max-w-2xl bg-white p-8 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-black" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-bold text-black uppercase tracking-tight">
              Admin access required
            </h1>
            <p className="mt-3 font-mono text-sm leading-6 text-gray-700">
              Only system administrators can access the Badge Studio.
            </p>
            <Link
              to="/dashboard"
              className="neu-border inline-block bg-black px-5 py-3 font-mono text-xs font-bold uppercase text-cream mt-6"
            >
              Return to Dashboard
            </Link>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-6xl">
          <BadgeStudio />
        </div>
      </section>
    </SiteShell>
  );
}

export default withAuth(AdminBadgesPage);