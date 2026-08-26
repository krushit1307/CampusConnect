import { queryClient, persister } from "@/hooks/useReactQueryReplacement";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Suspense, lazy, useEffect, useState } from "react";
import { AnimatePresence, LazyMotion, MotionConfig } from "framer-motion";
import { loadDomAnimation } from "@/lib/motionFeatures";
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
import { StoreHydrationGate } from "@/components/StoreHydrationGate";
import { TooltipProvider } from "@/components/ui/tooltip";
import MaintenancePage from "./components/MaintenancePage";
import { CommandPaletteProvider } from "@/components/CommandPaletteProvider";
import { createClient } from "./lib/supabase/client";
import GalleryPage from "./routes/gallery";
import { RouteSkeleton } from "./components/RouteSkeleton";
import { BreadcrumbProvider } from "@/components/BreadcrumbsContext";
import AriaAnnouncer from "@/components/accessibility/AriaAnnouncer";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { EmergencyBroadcastOverlay } from "@/components/EmergencyBroadcastOverlay";
import { LoginRecoveryModal } from "@/components/auth/LoginRecoveryModal";
import { MfaChallengeGuard } from "@/components/auth/MfaChallengeGuard";
import { ComplianceCheckGuard } from "@/components/auth/ComplianceCheckGuard";
import { ShadowbanEvasionCheck } from "@/components/Auth/ShadowbanEvasionCheck";
import UnsubscribeRoute from "./routes/unsubscribe";
import PollOverlayRoute from "./routes/overlay.poll.$poll_id";
function RemoteLoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
    </div>
  );
}

function PageFallback() {
  return <RouteSkeleton />;
}

const HEALTH_CHECK_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_HEALTH_URL) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_HEALTH_URL) ||
  "/api/health";

