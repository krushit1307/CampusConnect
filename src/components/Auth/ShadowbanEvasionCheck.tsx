import { useEffect, useMemo, useRef } from "react";
import { useDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import { normalizeShadowbanFingerprint } from "@/lib/shadowbanEvasion";
import { createClient } from "@/lib/supabase/client";

export function ShadowbanEvasionCheck() {
  const supabase = useMemo(() => createClient(), []);
  const { visitorId, isLoading } = useDeviceFingerprint();
  const checkedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const fingerprint = normalizeShadowbanFingerprint(visitorId);
    if (!fingerprint) return;

    let cancelled = false;

    const checkSession = async (session: { access_token: string; user: { id: string } } | null) => {
      if (!session || cancelled) return;
      const checkKey = `${session.user.id}:${fingerprint}`;
      if (checkedKeyRef.current === checkKey) return;
      checkedKeyRef.current = checkKey;

      // A detector outage must never affect authentication or reveal whether a
      // signature matched. The Edge Function intentionally returns a generic
      // successful response for all handled cases.
      try {
        await supabase.functions.invoke("shadowban-evasion-check", {
          body: { deviceFingerprint: fingerprint },
          headers: { "X-Device-Fingerprint": fingerprint },
        });
      } catch {
        // This is a non-blocking abuse-signal check; ignore network failures.
      }
    };

    const loadInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await checkSession(session);
    };

    void loadInitialSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") void checkSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isLoading, supabase, visitorId]);

  return null;
}
