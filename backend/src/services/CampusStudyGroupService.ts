import { Router, Request, Response } from 'express';

export interface StudyGroupDTO {
  id: string;
  courseCode: string;
  groupName: string;
  organizerName: string;
  memberCount: number;
  maxCapacity: number;
  meetingTime: string;
  location: string;
  isJoined: boolean;
}

export class CampusStudyGroupService {
  private groups: StudyGroupDTO[] = [
    {
      id: 'grp-401',
      courseCode: 'CS301',
      groupName: 'Graph Theory & Dynamic Programming Sprint',
      organizerName: 'Elena Rostova',
      memberCount: 7,
      maxCapacity: 10,
      meetingTime: 'Tuesdays & Thursdays @ 5:00 PM',
      location: 'Engineering Library, Room 402',
      isJoined: false,
    },
    {
      id: 'grp-402',
      courseCode: 'PHYS402',
      groupName: 'Schrödinger Equation Proof Working Circle',
      organizerName: 'Marcus Vance',
      memberCount: 4,
      maxCapacity: 6,
      meetingTime: 'Mondays @ 6:30 PM',
      location: 'Physics Building, Seminar Room B',
      isJoined: false,
    },
  ];

  public getGroups(courseCode?: string): StudyGroupDTO[] {
    if (!courseCode) return this.groups;
    return this.groups.filter(g => g.courseCode === courseCode);
  }

  public joinGroup(groupId: string): StudyGroupDTO | null {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return null;

    if (group.memberCount < group.maxCapacity) {
      group.memberCount += 1;
      group.isJoined = true;
    }
    return group;
  }
}

const studyService = new CampusStudyGroupService();
const studyRouter = Router();

studyRouter.get('/study-groups', (req: Request, res: Response) => {
  const { courseCode } = req.query;
  const items = studyService.getGroups(courseCode as string);
  res.json({ success: true, data: items });
});

studyRouter.post('/study-groups/:id/join', (req: Request, res: Response) => {
  const updated = studyService.joinGroup(req.params.id);
  if (!updated) return res.status(404).json({ success: false, error: 'Group not found' });
  res.json({ success: true, data: updated });
});

export default studyRouter;
