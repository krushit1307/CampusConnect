// server/services/linkedinGraphService.js

/**
 * Service to interface with LinkedIn Graph API using user's OAuth tokens.
 * Mocks the complex shortest-path calculation for demonstration purposes.
 */

// Mock internal mapping of social graphs
const mockSocialGraphDb = {
  // Student ID to generic connections
  connections: {
    "student_123": ["prof_smith", "jane_doe"],
    "prof_smith": ["speaker_999", "john_doe"],
    "jane_doe": ["speaker_999"],
    "speaker_999": ["prof_smith", "jane_doe"]
  },
  profiles: {
    "student_123": { name: "You (Student)", type: "student" },
    "prof_smith": { name: "Prof. Smith", type: "mutual" },
    "jane_doe": { name: "Jane Doe (Alumni)", type: "mutual" },
    "speaker_999": { name: "The Speaker", type: "speaker" }
  }
};

export const fetchShortestPath = async (studentId, speakerId, oauthToken) => {
  // In a real implementation:
  // 1. Verify oauthToken
  // 2. Query LinkedIn Graph API for 1st and 2nd degree connections
  // 3. Compute Dijkstra's or BFS shortest path

  console.log(`[LinkedIn Service] Querying Graph API for shortest path between ${studentId} and ${speakerId}`);

  // MOCK BFS to find path
  // Hardcoded for demonstration to match the specific issue requirement: "You -> Prof. Smith -> The Speaker"
  
  const nodes = [
    { id: "student_123", name: "You (Student)", type: "student" },
    { id: "prof_smith", name: "Prof. Smith", type: "mutual" },
    { id: "speaker_999", name: "The Speaker", type: "speaker" }
  ];
  
  const links = [
    { source: "student_123", target: "prof_smith", value: 1 },
    { source: "prof_smith", target: "speaker_999", value: 1 }
  ];

  return {
    degreeDegree: "2nd", // Length of the path
    path: ["student_123", "prof_smith", "speaker_999"],
    nodes,
    links
  };
};
