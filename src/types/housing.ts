export interface LifestyleProfile {
  sleepSchedule: 'early_bird' | 'night_owl' | 'flexible';
  cleanlinessLevel: number; // 1 (relaxed) to 5 (meticulous)
  noiseTolerance: number; // 1 (silent study) to 5 (social/music)
  guestFrequency: 'rarely' | 'weekends_only' | 'frequent';
  studyHabits: 'at_home' | 'library' | 'mixed';
  dietaryPreference?: string;
  petFriendly: boolean;
  budgetMax: number;
}

export interface RoommateCandidate {
  id: string;
  name: string;
  major: string;
  gradYear: number;
  avatarUrl?: string;
  bio: string;
  lifestyle: LifestyleProfile;
  compatibilityScore?: number; // 0-100%
  compatibilityHighlights?: string[];
}

export interface HousingSubletListing {
  id: string;
  title: string;
  address: string;
  distanceToCampusMiles: number;
  monthlyRent: number;
  availableTerm: string;
  bedrooms: number;
  bathrooms: number;
  panoramaImageUrl?: string;
  images: string[];
  utilitiesIncluded: boolean;
  amenities: string[];
  landlordOrSubletter: string;
  isVerified: boolean;
}
