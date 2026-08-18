import {
  CampusProjectService,
  ProjectPost,
  ApplicationRequest,
  ProjectFilterOptions,
} from "../models/CampusProjectModel";

export class CampusProjectServiceHandler {
  public static fetchProjectListings(filters?: Partial<ProjectFilterOptions>): ProjectPost[] {
    return CampusProjectService.getProjects(filters);
  }

  public static fetchProjectDetails(id: string): ProjectPost | undefined {
    return CampusProjectService.getProjectById(id);
  }

  public static createNewProjectPost(
    payload: Omit<ProjectPost, "id" | "status" | "postedDate">
  ): ProjectPost {
    return CampusProjectService.createProjectPost(payload);
  }

  public static fetchUserApplications(): ApplicationRequest[] {
    return CampusProjectService.getApplications();
  }

  public static submitProjectApplication(
    projectId: string,
    applicantName: string,
    applicantRole: string,
    appliedRole: string,
    pitch: string,
    skills: string[]
  ): ApplicationRequest {
    return CampusProjectService.applyToProject(
      projectId,
      applicantName,
      applicantRole,
      appliedRole,
      pitch,
      skills
    );
  }

  public static updateApplicationDecision(appId: string, status: 'accepted' | 'declined'): boolean {
    return CampusProjectService.updateApplicationStatus(appId, status);
  }
}
