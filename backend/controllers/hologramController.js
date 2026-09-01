/**
 * backend/controllers/hologramController.js
 *
 * REST Controller for Holographic Telepresence Session Management & WebRTC Signaling.
 * Issue #5358: Dynamic Alumni Speaker Holographic Telepresence Rendering.
 */

import { hologramWebRTCService } from "../services/hologramWebRTCService.js";

// Safe dynamic router initialization (supporting both express environment and standalone mock)
let router;
try {
  const express = (await import("express")).default;
  router = express.Router();
} catch {
  const routes = [];
  const addRoute =
    (method) =>
    (path, ...handlers) => {
      const handler = handlers[handlers.length - 1];
      routes.push({
        route: {
          path,
          methods: { [method.toLowerCase()]: true },
          stack: [{ handle: handler }],
        },
      });
    };
  router = {
    stack: routes,
    get: addRoute("GET"),
    post: addRoute("POST"),
    put: addRoute("PUT"),
    delete: addRoute("DELETE"),
  };
}

/**
 * POST /api/hologram/session/create
 * Initializes a new holographic telepresence session.
 */
export const createHologramSessionHandler = async (req, res) => {
  try {
    const {
      sessionId,
      speakerName,
      speakerRole,
      alumniClass,
      eventTitle,
      venueLocation,
      targetFps,
      targetPointCount,
      volumetricResolution,
    } = req.body || {};

    const session = hologramWebRTCService.createSession({
      sessionId,
      speakerName: speakerName || "Kenji Sato",
      speakerRole: speakerRole || "CEO & Founder, QuantumVenture Labs (Tokyo)",
      alumniClass: alumniClass || "Class of 2018 (Computer Science)",
      eventTitle:
        eventTitle || "Distinguished Alumni Keynote: The Holographic Future of Global Work",
      venueLocation: venueLocation || "Campus Grand Auditorium - Stage A (HoloGauze)",
      targetFps: targetFps || 60,
      targetPointCount: targetPointCount || 25000,
      volumetricResolution: volumetricResolution || "1080p_LiDAR_Volumetric",
    });

    return res.status(201).json({
      success: true,
      message: "Holographic telepresence session initialized.",
      session,
    });
  } catch (error) {
    console.error("[HOLOGRAM CONTROLLER] Error creating session:", error);
    return res
      .status(500)
      .json({ error: "Failed to initialize holographic session: " + error.message });
  }
};

router.post("/session/create", createHologramSessionHandler);
router.post("/api/hologram/session/create", createHologramSessionHandler);

/**
 * GET /api/hologram/session/:sessionId
 * Retrieves live session status, connected WebRTC peers, and real-time telemetry.
 */
export const getHologramSessionHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = hologramWebRTCService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: `Hologram session '${sessionId}' not found.` });
    }

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("[HOLOGRAM CONTROLLER] Error fetching session:", error);
    return res.status(500).json({ error: "Failed to fetch holographic session status." });
  }
};

router.get("/session/:sessionId", getHologramSessionHandler);
router.get("/api/hologram/session/:sessionId", getHologramSessionHandler);

/**
 * POST /api/hologram/signal
 * Relays SDP offers, answers, and ICE candidates between speaker and venue clients.
 */
export const handleSignalHandler = async (req, res) => {
  try {
    const { sessionId, type, payload, senderRole, senderId } = req.body || {};

    if (!sessionId || !type || !payload) {
      return res.status(400).json({
        error: "Missing required signaling parameters: sessionId, type, and payload are required.",
      });
    }

    const signalResult = hologramWebRTCService.handleSignalMessage(sessionId, {
      type,
      payload,
      senderRole: senderRole || "speaker",
      senderId: senderId || "speaker-client-01",
    });

    return res.status(200).json({
      success: true,
      message: `WebRTC signal '${type}' processed successfully.`,
      signalResult,
    });
  } catch (error) {
    console.error("[HOLOGRAM CONTROLLER] Signaling error:", error);
    return res.status(500).json({ error: error.message });
  }
};

router.post("/signal", handleSignalHandler);
router.post("/api/hologram/signal", handleSignalHandler);

/**
 * GET /api/hologram/sessions
 * Returns all active telepresence sessions.
 */
export const listHologramSessionsHandler = async (req, res) => {
  try {
    const sessions = hologramWebRTCService.listSessions();
    return res.status(200).json({
      success: true,
      total: sessions.length,
      sessions,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to list holographic sessions." });
  }
};

router.get("/sessions", listHologramSessionsHandler);
router.get("/api/hologram/sessions", listHologramSessionsHandler);

export default router;
