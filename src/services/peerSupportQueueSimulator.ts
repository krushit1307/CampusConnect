// =============================================================================
// File: src/services/peerSupportQueueSimulator.ts
// Issue: #4296 - Develop a 'Dynamic "Mental Health" Peer Support Matcher'
// Description: Real-time peer matchmaking simulation, live WebSocket handshake,
//              and interactive box-breathing calming exercise generator.
// =============================================================================

import type {
  PeerListenerProfile,
  AnonymousSessionState,
  EncryptedChatMessage,
} from "@/types/peerSupportMatcher";
import {
  getMockPeerListeners,
  generateEphemeralSessionKey,
  encryptEphemeralMessage,
} from "@/services/peerSupportMatcherService";

export interface BoxBreathingPhase {
  phase: "inhale" | "hold_in" | "exhale" | "hold_out";
  label: string;
  durationSeconds: number;
  instruction: string;
  progressPercent: number;
}

/**
 * Returns current box-breathing cycle instruction based on elapsed seconds.
 */
export function getBoxBreathingInstruction(elapsedSeconds: number): BoxBreathingPhase {
  const cycleTime = elapsedSeconds % 16; // 4s inhale, 4s hold, 4s exhale, 4s hold

  if (cycleTime < 4) {
    return {
      phase: "inhale",
      label: "Breathe In Deeply",
      durationSeconds: 4,
      instruction: "Inhale slowly through your nose, expanding your diaphragm...",
      progressPercent: (cycleTime / 4) * 100,
    };
  } else if (cycleTime < 8) {
    return {
      phase: "hold_in",
      label: "Hold Breath",
      durationSeconds: 4,
      instruction: "Hold your breath gently. Relax your shoulders and jaw...",
      progressPercent: ((cycleTime - 4) / 4) * 100,
    };
  } else if (cycleTime < 12) {
    return {
      phase: "exhale",
      label: "Breathe Out Slowly",
      durationSeconds: 4,
      instruction: "Release the air slowly through your mouth...",
      progressPercent: ((cycleTime - 8) / 4) * 100,
    };
  } else {
    return {
      phase: "hold_out",
      label: "Rest & Pause",
      durationSeconds: 4,
      instruction: "Pause and notice the quiet before your next breath...",
      progressPercent: ((cycleTime - 12) / 4) * 100,
    };
  }
}

/**
 * Simulates a certified peer listener accepting the incoming session.
 */
export async function simulatePeerListenerMatch(
  session: AnonymousSessionState,
  cryptoKey: CryptoKey
): Promise<{ updatedSession: AnonymousSessionState; listener: PeerListenerProfile }> {
  const listeners = getMockPeerListeners();
  const matchedListener = listeners[0]; // MindfulPenguin19

  const now = new Date().toISOString();

  // Create initial empathetic greeting
  const greetingPlaintext = `Hey there! I'm ${matchedListener.anonymousAlias}. I'm a psychology senior and fellow student. I'm right here with you. Take all the time you need—what's been on your mind?`;
  const { ciphertextBase64, ivBase64 } = await encryptEphemeralMessage(
    greetingPlaintext,
    cryptoKey
  );

  const greetingMessage: EncryptedChatMessage = {
    id: `msg-${Date.now()}`,
    senderRole: "peer_listener",
    ciphertext: ciphertextBase64,
    iv: ivBase64,
    plaintext: greetingPlaintext,
    timestamp: now,
  };

  const updatedSession: AnonymousSessionState = {
    ...session,
    status: "matched_active",
    matchedAt: now,
    matchedListener,
    messages: [...session.messages, greetingMessage],
  };

  return { updatedSession, listener: matchedListener };
}
