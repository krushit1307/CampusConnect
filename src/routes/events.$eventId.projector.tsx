import { useParams } from "react-router-dom";
import { ProjectorView } from "@/components/events/ProjectorView";

export default function EventProjectorRoute() {
  const { eventId } = useParams();

  if (!eventId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <h1 className="text-2xl font-bold">Error: Event not found.</h1>
      </div>
    );
  }

  return <ProjectorView eventId={eventId} />;
}
