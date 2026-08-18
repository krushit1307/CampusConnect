export interface GroupOrganizerMetadata {
  userId: string;
  fullName: string;
  role: string;
  avatarUrl: string;
}

export class StudyGroupModel {
  public id: string;
  public courseCode: string;
  public courseTitle: string;
  public groupTitle: string;
  public description: string;
  public organizer: GroupOrganizerMetadata;
  public currentMembersCount: number;
  public maxMemberLimit: number;
  public meetingSchedule: string;
  public roomLocation: string;
  public tags: string[];
  public difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  public createdAt: string;

  constructor(data: Partial<StudyGroupModel>) {
    this.id = data.id || `grp_${Math.random().toString(36).substr(2, 9)}`;
    this.courseCode = data.courseCode || 'GEN100';
    this.courseTitle = data.courseTitle || 'General Education Studies';
    this.groupTitle = data.groupTitle || 'Peer Study Circle';
    this.description = data.description || '';
    this.organizer = data.organizer || {
      userId: 'usr_org_1',
      fullName: 'Student Lead',
      role: 'Peer Facilitator',
      avatarUrl: '',
    };
    this.currentMembersCount = data.currentMembersCount || 1;
    this.maxMemberLimit = data.maxMemberLimit || 10;
    this.meetingSchedule = data.meetingSchedule || 'TBD';
    this.roomLocation = data.roomLocation || 'Campus Library';
    this.tags = data.tags || [];
    this.difficulty = data.difficulty || 'Intermediate';
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      courseCode: this.courseCode,
      courseTitle: this.courseTitle,
      groupTitle: this.groupTitle,
      description: this.description,
      organizer: this.organizer,
      currentMembersCount: this.currentMembersCount,
      maxMemberLimit: this.maxMemberLimit,
      meetingSchedule: this.meetingSchedule,
      roomLocation: this.roomLocation,
      tags: this.tags,
      difficulty: this.difficulty,
      createdAt: this.createdAt,
    };
  }
}
