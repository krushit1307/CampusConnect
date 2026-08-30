export interface EmployerBooth {
  id: string;
  name: string;
  industry: string;
  boothNumber: string;
  x: number; // coordinates on venue grid (0-10)
  y: number;
  hiringRoles: string[];
  techStack: string[];
  matchScore?: number; // Calculated match percentage (0-100)
  matchReason?: string;
  sponsorTier?: 'platinum' | 'gold' | 'silver';
  virtualQueueLength: number;
  estimatedWaitMinutes: number;
}

export interface StudentResumeProfile {
  name: string;
  major: string;
  graduationYear: number;
  skills: string[];
  experienceSummary: string;
  resumeFileName?: string;
  targetRoles: string[];
}

export interface CareerFairVenue {
  id: string;
  title: string;
  location: string;
  date: string;
  gridWidth: number;
  gridHeight: number;
  booths: EmployerBooth[];
}
