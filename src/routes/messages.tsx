import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import ChatBox from "@/components/Messages/ChatBox";
import type { User } from "@supabase/supabase-js";
import { CatererChatModal } from "@/components/events/CatererChatModal";

export default function MessagesRoute() {
  const [supabase] = useState(() => createClient());
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const catererChatId = searchParams.get("caterer_chat");

  const closeCatererChat = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("caterer_chat");
    setSearchParams(nextParams);
  };

  return (
    <SiteShell>
      <div className="bg-cream dark:bg-zinc-900 min-h-[80vh] py-6 relative">
        <ChatBox />

        {catererChatId && <CatererChatModal chatId={catererChatId} onClose={closeCatererChat} />}
      </div>
    </SiteShell>
  );
}
