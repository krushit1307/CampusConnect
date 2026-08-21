import { PageWrapper } from "@/components/PageWrapper";
import CampusAudioTour from "@/components/CampusAudioTour";

export default function AudioTourRoute() {
  return (
    <PageWrapper title="Interactive Audio Tour">
      <div className="container mx-auto py-12 px-4 md:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Campus History Walk</h1>
            <p className="text-lg text-muted-foreground">
              Explore the 100 years of university history and 50 years of club milestones.
              Walk around campus to trigger immersive audio stories as you approach historical landmarks.
            </p>
          </div>
          
          <div className="mt-12">
            <CampusAudioTour />
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
