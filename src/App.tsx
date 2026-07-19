import { useEffect, useState } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
} from "react-router-dom";

// Layout
import Layout from "./components/Layout";
import { ErrorBoundary, RouteErrorBoundary } from "./components/ErrorBoundary";
import MaintenancePage from "./components/MaintenancePage";
import { createClient } from "./lib/supabase/client";
// Pages
import Index from "./routes/index";
import Auth from "./routes/auth";
import Certificates from "./routes/certificates";
import ClubsIndex from "./routes/clubs.index";
import ClubDetails from "./routes/clubs.$slug";
import ClubsLayout from "./routes/clubs";
import Dashboard from "./routes/dashboard";
import DashboardOverview from "./routes/dashboard.index";
import DashboardRsvps from "./routes/dashboard.rsvps";
import DashboardBookmarks from "./routes/dashboard.bookmarks";
import EventsIndex from "./routes/events";
import EventDetails from "./routes/events.$eventId";
import Feed from "./routes/feed";
import ForgotPassword from "./routes/forgot-password";
import ResetPassword from "./routes/reset-password";
import Settings from "./routes/settings";
import PendingClubsAdmin from "./routes/admin.clubs.pending";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Layout />} errorElement={<RouteErrorBoundary />}>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/certificates" element={<Certificates />} />

      <Route path="/clubs" element={<ClubsLayout />}>
        <Route index element={<ClubsIndex />} />
        <Route path=":slug" element={<ClubDetails />} />
      </Route>

      <Route path="/dashboard" element={<Dashboard />}>
        <Route index element={<DashboardOverview />} />
        <Route path="rsvps" element={<DashboardRsvps />} />
        <Route path="bookmarks" element={<DashboardBookmarks />} />
      </Route>

      <Route path="/events">
        <Route index element={<EventsIndex />} />
        <Route path=":eventId" element={<EventDetails />} />
      </Route>

      <Route path="/feed" element={<Feed />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/admin/clubs/pending" element={<PendingClubsAdmin />} />
    </Route>,
  ),
);

const DB_HEALTH_CHECK_TIMEOUT_MS = 8000;
const DB_RETRY_INTERVAL_MS = 15000;

type DbStatus = "checking" | "online" | "offline";

/**
 * Pings Supabase with a cheap, RLS-open HEAD request. Returns false if the
 * client throws (bad config, connection refused, DNS failure, etc.) or if
 * the request doesn't resolve within the timeout.
 */
async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const supabase = createClient();

    const healthCheck = supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Database health check timed out")),
        DB_HEALTH_CHECK_TIMEOUT_MS,
      ),
    );

    const { error } = (await Promise.race([healthCheck, timeout])) as Awaited
      typeof healthCheck
    >;

    if (error) {
      console.error("Database health check returned an error:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Database client threw while checking connection:", err);
    return false;
  }
}

export default function App() {
  const [dbStatus, setDbStatus] = useState<DbStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const runCheck = async () => {
      const isOnline = await checkDatabaseConnection();
      if (cancelled) return;

      setDbStatus(isOnline ? "online" : "offline");

      // Keep polling in the background so the app recovers automatically
      // once the outage clears, without the user needing to refresh.
      if (!isOnline) {
        retryTimer = setTimeout(runCheck, DB_RETRY_INTERVAL_MS);
      }
    };

    runCheck();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, []);

  if (dbStatus === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <div className="neu-border bg-white px-6 py-4 font-mono text-sm font-bold uppercase shadow-[4px_4px_0_0_#000]">
          Loading CampusConnect…
        </div>
      </main>
    );
  }

  if (dbStatus === "offline") {
    return (
      <MaintenancePage
        onRetry={async () => {
          const isOnline = await checkDatabaseConnection();
          setDbStatus(isOnline ? "online" : "offline");
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
