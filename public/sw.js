const NOTIFICATION_ROUTE_PARAM = "notification_route";
const PUSH_DEEP_LINK_MESSAGE = "CAMPUSCONNECT_PUSH_DEEP_LINK";

function normalizeTargetRoute(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const target = new URL(value, self.location.origin);
    return target.origin === self.location.origin && !target.pathname.includes("\\")
      ? `${target.pathname}${target.search}${target.hash}`
      : null;
  } catch {
    return null;
  }
}

function createLaunchUrl(targetRoute) {
  const url = new URL("/", self.location.origin);
  url.searchParams.set(NOTIFICATION_ROUTE_PARAM, targetRoute);
  return url.toString();
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "CampusConnect", body: event.data.text() };
  }

  const targetRoute = normalizeTargetRoute(
    payload.target_route || payload.data?.target_route || payload.data?.url || payload.url,
  );
  const options = {
    body: payload.body || payload.message || "You have a new notification.",
    icon: payload.icon || "/icon-192x192.png",
    badge: payload.badge || "/icon-192x192.png",
    data: { target_route: targetRoute },
    tag: payload.tag || "campusconnect-notification",
  };
  event.waitUntil(self.registration.showNotification(payload.title || "CampusConnect", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetRoute = normalizeTargetRoute(event.notification.data?.target_route) || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      const client = windowClients[0];
      if (client) {
        await client.focus();
        client.postMessage({ type: PUSH_DEEP_LINK_MESSAGE, target_route: targetRoute });
        return;
      }
      return clients.openWindow(createLaunchUrl(targetRoute));
    }),
  );
});
