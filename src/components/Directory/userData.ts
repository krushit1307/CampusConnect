import { UserProfile, UserDataOptions } from "./types";

/**
 * Generates mock user data for the directory.
 * This is separated into its own module to enable code splitting
 * and potential web worker usage in the future.
 */
export function generateMockUsers(options: UserDataOptions = {}): UserProfile[] {
  const {
    count = 100000,
    roles = ["Student", "Professor", "Researcher", "Alumni", "Staff"],
    departments = ["Computer Science", "Engineering", "Business", "Biology", "Arts"],
    majors = [
      "Computer Science",
      "Mechanical Engineering",
      "Finance",
      "Genetics",
      "Graphic Design",
    ],
    allInterests = ["Coding", "Robotics", "Reading", "Sports", "Music", "Art", "Gaming", "Writing"],
  } = options;

  return Array.from({ length: count }, (_, i) => {
    const userInterests = [
      allInterests[i % allInterests.length],
      allInterests[(i + 3) % allInterests.length],
    ];
    return {
      id: i + 1,
      name: `User #${i + 1}`,
      email: `user${i + 1}@university.edu`,
      role: roles[i % roles.length],
      department: departments[i % departments.length],
      major: majors[i % majors.length],
      interests: userInterests,
    };
  });
}

/**
 * Filters users based on search query.
 * Extracted to enable code splitting and potential web worker usage.
 */
export function filterUsers(users: UserProfile[], searchQuery: string): UserProfile[] {
  if (!searchQuery.trim()) return users;

  const query = searchQuery.toLowerCase();
  return users.filter(
    (user) =>
      user.name.toLowerCase().includes(query) ||
      user.major.toLowerCase().includes(query) ||
      user.interests.some((interest) => interest.toLowerCase().includes(query)),
  );
}
