import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "./components/ui/command-palette";
import MaintenancePage from "./components/MaintenancePage";
import { createClient } from "./lib/supabase/client";
import RouteSkeleton from "@/components/RouteSkeleton";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer: any[];
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
const GlobalCalendar = lazy(() => import("./routes/calendar"));
const Feed = lazy(() => import("./routes/feed"));
const EventsMapPage = lazy(() => import("./routes/events.map"));
const ForgotPassword = lazy(() => import("./routes/forgot-password"));
const ResetPassword = lazy(() => import("./routes/reset-password"));
const Settings = lazy(() => import("./routes/settings"));
const VerifyEmail = lazy(() => import("./routes/verify-email"));
const Directory = lazy(() => import("./routes/Directory"));
const MessagesRoute = lazy(() => import("./routes/messages"));
const PendingClubsAdmin = lazy(() => import("./routes/admin.clubs.pending"));
const AnalyticsAdmin = lazy(() => import("./routes/admin.analytics"));
const AdminReportsPage = lazy(() => import("./routes/admin.reports"));
const AdminUsersPage = lazy(() => import("./routes/admin.users"));
const AdminRestorePage = lazy(() => import("./routes/admin.restore"));
const NotFound = lazy(() => import("./routes/NotFound"));
const ChallengeArena = lazy(() => import("./routes/challenge"));
const EventDashboard = lazy(() => import("./routes/events.$eventId.dashboard"));
const Leaderboard = lazy(() =>
  import("./components/Leaderboard").then((m) => ({ default: m.Leaderboard })),
);
const LazyEventsIndex = lazy(() => import("./routes/events"));
const LazyEventDetails = lazy(() => import("./routes/events.$eventId"));

// ---------------------------------------------------------------------------
// Animated Outlet Wrapper for Framer Motion transitions with Skeleton Fallback
// ---------------------------------------------------------------------------
function AnimatedOutlet() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <PageWrapper key={location.pathname}>
        <Suspense fallback={<RouteSkeleton />}>
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
        <Route index element={<Index />} />
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

        <Route path="/calendar" element={<GlobalCalendar />} />
        <Route path="/events" element={<LazyEventsIndex />} />
        <Route path="/events/:eventId" element={<LazyEventDetails />} />
        <Route path="/events/:eventId/dashboard" element={<EventDashboard />} />
        <Route path="/events/map" element={<EventsMapPage />} />
        <Route path="/challenge" element={<ChallengeArena />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

        <Route path="/feed" element={<Feed />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/messages" element={<MessagesRoute />} />
        <Route path="/admin/clubs/pending" element={<PendingClubsAdmin />} />
        <Route path="/admin/analytics" element={<AnalyticsAdmin />} />
        <Route path="/admin/reports" element={<AdminReportsPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/restore" element={<AdminRestorePage />} />

        <Route path="*" element={<NotFound />} />
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
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <CommandPalette />
            {/* Floating Dark Mode Toggle */}
            <div className="fixed bottom-4 right-4 z-[9999]">
              <ThemeToggle />
            </div>

            <RouterProvider router={router} />
          </ErrorBoundary>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
