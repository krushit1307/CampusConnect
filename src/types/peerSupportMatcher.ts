// =============================================================================
// File: src/types/peerSupportMatcher.ts
// Issue: #4296 - Develop a 'Dynamic "Mental Health" Peer Support Matcher'
// Description: Type definitions for anonymous peer support queues, Web Crypto
//              E2EE ephemeral messaging, certified listener profiles, and crisis escalation.
// =============================================================================

export type SupportTopicCategory =
  | "academic_burnout"
  | "social_isolation"
  | "post_event_overwhelm"
  | "grief_loss"
  | "imposter_syndrome"
  | "relationship_conflict"
  | "general_venting";

export type AnonymousSessionStatus =
  | "in_queue"
  | "matched_active"
  | "escalated_crisis"
  | "closed_keys_destroyed";

export interface PeerListenerProfile {
  id: string;
  anonymousAlias: string; // e.g. "MindfulPenguin42"
  majorOrFocus: string; // "Senior Psychology & Cognitive Science"
  certificationLevel: "CERTIFIED_PEER_SUPPORTER" | "ACTIVE_LISTENING_TIER_2" | "CRISIS_TRAINED_SENIOR";
  totalSessionsCompleted: number;
  isAvailableOnline: boolean;
  trainingCompletedDate: string;
}

export interface EncryptedChatMessage {
  id: string;
  senderRole: "student" | "peer_listener" | "system_shield";
  ciphertext: string; // Base64 AES-GCM 256 ciphertext
  iv: string; // Base64 12-byte initialization vector
  plaintext?: string; // Only populated in local volatile browser memory after E2EE decryption
  timestamp: string;
  isSafetyWarning?: boolean;
}

export interface AnonymousSessionState {
  sessionId: string;
  topic: SupportTopicCategory;
  moodRating: number; // 1 (Awful) to 5 (Okay)
  status: AnonymousSessionStatus;
  createdAt: string;
  matchedAt?: string;
  closedAt?: string;
  matchedListener?: PeerListenerProfile;
  messages: EncryptedChatMessage[];
  ephemeralKeyDestroyed: boolean;
}

export interface CrisisHotlineResource {
  name: string;
  phone: string;
  smsShortcode?: string;
  description: string;
  availability: string; // e.g. "24/7 Free & Confidential"
  isPrimaryImmediate: boolean;
}

export interface PeerSupportFilterState {
  topicFilter: "all" | SupportTopicCategory;
  certificationFilter: string;
}
