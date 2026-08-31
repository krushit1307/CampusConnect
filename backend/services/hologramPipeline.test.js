/**
 * backend/services/hologramPipeline.test.js
 *
 * Verification Test Suite for WebRTC Volumetric Signaling, 3D LiDAR Point Cloud Compression,
 * and Hologram Controller API (Issue #5358).
 */

import assert from "assert";
import { HologramWebRTCService, hologramWebRTCService } from "./hologramWebRTCService.js";
import hologramRouter, {
  createHologramSessionHandler,
  getHologramSessionHandler,
  handleSignalHandler,
  listHologramSessionsHandler,
} from "../controllers/hologramController.js";

async function runTests() {
  console.log("--- Starting Holographic Telepresence Pipeline Tests ---");

  // Test 1: Service Instantiation & Session Creation
  console.log("Test 1: WebRTC Telepresence Session Creation");
  const service = new HologramWebRTCService();
  const session = service.createSession({
    sessionId: "test-session-tokyo-01",
    speakerName: "Kenji Sato",
    speakerRole: "CEO, QuantumVenture Labs",
    venueLocation: "Auditorium Stage A",
  });

  assert.strictEqual(session.sessionId, "test-session-tokyo-01");
  assert.strictEqual(session.speakerName, "Kenji Sato");
  assert.strictEqual(session.status, "INITIALIZING");
  assert.strictEqual(session.targetPointCount, 25000);
  assert.strictEqual(session.targetFps, 60);
  console.log(
    "✓ Test 1 Passed: Holographic session created with expected metadata and target specs.",
  );

  // Test 2: SDP Offer Signaling
  console.log("\nTest 2: WebRTC SDP Offer Signaling Exchange");
  const offerSignal = {
    type: "offer",
    payload: { sdp: "v=0\r\no=- 461173 2 IN IP4 127.0.0.1\r\ns=HologramVolumetricStream\r\n" },
    senderRole: "speaker",
    senderId: "speaker-tokyo-studio",
  };

  const offerResult = service.handleSignalMessage("test-session-tokyo-01", offerSignal);
  assert.strictEqual(offerResult.success, true);
  assert.strictEqual(offerResult.sessionStatus, "OFFER_RECEIVED");

  const updatedSession = service.getSession("test-session-tokyo-01");
  assert.ok(updatedSession.sdpOffer, "Session must store SDP offer");
  assert.strictEqual(updatedSession.peers.speaker, "speaker-tokyo-studio");
  console.log(
    "✓ Test 2 Passed: Processed SDP Offer and transitioned session status to OFFER_RECEIVED.",
  );

  // Test 3: SDP Answer & ICE Candidate Signaling
  console.log("\nTest 3: WebRTC SDP Answer & ICE Candidate Routing");
  const answerSignal = {
    type: "answer",
    payload: { sdp: "v=0\r\no=- 928371 2 IN IP4 127.0.0.1\r\ns=VenueHoloGauzeReceiver\r\n" },
    senderRole: "renderer",
    senderId: "venue-stage-receiver-01",
  };

  const answerResult = service.handleSignalMessage("test-session-tokyo-01", answerSignal);
  assert.strictEqual(answerResult.success, true);
  assert.strictEqual(answerResult.sessionStatus, "STREAMING");

  const candidateSignal = {
    type: "candidate",
    payload: {
      candidate: "candidate:1 1 UDP 2122252543 192.168.1.50 50000 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
    },
    senderRole: "speaker",
    senderId: "speaker-tokyo-studio",
  };

  const candidateResult = service.handleSignalMessage("test-session-tokyo-01", candidateSignal);
  assert.strictEqual(candidateResult.success, true);
  assert.strictEqual(service.getSession("test-session-tokyo-01").iceCandidates.speaker.length, 1);
  console.log("✓ Test 3 Passed: Successfully routed SDP Answer and ICE candidates.");

  // Test 4: 3D Point Cloud Quantization & Binary Buffer Compression
  console.log("\nTest 4: 3D Point Cloud Binary Serialization & Quantization");
  const mockPoints = [
    { x: -0.5, y: 1.6, z: 0.2, r: 0.2, g: 0.8, b: 1.0 },
    { x: 0.0, y: 1.7, z: -0.1, r: 0.3, g: 0.9, b: 0.95 },
    { x: 0.4, y: 1.2, z: 0.3, r: 0.9, g: 0.4, b: 0.9 },
  ];

  const compressedBuffer = service.packPointCloud(mockPoints);
  // Header is 28 bytes + 3 points * 9 bytes = 55 bytes
  assert.strictEqual(
    compressedBuffer.length,
    28 + 3 * 9,
    "Compressed buffer size must match header + quantized point size",
  );
  console.log(`✓ Test 4 Passed: 3D point cloud compressed to ${compressedBuffer.length} bytes.`);

  // Test 5: Binary Buffer Decompression & Geometric Fidelity
  console.log("\nTest 5: Binary Buffer Decompression to WebGL Float32Arrays");
  const unpacked = service.unpackPointCloud(compressedBuffer);
  assert.strictEqual(unpacked.pointCount, 3);
  assert.strictEqual(unpacked.positions.length, 9); // 3 points * 3 coordinates
  assert.strictEqual(unpacked.colors.length, 9); // 3 points * 3 colors

  // Verify coordinates are reconstructed within quantization tolerance (< 0.001)
  assert.ok(Math.abs(unpacked.positions[0] - -0.5) < 0.001, "Reconstructed X0 must match original");
  assert.ok(Math.abs(unpacked.positions[1] - 1.6) < 0.001, "Reconstructed Y0 must match original");
  assert.ok(Math.abs(unpacked.positions[2] - 0.2) < 0.001, "Reconstructed Z0 must match original");
  console.log(
    "✓ Test 5 Passed: Decompressed point cloud reconstructed with high geometric fidelity.",
  );

  // Test 6: Telemetry Aggregation
  console.log("\nTest 6: Real-time Telemetry Metrics Aggregation");
  const telemetry = service.updateTelemetry("test-session-tokyo-01", {
    fps: 59,
    bitrateMbps: 19.2,
    latencyMs: 35,
    framesTransmitted: 120,
    bytesTransmitted: 120 * 225000,
  });

  assert.strictEqual(telemetry.fps, 59);
  assert.strictEqual(telemetry.bitrateMbps, 19.2);
  assert.strictEqual(telemetry.latencyMs, 35);
  assert.strictEqual(telemetry.framesTransmitted, 120);
  console.log("✓ Test 6 Passed: Telemetry metrics aggregated and updated correctly.");

  // Test 7: Hologram Controller REST Endpoints
  console.log("\nTest 7: Hologram REST Controller Route Handlers");
  let responseStatusCode = null;
  let responseJsonData = null;

  const mockRes = {
    status: (code) => {
      responseStatusCode = code;
      return {
        json: (data) => {
          responseJsonData = data;
        },
      };
    },
  };

  // 7a: POST /api/hologram/session/create
  const createReq = {
    body: {
      sessionId: "test-session-controller-01",
      speakerName: "Kenji Sato",
      speakerRole: "CEO, QuantumVenture Labs (Tokyo)",
    },
  };
  await createHologramSessionHandler(createReq, mockRes);
  assert.strictEqual(responseStatusCode, 201);
  assert.strictEqual(responseJsonData.success, true);
  assert.strictEqual(responseJsonData.session.sessionId, "test-session-controller-01");

  // 7b: GET /api/hologram/session/:sessionId
  const getReq = { params: { sessionId: "test-session-controller-01" } };
  await getHologramSessionHandler(getReq, mockRes);
  assert.strictEqual(responseStatusCode, 200);
  assert.strictEqual(responseJsonData.session.speakerName, "Kenji Sato");

  // 7c: POST /api/hologram/signal
  const signalReq = {
    body: {
      sessionId: "test-session-controller-01",
      type: "offer",
      payload: { sdp: "v=0\r\ntest-sdp" },
      senderRole: "speaker",
    },
  };
  await handleSignalHandler(signalReq, mockRes);
  assert.strictEqual(responseStatusCode, 200);
  assert.strictEqual(responseJsonData.success, true);

  // 7d: GET /api/hologram/sessions
  await listHologramSessionsHandler({}, mockRes);
  assert.strictEqual(responseStatusCode, 200);
  assert.ok(responseJsonData.total >= 2);

  console.log(
    "✓ Test 7 Passed: Controller endpoints responded with 200/201 and validated payloads.",
  );

  console.log("\n======================================================");
  console.log("🎉 ALL HOLOGRAPHIC TELEPRESENCE TESTS PASSED (7/7)");
  console.log("======================================================");
}

runTests().catch((err) => {
  console.error("❌ Test Suite Failed:", err);
  process.exit(1);
});
