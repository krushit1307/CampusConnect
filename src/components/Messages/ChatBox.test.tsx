import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ChatBox from "./ChatBox";

// Mock Supabase Client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: {
            user: {
              id: "user-123",
              email: "student@univ.edu",
              user_metadata: { full_name: "User A" },
            },
          },
        }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            neq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "user-456",
                      full_name: "User B",
                      avatar_url: "https://avatar.com/user-b.png",
                      college: "Science",
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "user_public_keys") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { public_key: "mock-pub-key" },
                  error: null,
                }),
            }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === "direct_messages") {
        return {
          select: () => ({
            or: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "msg-111",
                      sender_id: "user-123",
                      receiver_id: "user-456",
                      encrypted_content: "encrypted-content",
                      iv: "iv-123",
                      created_at: new Date(Date.now() - 10000).toISOString(),
                      read_at: null,
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "chat_participants") {
        return {
          select: () => ({
            or: () =>
              Promise.resolve({
                data: [
                  {
                    user_id: "user-456",
                    recipient_id: "user-123",
                    last_read_message_id: "msg-111",
                    profiles: {
                      full_name: "User B",
                      avatar_url: "https://avatar.com/user-b.png",
                    },
                  },
                ],
                error: null,
              }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      return {};
    },
    channel: () => ({
      on: () => ({
        subscribe: () => ({}),
      }),
      send: () => Promise.resolve({}),
    }),
    removeChannel: () => Promise.resolve(),
  }),
}));

// Mock cryptographic helper functions to resolve immediately with decrypted string or key
vi.mock("@/lib/crypto", () => ({
  generateECDHKeypair: () => Promise.resolve({ publicKey: {}, privateKey: {} }),
  exportPublicKey: () => Promise.resolve("mock-pub-key"),
  exportPrivateKey: () => Promise.resolve("mock-priv-key"),
  importPublicKey: () => Promise.resolve({}),
  importPrivateKey: () => Promise.resolve({}),
  deriveSharedSecret: () => Promise.resolve({}),
  encryptMessage: () => Promise.resolve({ ciphertext: "encrypted", iv: "iv" }),
  decryptMessage: () => Promise.resolve("Hello User B!"),
}));

// Mock user block utilities
vi.mock("@/lib/userBlockUtils", () => ({
  getBlockedUserIds: () => Promise.resolve(new Set()),
  validateDirectMessageSend: () => Promise.resolve({ allowed: true }),
}));

describe("ChatBox Read Receipts & Watermarks", () => {
  let originalIntersectionObserver: any;

  beforeEach(() => {
    // Mock IntersectionObserver
    originalIntersectionObserver = global.IntersectionObserver;
    global.IntersectionObserver = vi.fn().mockImplementation((callback, options) => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Mock document.hasFocus and visibilityState
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
    });
  });

  afterEach(() => {
    global.IntersectionObserver = originalIntersectionObserver;
    vi.restoreAllMocks();
  });

  it("loads chat contacts and renders active chat recipients", async () => {
    render(<ChatBox />);

    // Verify chat sidebar shows contact names
    const contactName = await screen.findByText("User B");
    expect(contactName).toBeInTheDocument();
  });
});
