import { SiteShell } from "@/components/site/SiteShell";
import { NotificationPreferencesPage } from "@/components/NotificationPreferences/NotificationPreferencesPage";

export default function NotificationPreferencesRoute() {
  return (
    <SiteShell>
      <main className="min-h-screen bg-cream px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <NotificationPreferencesPage />
        </div>
      </main>
    </SiteShell>
  );
}
