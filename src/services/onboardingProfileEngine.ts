/**
 * Onboarding Profile Engine
 * Student onboarding schemas, major taxonomies, interest tag selectors, and profile completeness calculators.
 */

export interface OnboardingProfileData {
    fullName: string;
    major: string;
    graduationYear: number;
    bio: string;
    selectedInterests: string[];
}

export const CAMPUS_INTEREST_TAGS = [
    "Artificial Intelligence", "Hackathons", "Web Development",
    "Robotics", "Cybersecurity", "UI/UX Design", "Data Science", "Open Source"
];

export const calculateProfileCompleteness = (data: OnboardingProfileData): number => {
    let score = 0;
    if (data.fullName.trim()) score += 25;
    if (data.major) score += 25;
    if (data.bio.trim()) score += 25;
    if (data.selectedInterests.length >= 3) score += 25;
    return score;
};