const HEALTH_CHECK_TIMEOUT = 8000; // 8 seconds
const PrintableCharter = lazy(() => import("./routes/print.charter.$slug"));

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
const VerifyCertificate = lazy(() => import("./routes/verify"));
const ClubsIndex = lazy(() => import("./routes/clubs.index"));
const ClubNew = lazy(() => import("./routes/clubs.new"));
const ClubDetails = lazy(() => import("./routes/clubs.$slug"));
const ClubManageRoute = lazy(() => import("./routes/clubs.$slug.manage"));
const ClubSeriesAnalyticsRoute = lazy(() => import("./routes/clubs.$slug.series-analytics"));
const ClubNotesRoute = lazy(() => import("./routes/clubs.$slug.notes"));
const ClubArticlesRoute = lazy(() => import("./routes/clubs.$slug.articles"));
const ClubArticleDetailsRoute = lazy(() => import("./routes/clubs.$slug.articles.$articleId"));
const ClubVaultRoute = lazy(() => import("./routes/clubs.$slug.vault"));
const ClubHonorariumsRoute = lazy(() => import("./routes/clubs.$slug.honorariums"));
const ClubNewsletterRoute = lazy(() => import("./routes/clubs.$slug.newsletter"));const ClubResourcesRoute = lazy(() => import("./routes/clubs.$slug.resources"));
const ClubYearbookRoute = lazy(() => import("./routes/clubs.$slug.yearbook"));
const ScavengerHuntsList = lazy(() => import("./routes/scavenger-hunts"));
const ScavengerHuntGame = lazy(() => import("./routes/scavenger-hunts.$id"));
const ExploreShowcase = lazy(() => import("./routes/explore"));
const ClubsLayout = lazy(() => import("./routes/clubs"));
const ClubDiscoveryQuiz = lazy(() => import("./routes/clubs.fit"));
const ClubDiscovery = lazy(() => import("./routes/clubs.discovery"));
const ClubAudioPitches = lazy(() => import("./routes/clubs.audio-pitches"));
const Dashboard = lazy(() => import("./routes/dashboard"));
const DashboardOverview = lazy(() => import("./routes/dashboard.index"));
const DashboardRsvps = lazy(() => import("./routes/dashboard.rsvps"));
const DashboardBookmarks = lazy(() => import("./routes/dashboard.bookmarks"));
const DashboardCalendar = lazy(() => import("./routes/dashboard.calendar"));
const GlobalCalendar = lazy(() => import("./routes/calendar"));
const Feed = lazy(() => import("./routes/feed"));
const EventsMapPage = lazy(() => import("./routes/events.map"));
const InteractiveCampusMap = lazy(() => import("./routes/events.interactive-map"));
const EventKiosk = lazy(() => import("./routes/events.$eventId.kiosk"));
const MapPage = lazy(() => import("./routes/map"));
const ForgotPassword = lazy(() => import("./routes/forgot-password"));
const ResetPassword = lazy(() => import("./routes/reset-password"));
const Settings = lazy(() => import("./routes/settings"));
const SettingsData = lazy(() => import("./routes/settings.data"));
const VerifyEmail = lazy(() => import("./routes/verify-email"));
const Directory = lazy(() => import("./routes/Directory"));
const MessagesRoute = lazy(() => import("./routes/messages"));
const PeerSupportRoute = lazy(() => import("./routes/peer-support"));
const PendingClubsAdmin = lazy(() => import("./routes/admin.clubs.pending"));
const AnalyticsAdmin = lazy(() => import("./routes/admin.analytics"));
const ConstitutionReviewAdmin = lazy(() => import("./routes/admin.constitutions"));
const FeedbackSafetyAdmin = lazy(() => import("./routes/admin.feedback-safety"));
const AdminReportsPage = lazy(() => import("./routes/admin.reports"));
const AdminUsersPage = lazy(() => import("./routes/admin.users"));
const AdminRestorePage = lazy(() => import("./routes/admin.restore"));
const AdminDlqPage = lazy(() => import("./routes/admin.dlq"));
const AdminEmergencyBroadcast = lazy(() => import("./routes/admin.emergency-broadcast"));
// const AdminBadgesPage = lazy(() => import("./routes/admin.badges"));
// const NotFound = lazy(() => import("./routes/NotFound"));
const AdminBadgesPage = lazy(() => import("./routes/admin.badges"));
const NotFound = lazy(() => import("./routes/NotFound"));
const EventRefundChoicePage = lazy(() => import("./routes/events.refund-choice"));
const ChallengeArena = lazy(() => import("./routes/challenge"));
const EventDashboard = lazy(() => import("./routes/events.$eventId.dashboard"));
const EventGantt = lazy(() => import("./routes/events.$eventId.gantt"));
const EventFloorplan = lazy(() => import("./routes/events.$eventId.floorplan"));
const LostFound = lazy(() => import("./routes/lost-found"));
const Leaderboard = lazy(() => import("./routes/leaderboard"));
const Recap = lazy(() => import("./routes/recap"));
const NetworkPage = lazy(() => import("@/pages/NetworkPage"));
const ReviveClubPage = lazy(() => import("@/pages/ReviveClub"));
const AdminRevivalRequestsPage = lazy(() => import("@/pages/Admin/AdminRevivalRequests"));
const AdminLeadershipApprovals = lazy(() => import("./routes/admin.leadership-approvals"));
const MfaChallenge = lazy(() => import("./routes/mfa-challenge"));
const ComplianceCheck = lazy(() => import("./routes/compliance-check"));
const VolunteerRecord = lazy(() => import("./routes/volunteer-record"));
const RemindersPage = lazy(() => import("@/pages/RemindersPage"));
const FacilityDashboard = lazy(() => import("./routes/facility-dashboard"));
const ApiPlayground = lazy(() => import("./routes/api-playground"));

const EventsLayout = lazy(() => import("./pages/Events/EventsLayout"));
const LazyEventsIndex = lazy(() => import("./pages/Events/EventsList"));
const LazyTicketingDemo = lazy(() => import("./pages/Events/CampusEventTicketingPage"));
const LazyEventDetails = lazy(() => import("./pages/Events/EventDetail"));
const EmptyState = lazy(() => import("./pages/Events/EmptyState"));
const TourManager = lazy(() => import("./routes/tours.manage"));
const TourMode = lazy(() => import("./routes/tours.$tourId"));
const BundleCheckoutRoute = lazy(() => import("./pages/BundleCheckoutPage"));
const BundleDetailsRoute = lazy(() => import("./pages/BundleDetailsPage"));
const EquipmentMarketplace = lazy(() => import("./routes/equipment"));
const Wrapped2026 = lazy(() => import("./routes/wrapped.2026"));
const SkillSwapMarketplace = lazy(() => import("./routes/skill-swap"));
const CampusWellnessHub = lazy(() => import("./pages/wellness/CampusWellnessHub"));
const ReferralDashboardRoute = lazy(() => import("./pages/ReferralDashboard"));
const ReferralLeaderboardRoute = lazy(() => import("./pages/ReferralLeaderboard"));
const AudioTourRoute = lazy(() => import("./routes/audio-tour"));
const DynamicEarlyBirdAnalyticsRoute = lazy(
  () => import("./routes/events.$id.early-bird-analytics"),
);
const AchievementsPage = lazy(() => import("@/pages/AchievementsPage"));
const EventFeedbackPage = lazy(() => import("@/pages/EventFeedbackPage"));

