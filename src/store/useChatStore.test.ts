import { describe, expect, it, beforeEach } from "vitest";
import { useChatStore } from "./useChatStore";
import type { User } from "@supabase/supabase-js";

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: { full_name: "Test User" },
    created_at: "2024-01-01",
    ...overrides,
  } as User;
}

const mockProfile = {
  id: "profile-1",
  full_name: "Alice Johnson",
  avatar_url: null,
  college: "Engineering",
};

const mockProfile2 = {
  id: "profile-2",
  full_name: "Bob Smith",
  avatar_url: null,
  college: "Science",
};

const mockMessage = {
  id: "msg-1",
  sender_id: "user-1",
  receiver_id: "profile-1",
  encrypted_content: "encrypted",
  iv: "iv123",
  created_at: "2025-01-01T00:00:00Z",
  read_at: null,
  content: "Hello!",
  decryptFailed: false,
};

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      currentUser: null,
      profiles: [],
      filteredProfiles: [],
      searchQuery: "",
      loadingProfiles: false,
      activeRecipient: null,
      messages: [],
      loadingMessages: false,
      recipientKeyError: null,
      inputMessage: "",
      initializingKeys: true,
      userKeys: null,
      sharedKeys: {},
    });
  });

  describe("auth state", () => {
    it("starts with null currentUser", () => {
      expect(useChatStore.getState().currentUser).toBeNull();
    });

    it("sets currentUser", () => {
      const user = createMockUser();
      useChatStore.getState().setCurrentUser(user);
      expect(useChatStore.getState().currentUser).toEqual(user);
    });
  });

  describe("profiles", () => {
    it("sets profiles and initializes filteredProfiles", () => {
      useChatStore.getState().setProfiles([mockProfile, mockProfile2]);
      const state = useChatStore.getState();
      expect(state.profiles).toHaveLength(2);
      expect(state.filteredProfiles).toHaveLength(2);
    });

    it("filters profiles by name", () => {
      useChatStore.getState().setProfiles([mockProfile, mockProfile2]);
      useChatStore.getState().setSearchQuery("alice");
      const filtered = useChatStore.getState().filteredProfiles;
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("profile-1");
    });

    it("filters profiles by college", () => {
      useChatStore.getState().setProfiles([mockProfile, mockProfile2]);
      useChatStore.getState().setSearchQuery("science");
      const filtered = useChatStore.getState().filteredProfiles;
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("profile-2");
    });

    it("returns all profiles when search query is empty", () => {
      useChatStore.getState().setProfiles([mockProfile, mockProfile2]);
      useChatStore.getState().setSearchQuery("");
      expect(useChatStore.getState().filteredProfiles).toHaveLength(2);
    });
  });

  describe("active chat", () => {
    it("sets activeRecipient and resets messages and errors", () => {
      useChatStore.setState({
        messages: [mockMessage],
        recipientKeyError: "some error",
      });
      useChatStore.getState().setActiveRecipient(mockProfile);

      const state = useChatStore.getState();
      expect(state.activeRecipient).toEqual(mockProfile);
      expect(state.messages).toHaveLength(0);
      expect(state.recipientKeyError).toBeNull();
    });

    it("sets messages", () => {
      useChatStore.getState().setMessages([mockMessage]);
      expect(useChatStore.getState().messages).toHaveLength(1);
    });

    it("adds a new message without duplicates", () => {
      useChatStore.getState().addMessage(mockMessage);
      useChatStore.getState().addMessage(mockMessage);
      expect(useChatStore.getState().messages).toHaveLength(1);
    });

    it("adds a unique message", () => {
      useChatStore.getState().addMessage(mockMessage);
      useChatStore.getState().addMessage({ ...mockMessage, id: "msg-2" });
      expect(useChatStore.getState().messages).toHaveLength(2);
    });

    it("updates read status for specific message IDs", () => {
      useChatStore.getState().addMessage(mockMessage);
      const { addMessage } = useChatStore.getState();
      addMessage({ ...mockMessage, id: "msg-2" });

      useChatStore.getState().updateMessagesRead(["msg-1"]);

      const messages = useChatStore.getState().messages;
      expect(messages[0].read_at).toBeTruthy();
      expect(messages[1].read_at).toBeNull();
    });
  });

  describe("message draft", () => {
    it("sets inputMessage", () => {
      useChatStore.getState().setInputMessage("Hello");
      expect(useChatStore.getState().inputMessage).toBe("Hello");
    });

    it("overwrites inputMessage", () => {
      useChatStore.getState().setInputMessage("Hello");
      useChatStore.getState().setInputMessage("World");
      expect(useChatStore.getState().inputMessage).toBe("World");
    });
  });

  describe("loading states", () => {
    it("toggles loadingProfiles", () => {
      useChatStore.getState().setLoadingProfiles(true);
      expect(useChatStore.getState().loadingProfiles).toBe(true);
      useChatStore.getState().setLoadingProfiles(false);
      expect(useChatStore.getState().loadingProfiles).toBe(false);
    });

    it("toggles loadingMessages", () => {
      useChatStore.getState().setLoadingMessages(true);
      expect(useChatStore.getState().loadingMessages).toBe(true);
    });

    it("toggles initializingKeys", () => {
      useChatStore.getState().setInitializingKeys(false);
      expect(useChatStore.getState().initializingKeys).toBe(false);
    });
  });

  describe("crypto state", () => {
    it("sets userKeys", () => {
      const keys = {} as unknown as { publicKey: CryptoKey; privateKey: CryptoKey };
      useChatStore.getState().setUserKeys(keys);
      expect(useChatStore.getState().userKeys).toBe(keys);
    });

    it("sets shared key for a recipient", () => {
      const key = {} as CryptoKey;
      useChatStore.getState().setSharedKey("recipient-1", key);
      expect(useChatStore.getState().sharedKeys["recipient-1"]).toBe(key);
    });

    it("resets shared keys", () => {
      useChatStore.getState().setSharedKey("recipient-1", {} as CryptoKey);
      useChatStore.getState().resetSharedKeys();
      expect(useChatStore.getState().sharedKeys).toEqual({});
    });
  });

  describe("error state", () => {
    it("sets recipientKeyError", () => {
      useChatStore.getState().setRecipientKeyError("Key not found");
      expect(useChatStore.getState().recipientKeyError).toBe("Key not found");
    });
  });
});
