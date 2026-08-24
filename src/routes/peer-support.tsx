import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  AlertTriangle,
  HeartHandshake,
  Loader2,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  buildPeerSupportRoomName,
  createEphemeralId,
  isPeerSupportPayload,
  MAX_PEER_SUPPORT_MESSAGE_LENGTH,
  PEER_SUPPORT_LOBBY,
  PEER_SUPPORT_MATCH_TIMEOUT_MS,
  type PeerSupportChatMessage,
  type PeerSupportPayload,
  type PeerSupportRole,
} from "@/lib/peerSupport";
import {
  decryptMessage,
  deriveSharedSecret,
  encryptMessage,
  exportPublicKey,
  generateECDHKeypair,
  importPublicKey,
} from "@/lib/crypto";

const EMPTY_CHAT: PeerSupportChatMessage[] = [];

type SessionStatus = "idle" | "searching" | "offering" | "matched" | "chatting" | "closed";

type UserState = {
  id: string;
};

export default function PeerSupportPage() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<UserState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPeerListener, setIsPeerListener] = useState(false);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [role, setRole] = useState<PeerSupportRole | null>(null);
  const [connectionReady, setConnectionReady] = useState(false);
  const [encryptedReady, setEncryptedReady] = useState(false);
  const [messages, setMessages] = useState<PeerSupportChatMessage[]>(EMPTY_CHAT);
  const [draft, setDraft] = useState("");
  const [, setRoomId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lobbyChannelRef = useRef<RealtimeChannel | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const participantIdRef = useRef(createEphemeralId());
  const activeRequestIdRef = useRef<string | null>(null);
  const listenerRequestIdRef = useRef<string | null>(null);
  const roleRef = useRef<PeerSupportRole | null>(null);
  const listenerAvailableRef = useRef(false);
  const listenerBusyRef = useRef(false);
  const acceptedCandidatesRef = useRef<Extract<PeerSupportPayload, { type: "accept" }>[]>([]);
  const acceptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ephemeralKeyPairRef = useRef<CryptoKeyPair | null>(null);
  const helloRespondedToRef = useRef(new Set<string>());
  const sharedKeyRef = useRef<CryptoKey | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);

  const sendLobby = useCallback((payload: PeerSupportPayload) => {
    void lobbyChannelRef.current?.send({
      type: "broadcast",
      event: "peer-support",
      payload,
    });
  }, []);

  const destroyRoom = useCallback(() => {
    const room = roomChannelRef.current;
    roomChannelRef.current = null;
    currentRoomIdRef.current = null;
    sharedKeyRef.current = null;
    ephemeralKeyPairRef.current = null;
    helloRespondedToRef.current.clear();
    setEncryptedReady(false);
    setRoomId(null);
    if (room) void room.unsubscribe();
  }, []);

  const resetSession = useCallback(
    (notifyPeer: boolean) => {
      const requestId = activeRequestIdRef.current;
      const currentRole = roleRef.current;
      const currentRoomId = currentRoomIdRef.current;

      if (notifyPeer && currentRoomId) {
        void roomChannelRef.current?.send({
          type: "broadcast",
          event: "peer-support-room",
          payload: { type: "close", roomId: currentRoomId, senderId: participantIdRef.current },
        });
      } else if (notifyPeer && requestId && currentRole === "requester") {
        sendLobby({ type: "cancel", requestId, senderId: participantIdRef.current });
      }

      if (acceptTimerRef.current) clearTimeout(acceptTimerRef.current);
      if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
      if (listenerTimerRef.current) clearTimeout(listenerTimerRef.current);
      acceptTimerRef.current = null;
      requestTimerRef.current = null;
      listenerTimerRef.current = null;
      destroyRoom();
      acceptedCandidatesRef.current = [];
      activeRequestIdRef.current = null;
      listenerRequestIdRef.current = null;
      roleRef.current = null;
      listenerAvailableRef.current = false;
      listenerBusyRef.current = false;
      setRole(null);
      setStatus("idle");
      setMessages([]);
      setDraft("");
      setErrorMessage(null);
    },
    [destroyRoom, sendLobby],
  );

  const enterRoom = useCallback(
    async (nextRoomId: string) => {
      if (roomChannelRef.current) void roomChannelRef.current.unsubscribe();
      setRoomId(nextRoomId);
      currentRoomIdRef.current = nextRoomId;
      setStatus("matched");
      setMessages([]);
      setErrorMessage(null);
      sharedKeyRef.current = null;
      setEncryptedReady(false);

      try {
        const keyPair = await generateECDHKeypair();
        ephemeralKeyPairRef.current = keyPair;
        const publicKey = await exportPublicKey(keyPair.publicKey);
        const room = supabase.channel(buildPeerSupportRoomName(nextRoomId), {
          config: { private: true, broadcast: { self: false } },
        });
        room.on("broadcast", { event: "peer-support-room" }, ({ payload }) => {
          if (!isPeerSupportPayload(payload)) return;
          if (payload.type === "hello") {
            if (
              payload.roomId !== currentRoomIdRef.current ||
              payload.senderId === participantIdRef.current ||
              !ephemeralKeyPairRef.current
            ) {
              return;
            }
            if (!helloRespondedToRef.current.has(payload.senderId)) {
              helloRespondedToRef.current.add(payload.senderId);
              void room.send({
                type: "broadcast",
                event: "peer-support-room",
                payload: {
                  type: "hello",
                  roomId: nextRoomId,
                  senderId: participantIdRef.current,
                  publicKey,
                },
              });
            }
            void importPublicKey(payload.publicKey)
              .then((peerPublicKey) =>
                deriveSharedSecret(ephemeralKeyPairRef.current!.privateKey, peerPublicKey),
              )
              .then((sharedKey) => {
                sharedKeyRef.current = sharedKey;
                setEncryptedReady(true);
                setStatus("chatting");
              })
              .catch(() =>
                setErrorMessage(
                  "The secure session could not be established. Please leave and try again.",
                ),
              );
          }
          if (payload.type === "chat") {
            if (
              payload.roomId !== currentRoomIdRef.current ||
              payload.senderId === participantIdRef.current ||
              !sharedKeyRef.current
            ) {
              return;
            }
            void decryptMessage(payload.ciphertext, payload.iv, sharedKeyRef.current)
              .then((body) => {
                setMessages((previous) => [
                  ...previous,
                  { id: createEphemeralId(), body, mine: false },
                ]);
              })
              .catch(() => setErrorMessage("A message could not be decrypted and was discarded."));
          }
          if (payload.type === "close" && payload.roomId === currentRoomIdRef.current) {
            destroyRoom();
            setStatus("closed");
            setRole(null);
            roleRef.current = null;
            listenerBusyRef.current = false;
            listenerRequestIdRef.current = null;
          }
        });
        roomChannelRef.current = room;
        room.subscribe((subscriptionStatus) => {
          if (subscriptionStatus === "SUBSCRIBED") {
            void room.send({
              type: "broadcast",
              event: "peer-support-room",
              payload: {
                type: "hello",
                roomId: nextRoomId,
                senderId: participantIdRef.current,
                publicKey,
              },
            });
          }
        });
      } catch {
        destroyRoom();
        setStatus("closed");
        setErrorMessage("The secure room could not be created. Please try again.");
      }
    },
    [destroyRoom, supabase],
  );

  const chooseAcceptedListener = useCallback(() => {
    const requestId = activeRequestIdRef.current;
    if (!requestId || roleRef.current !== "requester") return;
    const winner = [...acceptedCandidatesRef.current]
      .filter((candidate) => candidate.requestId === requestId)
      .sort((a, b) => a.acceptedAt - b.acceptedAt || a.listenerId.localeCompare(b.listenerId))[0];
    if (!winner) return;

    if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
    requestTimerRef.current = null;
    const nextRoomId = createEphemeralId();
    sendLobby({
      type: "matched",
      requestId,
      roomId: nextRoomId,
      requesterId: participantIdRef.current,
      listenerId: winner.listenerId,
    });
    void enterRoom(nextRoomId);
  }, [enterRoom, sendLobby]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!authUser) {
        setIsLoading(false);
        return;
      }
      setUser({ id: authUser.id });
      const { data: listenerData } = await supabase.rpc("is_peer_listener");
      if (!mounted) return;
      setIsPeerListener(Boolean(listenerData));
      setIsLoading(false);
    })();

    const lobby = supabase.channel(PEER_SUPPORT_LOBBY, {
      config: { private: true, broadcast: { self: false } },
    });
    lobby.on("broadcast", { event: "peer-support" }, ({ payload }) => {
      if (!isPeerSupportPayload(payload)) return;

      if (payload.type === "request") {
        if (
          !listenerAvailableRef.current ||
          listenerBusyRef.current ||
          payload.requesterId === participantIdRef.current
        ) {
          return;
        }
        listenerBusyRef.current = true;
        listenerRequestIdRef.current = payload.requestId;
        roleRef.current = "listener";
        setRole("listener");
        setStatus("offering");
        sendLobby({
          type: "accept",
          requestId: payload.requestId,
          listenerId: participantIdRef.current,
          acceptedAt: Date.now(),
        });
        listenerTimerRef.current = setTimeout(() => {
          if (listenerRequestIdRef.current !== payload.requestId) return;
          listenerBusyRef.current = false;
          listenerRequestIdRef.current = null;
          roleRef.current = null;
          setRole(null);
          setStatus(listenerAvailableRef.current ? "idle" : "closed");
        }, PEER_SUPPORT_LISTENER_CONFIRM_TIMEOUT_MS);
        return;
      }

      if (payload.type === "accept" && roleRef.current === "requester") {
        if (payload.requestId !== activeRequestIdRef.current) return;
        acceptedCandidatesRef.current = [...acceptedCandidatesRef.current, payload];
        if (!acceptTimerRef.current) {
          acceptTimerRef.current = setTimeout(() => {
            acceptTimerRef.current = null;
            chooseAcceptedListener();
          }, 250);
        }
        return;
      }

      if (payload.type === "matched") {
        if (
          payload.requesterId === participantIdRef.current &&
          payload.requestId === activeRequestIdRef.current
        ) {
          void enterRoom(payload.roomId);
          return;
        }
        if (
          payload.listenerId === participantIdRef.current &&
          payload.requestId === listenerRequestIdRef.current
        ) {
          if (listenerTimerRef.current) clearTimeout(listenerTimerRef.current);
          listenerTimerRef.current = null;
          listenerAvailableRef.current = false;
          void enterRoom(payload.roomId);
          return;
        }
        if (payload.requestId === listenerRequestIdRef.current) {
          listenerBusyRef.current = false;
          listenerRequestIdRef.current = null;
          setStatus(listenerAvailableRef.current ? "idle" : "closed");
          setRole(null);
          roleRef.current = null;
        }
        return;
      }

      if (payload.type === "cancel" && payload.requestId === listenerRequestIdRef.current) {
        if (listenerTimerRef.current) clearTimeout(listenerTimerRef.current);
        listenerTimerRef.current = null;
        listenerBusyRef.current = false;
        listenerRequestIdRef.current = null;
        setStatus(listenerAvailableRef.current ? "idle" : "closed");
        setRole(null);
        roleRef.current = null;
      }
    });
    lobbyChannelRef.current = lobby;
    lobby.subscribe((subscriptionStatus) =>
      setConnectionReady(subscriptionStatus === "SUBSCRIBED"),
    );

    return () => {
      mounted = false;
      void lobby.unsubscribe();
      lobbyChannelRef.current = null;
      if (acceptTimerRef.current) clearTimeout(acceptTimerRef.current);
      if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
      if (listenerTimerRef.current) clearTimeout(listenerTimerRef.current);
      acceptTimerRef.current = null;
      requestTimerRef.current = null;
      listenerTimerRef.current = null;
      if (roomChannelRef.current) void roomChannelRef.current.unsubscribe();
      roomChannelRef.current = null;
      activeRequestIdRef.current = null;
      listenerRequestIdRef.current = null;
      roleRef.current = null;
      sharedKeyRef.current = null;
      ephemeralKeyPairRef.current = null;
      helloRespondedToRef.current.clear();
    };
  }, [chooseAcceptedListener, enterRoom, resetSession, sendLobby, supabase]);

  const startRequest = () => {
    if (!connectionReady || !user) return;
    resetSession(false);
    const requestId = createEphemeralId();
    activeRequestIdRef.current = requestId;
    roleRef.current = "requester";
    setRole("requester");
    setStatus("searching");
    setErrorMessage(null);
    sendLobby({
      type: "request",
      requestId,
      requesterId: participantIdRef.current,
      createdAt: Date.now(),
    });
    requestTimerRef.current = setTimeout(() => {
      if (activeRequestIdRef.current !== requestId) return;
      resetSession(false);
      setStatus("closed");
      setErrorMessage(
        "No verified peer listener accepted yet. You can try again when you are ready.",
      );
    }, PEER_SUPPORT_MATCH_TIMEOUT_MS);
  };

  const startListening = () => {
    if (!connectionReady || !isPeerListener) return;
    listenerAvailableRef.current = true;
    listenerBusyRef.current = false;
    setRole("listener");
    roleRef.current = "listener";
    setStatus("idle");
    toast.success("You are available for anonymous peer listening.");
  };

  const stopListening = () => {
    listenerAvailableRef.current = false;
    if (!listenerBusyRef.current) {
      setRole(null);
      roleRef.current = null;
      setStatus("idle");
    }
  };

  const sendMessage = async () => {
    const body = draft.trim();
    const currentRoomId = currentRoomIdRef.current;
    const sharedKey = sharedKeyRef.current;
    const room = roomChannelRef.current;
    if (
      !body ||
      body.length > MAX_PEER_SUPPORT_MESSAGE_LENGTH ||
      !currentRoomId ||
      !sharedKey ||
      !room
    )
      return;
    setDraft("");
    try {
      const { ciphertext, iv } = await encryptMessage(body, sharedKey);
      await room.send({
        type: "broadcast",
        event: "peer-support-room",
        payload: {
          type: "chat",
          roomId: currentRoomId,
          senderId: participantIdRef.current,
          ciphertext,
          iv,
          sentAt: Date.now(),
        },
      });
      setMessages((previous) => [...previous, { id: createEphemeralId(), body, mine: true }]);
    } catch {
      setErrorMessage("Your message could not be encrypted. Please try again.");
    }
  };

  const closeChat = () => {
    resetSession(true);
    setStatus("closed");
  };

  if (isLoading) {
    return (
      <SiteShell>
        <div className="flex min-h-[60vh] items-center justify-center gap-2 font-mono text-sm">
          <Loader2 className="h-5 w-5 animate-spin" /> Preparing private peer support…
        </div>
      </SiteShell>
    );
  }

  if (!user) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <HeartHandshake className="mx-auto h-12 w-12" aria-hidden="true" />
          <h1 className="mt-4 font-display text-3xl font-black uppercase">Chat with a peer</h1>
          <p className="mt-3 font-mono text-sm text-gray-600">
            Sign in to join an anonymous, ephemeral peer-support room.
          </p>
          <Link
            to="/auth"
            className="neu-border neu-press mt-6 inline-block bg-lime px-6 py-3 font-mono text-sm font-bold uppercase"
          >
            Sign in
          </Link>
        </div>
      </SiteShell>
    );
  }

  const inChat = status === "matched" || status === "chatting";
  const canRequest = status === "idle" || status === "closed";

  return (
    <SiteShell>
      <main className="min-h-screen bg-cream px-4 py-8 text-black">
        <div className="mx-auto max-w-5xl">
          <header className="border-b-2 border-black pb-6">
            <div className="flex items-center gap-3">
              <HeartHandshake className="h-10 w-10" aria-hidden="true" />
              <div>
                <p className="font-mono text-xs font-black uppercase tracking-widest">
                  CampusConnect care space
                </p>
                <h1 className="font-display text-4xl font-black uppercase md:text-5xl">
                  Peer listener match
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-3xl font-mono text-sm leading-relaxed text-black/70">
              Talk anonymously with a verified student peer listener who is trained to listen. This
              is peer support, not counseling or emergency care.
            </p>
          </header>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <section
              className="neu-border bg-white p-6 shadow-[6px_6px_0_0_#000]"
              aria-labelledby="support-heading"
            >
              <div className="flex items-start gap-3">
                <div className="border-2 border-black bg-peach p-3">
                  <MessageCircle className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="support-heading" className="font-display text-2xl font-black uppercase">
                    I need someone to listen
                  </h2>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-black/65">
                    Tap once to notify available verified listeners. Neither person sees the other’s
                    name, profile, or contact details.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={startRequest}
                disabled={!connectionReady || !canRequest}
                className="neu-border neu-press mt-6 w-full bg-lime font-mono text-sm font-black uppercase text-black"
              >
                {status === "searching" ? "Finding a peer listener…" : "Chat with a Peer"}
              </Button>
              {status === "searching" && (
                <div
                  className="mt-4 border-2 border-dashed border-black bg-yellow-100 p-4 font-mono text-xs"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2 font-black uppercase">
                    <Loader2 className="h-4 w-4 animate-spin" /> Waiting room is open
                  </div>
                  <p className="mt-2">
                    We are notifying verified listeners. You can leave at any time; no request
                    record is saved.
                  </p>
                  <button
                    type="button"
                    onClick={() => resetSession(true)}
                    className="mt-3 inline-flex items-center gap-1 underline"
                  >
                    <X className="h-3 w-3" /> Cancel request
                  </button>
                </div>
              )}
            </section>

            <section
              className="neu-border bg-zinc-950 p-6 text-white"
              aria-labelledby="listener-heading"
            >
              <div className="flex items-start gap-3">
                <div className="border-2 border-white bg-violet-500 p-3">
                  <Users className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="listener-heading" className="font-display text-2xl font-black uppercase">
                    I can listen
                  </h2>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-white/70">
                    Verified upperclass psychology majors can volunteer for anonymous, one-room peer
                    listening sessions.
                  </p>
                </div>
              </div>
              {isPeerListener ? (
                <div className="mt-6">
                  {!listenerAvailableRef.current && !listenerBusyRef.current ? (
                    <Button
                      type="button"
                      onClick={startListening}
                      disabled={!connectionReady || inChat}
                      className="neu-border neu-press w-full bg-violet-400 font-mono text-sm font-black uppercase text-black"
                    >
                      Start listening
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={stopListening}
                      disabled={listenerBusyRef.current || inChat}
                      className="neu-border neu-press w-full bg-white font-mono text-sm font-black uppercase text-black"
                    >
                      Stop listening
                    </Button>
                  )}
                  {status === "offering" && (
                    <div
                      className="mt-3 border border-white/30 bg-white/10 p-3 font-mono text-[11px]"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="flex items-center gap-2 font-bold uppercase">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting anonymously
                      </div>
                      <p className="mt-1 text-white/70">
                        A requester is being connected to you. You will enter the room only after
                        the requester confirms.
                      </p>
                    </div>
                  )}
                  <p className="mt-3 flex items-start gap-2 font-mono text-[11px] text-white/60">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    You will be shown only as “Peer Listener.” Never share personal contact details
                    in the room.
                  </p>
                </div>
              ) : (
                <p className="mt-6 border border-white/30 p-3 font-mono text-[11px] leading-relaxed text-white/65">
                  Listener access is limited to students verified by a CampusConnect administrator.
                  If you meet the training requirements, contact your Student Union administrator.
                </p>
              )}
            </section>
          </div>

          <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Privacy guarantees">
            <div className="border-2 border-black bg-lime-200 p-4">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              <p className="mt-2 font-mono text-xs font-bold uppercase">Encrypted in browser</p>
              <p className="mt-1 font-mono text-[11px] text-black/65">
                Only ciphertext crosses the realtime relay.
              </p>
            </div>
            <div className="border-2 border-black bg-blue-200 p-4">
              <LogOut className="h-5 w-5" aria-hidden="true" />
              <p className="mt-2 font-mono text-xs font-bold uppercase">Ephemeral by design</p>
              <p className="mt-1 font-mono text-[11px] text-black/65">
                Closing the room clears messages and key references.
              </p>
            </div>
            <div className="border-2 border-black bg-peach p-4">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <p className="mt-2 font-mono text-xs font-bold uppercase">Anonymous to each other</p>
              <p className="mt-1 font-mono text-[11px] text-black/65">
                No names, transcripts, or contact details are displayed.
              </p>
            </div>
          </section>

          {(errorMessage || status === "closed") && !inChat && (
            <div
              className="mt-6 border-2 border-black bg-yellow-100 p-4 font-mono text-xs"
              role="status"
            >
              {errorMessage ||
                "This peer-support room is closed. Nothing from the conversation was saved."}
            </div>
          )}

          {inChat && (
            <section
              className="neu-border mt-6 overflow-hidden bg-white shadow-[6px_6px_0_0_#000]"
              aria-labelledby="chat-heading"
            >
              <div className="flex items-center justify-between gap-3 border-b-2 border-black bg-violet-200 p-4">
                <div>
                  <p className="font-mono text-[10px] font-black uppercase tracking-widest">
                    Ephemeral room
                  </p>
                  <h2 id="chat-heading" className="font-display text-2xl font-black uppercase">
                    {role === "listener" ? "Listening with you" : "A peer is here"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeChat}
                  className="neu-border neu-press bg-white p-2"
                  aria-label="Close peer-support room"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div
                className="flex items-center gap-2 border-b border-black/20 bg-cream px-4 py-3 font-mono text-[11px]"
                role="status"
                aria-live="polite"
              >
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                {encryptedReady
                  ? "End-to-end encrypted · no transcript is saved"
                  : "Establishing the ephemeral encryption key…"}
              </div>
              <div
                className="min-h-72 space-y-3 p-4"
                aria-live="polite"
                aria-label="Encrypted peer-support messages"
              >
                {messages.length === 0 ? (
                  <p className="py-12 text-center font-mono text-xs text-black/55">
                    {encryptedReady
                      ? "You can start with a gentle hello."
                      : "Secure handshake in progress…"}
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                    >
                      <p
                        className={`max-w-[85%] border-2 border-black px-3 py-2 font-mono text-sm ${message.mine ? "bg-lime-200" : "bg-blue-100"}`}
                      >
                        {message.body}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t-2 border-black p-4">
                <div className="flex gap-2">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    maxLength={MAX_PEER_SUPPORT_MESSAGE_LENGTH}
                    disabled={!encryptedReady}
                    placeholder="Write something kind…"
                    aria-label="Message to peer listener"
                    className="neu-border min-h-12 flex-1 bg-cream font-mono text-sm"
                  />
                  <Button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={!encryptedReady || !draft.trim()}
                    className="neu-border neu-press self-end bg-black text-white"
                    aria-label="Send encrypted message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex items-start justify-between gap-3 font-mono text-[10px] text-black/50">
                  <span>
                    {draft.length}/{MAX_PEER_SUPPORT_MESSAGE_LENGTH}
                  </span>
                  <span>Do not share identifying details or emergency information here.</span>
                </div>
              </div>
            </section>
          )}

          <aside
            className="mt-8 border-2 border-red-700 bg-red-50 p-4 text-red-950"
            aria-label="Crisis support notice"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-mono text-xs font-black uppercase">
                  If you may be in immediate danger
                </p>
                <p className="mt-1 font-mono text-xs leading-relaxed">
                  This peer room is not an emergency service. Contact your local emergency number
                  now, or open the{" "}
                  <Link to="/wellness" className="font-bold underline">
                    Campus Wellness Hub
                  </Link>{" "}
                  for crisis-resource options.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </SiteShell>
  );
}
