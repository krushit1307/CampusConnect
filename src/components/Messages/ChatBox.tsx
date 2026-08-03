import { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, RealtimeChannel } from "@supabase/supabase-js";
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
import { ShieldCheck, Send, Search, Lock, AlertTriangle, RefreshCw, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker from "emoji-picker-react";
import { EmptyState } from "@/components/EmptyState";
import { LinkPreview } from "./LinkPreview";
import { extractFirstUrl } from "@/lib/extractUrls";
import { getBlockedUserIds, validateDirectMessageSend } from "@/lib/userBlockUtils";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  college: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  encrypted_content: string;
  iv: string;
  created_at: string;
  read_at: string | null;
  content?: string;
  decryptFailed?: boolean;
}

export default function ChatBox() {
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [activeRecipient, setActiveRecipient] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [initializingKeys, setInitializingKeys] = useState(true);
  const [recipientKeyError, setRecipientKeyError] = useState<string | null>(null);

  // Cryptographic state
  const [userKeys, setUserKeys] = useState<{
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  } | null>(null);
  const [sharedKeys, setSharedKeys] = useState<Record<string, CryptoKey>>({});

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stable per-conversation presence channel name:
  // sort the two participant IDs so both sides derive the same channel key
  const typingChannelName = useMemo(() => {
    if (!currentUser?.id || !activeRecipient?.id) return "";
    const ids = [currentUser.id, activeRecipient.id].sort().join("_");
    return `chat_typing:${ids}`;
  }, [currentUser?.id, activeRecipient?.id]);

  const { typingUsers, broadcastTyping, clearTyping } = useTypingIndicator(
    typingChannelName,
    currentUser?.id ?? "",
    currentUser?.user_metadata?.full_name ?? currentUser?.email?.split("@")[0] ?? "Someone",
  );

  // 1. Initialize user and their cryptographic keys
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setInitializingKeys(false);
          return;
        }
        setCurrentUser(user);

        const privKeyName = `cc_e2ee_private_key_${user.id}`;
        const pubKeyName = `cc_e2ee_public_key_${user.id}`;

        const privKeyStr = localStorage.getItem(privKeyName);
        const pubKeyStr = localStorage.getItem(pubKeyName);

        let pubCryptoKey: CryptoKey;
        let privCryptoKey: CryptoKey;

        if (privKeyStr && pubKeyStr) {
          // Import existing key pair from localStorage
          pubCryptoKey = await importPublicKey(pubKeyStr);
          privCryptoKey = await importPrivateKey(privKeyStr);
        } else {
          // Generate a fresh key pair
          const keypair = await generateECDHKeypair();
          pubCryptoKey = keypair.publicKey;
          privCryptoKey = keypair.privateKey;

          const pubJwk = await exportPublicKey(pubCryptoKey);
          const privJwk = await exportPrivateKey(privCryptoKey);

          localStorage.setItem(privKeyName, privJwk);
          localStorage.setItem(pubKeyName, pubJwk);

          // Publish/upsert public key to database
          const { error } = await supabase.from("user_public_keys").upsert({
            user_id: user.id,
            public_key: pubJwk,
          });

          if (error) {
            console.error("Failed to publish public key:", error);
            toast.error("Failed to publish secure encryption key to directory.");
          }
        }

        setUserKeys({ publicKey: pubCryptoKey, privateKey: privCryptoKey });
      } catch (err) {
        console.error("E2EE initialization failed:", err);
        toast.error("Failed to initialize E2EE secure keys.");
      } finally {
        setInitializingKeys(false);
      }
    };

    initializeUser();
  }, []);

  // 2. Fetch profiles to chat with
  useEffect(() => {
    const fetchProfiles = async () => {
      if (initializingKeys || !currentUser) return;
      setLoadingProfiles(true);
      try {
        const blockedIds = await getBlockedUserIds(currentUser.id);
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, college")
          .neq("id", currentUser.id)
          .order("full_name", { ascending: true });

        if (error) throw error;
        const availableProfiles = (data || []).filter((p) => !blockedIds.has(p.id));
        setProfiles(availableProfiles);
        setFilteredProfiles(availableProfiles);
      } catch (err) {
        console.error("Failed to load profiles:", err);
        toast.error("Failed to load direct messaging contacts.");
      } finally {
        setLoadingProfiles(false);
      }
    };

    fetchProfiles();
  }, [currentUser, initializingKeys]);

  // 3. Search filter profiles
  useEffect(() => {
    const filtered = profiles.filter((p) => {
      const name = p.full_name?.toLowerCase() || "";
      const college = p.college?.toLowerCase() || "";
      const query = searchQuery.toLowerCase();
      return name.includes(query) || college.includes(query);
    });
    setFilteredProfiles(filtered);
  }, [searchQuery, profiles]);

  // Derive or fetch shared key
  const getSharedKey = async (
    recipientId: string,
    recipientPublicKeyJwk: string,
  ): Promise<CryptoKey | null> => {
    if (!userKeys) return null;
    if (sharedKeys[recipientId]) {
      return sharedKeys[recipientId];
    }

    try {
      const recipientPubKey = await importPublicKey(recipientPublicKeyJwk);
      const derivedKey = await deriveSharedSecret(userKeys.privateKey, recipientPubKey);
      setSharedKeys((prev) => ({
        ...prev,
        [recipientId]: derivedKey,
      }));
      return derivedKey;
    } catch (err) {
      console.error("Error deriving shared secret:", err);
      return null;
    }
  };

  // 4. Fetch and decrypt messages when active recipient changes
  const fetchMessages = async (recipient: Profile) => {
    if (!currentUser || !userKeys) return;
    setLoadingMessages(true);
    setRecipientKeyError(null);
    setMessages([]);

    try {
      // Fetch recipient's public key
      const { data: keyData, error: keyError } = await supabase
        .from("user_public_keys")
        .select("public_key")
        .eq("user_id", recipient.id)
        .maybeSingle();

      if (keyError) throw keyError;

      if (!keyData) {
        setRecipientKeyError(
          "This user has not initialized their security keys. E2EE direct messages are not available until they log in.",
        );
        setLoadingMessages(false);
        return;
      }

      // Derive shared secret
      const sharedKey = await getSharedKey(recipient.id, keyData.public_key);
      if (!sharedKey) {
        toast.error("Failed to establish secure session key.");
        setLoadingMessages(false);
        return;
      }

      // Fetch messages
      const { data: dmData, error: dmError } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${recipient.id}),and(sender_id.eq.${recipient.id},receiver_id.eq.${currentUser.id})`,
        )
        .order("created_at", { ascending: true });

      if (dmError) throw dmError;

      // Decrypt messages
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

      setMessages(decrypted);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      toast.error("Error loading chat history.");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeRecipient) {
      fetchMessages(activeRecipient);
    }
  }, [activeRecipient, userKeys]);

  // 5. Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 5b. Mark received messages as read
  const markMessagesAsRead = async () => {
    if (!currentUser || !activeRecipient) return;

    const unreadIds = messages
      .filter((m) => m.receiver_id === currentUser.id && !m.read_at)
      .map((m) => m.id);

    if (unreadIds.length === 0) return;

    try {
      const { error } = await supabase
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);

      if (error) throw error;

      setMessages((prev) =>
        prev.map((m) =>
          unreadIds.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m,
        ),
      );
    } catch (err) {
      console.error("Failed to mark messages as read:", err);
    }
  };

  useEffect(() => {
    if (!messages.length || !currentUser) return;

    const hasUnread = messages.some((m) => m.receiver_id === currentUser.id && !m.read_at);

    if (!hasUnread) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isAtBottom) {
      markMessagesAsRead();
    }
  }, [messages, currentUser, activeRecipient]);

  // 6. Subscribing to real-time updates for direct messages
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!activeRecipient || !currentUser || !userKeys) return;

    let cancelled = false;
    const MAX_RETRIES = 3;

    const cleanup = async () => {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };

    const setupSubscription = async (attempt = 0) => {
      await cleanup();
      if (cancelled) return;

      const { data: keyData } = await supabase
        .from("user_public_keys")
        .select("public_key")
        .eq("user_id", activeRecipient.id)
        .maybeSingle();

      if (!keyData || cancelled) return;

      const sharedKey = await getSharedKey(activeRecipient.id, keyData.public_key);
      if (!sharedKey || cancelled) return;

      const channel = supabase
        .channel(`chat_messages_${activeRecipient.id}_${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "direct_messages" },
          async (payload) => {
            const newMsg = payload.new as Message;
            const isFromActiveChat =
              (newMsg.sender_id === currentUser.id && newMsg.receiver_id === activeRecipient.id) ||
              (newMsg.sender_id === activeRecipient.id && newMsg.receiver_id === currentUser.id);

            if (!isFromActiveChat) return;

            try {
              const plainText = await decryptMessage(
                newMsg.encrypted_content,
                newMsg.iv,
                sharedKey,
              );
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, { ...newMsg, content: plainText, decryptFailed: false }];
              });
            } catch (err) {
              console.warn("Real-time decryption failure:", err);
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [
                  ...prev,
                  {
                    ...newMsg,
                    content:
                      "[Unable to decrypt - security key was rotated or reset on this device]",
                    decryptFailed: true,
                  },
                ];
              });
            }
          },
        )
        .subscribe((status, err) => {
          if (cancelled) return;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(`Channel subscription failed (attempt ${attempt + 1}):`, err);
            if (attempt < MAX_RETRIES) {
              setTimeout(() => setupSubscription(attempt + 1), 1000 * (attempt + 1));
            } else {
              toast.error("Real-time chat connection failed. Please refresh.");
            }
          }
        });

      if (!cancelled) {
        channelRef.current = channel;
      } else {
        await supabase.removeChannel(channel);
      }
    };

    setupSubscription();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [activeRecipient?.id, currentUser, userKeys]);

  // 7. Send message handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeRecipient || !currentUser || !userKeys) return;

    try {
      // Execute validation check: Throw 403 error if receiver blocked sender or sender blocked receiver
      const validation = await validateDirectMessageSend(currentUser.id, activeRecipient.id);
      if (!validation.allowed) {
        toast.error(validation.error || "403 Forbidden: Direct messaging is blocked.");
        return;
      }

      const { data: keyData } = await supabase
        .from("user_public_keys")
        .select("public_key")
        .eq("user_id", activeRecipient.id)
        .maybeSingle();

      if (!keyData) {
        toast.error("Recipient E2EE keys are unavailable.");
        return;
      }

      const sharedKey = await getSharedKey(activeRecipient.id, keyData.public_key);
      if (!sharedKey) {
        toast.error("Failed to derive secure encryption key.");
        return;
      }

      const textToSend = inputMessage;
      setInputMessage("");
      clearTyping();

      // Encrypt message on client side
      const { ciphertext, iv } = await encryptMessage(textToSend, sharedKey);

      // Store in DB (encrypted_content and iv)
      const { data, error } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: currentUser.id,
          receiver_id: activeRecipient.id,
          encrypted_content: ciphertext,
          iv: iv,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to messages list locally
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, { ...data, content: textToSend, decryptFailed: false }];
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send encrypted message.");
    }
  };

  const handleResetKeys = async () => {
    if (!currentUser) return;
    const confirm = window.confirm(
      "Are you sure you want to reset your secure messaging key pair? You will lose the ability to decrypt past messages, but other users will be able to send you messages with your new key.",
    );
    if (!confirm) return;

    setInitializingKeys(true);
    try {
      const privKeyName = `cc_e2ee_private_key_${currentUser.id}`;
      const pubKeyName = `cc_e2ee_public_key_${currentUser.id}`;

      const keypair = await generateECDHKeypair();
      const pubJwk = await exportPublicKey(keypair.publicKey);
      const privJwk = await exportPrivateKey(keypair.privateKey);

      localStorage.setItem(privKeyName, privJwk);
      localStorage.setItem(pubKeyName, pubJwk);

      const { error } = await supabase.from("user_public_keys").upsert({
        user_id: currentUser.id,
        public_key: pubJwk,
      });

      if (error) throw error;

      setUserKeys({ publicKey: keypair.publicKey, privateKey: keypair.privateKey });
      setSharedKeys({}); // reset cached derived keys
      toast.success("Secure keys reset and published successfully.");
      if (activeRecipient) {
        fetchMessages(activeRecipient);
      }
    } catch (err) {
      console.error("Failed to reset keys:", err);
      toast.error("Failed to reset secure messaging keys.");
    } finally {
      setInitializingKeys(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex h-[75vh] items-center justify-center p-4">
        <div className="max-w-md border-2 border-black bg-white p-8 text-center shadow-lg dark:bg-black dark:border-cream">
          <Lock className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="mb-2 font-display text-xl font-bold uppercase">Authentication Required</h2>
          <p className="font-mono text-sm text-gray-600 dark:text-gray-400">
            Please sign in to access end-to-end encrypted direct messages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      {/* Page Header */}
      <div className="mb-6 border-2 border-black bg-[#ffde00] p-4 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-2xl font-black uppercase tracking-wider sm:text-3xl">
              Secure Direct Messages
            </h1>
            <p className="mt-1 font-mono text-xs font-semibold uppercase">
              End-to-End Encrypted (E2EE) Client-Side Cryptography (ECDH + AES-GCM 256)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetKeys}
              disabled={initializingKeys}
              className="neu-border flex items-center gap-1 bg-white px-3 py-1 font-mono text-xs font-bold uppercase text-black transition-all hover:bg-black hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={12} className={initializingKeys ? "animate-spin" : ""} />
              Reset Keys
            </button>
            <span className="flex items-center gap-1 border-2 border-black bg-lime px-3 py-1 font-mono text-xs font-bold uppercase text-black">
              <ShieldCheck size={14} />
              E2EE Secure
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* Contacts Sidebar */}
        <div className="flex flex-col border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-black dark:border-cream md:col-span-4">
          <div className="border-b-2 border-black p-3 dark:border-cream bg-[#f3f4f6] dark:bg-zinc-900">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border-2 border-black bg-white py-1.5 pl-9 pr-3 font-mono text-xs focus:outline-none dark:bg-zinc-800 dark:border-cream dark:text-cream"
              />
            </div>
          </div>

          <div className="h-[550px] overflow-y-auto p-2">
            {loadingProfiles ? (
              <div className="py-8 text-center font-mono text-xs">Loading students...</div>
            ) : filteredProfiles.length === 0 ? (
              <EmptyState
                illustrationType={searchQuery ? "no-results" : "no-messages"}
                title={searchQuery ? "No students found" : "Your inbox is quiet"}
                description={
                  searchQuery
                    ? "Try a different name, college, or keyword."
                    : "Find a student to start a conversation."
                }
                actionButton={
                  searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="neu-border neu-press bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-white"
                    >
                      Clear search
                    </button>
                  ) : undefined
                }
                className="border-0 px-3 py-8 shadow-none"
              />
            ) : (
              <div className="space-y-1.5">
                {filteredProfiles.map((profile) => {
                  const isActive = activeRecipient?.id === profile.id;
                  const initials =
                    profile.full_name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "U";

                  return (
                    <button
                      key={profile.id}
                      onClick={() => setActiveRecipient(profile)}
                      className={`w-full border-2 border-black p-3 text-left transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none flex items-center gap-3 ${
                        isActive
                          ? "bg-lime text-black shadow-none translate-x-0.5 translate-y-0.5"
                          : "bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-800 dark:text-cream dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.15)] dark:border-cream"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-yellow-300 font-display text-sm font-bold text-black uppercase">
                        {initials}
                      </div>
                      <div className="overflow-hidden">
                        <div className="truncate font-display text-sm font-bold uppercase leading-none">
                          {profile.full_name || "Anonymous Student"}
                        </div>
                        <div className="mt-1 truncate font-mono text-[10px] uppercase opacity-75">
                          {profile.college || "No College Listed"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="flex flex-col border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-black dark:border-cream md:col-span-8">
          {activeRecipient ? (
            <>
              {/* Chat Window Header */}
              <div className="flex items-center justify-between border-b-2 border-black p-4 dark:border-cream bg-white dark:bg-zinc-900">
                <div>
                  <h3 className="font-display text-base font-bold uppercase text-black dark:text-cream leading-tight">
                    {activeRecipient.full_name || "Anonymous Student"}
                  </h3>
                  <p className="mt-0.5 font-mono text-[10px] uppercase text-gray-500 dark:text-gray-400">
                    {activeRecipient.college || "No College Listed"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 border border-black bg-cream px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-black">
                  <Lock size={10} />
                  Session Secure
                </div>
              </div>

              {/* Messages Area */}
              <div
                ref={messagesContainerRef}
                className="flex-1 h-[420px] overflow-y-auto bg-slate-50 dark:bg-zinc-950 p-4 space-y-3"
              >
                {recipientKeyError ? (
                  <div className="flex h-full items-center justify-center p-4">
                    <div className="max-w-md border-2 border-black bg-yellow-50 p-6 text-center text-black shadow-md">
                      <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-yellow-600" />
                      <h4 className="font-display text-sm font-bold uppercase">
                        Encryption Blocked
                      </h4>
                      <p className="mt-1 font-mono text-xs text-gray-700">{recipientKeyError}</p>
                    </div>
                  </div>
                ) : loadingMessages ? (
                  <div className="flex h-full items-center justify-center font-mono text-xs">
                    Establishing secure ECDH key agreement and fetching messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                    <Lock className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="font-display text-sm font-bold uppercase text-gray-500">
                      Encrypted Chat Session
                    </p>
                    <p className="font-mono text-xs text-gray-400 mt-1 max-w-xs">
                      Send a message to start a conversation. Only you and this recipient can
                      decrypt the contents.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isMe = msg.sender_id === currentUser.id;
                      const time = new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:border-cream ${
                              isMe
                                ? "bg-lime text-black"
                                : "bg-white text-black dark:bg-zinc-800 dark:text-cream dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.15)]"
                            }`}
                          >
                            <p className="whitespace-pre-wrap font-sans text-sm font-medium">
                              {msg.content}
                            </p>
                            {/* Link Preview — rendered below message text if a URL is detected */}
                            {(() => {
                              const previewUrl = extractFirstUrl(msg.content ?? "");
                              return previewUrl ? (
                                <LinkPreview url={previewUrl} isMe={isMe} />
                              ) : null;
                            })()}
                            <div className="mt-1.5 flex items-center justify-between gap-4 font-mono text-[9px] uppercase opacity-60">
                              <span>{time}</span>
                              <span className="flex items-center gap-0.5">
                                {isMe ? (
                                  msg.read_at ? (
                                    <span
                                      className="flex items-center gap-0.5 text-blue-600"
                                      title="Read"
                                    >
                                      <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                                        <path
                                          d="M1 5.5L4 8.5L9 1"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                        <path
                                          d="M6 5.5L9 8.5L13 1"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5" title="Sent">
                                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path
                                          d="M1 5L4 8L9 1"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </span>
                                  )
                                ) : (
                                  <Lock size={8} />
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message Input Box */}
              {!recipientKeyError && (
                <form
                  onSubmit={handleSendMessage}
                  className="border-t-2 border-black p-3 bg-white dark:bg-zinc-900 dark:border-cream flex flex-col gap-2"
                >
                  {/* Typing indicator — visible only when someone else is typing */}
                  <div
                    className="min-h-[1.25rem] flex items-center gap-1.5"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {typingUsers.length > 0 && (
                      <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 italic animate-pulse">
                        💬{" "}
                        {typingUsers.length === 1
                          ? `${typingUsers[0]} is typing…`
                          : typingUsers.length === 2
                            ? `${typingUsers[0]} and ${typingUsers[1]} are typing…`
                            : "Several people are typing…"}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => {
                        setInputMessage(e.target.value);
                        broadcastTyping();
                      }}
                      onFocus={broadcastTyping}
                      placeholder="Type a secure message..."
                      className="flex-1 border-2 border-black px-3 py-2 font-mono text-sm focus:outline-none dark:bg-zinc-800 dark:border-cream dark:text-cream"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-10 w-10 border-2 border-black bg-yellow-300 text-black neu-border neu-press"
                        >
                          <Smile className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="top" align="end" className="p-0 border-2 border-black">
                        <EmojiPicker
                          onEmojiClick={(emojiData) =>
                            setInputMessage((prev) => prev + emojiData.emoji)
                          }
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="submit"
                      size="icon"
                      className="h-10 w-10 border-2 border-black bg-lime text-black neu-border neu-press"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-[480px] flex-col items-center justify-center p-6 text-center">
              <div className="mb-4 border-2 border-black bg-yellow-300 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-yellow-400">
                <Lock className="h-10 w-10 text-black" />
              </div>
              <h3 className="font-display text-lg font-bold uppercase text-black dark:text-cream">
                Secure Chat Terminal
              </h3>
              <p className="mt-2 max-w-sm font-mono text-xs text-gray-500 dark:text-gray-400">
                Select a student from the sidebar to establish a secure end-to-end encrypted direct
                messaging channel.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
