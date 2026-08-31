export interface MentorSlot {
  id: string;
  dayOfWeek: string;
  startTime: string; // e.g. "14:00"
  endTime: string; // e.g. "14:45"
  isBooked: boolean;
  bookedByStudent?: string;
}

export interface MentorProfile {
  id: string;
  name: string;
  roleTitle: string; // e.g. "Incoming SWE @ Google, Former CS TA"
  major: string;
  avatarUrl?: string;
  bio: string;
  expertiseAreas: string[];
  rating: number; // 0-5.0
  totalSessionsCompleted: number;
  availableSlots: MentorSlot[];
  hourlyMeritCost: number; // Campus Merit Points or Free
}

export interface CampusQuest {
  id: string;
  title: string;
  category: 'academic' | 'career' | 'community' | 'leadership';
  tier: 1 | 2 | 3 | 4;
  description: string;
  rewardXp: number;
  rewardBadgeId?: string;
  rewardBadgeName?: string;
  currentProgress: number; // e.g. 2
  targetGoal: number; // e.g. 3
  status: 'locked' | 'in_progress' | 'completed';
  prerequisiteQuestIds: string[];
}

export interface VerifiableSkillBadge {
  id: string;
  title: string;
  issuer: string;
  category: string;
  issuedAt: string;
  signatureHash: string;
  iconName: string;
  xpValue: number;
}
