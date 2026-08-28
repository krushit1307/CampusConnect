import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. First conflict
c1_head = """const AdminBadgesPage = lazy(() => import("./routes/admin.badges"));
const NotFound = lazy(() => import("./routes/NotFound"));"""
c1_origin = """// const AdminBadgesPage = lazy(() => import("./routes/admin.badges"));
// const NotFound = lazy(() => import("./routes/NotFound"));
const AdminBadgesPage = lazy(() => import("./routes/admin.badges"));
const NotFound = lazy(() => import("./routes/NotFound"));
const EventRefundChoicePage = lazy(() => import("./routes/events.refund-choice"));"""
c1_merged = c1_origin

# 2. Second conflict
c2_head = """    <Route element={<Layout />} errorElement={<RouteErrorBoundary />}>
      <Route element={<MfaChallengeGuard />}>
        <Route element={<ComplianceCheckGuard />}>"""
c2_origin = """    <>
      {/* Poll Overlay */}
      <Route path="/overlay/poll/:poll_id" element={<PollOverlayRoute />} />

      {/* Main Application Layout */}
      <Route element={<Layout />} errorElement={<RouteErrorBoundary />}>
        {/* MFA Guard */}
        <Route element={<MfaChallengeGuard />}>
          {/* Animated Outlet */}"""
c2_merged = """    <>
      {/* Poll Overlay */}
      <Route path="/overlay/poll/:poll_id" element={<PollOverlayRoute />} />

      {/* Main Application Layout */}
      <Route element={<Layout />} errorElement={<RouteErrorBoundary />}>
        {/* MFA Guard */}
        <Route element={<MfaChallengeGuard />}>
          <Route element={<ComplianceCheckGuard />}>
            {/* Animated Outlet */}"""

# 3. Third conflict
c3_head = """            <Route path="/audio-tour" element={<AudioTourRoute />} />"""
c3_origin = """
            {/* Audio Tour */}
            <Route path="/audio-tour" element={<AudioTourRoute />} />

            {/* Clubs */}"""
c3_merged = c3_origin

# 4. Fourth conflict
c4_head = """=======
              <Route path="audio-pitches" element={<ClubAudioPitches />} />
>>>>>>> origin/main
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
<<<<<<< HEAD
            <Route path="/scavenger-hunts" element={<ScavengerHuntsList />} />
            <Route path="/scavenger-hunts/:id" element={<ScavengerHuntGame />} />
            <Route path="/explore" element={<ExploreShowcase />} />"""
c4_origin = """
            {/* Scavenger Hunts */}
            <Route path="/scavenger-hunts" element={<ScavengerHuntsList />} />
            <Route path="/scavenger-hunts/:id" element={<ScavengerHuntGame />} />

            {/* Explore */}
            <Route path="/explore" element={<ExploreShowcase />} />

            {/* Dashboard */}"""
c4_merged = """              <Route path="audio-pitches" element={<ClubAudioPitches />} />
              <Route path="new" element={<ClubNew />} />

              <Route path=":slug" element={<ClubDetails />} />
              <Route path=":slug/manage" element={<ClubManageRoute />} />
              <Route path=":slug/series-analytics" element={<ClubSeriesAnalyticsRoute />} />
              <Route path=":slug/notes" element={<ClubNotesRoute />} />
              <Route path=":slug/articles" element={<ClubArticlesRoute />} />
              <Route path=":slug/articles/:articleId" element={<ClubArticleDetailsRoute />} />
              <Route path=":slug/vault" element={<ClubVaultRoute />} />
              <Route path=":slug/honorariums" element={<ClubHonorariumsRoute />} />
              <Route path=":slug/newsletter" element={<ClubNewsletterRoute />} />
              <Route path=":slug/resources" element={<ClubResourcesRoute />} />
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

            {/* Dashboard */}"""

# 5. Fifth conflict
c5_head = """            {/* Events Layout with Split-Screen desktop and Mobile Bottom Sheet */}"""
c5_origin = """
            {/* Events */}"""
c5_merged = c5_origin

# 6. Sixth conflict
c6_head = """            <Route path="challenge" element={<ChallengeArena />} />
            <Route path="leaderboard" element={<Leaderboard />} />"""
c6_origin = """
            {/* Challenges */}
            <Route path="/challenge" element={<ChallengeArena />} />
            <Route path="/leaderboard" element={<Leaderboard />} />

            {/* Feed */}"""
c6_merged = c6_origin

