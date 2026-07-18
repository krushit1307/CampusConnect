import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
} from "react-router-dom";

// Layout
import Layout from "./components/Layout";

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
    <Route element={<Layout />}>
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
  return <RouterProvider router={router} />;
}
