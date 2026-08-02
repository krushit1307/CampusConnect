import { useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import {
  generateECDHKeypair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
} from "@/lib/crypto";
import { toast } from "sonner";
import { useChatStore, type Message } from "@/store/useChatStore";

export function useChat() {
  const supabase = useRef(createClient()).current;

  const store = useChatStore();

  const typingChannelName = useMemo(() => {
    if (!store.currentUser?.id || !store.activeRecipient?.id) return "";
    const ids = [store.currentUser.id, store.activeRecipient.id].sort().join("_");
    return `chat_typing:${ids}`;
  }, [store.currentUser?.id, store.activeRecipient?.id]);

  const { typingUsers, broadcastTyping, clearTyping } = useTypingIndicator(
    typingChannelName,
    store.currentUser?.id ?? "",
    store.currentUser?.user_metadata?.full_name ??
      store.currentUser?.email?.split("@")[0] ??
      "Someone",
  );

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          store.setInitializingKeys(false);
          return;
        }
        store.setCurrentUser(user);

        const privKeyName = `cc_e2ee_private_key_${user.id}`;
        const pubKeyName = `cc_e2ee_public_key_${user.id}`;

        const privKeyStr = localStorage.getItem(privKeyName);
        const pubKeyStr = localStorage.getItem(pubKeyName);

        let pubCryptoKey: CryptoKey;
        let privCryptoKey: CryptoKey;

        if (privKeyStr && pubKeyStr) {
          pubCryptoKey = await importPublicKey(pubKeyStr);
          privCryptoKey = await importPrivateKey(privKeyStr);
        } else {
          const keypair = await generateECDHKeypair();
          pubCryptoKey = keypair.publicKey;
          privCryptoKey = keypair.privateKey;

          const pubJwk = await exportPublicKey(pubCryptoKey);
          const privJwk = await exportPrivateKey(privCryptoKey);

          localStorage.setItem(privKeyName, privJwk);
          localStorage.setItem(pubKeyName, pubJwk);

          const { error } = await supabase.from("user_public_keys").upsert({
            user_id: user.id,
            public_key: pubJwk,
          });

          if (error) {
            console.error("Failed to publish public key:", error);
            toast.error("Failed to publish secure encryption key to directory.");
          }
        }

        store.setUserKeys({ publicKey: pubCryptoKey, privateKey: privCryptoKey });
      } catch (err) {
        console.error("E2EE initialization failed:", err);
        toast.error("Failed to initialize E2EE secure keys.");
      } finally {
        store.setInitializingKeys(false);
      }
    };

    initializeUser();
  }, []);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (store.initializingKeys || !store.currentUser) return;
      store.setLoadingProfiles(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, college")
          .neq("id", store.currentUser.id)
          .order("full_name", { ascending: true });

        if (error) throw error;
        store.setProfiles(data || []);
      } catch (err) {
        console.error("Failed to load profiles:", err);
        toast.error("Failed to load direct messaging contacts.");
      } finally {
        store.setLoadingProfiles(false);
      }
    };

    fetchProfiles();
  }, [store.currentUser, store.initializingKeys]);

  const getSharedKey = async (
    recipientId: string,
    recipientPublicKeyJwk: string,
  ): Promise<CryptoKey | null> => {
    const { userKeys, sharedKeys } = useChatStore.getState();
    if (!userKeys) return null;
    if (sharedKeys[recipientId]) return sharedKeys[recipientId];

    try {
      const recipientPubKey = await importPublicKey(recipientPublicKeyJwk);
      const derivedKey = await deriveSharedSecret(userKeys.privateKey, recipientPubKey);
      useChatStore.getState().setSharedKey(recipientId, derivedKey);
      return derivedKey;
    } catch (err) {
      console.error("Error deriving shared secret:", err);
      return null;
    }
  };

  const fetchMessages = async (recipient: { id: string }) => {
    const state = useChatStore.getState();
    if (!state.currentUser || !state.userKeys) return;
    store.setLoadingMessages(true);
    store.setRecipientKeyError(null);
    store.setMessages([]);

    try {
      const { data: keyData, error: keyError } = await supabase
        .from("user_public_keys")
        .select("public_key")
        .eq("user_id", recipient.id)
        .maybeSingle();

      if (keyError) throw keyError;

      if (!keyData) {
        store.setRecipientKeyError(
          "This user has not initialized their security keys. E2EE direct messages are not available until they log in.",
        );
        store.setLoadingMessages(false);
        return;
      }

      const sharedKey = await getSharedKey(recipient.id, keyData.public_key);
      if (!sharedKey) {
        toast.error("Failed to establish secure session key.");
        store.setLoadingMessages(false);
        return;
      }

      const { data: dmData, error: dmError } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${state.currentUser.id},receiver_id.eq.${recipient.id}),and(sender_id.eq.${recipient.id},receiver_id.eq.${state.currentUser.id})`,
        )
        .order("created_at", { ascending: true });

      if (dmError) throw dmError;

      const decrypted = await Promise.all(
        (dmData || []).map(async (msg) => {
          try {
            const plainText = await decryptMessage(msg.encrypted_content, msg.iv, sharedKey);
            return { ...msg, content: plainText, decryptFailed: false };
          } catch (err) {
            console.warn("Decryption error on message ID", msg.id, err);
            return {
              ...msg,
              content: "[Unable to decrypt - security key was rotated or reset on this device]",
              decryptFailed: true,
            };
          }
        }),
      );

      store.setMessages(decrypted);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      toast.error("Error loading chat history.");
    } finally {
      store.setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (store.activeRecipient) {
      fetchMessages(store.activeRecipient);
    }
  }, [store.activeRecipient, store.userKeys]);

  const markMessagesAsRead = async () => {
    const state = useChatStore.getState();
    if (!state.currentUser || !state.activeRecipient) return;
    const currentUser = state.currentUser;

    const unreadIds = state.messages
      .filter((m) => m.receiver_id === currentUser.id && !m.read_at)
      .map((m) => m.id);

    if (unreadIds.length === 0) return;

    try {
      const { error } = await supabase
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);

      if (error) throw error;
      store.updateMessagesRead(unreadIds);
    } catch (err) {
      console.error("Failed to mark messages as read:", err);
    }
  };

  useEffect(() => {
    const state = useChatStore.getState();
    if (!state.messages.length || !state.currentUser) return;
    const currentUser = state.currentUser;

    const hasUnread = state.messages.some((m) => m.receiver_id === currentUser.id && !m.read_at);
    if (!hasUnread) return;

    const container = document.getElementById("messages-container");
    if (!container) return;

    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isAtBottom) {
      markMessagesAsRead();
    }
  }, [store.messages, store.currentUser, store.activeRecipient]);

  useEffect(() => {
    if (!store.activeRecipient || !store.currentUser || !store.userKeys) return;
    const activeRecipient = store.activeRecipient;
    const currentUser = store.currentUser;

    const setupSubscription = async () => {
      const { data: keyData } = await supabase
        .from("user_public_keys")
        .select("public_key")
        .eq("user_id", activeRecipient.id)
        .maybeSingle();

      if (!keyData) return;

      const sharedKey = await getSharedKey(activeRecipient.id, keyData.public_key);
      if (!sharedKey) return;

      const channel = supabase
        .channel(`chat_messages_${activeRecipient.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "direct_messages",
          },
          async (payload) => {
            const newMsg = payload.new as Message;
            const state = useChatStore.getState();
            const isFromActiveChat =
              (newMsg.sender_id === currentUser.id && newMsg.receiver_id === activeRecipient.id) ||
              (newMsg.sender_id === activeRecipient.id && newMsg.receiver_id === currentUser.id);

            if (isFromActiveChat) {
              try {
                const plainText = await decryptMessage(
                  newMsg.encrypted_content,
                  newMsg.iv,
                  sharedKey,
                );
                store.addMessage({ ...newMsg, content: plainText, decryptFailed: false });
              } catch (err) {
                console.warn("Real-time decryption failure:", err);
                store.addMessage({
                  ...newMsg,
                  content: "[Unable to decrypt - security key was rotated or reset on this device]",
                  decryptFailed: true,
                });
              }
            }
          },
        )
        .subscribe();

      return channel;
    };

    let subscriptionChannel: RealtimeChannel | null = null;
    setupSubscription().then((channel) => {
      subscriptionChannel = channel || null;
    });

    return () => {
      if (subscriptionChannel) {
        supabase.removeChannel(subscriptionChannel);
      }
    };
  }, [store.activeRecipient?.id, store.currentUser, store.userKeys]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const state = useChatStore.getState();
    if (
      !state.inputMessage.trim() ||
      !state.activeRecipient ||
      !state.currentUser ||
      !state.userKeys
    )
      return;

    try {
      const { data: keyData } = await supabase
        .from("user_public_keys")
        .select("public_key")
        .eq("user_id", state.activeRecipient.id)
        .maybeSingle();

      if (!keyData) {
        toast.error("Recipient E2EE keys are unavailable.");
        return;
      }

      const sharedKey = await getSharedKey(state.activeRecipient.id, keyData.public_key);
      if (!sharedKey) {
        toast.error("Failed to derive secure encryption key.");
        return;
      }

      const textToSend = state.inputMessage;
      store.setInputMessage("");
      clearTyping();

      const { ciphertext, iv } = await encryptMessage(textToSend, sharedKey);

      const { data, error } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: state.currentUser.id,
          receiver_id: state.activeRecipient.id,
          encrypted_content: ciphertext,
          iv,
        })
        .select()
        .single();

      if (error) throw error;

      store.addMessage({ ...data, content: textToSend, decryptFailed: false });
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send encrypted message.");
    }
  };

  const handleResetKeys = async () => {
    const state = useChatStore.getState();
    if (!state.currentUser) return;
    const confirm = window.confirm(
      "Are you sure you want to reset your secure messaging key pair? You will lose the ability to decrypt past messages, but other users will be able to send you messages with your new key.",
    );
    if (!confirm) return;

    store.setInitializingKeys(true);
    try {
      const privKeyName = `cc_e2ee_private_key_${state.currentUser.id}`;
      const pubKeyName = `cc_e2ee_public_key_${state.currentUser.id}`;

      const keypair = await generateECDHKeypair();
      const pubJwk = await exportPublicKey(keypair.publicKey);
      const privJwk = await exportPrivateKey(keypair.privateKey);

      localStorage.setItem(privKeyName, privJwk);
      localStorage.setItem(pubKeyName, pubJwk);

      const { error } = await supabase.from("user_public_keys").upsert({
        user_id: state.currentUser.id,
        public_key: pubJwk,
      });

      if (error) throw error;

      store.setUserKeys({ publicKey: keypair.publicKey, privateKey: keypair.privateKey });
      store.resetSharedKeys();
      toast.success("Secure keys reset and published successfully.");
      if (state.activeRecipient) {
        fetchMessages(state.activeRecipient);
      }
    } catch (err) {
      console.error("Failed to reset keys:", err);
      toast.error("Failed to reset secure messaging keys.");
    } finally {
      store.setInitializingKeys(false);
    }
  };

  return {
    typingUsers,
    broadcastTyping,
    clearTyping,
    handleSendMessage,
    handleResetKeys,
  };
}
