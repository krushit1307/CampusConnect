import { useEffect, useState, useCallback } from "react";
import MaintenancePage from "./components/MaintenancePage";
import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
} from "react-router-dom";

// Layout
import Layout from "./components/Layout";
import { ErrorBoundary, RouteErrorBoundary } from "./components/ErrorBoundary";
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

    const data = await response.json().catch(() => null);
    if (data && typeof data === "object" && "status" in data && data.status !== "ok") {
      return {
        ok: false,
        error: `API health status: ${data.status}`,
      };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown connection error";
    return {
      ok: false,
      error: `Connection failed: ${message}`,
    };
  }
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
