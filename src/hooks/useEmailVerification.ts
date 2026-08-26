import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useEmailVerification() {
  const supabase = createClient();
  const [emailVerified, setEmailVerified] = useState(true); // default to true to prevent flash of disabled state

  useEffect(() => {
    const checkVerification = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setEmailVerified(!!user.email_confirmed_at);
      }
    };

    checkVerification();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setEmailVerified(!!session.user.email_confirmed_at);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return emailVerified;
}
