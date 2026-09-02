/**
 * backend/services/hologramWebRTCService.js
 *
 * WebRTC Volumetric Telepresence Signaling & Stream Management Service.
 * Issue #5358: Dynamic Alumni Speaker Holographic Telepresence Rendering.
 */

import { EventEmitter } from "events";
import crypto from "crypto";

export class HologramWebRTCService extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.telemetryLogs = new Map();
    this._initializeDefaultSession();
  }

  _initializeDefaultSession() {
    const defaultSessionId = "holo-session-tokyo-ceo-01";
    this.createSession({
      sessionId: defaultSessionId,
      speakerName: "Kenji Sato",
      speakerRole: "CEO & Founder, QuantumVenture Labs (Tokyo)",
      alumniClass: "Class of 2018 (Computer Science)",
      eventTitle: "Distinguished Alumni Keynote: The Holographic Future of Global Work",
      venueLocation: "Campus Grand Auditorium - Stage A",
      targetFps: 60,
      targetPointCount: 25000,
      volumetricResolution: "1080p_LiDAR_Volumetric",
    });
  }

  /**
   * Initializes a new holographic keynote telepresence session.
   */
  createSession(options = {}) {
    const sessionId = options.sessionId || `holo-${crypto.randomBytes(4).toString("hex")}`;

    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    const session = {
      sessionId,
      speakerName: options.speakerName || "Alumni Keynote Speaker",
      speakerRole: options.speakerRole || "Distinguished Alumni",
      alumniClass: options.alumniClass || "Alumni Network",
      eventTitle: options.eventTitle || "CampusConnect Holographic Keynote",
      venueLocation: options.venueLocation || "Main Hall HoloGauze Stage",
      targetFps: options.targetFps || 60,
      targetPointCount: options.targetPointCount || 25000,
      volumetricResolution: options.volumetricResolution || "1080p_LiDAR_Volumetric",
      status: "INITIALIZING", // INITIALIZING, READY, STREAMING, PAUSED, CLOSED
      createdAt: new Date().toISOString(),
      peers: {
        speaker: null,
        renderers: [],
      },
      sdpOffer: null,
      sdpAnswer: null,
      iceCandidates: {
        speaker: [],
        renderers: [],
      },
      telemetry: {
        fps: 60,
        bitrateMbps: 18.4,
        latencyMs: 38,
        jitterMs: 1.8,
        packetLossRate: 0.001,
        totalPointsRendered: options.targetPointCount || 25000,
        framesTransmitted: 0,
        bytesTransmitted: 0,
        lastUpdated: new Date().toISOString(),
      },
    };

    this.sessions.set(sessionId, session);
    this.emit("session_created", session);
    return session;
  }

  /**
   * Retrieves a session by ID.
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Lists all active sessions.
   */
  listSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Processes WebRTC signaling messages (offer, answer, candidate).
   */
  handleSignalMessage(sessionId, signalData) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Hologram session '${sessionId}' not found.`);
    }

    const { type, payload, senderRole, senderId } = signalData;

    switch (type) {
      case "offer":
        session.sdpOffer = {
          sdp: payload.sdp,
          senderId: senderId || "speaker-client",
          timestamp: new Date().toISOString(),
        };
        session.status = "OFFER_RECEIVED";
        session.peers.speaker = senderId || "speaker-tokyo";
        this.emit("signal_offer", { sessionId, offer: session.sdpOffer });
        break;

      case "answer":
        session.sdpAnswer = {
          sdp: payload.sdp,
          senderId: senderId || "venue-renderer",
          timestamp: new Date().toISOString(),
        };
        session.status = "STREAMING";
        if (!session.peers.renderers.includes(senderId)) {
          session.peers.renderers.push(senderId || "venue-stage-renderer-01");
        }
        this.emit("signal_answer", { sessionId, answer: session.sdpAnswer });
        break;

      case "candidate":
        if (senderRole === "speaker") {
          session.iceCandidates.speaker.push(payload);
        } else {
          session.iceCandidates.renderers.push(payload);
        }
        this.emit("signal_candidate", { sessionId, senderRole, candidate: payload });
        break;

      default:
        throw new Error(
          `Unsupported WebRTC signal type: '${type}'. Expected 'offer', 'answer', or 'candidate'.`,
        );
    }

    return {
      success: true,
      sessionId,
      type,
      sessionStatus: session.status,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Serializes and quantizes a 3D point cloud array into a compressed binary Buffer/ArrayBuffer.
   *
   * @param {Array<{x: number, y: number, z: number, r: number, g: number, b: number}>} points
   * @returns {Buffer} Compressed binary payload
   */
  packPointCloud(points) {
    const pointCount = points.length;
    if (pointCount === 0) {
      return Buffer.alloc(0);
    }

    // 1. Calculate bounding box for 16-bit fixed-point quantization
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < pointCount; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    // Safety margins
    if (minX === maxX) maxX += 0.001;
    if (minY === maxY) maxY += 0.001;
    if (minZ === maxZ) maxZ += 0.001;

    // Header size:
    // 4 bytes: uint32 pointCount
    // 24 bytes: 6 x float32 (minX, maxX, minY, maxY, minZ, maxZ)
    // Total Header = 28 bytes
    // Per point payload:
    // 6 bytes: 3 x uint16 (quantized x, y, z in [0, 65535])
    // 3 bytes: 3 x uint8 (r, g, b in [0, 255])
    // Total per point = 9 bytes (vs 24 bytes uncompressed float)
    const headerSize = 28;
    const pointSize = 9;
    const totalBytes = headerSize + pointCount * pointSize;
    const buffer = Buffer.alloc(totalBytes);

    // Write header
    buffer.writeUInt32LE(pointCount, 0);
    buffer.writeFloatLE(minX, 4);
    buffer.writeFloatLE(maxX, 8);
    buffer.writeFloatLE(minY, 12);
    buffer.writeFloatLE(maxY, 16);
    buffer.writeFloatLE(minZ, 20);
    buffer.writeFloatLE(maxZ, 24);

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const rangeZ = maxZ - minZ;

    let offset = headerSize;
    for (let i = 0; i < pointCount; i++) {
      const p = points[i];
      // Quantize coordinates to [0, 65535]
      const qx = Math.max(0, Math.min(65535, Math.round(((p.x - minX) / rangeX) * 65535)));
      const qy = Math.max(0, Math.min(65535, Math.round(((p.y - minY) / rangeY) * 65535)));
      const qz = Math.max(0, Math.min(65535, Math.round(((p.z - minZ) / rangeZ) * 65535)));

      buffer.writeUInt16LE(qx, offset);
      buffer.writeUInt16LE(qy, offset + 2);
      buffer.writeUInt16LE(qz, offset + 4);

      // Colors to [0, 255]
      const r = Math.max(0, Math.min(255, Math.round(p.r <= 1 ? p.r * 255 : p.r)));
      const g = Math.max(0, Math.min(255, Math.round(p.g <= 1 ? p.g * 255 : p.g)));
      const b = Math.max(0, Math.min(255, Math.round(p.b <= 1 ? p.b * 255 : p.b)));

      buffer.writeUInt8(r, offset + 6);
      buffer.writeUInt8(g, offset + 7);
      buffer.writeUInt8(b, offset + 8);

      offset += pointSize;
    }

    return buffer;
  }

  /**
   * Decompresses a binary WebRTC buffer back to Float32 position and color arrays for WebGL rendering.
   *
   * @param {Buffer|Uint8Array} buffer
   * @returns {{positions: Float32Array, colors: Float32Array, pointCount: number}}
   */
  unpackPointCloud(buffer) {
    if (!buffer || buffer.length < 28) {
      return {
        pointCount: 0,
        positions: new Float32Array(0),
        colors: new Float32Array(0),
      };
    }

    const nodeBuf = Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const pointCount = nodeBuf.readUInt32LE(0);
    const minX = nodeBuf.readFloatLE(4);
    const maxX = nodeBuf.readFloatLE(8);
    const minY = nodeBuf.readFloatLE(12);
    const maxY = nodeBuf.readFloatLE(16);
    const minZ = nodeBuf.readFloatLE(20);
    const maxZ = nodeBuf.readFloatLE(24);

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const rangeZ = maxZ - minZ;

    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);

    const headerSize = 28;
    const pointSize = 9;

    let offset = headerSize;
    for (let i = 0; i < pointCount; i++) {
      const qx = nodeBuf.readUInt16LE(offset);
      const qy = nodeBuf.readUInt16LE(offset + 2);
      const qz = nodeBuf.readUInt16LE(offset + 4);

      positions[i * 3] = minX + (qx / 65535) * rangeX;
      positions[i * 3 + 1] = minY + (qy / 65535) * rangeY;
      positions[i * 3 + 2] = minZ + (qz / 65535) * rangeZ;

      const r = nodeBuf.readUInt8(offset + 6);
      const g = nodeBuf.readUInt8(offset + 7);
      const b = nodeBuf.readUInt8(offset + 8);

      colors[i * 3] = r / 255;
      colors[i * 3 + 1] = g / 255;
      colors[i * 3 + 2] = b / 255;

      offset += pointSize;
    }

    return {
      pointCount,
      positions,
      colors,
    };
  }

  /**
   * Updates and returns telemetry statistics for a session.
   */
  updateTelemetry(sessionId, telemetryDelta = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found.`);
    }

    session.telemetry = {
      ...session.telemetry,
      ...telemetryDelta,
      lastUpdated: new Date().toISOString(),
    };

    return session.telemetry;
  }
}

// Singleton instance
export const hologramWebRTCService = new HologramWebRTCService();
export default hologramWebRTCService;
