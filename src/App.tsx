import { useEffect, useState, useCallback } from "react";
import { useEmailVerification } from "./hooks/useEmailVerification";

import Directory from "./routes/Directory";

import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
} from "react-router-dom";

// Layout & Components
import Layout from "./components/Layout";
import { ErrorBoundary, RouteErrorBoundary } from "./components/ErrorBoundary";
import MaintenancePage from "./components/MaintenancePage";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { createClient } from "./lib/supabase/client";

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
import EventsIndex from "./routes/events";
import EventDetails from "./routes/events.$eventId";
import Feed from "./routes/feed";
import ForgotPassword from "./routes/forgot-password";
import ResetPassword from "./routes/reset-password";
import Settings from "./routes/settings";
import PrivacyPolicy from "./routes/privacy";
import TermsOfService from "./routes/terms";
import PendingClubsAdmin from "./routes/admin.clubs.pending";
import MessagesRoute from "./routes/messages";
import NotificationsRoute from "./routes/notifications";
import ProfileRoute from "./routes/profile.$handle";
import { NotFoundPage } from "./components/NotFoundPage";

interface HealthStatus {
  ok: boolean;
  error?: string;
}

async function checkDatabaseHealth(): Promise<HealthStatus> {
  return {
    ok: true,
  };
}

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-brand-yellow-bright)",
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 800,
        fontSize: "1.25rem",
        color: "var(--color-ink)",
      }}
    >
      <div
        style={{
          border: "4px solid var(--color-ink)",
          padding: "24px 40px",
          backgroundColor: "#ffffff",
          boxShadow: "8px 8px 0px 0px var(--color-ink)",
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

export default function App() {
  const [dbStatus, setDbStatus] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Onboarding state
  const [userId, setUserId] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const performHealthCheck = useCallback(async () => {
    setIsLoading(true);
    const result = await checkDatabaseHealth();
    setDbStatus(result);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    performHealthCheck();
  }, [performHealthCheck, retryCount]);

  // Check if user profile is complete
  useEffect(() => {
    async function checkProfileOnboarding() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        setUserId(user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, major")
          .eq("id", user.id)
          .single();

        if (!profile || !profile.full_name || !profile.major) {
          setNeedsOnboarding(true);
        }
      } catch (err) {
        console.error("Failed to check profile status:", err);
      }
    }

    if (!isLoading && dbStatus?.ok) {
      checkProfileOnboarding();
    }
  }, [isLoading, dbStatus]);

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

  const emailVerified = useEmailVerification();

  return (
    <ErrorBoundary>
      {!emailVerified && (
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-900 px-4 py-3 text-center">
          📧 Please verify your email address to unlock posting, commenting, and RSVP features.
          Check your inbox for the verification email.
        </div>
      )}
      <RouterProvider router={router} />
      {needsOnboarding && userId && (
        <OnboardingWizard userId={userId} onComplete={() => setNeedsOnboarding(false)} />
      )}
    </ErrorBoundary>
  );
}
