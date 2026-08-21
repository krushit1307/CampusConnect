import CampusHackathonIncubator, { ICampusHackathonIncubator } from '../models/CampusHackathonIncubatorModel';

export interface HackathonIncubatorFilterQuery {
  projectDomain?: string;
  prototypeStatus?: string;
  search?: string;
}

export class CampusHackathonIncubatorEngine {
  public static async registerProject(payload: {
    projectName: string;
    campusName: string;
    leadStudentName: string;
    teamSize: number;
    projectDomain: 'FINTECH' | 'HEALTH_TECH' | 'ED_TECH' | 'WEB3' | 'AI_ML';
    prizeFundingUsd?: number;
  }): Promise<ICampusHackathonIncubator> {
    const project = new CampusHackathonIncubator({
      ...payload,
      incubatorGrantUsd: 0,
      prototypeStatus: 'PROTOTYPE',
    });
    return await project.save();
  }

  public static async getProjects(filters: HackathonIncubatorFilterQuery): Promise<ICampusHackathonIncubator[]> {
    const query: any = {};
    if (filters.projectDomain && filters.projectDomain !== 'All') {
      query.projectDomain = filters.projectDomain;
    }
    if (filters.prototypeStatus && filters.prototypeStatus !== 'All') {
      query.prototypeStatus = filters.prototypeStatus;
    }
    if (filters.search && filters.search.trim() !== '') {
      query.$or = [
        { projectName: { $regex: filters.search, $options: 'i' } },
        { leadStudentName: { $regex: filters.search, $options: 'i' } },
        { campusName: { $regex: filters.search, $options: 'i' } },
      ];
    }
    return await CampusHackathonIncubator.find(query).sort({ createdAt: -1 });
  }

  public static async awardIncubatorGrant(
    projectId: string,
    grantUsd: number
  ): Promise<ICampusHackathonIncubator | null> {
    const project = await CampusHackathonIncubator.findById(projectId);
    if (!project) return null;

    const newGrant = project.incubatorGrantUsd + grantUsd;
    const newStatus = newGrant >= 25000 ? 'INCUBATED_STARTUP' : 'MINIMUM_VIABLE_PRODUCT';

    return await CampusHackathonIncubator.findByIdAndUpdate(
      projectId,
      {
        incubatorGrantUsd: newGrant,
        prototypeStatus: newStatus,
      },
      { new: true }
    );
  }
}
