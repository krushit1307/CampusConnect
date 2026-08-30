// server/controllers/speakerGraphController.js
import { fetchShortestPath } from '../services/linkedinGraphService.js';

/**
 * Technical Requirement 1 & 2:
 * Utilizes the linked LinkedIn OAuth token to query the LinkedIn Graph API
 * and find the shortest path between the Student and the Speaker.
 */
export const getSpeakerProximityGraph = async (req, res) => {
  try {
    const { studentId, speakerId } = req.query;
    
    // Extract OAuth token from session or headers
    const linkedInToken = req.headers.authorization?.split(" ")[1] || "mock_oauth_token";

    if (!studentId || !speakerId) {
      return res.status(400).json({ error: "Missing studentId or speakerId parameters" });
    }

    // Delegate to the LinkedIn Graph Service to traverse the network graph
    const graphResult = await fetchShortestPath(studentId, speakerId, linkedInToken);

    if (!graphResult) {
      return res.status(404).json({ error: "No direct or 2nd-degree path found between user and speaker." });
    }

    return res.status(200).json(graphResult);

  } catch (error) {
    console.error("[Graph Controller] Error fetching speaker network proximity:", error);
    return res.status(500).json({ error: "Internal server error while resolving social graph." });
  }
};
