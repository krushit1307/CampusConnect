import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import { FeedbackSafetyAlertDashboard } from "@/components/admin/FeedbackSafetyAlertDashboard";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";

export default function FeedbackSafetyAdmin() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [isReviewer, setIsReviewer] = useState(false);
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
        const { data: reviewer } = await supabase.rpc("is_feedback_safety_reviewer", {
          p_user_id: currentUser.id,
        });
        if (active) setIsReviewer(Boolean(reviewer));
      }
      if (active) setAuthChecked(true);
    };
    void initialise();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (authChecked && (!user || !isReviewer)) return <Navigate to="/" replace />;

  return (
    <SiteShell>
      <FeedbackSafetyAlertDashboard />
    </SiteShell>
  );
}
