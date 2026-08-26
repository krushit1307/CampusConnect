# Routes & Pages

CampusConnect uses **React Router v7 (React Router DOM)** for client-side routing. All top-level page components are placed in this `src/routes/` directory for clean organization and structure.

## Routing Configuration

The routes are explicitly configured inside [App.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/App.tsx) using the standard `<BrowserRouter>`, `<Routes>`, and `<Route>` components.

The main application layout/shell is managed by [Layout.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/components/Layout.tsx) (acting as the wrapper routing element).

## Conventions & Mapping

Here is the mapping of components in this folder to their client-side URLs:

| Page Component File                                                                                                       | Route URL          | Purpose                                                |
| :------------------------------------------------------------------------------------------------------------------------ | :----------------- | :----------------------------------------------------- |
| [index.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/index.tsx)                     | `/`                | Brand landing page and onboarding                      |
| [auth.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/auth.tsx)                       | `/auth`            | Student / Admin auth screen (Sign In / Sign Up)        |
| [forgot-password.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/forgot-password.tsx) | `/forgot-password` | Password recovery start                                |
| [reset-password.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/reset-password.tsx)   | `/reset-password`  | Password reset execution                               |
| [dashboard.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/dashboard.tsx)             | `/dashboard`       | User dashboard (RSVPs, joined clubs, activity)         |
| [settings.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/settings.tsx)               | `/settings`        | Profile & notification configurations                  |
| [clubs.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/clubs.tsx)                     | Nest Layout        | Wrapper layout for club routes                         |
| [clubs.index.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/clubs.index.tsx)         | `/clubs`           | Directory listing of all campus clubs                  |
| [clubs.$slug.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/clubs.$slug.tsx)         | `/clubs/:slug`     | Detailed profile, roster, and info for a specific club |
| [events.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/events.tsx)                   | `/events`          | Listing of upcoming and past campus events             |
| [events.$eventId.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/events.$eventId.tsx) | `/events/:eventId` | Full details, banner, and RSVP action for an event     |
| [feed.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/feed.tsx)                       | `/feed`            | Real-time social discussion board                      |
| [certificates.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/routes/certificates.tsx)       | `/certificates`    | Digital proof-of-work certificate locker               |

## Adding a New Page Route

1. Create your page component in this directory (e.g. `src/routes/new-page.tsx`).
2. Export the component as default.
3. Import the component in [src/App.tsx](file:///e:/Krushit_ALL/WebDevelopment/ECSoC/campus-connect-hub-main/src/App.tsx) and register it inside `<Routes>` using `<Route path="/new-path" element={<NewPage />} />`.
