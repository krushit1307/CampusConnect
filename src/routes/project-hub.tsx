import { Suspense, lazy } from "react";
import { RouteSkeleton } from "@/components/RouteSkeleton";

const ProjectHubPage = lazy(() => import("@/components/project-hub/ProjectHubPage"));

export default function ProjectHubRoute() {
  return (
    <Suspense fallback={<RouteSkeleton />}>
      <ProjectHubPage />
    </Suspense>
  );
}
