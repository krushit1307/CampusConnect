import { LifestyleProfile, RoommateCandidate } from '@/types/housing';

/**
 * Multi-factor Roommate Compatibility Scoring Algorithm.
 * Computes a weighted 0-100% score comparing two student lifestyle profiles.
 */
export function calculateRoommateCompatibility(
  myProfile: LifestyleProfile,
  candidateProfile: LifestyleProfile
): {
  score: number;
  highlights: string[];
} {
  let scoreTotal = 0;
  const highlights: string[] = [];

  // 1. Sleep Schedule Match (20% Weight)
  if (myProfile.sleepSchedule === candidateProfile.sleepSchedule) {
    scoreTotal += 20;
    highlights.push('Identical sleep schedules');
  } else if (
    myProfile.sleepSchedule === 'flexible' ||
    candidateProfile.sleepSchedule === 'flexible'
  ) {
    scoreTotal += 14;
  } else {
    scoreTotal += 4;
  }

  // 2. Cleanliness Scale (20% Weight) - Diff of 0 is 20pts, diff of 1 is 15pts, diff of 2 is 8pts, etc.
  const cleanDiff = Math.abs(myProfile.cleanlinessLevel - candidateProfile.cleanlinessLevel);
  if (cleanDiff === 0) {
    scoreTotal += 20;
    highlights.push('Matching cleanliness expectations');
  } else if (cleanDiff === 1) {
    scoreTotal += 15;
  } else if (cleanDiff === 2) {
    scoreTotal += 8;
  } else {
    scoreTotal += 2;
  }

  // 3. Noise Tolerance (20% Weight)
  const noiseDiff = Math.abs(myProfile.noiseTolerance - candidateProfile.noiseTolerance);
  if (noiseDiff === 0) {
    scoreTotal += 20;
    highlights.push('Harmonious noise & study preferences');
  } else if (noiseDiff === 1) {
    scoreTotal += 14;
  } else if (noiseDiff === 2) {
    scoreTotal += 7;
  }

  // 4. Guest Frequency (15% Weight)
  if (myProfile.guestFrequency === candidateProfile.guestFrequency) {
    scoreTotal += 15;
    highlights.push('Aligned guest & social visit policies');
  } else if (
    myProfile.guestFrequency === 'weekends_only' ||
    candidateProfile.guestFrequency === 'weekends_only'
  ) {
    scoreTotal += 10;
  } else {
    scoreTotal += 3;
  }

  // 5. Pet Compatibility (15% Weight)
  if (myProfile.petFriendly === candidateProfile.petFriendly) {
    scoreTotal += 15;
    highlights.push(myProfile.petFriendly ? 'Both pet friendly' : 'Both prefer no pets');
  } else {
    scoreTotal += 0;
  }

  // 6. Budget Overlap (10% Weight)
  const budgetDiff = Math.abs(myProfile.budgetMax - candidateProfile.budgetMax);
  if (budgetDiff <= 100) {
    scoreTotal += 10;
    highlights.push('Similar rent budget target');
  } else if (budgetDiff <= 250) {
    scoreTotal += 6;
  } else {
    scoreTotal += 2;
  }

  return {
    score: Math.min(100, Math.round(scoreTotal)),
    highlights: highlights.slice(0, 3),
  };
}