# 7. Seventh conflict
c7_head = """            <Route path="/admin/clubs/revival-requests" element={<AdminRevivalRequestsPage />} />
            <Route path="/admin/analytics" element={<AnalyticsAdmin />} />
            <Route path="/admin/leadership-approvals" element={<AdminLeadershipApprovals />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/messages" element={<MessagesRoute />} />"""
c7_origin = """
            <Route path="/admin/clubs/revival-requests" element={<AdminRevivalRequestsPage />} />

            <Route path="/admin/analytics" element={<AnalyticsAdmin />} />
"""
c7_merged = """
            <Route path="/admin/clubs/revival-requests" element={<AdminRevivalRequestsPage />} />
            <Route path="/admin/analytics" element={<AnalyticsAdmin />} />"""

# 8. Eighth conflict
c8_head = """            <Route path="/admin/dlq" element={<AdminDlqPage />} />
            <Route path="/admin/emergency-broadcast" element={<AdminEmergencyBroadcast />} />
            <Route path="/admin/badges" element={<AdminBadgesPage />} />
            <Route path="/equipment-rentals" element={<EquipmentMarketplace />} />
            <Route path="/mentorship-dashboard" element={<MentorshipDashboard />} />
            <Route path="/tutors" element={<TutorsRoute />} />
            <Route path="/carpool" element={<CarpoolRoute />} />
            <Route path="/unsubscribe" element={<UnsubscribeRoute />} />
            {/* Catch-all route for 404 errors */}"""
c8_origin = """
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

            {/* 404 */}"""
c8_merged = """
            <Route path="/admin/dlq" element={<AdminDlqPage />} />
            <Route path="/admin/emergency-broadcast" element={<AdminEmergencyBroadcast />} />
            <Route path="/admin/badges" element={<AdminBadgesPage />} />
            <Route path="/admin/leadership-approvals" element={<AdminLeadershipApprovals />} />
            
            {/* Equipment */}
            <Route path="/equipment-rentals" element={<EquipmentMarketplace />} />
            <Route path="/mentorship-dashboard" element={<MentorshipDashboard />} />
            <Route path="/tutors" element={<TutorsRoute />} />
            <Route path="/carpool" element={<CarpoolRoute />} />

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

            {/* 404 */}"""

# 9. Ninth conflict
c9_head = """
      <Route path="/gallery" element={<GalleryPage />} />
    </Route>,"""
c9_origin = """    </>,"""
c9_merged = """          </Route>
        </Route>
      </Route>
    </>,"""

# 10. Tenth conflict
c10_head = """                  <OfflineIndicator />
                  <EmergencyBroadcastOverlay />
                  <LoginRecoveryModal /> {/* Floating Dark Mode Toggle */}
                  <div className="fixed bottom-4 right-4 z-[9999]">
                    <ThemeToggle />
                  </div>"""
c10_origin = """                  {!isPollOverlayRoute && (
                    <>
                      <OfflineIndicator />
                      <EmergencyBroadcastOverlay />
                      <LoginRecoveryModal />
                      {/* Floating Dark Mode Toggle */}
                      <div className="fixed bottom-4 right-4 z-[9999]">
                        <ThemeToggle />
                      </div>
                    </>
                  )}"""
c10_merged = c10_origin

def replace_conflict(content, head, origin, merged):
    pattern = r'<<<<<<< HEAD\n' + re.escape(head) + r'\n=======\n' + re.escape(origin) + r'\n>>>>>>> origin/main'
    return re.sub(pattern, merged, content, count=1)

content = replace_conflict(content, c1_head, c1_origin, c1_merged)
content = replace_conflict(content, c2_head, c2_origin, c2_merged)
content = replace_conflict(content, c3_head, c3_origin, c3_merged)

pattern4 = re.compile(r'<<<<<<< HEAD.*?=======\n              <Route path="audio-pitches" element={<ClubAudioPitches />} />\n>>>>>>> origin/main.*?<<<<<<< HEAD\n.*?=======\n(.*?)\n>>>>>>> origin/main', re.DOTALL)
content = re.sub(pattern4, c4_merged, content, count=1)

content = replace_conflict(content, c5_head, c5_origin, c5_merged)
content = replace_conflict(content, c6_head, c6_origin, c6_merged)
content = replace_conflict(content, c7_head, c7_origin, c7_merged)
content = replace_conflict(content, c8_head, c8_origin, c8_merged)
content = replace_conflict(content, c9_head, c9_origin, c9_merged)
content = replace_conflict(content, c10_head, c10_origin, c10_merged)

# Clean up any leftover conflicts blindly
content = re.sub(r'<<<<<<< HEAD.*?\n=======\n(.*?)\n>>>>>>> origin/main', r'\1', content, flags=re.DOTALL)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
