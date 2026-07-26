import { Suspense, lazy } from "react";
// @ts-expect-error - framer-motion types may not be resolved in all editor settings
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
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { NotFoundPage } from "./components/NotFoundPage";

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
const PendingClubsAdmin = lazy(() => import("./routes/admin.clubs.pending"));
const AdminReportsPage = lazy(() => import("./routes/admin.reports"));
const ChallengeArena = lazy(() => import("./routes/challenge"));
const Leaderboard = lazy(() =>
  import("./components/Leaderboard").then((m) => ({ default: m.Leaderboard })),
);

// ---------------------------------------------------------------------------
// Micro-frontend: Events remote (loaded dynamically from Module Federation)
// Falls back to local static imports when the remote is unavailable.
// ---------------------------------------------------------------------------

type EventsModule = {
  EventsPage: React.ComponentType;
  EventDetailsPage: React.ComponentType;
};

let eventsModulePromise: Promise<EventsModule> | null = null;

async function loadEventsRemote(): Promise<EventsModule> {
  if (!eventsModulePromise) {
    eventsModulePromise = (async () => {
      try {
        const mod = await import("eventsApp/remoteEntry");
        return {
          EventsPage: mod.EventsPage,
          EventDetailsPage: mod.EventDetailsPage,
        };
      } catch (err) {
        console.warn("[Host] Events remote unavailable, falling back to local modules:", err);
        const [eventsMod, eventDetailsMod] = await Promise.all([
          import("./routes/events"),
          import("./routes/events.$eventId"),
        ]);
        return {
          EventsPage: eventsMod.default,
          EventDetailsPage: eventDetailsMod.default,
        };
      }
    })();
  }
  return eventsModulePromise;
}

const LazyEventsIndex = lazy(() => loadEventsRemote().then((m) => ({ default: m.EventsPage })));
const LazyEventDetails = lazy(() =>
  loadEventsRemote().then((m) => ({ default: m.EventDetailsPage })),
);

function RemoteLoadingScreen() {
  return (
    <div
      style={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 800,
        fontSize: "1rem",
        color: "#555",
      }}
    >
      Loading Events…
    </div>
  );
}

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

        {/* Events — loaded from remote micro-frontend when available */}
        <Route
          path="/events"
          element={
            <Suspense fallback={<RemoteLoadingScreen />}>
              <LazyEventsIndex />
            </Suspense>
          }
        />
        <Route
          path="/events/:eventId"
          element={
            <Suspense fallback={<RemoteLoadingScreen />}>
              <LazyEventDetails />
            </Suspense>
          }
        />
        {/* Events Map View with clustering */}
        <Route path="/events/map" element={<EventsMapPage />} />
        <Route path="/challenge" element={<ChallengeArena />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

        <Route path="/feed" element={<Feed />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin/clubs/pending" element={<PendingClubsAdmin />} />
        <Route path="/admin/reports" element={<AdminReportsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>,
  ),
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}