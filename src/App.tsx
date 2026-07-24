import { Suspense, lazy } from "react";
import { AnimatePresence } from "framer-motion";
import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
  useLocation,
  Outlet,
} from "react-router-dom";

// Layout & Components
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

// ---------------------------------------------------------------------------
// Animated Outlet Wrapper for Framer Motion transitions
// ---------------------------------------------------------------------------
function AnimatedOutlet() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <PageWrapper key={location.pathname}>
        <Outlet />
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

        <Route path="/feed" element={<Feed />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin/clubs/pending" element={<PendingClubsAdmin />} />
      </Route>
    </Route>,
  ),
);

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
