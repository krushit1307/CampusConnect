import { useParams } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { SurveyBuilderPage } from "@/components/SurveyBuilder/SurveyBuilderPage";

export default function EventSurveyRoute() {
  const { eventId } = useParams();

  return (
    <SiteShell>
      <main className="min-h-screen bg-cream px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <SurveyBuilderPage eventId={eventId} />
        </div>
      </main>
    </SiteShell>
  );
}
