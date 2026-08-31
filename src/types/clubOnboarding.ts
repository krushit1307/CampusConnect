export interface ExecutiveOfficer {
  name: string;
  email: string;
  role: 'President' | 'Vice President' | 'Treasurer' | 'Secretary' | 'Tech Lead';
}

export interface ClubOnboardingState {
  currentStep: number; // 1 to 5
  isCompleted: boolean;
  clubName: string;
  tagline: string;
  category: string;
  logoUrl?: string;
  primaryColor: string;
  missionStatement: string;
  meetingSchedule: string;
  executives: ExecutiveOfficer[];
  constitutionUploaded: boolean;
  constitutionFileName?: string;
  firstEventDraft: {
    title: string;
    date: string;
    location: string;
    description: string;
  };
}