// ---------------------------------------------------------------------------
// Animated Outlet Wrapper for Framer Motion transitions with Skeleton Fallback
// ---------------------------------------------------------------------------
function AnimatedOutlet() {
  const location = useLocation();
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    return (
      <PageWrapper key={location.pathname}>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </PageWrapper>
    );
  }

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

// const router = createBrowserRouter(
//   createRoutesFromElements(
//     <>
//       <Route path="/overlay/poll/:poll_id" element={<PollOverlayRoute />} />
//       <Route element={<Layout />} errorElement={<RouteErrorBoundary />}>
//         <Route element={<MfaChallengeGuard />}>
//           <Route element={<AnimatedOutlet />}>
//             <Route index element={<Index />} />
//             <Route path="/auth" element={<Auth />} />
//             <Route path="/mfa-challenge" element={<MfaChallenge />} />
//             <Route path="/certificates" element={<Certificates />} />
//             <Route path="/verify" element={<VerifyCertificate />} />
//             <Route path="/audio-tour" element={<AudioTourRoute />} />
//             <Route path="/clubs" element={<ClubsLayout />}>
//               <Route index element={<ClubsIndex />} />
//               <Route path="fit" element={<ClubDiscoveryQuiz />} />
//               <Route path="discovery" element={<ClubDiscovery />} />
//               <Route path="audio-pitches" element={<ClubAudioPitches />} />
//               <Route path="new" element={<ClubNew />} />
//               <Route path=":slug" element={<ClubDetails />} />
//               <Route path=":slug/manage" element={<ClubManageRoute />} />
//               <Route path=":slug/series-analytics" element={<ClubSeriesAnalyticsRoute />} />
//               <Route path=":slug/notes" element={<ClubNotesRoute />} />
//               <Route path=":slug/articles" element={<ClubArticlesRoute />} />
//               <Route path=":slug/articles/:articleId" element={<ClubArticleDetailsRoute />} />
//               <Route path=":slug/vault" element={<ClubVaultRoute />} />
//               <Route path=":slug/honorariums" element={<ClubHonorariumsRoute />} />
//               <Route path=":slug/resources" element={<ClubResourcesRoute />} />
//               <Route path=":slug/yearbook/2026" element={<ClubYearbookRoute />} />
//               <Route path=":slug/revive" element={<ReviveClubPage />} />{" "}
//             </Route>
//             <Route path="/print/charter/:slug" element={<PrintableCharter />} />
//             <Route path="/bundles/:bundleId" element={<BundleDetailsRoute />} />
//             <Route path="/bundles/:bundleId/checkout" element={<BundleCheckoutRoute />} />
//             <Route path="/referrals/dashboard" element={<ReferralDashboardRoute />} />
//             <Route path="/referrals/leaderboard" element={<ReferralLeaderboardRoute />} />
//             <Route path="/scavenger-hunts" element={<ScavengerHuntsList />} />
//             <Route path="/scavenger-hunts/:id" element={<ScavengerHuntGame />} />
//             <Route path="/explore" element={<ExploreShowcase />} />
//             <Route path="/dashboard" element={<Dashboard />}>
//               <Route index element={<DashboardOverview />} />
//               <Route path="rsvps" element={<DashboardRsvps />} />
//               <Route path="bookmarks" element={<DashboardBookmarks />} />
//               <Route path="calendar" element={<DashboardCalendar />} />
//             </Route>
//             {/* Events Layout with Split-Screen desktop and Mobile Bottom Sheet */}
//             <Route
//               path="/events"
//               element={
//                 <Suspense fallback={<PageFallback />}>
//                   <EventsLayout />
//                 </Suspense>
//               }
//             />
//             <Route element={<ComplianceCheckGuard />}>
//               <Route element={<AnimatedOutlet />}>
//                 <Route index element={<Index />} />
//                 <Route path="/auth" element={<Auth />} />
//                 <Route path="/mfa-challenge" element={<MfaChallenge />} />
//                 <Route path="/certificates" element={<Certificates />} />
//                 <Route path="/verify" element={<VerifyCertificate />} />
//                 <Route path="/audio-tour" element={<AudioTourRoute />} />
//                 <Route path="/clubs" element={<ClubsLayout />}>
//                   <Route index element={<ClubsIndex />} />
//                   <Route path="fit" element={<ClubDiscoveryQuiz />} />
//                   <Route path="discovery" element={<ClubDiscovery />} />
//                   <Route path="new" element={<ClubNew />} />
//                   <Route path=":slug" element={<ClubDetails />} />
//                   <Route path=":slug/manage" element={<ClubManageRoute />} />
//                   <Route path=":slug/series-analytics" element={<ClubSeriesAnalyticsRoute />} />
//                   <Route path=":slug/notes" element={<ClubNotesRoute />} />
//                   <Route path=":slug/articles" element={<ClubArticlesRoute />} />
//                   <Route path=":slug/articles/:articleId" element={<ClubArticleDetailsRoute />} />
//                   <Route path=":slug/vault" element={<ClubVaultRoute />} />
//                   <Route path=":slug/honorariums" element={<ClubHonorariumsRoute />} />
//                   <Route path=":slug/resources" element={<ClubResourcesRoute />} />
//                   <Route path=":slug/yearbook/2026" element={<ClubYearbookRoute />} />
//                   <Route path=":slug/revive" element={<ReviveClubPage />} />{" "}
//                 </Route>
//                 <Route path="/print/charter/:slug" element={<PrintableCharter />} />
//                 <Route path="/bundles/:bundleId" element={<BundleDetailsRoute />} />
//                 <Route path="/bundles/:bundleId/checkout" element={<BundleCheckoutRoute />} />
//                 <Route path="/referrals/dashboard" element={<ReferralDashboardRoute />} />
//                 <Route path="/referrals/leaderboard" element={<ReferralLeaderboardRoute />} />
//                 <Route path="/scavenger-hunts" element={<ScavengerHuntsList />} />
//                 <Route path="/scavenger-hunts/:id" element={<ScavengerHuntGame />} />
//                 <Route path="/explore" element={<ExploreShowcase />} />
//                 <Route path="/dashboard" element={<Dashboard />}>
//                   <Route index element={<DashboardOverview />} />
//                   <Route path="rsvps" element={<DashboardRsvps />} />
//                   <Route path="bookmarks" element={<DashboardBookmarks />} />
//                   <Route path="calendar" element={<DashboardCalendar />} />
//                 </Route>
//                 <Route
//                   path="/events"
//                   element={
//                     <Suspense fallback={<PageFallback />}>
//                       <EventsLayout />
//                     </Suspense>
//                   }
//                 />
//                 <Route path="/events/:eventId/gantt" element={<EventGantt />} />
//                 <Route path="events/map" element={<EventsMapPage />} />
//                 <Route path="/map" element={<MapPage />} />
//                 <Route path="/tours/manage" element={<TourManager />} />
//                 <Route path="/tours/:tourId" element={<TourMode />} />{" "}
//                 <Route path="challenge" element={<ChallengeArena />} />
//                 <Route path="leaderboard" element={<Leaderboard />} />
//                 <Route path="/feed" element={<Feed />} />
//                 <Route path="/lost-found" element={<LostFound />} />
//                 <Route path="/forgot-password" element={<ForgotPassword />} />
//                 <Route path="/reset-password" element={<ResetPassword />} />
//                 <Route path="/settings" element={<Settings />} />
//                 <Route path="/facility-dashboard" element={<FacilityDashboard />} />
//                 <Route path="/settings/data" element={<SettingsData />} />
//                 <Route path="/recap" element={<Recap />} />
//                 <Route path="/volunteer-record" element={<VolunteerRecord />} />
//                 <Route path="/network" element={<NetworkPage />} />
//                 <Route path="/admin/clubs/pending" element={<PendingClubsAdmin />} />
//                 <Route path="/admin/analytics" element={<AnalyticsAdmin />} />
//                 <Route path="/verify-email" element={<VerifyEmail />} />
//                 <Route path="/messages" element={<MessagesRoute />} />
//                 <Route path="/admin/reports" element={<AdminReportsPage />} />
//                 <Route path="/admin/users" element={<AdminUsersPage />} />
//                 <Route path="/admin/restore" element={<AdminRestorePage />} />
//                 <Route path="/admin/dlq" element={<AdminDlqPage />} />
//                 <Route path="/admin/emergency-broadcast" element={<AdminEmergencyBroadcast />} />
//                 <Route path="/admin/badges" element={<AdminBadgesPage />} />
//                 <Route path="/unsubscribe" element={<UnsubscribeRoute />} />
                  <Route path="/achievements" element={<AchievementsPage />} />
                  <Route path="/events/:eventId/reviews" element={<EventFeedbackPage />} />
