import { Suspense, lazy, useEffect, useState } from "react";

import { AnimatePresence } from "framer-motion";
import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
  useLocation,
  Outlet,
} from "react-router-dom";

// Layout & Core Components (Loaded eagerly)
import Layout from "./components/Layout";
import { ErrorBoundary, RouteErrorBoundary } from "./components/ErrorBoundary";
import { PageWrapper } from "./components/PageWrapper";

// Pages
import Index from "./routes/index";
import Auth from "./routes/auth";
import Certificates from "./routes/certificates";
import ClubsIndex from "./routes/clubs.index";
import ClubDetails from "./routes/clubs.$slug";
import ClubManageRoute from "./routes/clubs.$slug.manage";
import ClubsLayout from "./routes/clubs";
import Dashboard from "./routes/dashboard";
import DashboardOverview from "./routes/dashboard.index";
import DashboardRsvps from "./routes/dashboard.rsvps";
import DashboardBookmarks from "./routes/dashboard.bookmarks";
import DashboardCalendar from "./routes/dashboard.calendar";
import Feed from "./routes/feed";
import EventsMapPage from "./routes/events.map";
import ForgotPassword from "./routes/forgot-password";
import ResetPassword from "./routes/reset-password";
import Settings from "./routes/settings";
import VerifyEmail from "./routes/verify-email";
import PendingClubsAdmin from "./routes/admin.clubs.pending";
import AdminReportsPage from "./routes/admin.reports";
import AdminUsersPage from "./routes/admin.users";
import { NotFoundPage } from "./components/NotFoundPage";
import { createClient } from "./lib/supabase/client";

const HEALTH_CHECK_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_HEALTH_URL) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_HEALTH_URL) ||
  "/api/health";

const HEALTH_CHECK_TIMEOUT = 8000; // 8 seconds

interface HealthStatus {
  ok: boolean;
  error?: string;
}

async function checkDatabaseHealth(): Promise<HealthStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    const response = await fetch(HEALTH_CHECK_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        ok: false,
        error: `Server responded with status ${response.status} (${response.statusText})`,
      };
    }

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// Lazy-loaded Routes / Pages
const Index = lazy(() => import("./routes/index"));
const Auth = lazy(() => import("./routes/auth"));
const Certificates = lazy(() => import("./routes/certificates"));
const ClubsIndex = lazy(() => import("./routes/clubs.index"));
const ClubDetails = lazy(() => import("./routes/clubs.$slug"));
const ClubManageRoute = lazy(() => import("./routes/clubs.$slug.manage"));
const ClubsLayout = lazy(() => import("./routes/clubs"));
const Dashboard = lazy(() => import("./routes/dashboard"));
const DashboardOverview = lazy(() => import("./routes/dashboard.index"));
const DashboardRsvps = lazy(() => import("./routes/dashboard.rsvps"));
const DashboardBookmarks = lazy(() => import("./routes/dashboard.bookmarks"));
const DashboardCalendar = lazy(() => import("./routes/dashboard.calendar"));
const Feed = lazy(() => import("./routes/feed"));
const EventsMapPage = lazy(() => import("./routes/events.map"));
const ForgotPassword = lazy(() => import("./routes/forgot-password"));
const ResetPassword = lazy(() => import("./routes/reset-password"));
const Settings = lazy(() => import("./routes/settings"));
const VerifyEmail = lazy(() => import("./routes/verify-email"));
const MessagesRoute = lazy(() => import("./routes/messages"));
const PendingClubsAdmin = lazy(() => import("./routes/admin.clubs.pending"));
const AdminReportsPage = lazy(() => import("./routes/admin.reports"));
const ChallengeArena = lazy(() => import("./routes/challenge"));
const EventDashboard = lazy(() => import("./routes/events.$eventId.dashboard"));
const Leaderboard = lazy(() =>
  import("./components/Leaderboard").then((m) => ({ default: m.Leaderboard })),
);

const LazyEventsIndex = lazy(() => import("./routes/events"));
const LazyEventDetails = lazy(() => import("./routes/events.$eventId"));

function PageFallback() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated Outlet Wrapper for Framer Motion transitions
// ---------------------------------------------------------------------------
function AnimatedOutlet() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <PageWrapper key={location.pathname}>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </PageWrapper>
    </AnimatePresence>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Layout />} errorElement={<RouteErrorBoundary />}>
      <Route element={<AnimatedOutlet />}>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/certificates" element={<Certificates />} />

        <Route path="/clubs" element={<ClubsLayout />}>
          <Route index element={<ClubsIndex />} />
          <Route path=":slug" element={<ClubDetails />} />
          <Route path=":slug/manage" element={<ClubManageRoute />} />
        </Route>

        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<DashboardOverview />} />
          <Route path="rsvps" element={<DashboardRsvps />} />
          <Route path="bookmarks" element={<DashboardBookmarks />} />
          <Route path="calendar" element={<DashboardCalendar />} />
        </Route>

        <Route path="/events" element={<LazyEventsIndex />} />
        <Route path="/events/:eventId" element={<LazyEventDetails />} />
        <Route path="/events/:eventId/dashboard" element={<EventDashboard />} />
        {/* Events Map View with clustering */}
        <Route path="/events/map" element={<EventsMapPage />} />
        <Route path="/challenge" element={<ChallengeArena />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

        <Route path="/feed" element={<Feed />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/messages" element={<MessagesRoute />} />
        <Route path="/admin/clubs/pending" element={<PendingClubsAdmin />} />
        <Route path="/admin/reports" element={<AdminReportsPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>,
  ),
);

const DB_HEALTH_CHECK_TIMEOUT_MS = 8000;
const DB_RETRY_INTERVAL_MS = 15000;

type DbStatus = "checking" | "online" | "offline";

async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const supabase = createClient();

    const healthCheck = supabase.from("profiles").select("id", { count: "exact", head: true });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Database health check timed out")),
        DB_HEALTH_CHECK_TIMEOUT_MS,
      ),
    );

    type HealthCheckResult = Awaited<typeof healthCheck>;
    const { error } = (await Promise.race([healthCheck, timeout])) as HealthCheckResult;

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
    let timer: ReturnType<typeof setTimeout>;

    const verify = async () => {
      const isOnline = await checkDatabaseConnection();
      setDbStatus(isOnline ? "online" : "offline");
      if (!isOnline) {
        timer = setTimeout(verify, DB_RETRY_INTERVAL_MS);
      }
    };

    verify();

    return () => clearTimeout(timer);
  }, []);

  if (dbStatus === "offline") {
    return <MaintenancePage />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
