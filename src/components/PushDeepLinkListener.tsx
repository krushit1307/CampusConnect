import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getDeepLinkParentRoute,
  getNotificationRouteFromUrl,
  normalizePushTargetRoute,
  savePendingDeepLink,
  takePendingDeepLink,
  type PushNavigationMessage,
} from "@/lib/pushDeepLinks";
import type { Router } from "react-router-dom";

interface PushDeepLinkListenerProps {
  router: Router;
}

/** Coordinates service-worker notification clicks with auth initialization. */
export function PushDeepLinkListener({ router }: PushDeepLinkListenerProps) {
  useEffect(() => {
    const supabase = createClient();
    let disposed = false;

    const navigateToTarget = async (targetRoute: string) => {
      const parentRoute = getDeepLinkParentRoute(targetRoute);
      if (parentRoute && router.state.location.pathname !== parentRoute) {
        await router.navigate(parentRoute, { replace: true });
      }
      await router.navigate(targetRoute);
    };

    const handleTarget = async (candidate: unknown) => {
      const targetRoute = normalizePushTargetRoute(candidate);
      if (!targetRoute || disposed) return;

      const { data } = await supabase.auth.getSession();
      if (disposed) return;
      if (data.session) {
        await navigateToTarget(targetRoute);
        return;
      }

      savePendingDeepLink(targetRoute);
      await router.navigate("/auth", { replace: true });
    };

    const initialRoute = getNotificationRouteFromUrl();
    if (initialRoute) void handleTarget(initialRoute);

    const onMessage = (event: MessageEvent<PushNavigationMessage>) => {
      if (event.data?.type === "CAMPUSCONNECT_PUSH_DEEP_LINK") {
        void handleTarget(event.data.target_route);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        const targetRoute = takePendingDeepLink();
        if (targetRoute) void navigateToTarget(targetRoute);
      }
    });

    return () => {
      disposed = true;
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      authSubscription.subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