//                 <Route path="*" element={<NotFound />} />
//               </Route>
//             </Route>
//           <Route
//             path="/events/:eventId/kiosk"
//             element={
//               <Suspense fallback={<RemoteLoadingScreen />}>
//                 <EventKiosk />
//               </Suspense>
//             } />
//           <Route path="/events/:eventId/gantt" element={<EventGantt />} />
//           {/* Events Map View with clustering */}
//           <Route path="events/map" element={<EventsMapPage />} />
//           {/* Campus Heatmap - Live Activity */}
//           <Route path="/map" element={<MapPage />} />
//           <Route path="/tours/manage" element={<TourManager />} />
//           <Route path="/tours/:tourId" element={<TourMode />} />{" "}
//           <Route path="challenge" element={<ChallengeArena />} />
//           <Route path="leaderboard" element={<Leaderboard />} />
//           <Route path="/feed" element={<Feed />} />
//           <Route path="/lost-found" element={<LostFound />} />
//           <Route path="/forgot-password" element={<ForgotPassword />} />
//           <Route path="/reset-password" element={<ResetPassword />} />
//           <Route path="/settings" element={<Settings />} />
//           <Route path="/settings/data" element={<SettingsData />} />
//           <Route path="/recap" element={<Recap />} />
//           <Route path="/volunteer-record" element={<VolunteerRecord />} />
//           <Route path="/network" element={<NetworkPage />} />
//           <Route path="/admin/clubs/pending" element={<PendingClubsAdmin />} />
//           <Route path="/admin/clubs/revival-requests" element={<AdminRevivalRequestsPage />} />
//           <Route path="/admin/analytics" element={<AnalyticsAdmin />} />
//           <Route path="/verify-email" element={<VerifyEmail />} />
//           <Route path="/messages" element={<MessagesRoute />} />
//           <Route path="/admin/reports" element={<AdminReportsPage />} />
//           <Route path="/admin/users" element={<AdminUsersPage />} />
//           <Route path="/admin/restore" element={<AdminRestorePage />} />
//           <Route path="/admin/dlq" element={<AdminDlqPage />} />
//           <Route path="/admin/leadership-approvals" element={<AdminLeadershipApprovals />} />
//           <Route path="/equipment-rentals" element={<EquipmentMarketplace />} />
//           <Route path="/wrapped/2026" element={<Wrapped2026 />} />
//           <Route path="/skill-swap" element={<SkillSwapMarketplace />} />
//           <Route path="/wellness" element={<CampusWellnessHub />} />
//           <Route path="/unsubscribe" element={<UnsubscribeRoute />} />
//           {/* Catch-all route for 404 errors */}
//           <Route path="*" element={<NotFound />} />
//         </Route>
//         <Route path="/gallery" element={<GalleryPage />} />
//       </Route>
//     </>,
//   ));

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* Poll Overlay */}
      <Route path="/overlay/poll/:poll_id" element={<PollOverlayRoute />} />

      {/* Main Application Layout */}
      <Route element={<Layout />} errorElement={<RouteErrorBoundary />}>
        {/* MFA Guard */}
        <Route element={<MfaChallengeGuard />}>
          {/* Animated Outlet */}
          <Route element={<AnimatedOutlet />}>
            {/* Home */}
            <Route index element={<Index />} />

            {/* Authentication */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/mfa-challenge" element={<MfaChallenge />} />

            {/* Certificates */}
            <Route path="/certificates" element={<Certificates />} />
            <Route path="/verify" element={<VerifyCertificate />} />

            {/* Audio Tour */}
            <Route path="/audio-tour" element={<AudioTourRoute />} />

            {/* Clubs */}
            <Route path="/clubs" element={<ClubsLayout />}>
              <Route index element={<ClubsIndex />} />
              <Route path="fit" element={<ClubDiscoveryQuiz />} />
              <Route path="discovery" element={<ClubDiscovery />} />
              <Route path="audio-pitches" element={<ClubAudioPitches />} />
              <Route path="new" element={<ClubNew />} />

              <Route path=":slug" element={<ClubDetails />} />
              <Route path=":slug/manage" element={<ClubManageRoute />} />
              <Route path=":slug/series-analytics" element={<ClubSeriesAnalyticsRoute />} />
              <Route path=":slug/notes" element={<ClubNotesRoute />} />
              <Route path=":slug/articles" element={<ClubArticlesRoute />} />
              <Route path=":slug/articles/:articleId" element={<ClubArticleDetailsRoute />} />
              <Route path=":slug/vault" element={<ClubVaultRoute />} />
              <Route path=":slug/honorariums" element={<ClubHonorariumsRoute />} />
              <Route path=":slug/newsletter" element={<ClubNewsletterRoute />} />              <Route path=":slug/resources" element={<ClubResourcesRoute />} />
              <Route path=":slug/yearbook/2026" element={<ClubYearbookRoute />} />
              <Route path=":slug/revive" element={<ReviveClubPage />} />
            </Route>

            {/* Printable Charter */}
            <Route path="/print/charter/:slug" element={<PrintableCharter />} />

            {/* Bundles */}
            <Route path="/bundles/:bundleId" element={<BundleDetailsRoute />} />
            <Route path="/bundles/:bundleId/checkout" element={<BundleCheckoutRoute />} />

            {/* Referrals */}
            <Route path="/referrals/dashboard" element={<ReferralDashboardRoute />} />
            <Route path="/referrals/leaderboard" element={<ReferralLeaderboardRoute />} />

            {/* Scavenger Hunts */}
            <Route path="/scavenger-hunts" element={<ScavengerHuntsList />} />
            <Route path="/scavenger-hunts/:id" element={<ScavengerHuntGame />} />

            {/* Explore */}
            <Route path="/explore" element={<ExploreShowcase />} />

            {/* Dashboard */}
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<DashboardOverview />} />
              <Route path="rsvps" element={<DashboardRsvps />} />
              <Route path="bookmarks" element={<DashboardBookmarks />} />
              <Route path="calendar" element={<DashboardCalendar />} />
            </Route>

            {/* Events */}
            <Route
              path="/events"
              element={
                <Suspense fallback={<PageFallback />}>
                  <EventsLayout />
                </Suspense>
              }
            />

            <Route
              path="/events/:eventId/kiosk"
              element={
                <Suspense fallback={<RemoteLoadingScreen />}>
                  <EventKiosk />
                </Suspense>
              }
            />

            <Route path="/events/:eventId/gantt" element={<EventGantt />} />

            <Route path="/events/map" element={<EventsMapPage />} />

            {/* Maps */}
            <Route path="/map" element={<MapPage />} />

            {/* Tours */}
            <Route path="/tours/manage" element={<TourManager />} />
            <Route path="/tours/:tourId" element={<TourMode />} />

            {/* Challenges */}
            <Route path="/challenge" element={<ChallengeArena />} />
            <Route path="/leaderboard" element={<Leaderboard />} />

            {/* Feed */}
            <Route path="/feed" element={<Feed />} />

            {/* Lost & Found */}
            <Route path="/lost-found" element={<LostFound />} />

            {/* Password */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Settings */}
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/data" element={<SettingsData />} />

            {/* Facility */}
            <Route path="/facility-dashboard" element={<FacilityDashboard />} />

            {/* Recap */}
            <Route path="/recap" element={<Recap />} />

            {/* Volunteer */}
            <Route path="/volunteer-record" element={<VolunteerRecord />} />

            {/* Network */}
            <Route path="/network" element={<NetworkPage />} />

            {/* Admin */}
            <Route path="/admin/clubs/pending" element={<PendingClubsAdmin />} />

            <Route path="/admin/clubs/revival-requests" element={<AdminRevivalRequestsPage />} />

            <Route path="/admin/analytics" element={<AnalyticsAdmin />} />

            <Route path="/admin/reports" element={<AdminReportsPage />} />

            <Route path="/admin/users" element={<AdminUsersPage />} />

            <Route path="/admin/restore" element={<AdminRestorePage />} />

            <Route path="/admin/dlq" element={<AdminDlqPage />} />

            <Route path="/admin/emergency-broadcast" element={<AdminEmergencyBroadcast />} />

            <Route path="/admin/badges" element={<AdminBadgesPage />} />

            <Route path="/admin/leadership-approvals" element={<AdminLeadershipApprovals />} />

            {/* Equipment */}
            <Route path="/equipment-rentals" element={<EquipmentMarketplace />} />

            {/* Wrapped */}
            <Route path="/wrapped/2026" element={<Wrapped2026 />} />

            {/* Skill Swap */}
            <Route path="/skill-swap" element={<SkillSwapMarketplace />} />

            {/* Wellness */}
            <Route path="/wellness" element={<CampusWellnessHub />} />

            {/* Achievements */}
            <Route path="/achievements" element={<AchievementsPage />} />

            {/* Event Feedback / Reviews */}
            <Route path="/events/:eventId/reviews" element={<EventFeedbackPage />} />

            {/* Email Verification */}
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Messages */}
            <Route path="/messages" element={<MessagesRoute />} />

            {/* Unsubscribe */}
            <Route path="/unsubscribe" element={<UnsubscribeRoute />} />

            {/* Gallery */}
            <Route path="/gallery" element={<GalleryPage />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Route>
    </>,
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

function usePushNotifications() {
  useEffect(() => {
    async function syncToken() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Mock FCM token generation since no real Web Push setup exists
        const fcmToken =
          localStorage.getItem("fcm_token") || `mock-fcm-${session.user.id}-${Date.now()}`;
        localStorage.setItem("fcm_token", fcmToken);

        await supabase
          .from("profiles")
          // @ts-expect-error - timezone and fcm_token exist in DB
          .update({ timezone, fcm_token: fcmToken })
          .eq("id", session.user.id);
      } catch (e) {
        console.error("Failed to sync push token/timezone", e);
      }
    }
    syncToken();
  }, []);
}

