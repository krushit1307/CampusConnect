import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import ChatBox from "@/components/Messages/ChatBox";
import type { User } from "@supabase/supabase-js";

export default function MessagesRoute() {
  const [supabase] = useState(() => createClient());
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate("/auth", { replace: true });
      } else {
        setUser(user);
      }
    });
  }, [navigate, supabase]);

  if (!user) {
    return (
      <SiteShell>
        <div className="flex h-[60vh] items-center justify-center font-mono text-sm">
          Checking authorization...
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="bg-cream dark:bg-zinc-900 min-h-[80vh] py-6">
        <ChatBox />
      </div>
    </SiteShell>
  );
}
