export interface AttendeeProfile {
  id: string;
  name: string;
  email: string;
  major: string;
  year: string; // e.g. "Senior", "Junior", "Sophomore", "Freshman"
  interests: string[];
  tags?: string[];
}

export interface BreakoutRoom {
  id: string;
  roomNumber: number;
  roomName: string;
  attendees: AttendeeProfile[];
  commonTags: string[];
  compatibilityScore: number; // 0 to 100%
}

/**
 * Calculates similarity coefficient between two attendee profiles (0 to 1) (#3540).
 * Weighted across: Major (0.35), Class Year (0.25), Interest Tags overlap (0.40).
 */
export function calculateProfileSimilarity(a: AttendeeProfile, b: AttendeeProfile): number {
  if (!a || !b) return 0;

  // Major match
  const majorScore = a.major && b.major && a.major.toLowerCase() === b.major.toLowerCase() ? 1 : 0;

  // Year match
  const yearScore = a.year && b.year && a.year.toLowerCase() === b.year.toLowerCase() ? 1 : 0;

  // Interests Jaccard similarity
  const aInterests = (a.interests || []).map((i) => i.toLowerCase().trim());
  const bInterests = (b.interests || []).map((i) => i.toLowerCase().trim());

  let interestScore = 0;
  if (aInterests.length > 0 && bInterests.length > 0) {
    const intersection = aInterests.filter((item) => bInterests.includes(item));
    const union = Array.from(new Set([...aInterests, ...bInterests]));
    interestScore = union.length > 0 ? intersection.length / union.length : 0;
  }

  return Number((majorScore * 0.35 + yearScore * 0.25 + interestScore * 0.4).toFixed(3));
}

/**
 * Algorithmic clustering of active attendees into optimal sub-groups/breakout rooms (#3540).
 * Groups users based on demographic & interest vectors to maximize networking synergy.
 */
export function matchBreakoutRooms(
  attendees: AttendeeProfile[],
  targetRoomSize: number = 5
): BreakoutRoom[] {
  if (!attendees || attendees.length === 0) return [];

  const safeRoomSize = Math.max(2, targetRoomSize || 5);
  const pool = [...attendees];
  const rooms: BreakoutRoom[] = [];
  let roomCounter = 1;

  while (pool.length > 0) {
    // Start a new room with the first attendee
    const seed = pool.shift()!;
    const roomAttendees: AttendeeProfile[] = [seed];

    // Find closest matching attendees in pool until room is filled or pool empty
    while (roomAttendees.length < safeRoomSize && pool.length > 0) {
      // Find candidate with highest average similarity to current room members
      let bestIndex = 0;
      let bestScore = -1;

      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[i];
        let totalSim = 0;
        for (const member of roomAttendees) {
          totalSim += calculateProfileSimilarity(candidate, member);
        }
        const avgSim = totalSim / roomAttendees.length;

        if (avgSim > bestScore) {
          bestScore = avgSim;
          bestIndex = i;
        }
      }

      roomAttendees.push(pool.splice(bestIndex, 1)[0]);
    }

    // Determine common tags / dominant traits for room naming
    const tagCountMap = new Map<string, number>();
    const majorCountMap = new Map<string, number>();

    roomAttendees.forEach((a) => {
      if (a.major) {
        majorCountMap.set(a.major, (majorCountMap.get(a.major) || 0) + 1);
      }
      (a.interests || []).forEach((interest) => {
        tagCountMap.set(interest, (tagCountMap.get(interest) || 0) + 1);
      });
    });

    const sortedTags = Array.from(tagCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    const sortedMajors = Array.from(majorCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    const dominantMajor = sortedMajors[0] || "Networking";
    const topInterest = sortedTags[0] || "General";

    // Calculate room overall internal compatibility score
    let pairScoresSum = 0;
    let pairsCount = 0;
    for (let i = 0; i < roomAttendees.length; i++) {
      for (let j = i + 1; j < roomAttendees.length; j++) {
        pairScoresSum += calculateProfileSimilarity(roomAttendees[i], roomAttendees[j]);
        pairsCount += 1;
      }
    }
    const avgCompatibility = pairsCount > 0 ? Math.round((pairScoresSum / pairsCount) * 100) : 85;

    rooms.push({
      id: `room-${roomCounter}`,
      roomNumber: roomCounter,
      roomName: `Room ${roomCounter}: ${dominantMajor} & ${topInterest}`,
      attendees: roomAttendees,
      commonTags: sortedTags.slice(0, 3),
      compatibilityScore: Math.min(100, Math.max(65, avgCompatibility)),
    });

    roomCounter += 1;
  }

  return rooms;
}

/**
 * Generates standard Zoom Pre-assignment compatible CSV export (#3540).
 * Format: "Pre-assign Room Name,Email Address"
 */
export function exportZoomBreakoutCsv(rooms: BreakoutRoom[]): string {
  const lines = ["Pre-assign Room Name,Email Address"];

  rooms.forEach((room) => {
    const roomLabel = `Room ${room.roomNumber}`;
    room.attendees.forEach((attendee) => {
      lines.push(`"${roomLabel}","${attendee.email}"`);
    });
  });

  return lines.join("\n");
}