export default function App() {
  const [dbStatus, setDbStatus] = useState<DbStatus>("checking");
  // OBS/vMix load this route directly as a bare Browser Source, so the
  // app's floating chrome (theme toggle, banners, modals) must not render
  // on top of the transparent poll overlay.
  const isPollOverlayRoute =
    typeof window !== "undefined" && window.location.pathname.startsWith("/overlay/poll/");

  usePushNotifications();
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
    if (typeof navigator !== "undefined" && navigator.onLine) {
      return <MaintenancePage />;
    }
    // If device is offline, allow the app to render with cached data
  }

  return (
    <ThemeProvider>
      <StoreHydrationGate>
        <AriaAnnouncer />
        <TooltipProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister,
              dehydrateOptions: {
                shouldDehydrateQuery: (query: any) => {
                  if (query.state.status !== "success") return false;
                  const queryKeyStr = JSON.stringify(query.queryKey).toLowerCase();
                  if (
                    queryKeyStr.includes("password") ||
                    queryKeyStr.includes("billing") ||
                    queryKeyStr.includes("payment")
                  ) {
                    return false;
                  }
                  return true;
                },
              },
            }}
          >
            <ErrorBoundary>
              {/*
                App-wide LazyMotion provider. Every `m.*` component in the tree
                renders using this lightweight `domAnimation` feature set
                (fetched from a separate chunk) instead of statically bundling
                framer-motion's full ~35kb `motion` object. `strict` is only
                enabled in dev so that any stray `motion.div` (which would
                silently pull in the full bundle) throws loudly during
                development instead of shipping to production.
              */}
              <LazyMotion features={loadDomAnimation} strict={import.meta.env.DEV}>
                <CommandPaletteProvider>
                  {!isPollOverlayRoute && (
                    <>
                      <OfflineIndicator />
                      <EmergencyBroadcastOverlay />
                      <LoginRecoveryModal />
                      {/* Floating Dark Mode Toggle */}
                      <div className="fixed bottom-4 right-4 z-[9999]">
                        <ThemeToggle />
                      </div>
                    </>
                  )}
                  <BreadcrumbProvider>
                    <MotionConfig reducedMotion="user">
                      <PushDeepLinkListener router={router} />
                      <ShadowbanEvasionCheck />
                      <RouterProvider router={router} />
                    </MotionConfig>
                  </BreadcrumbProvider>
                </CommandPaletteProvider>
              </LazyMotion>
            </ErrorBoundary>
          </PersistQueryClientProvider>
        </TooltipProvider>
      </StoreHydrationGate>
    </ThemeProvider>
  );
}
