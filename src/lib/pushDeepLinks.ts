const PENDING_DEEP_LINK_KEY = "campusconnect.pending_deep_link";
const NOTIFICATION_ROUTE_PARAM = "notification_route";

export interface PushNavigationMessage {
  type: "CAMPUSCONNECT_PUSH_DEEP_LINK";
  target_route?: unknown;
}

/**
 * Accept only same-origin, application-relative routes from notification data.
 * This prevents a compromised payload from turning a notification click into
 * an open redirect.
 */
export function normalizePushTargetRoute(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  try {
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin || target.pathname.includes("\\")) {
      return null;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function getNotificationRouteFromUrl(search = window.location.search): string | null {
  return normalizePushTargetRoute(new URLSearchParams(search).get(NOTIFICATION_ROUTE_PARAM));
}

export function savePendingDeepLink(targetRoute: string): void {
  localStorage.setItem(PENDING_DEEP_LINK_KEY, targetRoute);
}

export function takePendingDeepLink(): string | null {
  const targetRoute = normalizePushTargetRoute(localStorage.getItem(PENDING_DEEP_LINK_KEY));
  localStorage.removeItem(PENDING_DEEP_LINK_KEY);
  return targetRoute;
}

/** Gives notification destinations a meaningful first Back destination. */
export function getDeepLinkParentRoute(targetRoute: string): string | null {
  if (/^\/forum\/post\/[^/]+/.test(targetRoute)) return "/forum";
  if (/^\/events\/[^/]+/.test(targetRoute)) return "/events";
  return null;
}

export function createNotificationLaunchUrl(
  targetRoute: string,
  origin = self.location.origin,
): string {
  const url = new URL("/", origin);
  url.searchParams.set(NOTIFICATION_ROUTE_PARAM, targetRoute);
  return url.toString();
}
