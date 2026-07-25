import { useEffect, useState, useCallback, lazy, Suspense } from "react";

import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
} from "react-router-dom";

// Layout & Non-lazy Components
import Layout from "./components/Layout";
import { ErrorBoundary, RouteErrorBoundary } from "./components/ErrorBoundary";
import MaintenancePage from "./components/MaintenancePage";
import { createClient } from "./lib/supabase/client";
import { NotFoundPage } from "./components/NotFoundPage";

// Lazy-loaded Pages / Components
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
const EventsIndex = lazy(() => import("./routes/events"));
const EventDetails = lazy(() => import("./routes/events.$eventId"));
const Feed = lazy(() => import("./routes/feed"));
const ForgotPassword = lazy(() => import("./routes/forgot-password"));
const ResetPassword = lazy(() => import("./routes/reset-password"));
const Settings = lazy(() => import("./routes/settings"));
const PrivacyPolicy = lazy(() => import("./routes/privacy"));
const TermsOfService = lazy(() => import("./routes/terms"));
const PendingClubsAdmin = lazy(() => import("./routes/admin.clubs.pending"));
const MessagesRoute = lazy(() => import("./routes/messages"));
const NotificationsRoute = lazy(() => import("./routes/notifications"));
const ProfileRoute = lazy(() => import("./routes/profile.$handle"));
const Directory = lazy(() => import("./routes/Directory"));

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
  return {
    ok: true,
  };
}

function PageFallback() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffde00",
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 800,
        fontSize: "1.25rem",
        color: "#0a0a0a",
      }}
    >
      <div
        style={{
          border: "4px solid #0a0a0a",
          padding: "24px 40px",
          backgroundColor: "#ffffff",
          boxShadow: "8px 8px 0px 0px #0a0a0a",
        }}
      >
        CHECKING SYSTEM STATUS...
      </div>
    </div>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      element={
        <Suspense fallback={<PageFallback />}>
          <Layout />
        </Suspense>
      }
      errorElement={<RouteErrorBoundary />}
    >
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
      </Route>

      <Route path="/events">
        <Route index element={<EventsIndex />} />
        <Route path=":eventId" element={<EventDetails />} />
      </Route>

      <Route path="/feed" element={<Feed />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/messages" element={<MessagesRoute />} />
      <Route path="/notifications" element={<NotificationsRoute />} />
      <Route path="/admin/clubs/pending" element={<PendingClubsAdmin />} />
      <Route path="/directory" element={<Directory />} />
      <Route path="/profile/:handle" element={<ProfileRoute />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="*" element={<NotFoundPage />} />
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
  const [dbStatus, setDbStatus] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const performHealthCheck = useCallback(async () => {
    setIsLoading(true);
    const result = await checkDatabaseHealth();
    setDbStatus(result);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    performHealthCheck();
  }, [performHealthCheck, retryCount]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (dbStatus && !dbStatus.ok) {
    return (
      <MaintenancePage
        onRetry={() => setRetryCount((prev) => prev + 1)}
        errorDetails={dbStatus.error}
      />
    );
  }

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
