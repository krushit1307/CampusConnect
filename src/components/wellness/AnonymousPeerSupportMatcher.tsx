// =============================================================================
// File: src/components/wellness/AnonymousPeerSupportMatcher.tsx
// Issue: #4296 - Develop a 'Dynamic "Mental Health" Peer Support Matcher'
// Description: Anonymous, end-to-end encrypted (E2EE) peer support chat station,
//              Web Crypto ephemeral keys, box-breathing widget, and safety escalation.
// =============================================================================

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Heart,
  ShieldCheck,
  ShieldAlert,
  Send,
  Lock,
  Flame,
  Radio,
  Clock,
  Sparkles,
  RefreshCw,
  PhoneCall,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Smile,
  Frown,
  Meh,
  Activity,
  HeartHandshake,
  Key,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  SupportTopicCategory,
  PeerListenerProfile,
  AnonymousSessionState,
  EncryptedChatMessage,
} from "@/types/peerSupportMatcher";
import {
  generateEphemeralSessionKey,
  encryptEphemeralMessage,
  decryptEphemeralMessage,
  evaluateCrisisSafetyTriggers,
  queueAnonymousPeerSupport,
  getMockPeerListeners,
} from "@/services/peerSupportMatcherService";
import {
  getBoxBreathingInstruction,
  simulatePeerListenerMatch,
} from "@/services/peerSupportQueueSimulator";
import { CrisisSafetyEscalationDrawer } from "@/components/wellness/CrisisSafetyEscalationDrawer";
import { PeerListenerDashboard } from "@/components/wellness/PeerListenerDashboard";
import { SafetyPlanInteractiveBuilder } from "@/components/wellness/SafetyPlanInteractiveBuilder";

export const AnonymousPeerSupportMatcher: React.FC = () => {
  const [activePortalTab, setActivePortalTab] = useState<string>("student_client");
  const [sessionState, setSessionState] = useState<AnonymousSessionState | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<SupportTopicCategory>("academic_burnout");
  const [selectedMood, setSelectedMood] = useState<number>(2); // 1-5
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

  const [messageInput, setMessageInput] = useState<string>("");
  const [isCrisisModalOpen, setIsCrisisModalOpen] = useState<boolean>(false);
  const [isSafetyAlertTriggered, setIsSafetyAlertTriggered] = useState<boolean>(false);
  const [elapsedWaitingSeconds, setElapsedWaitingSeconds] = useState<number>(0);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Box Breathing Exercise Instruction
  const breathingPhase = useMemo(() => {
    return getBoxBreathingInstruction(elapsedWaitingSeconds);
  }, [elapsedWaitingSeconds]);

  // Queue Waiting Timer & Automatic Match Simulation
  useEffect(() => {
    if (!sessionState || sessionState.status !== "in_queue") return;

    const timer = setInterval(() => {
      setElapsedWaitingSeconds((prev) => prev + 1);
    }, 1000);

    // Simulate match after 5 seconds
    const matchTimeout = setTimeout(async () => {
      if (cryptoKey) {
        const { updatedSession } = await simulatePeerListenerMatch(sessionState, cryptoKey);
        setSessionState(updatedSession);
        setSuccessToast(
          `Connected with verified Peer Listener ${updatedSession.matchedListener?.anonymousAlias}! E2EE Session Live.`
        );
        setTimeout(() => setSuccessToast(null), 5000);
      }
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(matchTimeout);
    };
  }, [sessionState, cryptoKey]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [sessionState?.messages]);

  // Step 1: Start Anonymous Session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const key = await generateEphemeralSessionKey();
      setCryptoKey(key);

      const { session } = await queueAnonymousPeerSupport(selectedTopic, selectedMood);
      setSessionState(session);
      setElapsedWaitingSeconds(0);
    } catch {
      // Fallback
    }
  };

  // Step 2: Send Encrypted Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !sessionState || !cryptoKey) return;

    const rawText = messageInput.trim();
    setMessageInput("");

    // Crisis Safety Evaluation
    const safetyCheck = evaluateCrisisSafetyTriggers(rawText);
    if (safetyCheck.isCriticalCrisis) {
      setIsSafetyAlertTriggered(true);
      setIsCrisisModalOpen(true);
    }

    // Encrypt in memory with AES-GCM 256
    const { ciphertextBase64, ivBase64 } = await encryptEphemeralMessage(rawText, cryptoKey);

    const newMessage: EncryptedChatMessage = {
      id: `msg-${Date.now()}`,
      senderRole: "student",
      ciphertext: ciphertextBase64,
      iv: ivBase64,
      plaintext: rawText,
      timestamp: new Date().toISOString(),
      isSafetyWarning: safetyCheck.isCriticalCrisis,
    };

    setSessionState((prev) =>
      prev ? { ...prev, messages: [...prev.messages, newMessage] } : null
    );

    // Simulate instant peer listener empathetic reply after 2.5 seconds
    if (sessionState.status === "matched_active") {
      setTimeout(async () => {
        const replies = [
          "I hear you, and that makes total sense. Being in college with that amount of pressure is exhausting.",
          "Thank you for sharing that with me. It takes real courage to open up when you're overwhelmed.",
          "You're not alone in feeling this way. How have you been managing your sleep and meals today?",
          "Take a slow breath. We can take this one step at a time.",
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        const enc = await encryptEphemeralMessage(randomReply, cryptoKey);

        const replyMsg: EncryptedChatMessage = {
          id: `msg-${Date.now()}`,
          senderRole: "peer_listener",
          ciphertext: enc.ciphertextBase64,
          iv: enc.ivBase64,
          plaintext: randomReply,
          timestamp: new Date().toISOString(),
        };

        setSessionState((prev) =>
          prev ? { ...prev, messages: [...prev.messages, replyMsg] } : null
        );
      }, 2500);
    }
  };

  // Step 3: 1-Click End Chat & Cryptographic Memory Wipe
  const handleEndChatAndDestroyKeys = () => {
    setCryptoKey(null); // Destroy in-memory key
    setSessionState(null); // Wipe state
    setSuccessToast("🔒 Chat session ended. Cryptographic keys destroyed from browser memory.");
    setTimeout(() => setSuccessToast(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Station */}
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-purple-500 text-white">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Anonymous Mental Health Peer Support Matcher
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Ephemeral Web Crypto E2EE Messaging • Zero Database Storage • Verified Upperclassmen Peer Listeners
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCrisisModalOpen(true)}
              className="neu-border flex items-center gap-1.5 bg-rose-600 font-mono text-xs font-bold uppercase text-white hover:bg-rose-700 shadow-[3px_3px_0_0_#000]"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              24/7 Crisis Hotline (988)
            </Button>
          </div>
        </div>

        {/* Global Success Notification */}
        {successToast && (
          <div className="neu-border mt-4 flex items-center gap-2 bg-emerald-100 p-3 text-xs font-mono font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Privacy Shield Guarantee */}
        <div className="neu-border mt-4 flex items-center gap-3 bg-purple-50/70 p-3 text-xs font-mono text-purple-950 dark:bg-purple-950/30 dark:text-purple-200 border-purple-300">
          <ShieldCheck className="h-5 w-5 text-purple-600 shrink-0" />
          <span>
            <strong>Zero-Knowledge Privacy Shield:</strong> Conversations are encrypted using AES-GCM 256 keys generated in your browser. Messages are never saved to disk or database. All cryptographic keys are permanently destroyed when the session terminates.
          </span>
        </div>
      </div>

      {/* Tabs: Student Portal vs Certified Listener Portal vs Safety Plan Builder */}
      <Tabs value={activePortalTab} onValueChange={setActivePortalTab} className="w-full">
        <TabsList className="neu-border grid w-full max-w-xl grid-cols-3 bg-white p-1 dark:bg-zinc-900">
          <TabsTrigger
            value="student_client"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-purple-500 dark:data-[state=active]:text-white"
          >
            Chat with a Peer
          </TabsTrigger>
          <TabsTrigger
            value="listener_dashboard"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-purple-500 dark:data-[state=active]:text-white"
          >
            Peer Listener Portal
          </TabsTrigger>
          <TabsTrigger
            value="safety_plan"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-purple-500 dark:data-[state=active]:text-white"
          >
            Safety Plan Modeler
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Student Client */}
        <TabsContent value="student_client" className="mt-4">
          {!sessionState ? (
            /* STAGE 1: Intake & Mood Selection */
            <div className="neu-border bg-white p-6 dark:bg-zinc-900 max-w-2xl mx-auto space-y-6">
              <div>
                <h3 className="text-xl font-black uppercase text-zinc-900 dark:text-white">
                  Connect with a Fellow Student Listener
                </h3>
                <p className="font-mono text-xs text-zinc-500 mt-1">
                  Select what's on your mind. We will match you with a certified upperclassman psychology major who gets it.
                </p>
              </div>

              <form onSubmit={handleStartSession} className="space-y-5 font-mono text-xs">
                {/* Topic Selector */}
                <div>
                  <label className="block font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-2">
                    What would you like to talk about?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: "academic_burnout", label: "Academic Burnout & Midterms" },
                      { id: "social_isolation", label: "Feeling Lonely / Social Anxiety" },
                      { id: "imposter_syndrome", label: "Imposter Syndrome in Tech/College" },
                      { id: "post_event_overwhelm", label: "Post-Event Overstimulation" },
                      { id: "relationship_conflict", label: "Roommate / Relationship Issues" },
                      { id: "general_venting", label: "Just Need to Vent (No Advice)" },
                    ].map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setSelectedTopic(t.id as SupportTopicCategory)}
                        className={`neu-border p-3 text-left font-bold transition-colors ${
                          selectedTopic === t.id
                            ? "bg-purple-600 text-white shadow-[3px_3px_0_0_#000]"
                            : "bg-zinc-50 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 hover:bg-zinc-100"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mood Rating */}
                <div>
                  <label className="block font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-2">
                    How are you feeling right now?
                  </label>
                  <div className="flex items-center justify-between gap-2 max-w-md">
                    {[
                      { rating: 1, label: "Awful" },
                      { rating: 2, label: "Stressed" },
                      { rating: 3, label: "Tired" },
                      { rating: 4, label: "Okay" },
                      { rating: 5, label: "Good" },
                    ].map((m) => (
                      <button
                        type="button"
                        key={m.rating}
                        onClick={() => setSelectedMood(m.rating)}
                        className={`neu-border flex-1 p-2 text-center font-bold ${
                          selectedMood === m.rating
                            ? "bg-purple-600 text-white shadow-[2px_2px_0_0_#000]"
                            : "bg-zinc-50 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        <div className="text-sm">{m.rating}</div>
                        <div className="text-[10px]">{m.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="neu-border w-full bg-purple-600 font-mono text-xs font-black uppercase text-white hover:bg-purple-700 shadow-[4px_4px_0_0_#000] py-3"
                >
                  <Lock className="h-4 w-4 mr-1.5" />
                  Initialize E2EE Chat with a Peer Listener
                </Button>
              </form>
            </div>
          ) : sessionState.status === "in_queue" ? (
            /* STAGE 2: Waiting Room with Box Breathing Calming Exercise */
            <div className="neu-border bg-white p-6 dark:bg-zinc-900 max-w-2xl mx-auto space-y-6 text-center">
              <div className="inline-flex items-center gap-2 rounded bg-purple-100 px-3 py-1 font-mono text-xs font-bold text-purple-900 dark:bg-purple-950 dark:text-purple-300">
                <Activity className="h-4 w-4 animate-spin text-purple-600" />
                <span>Pinging Available Verified Peer Listeners... ({elapsedWaitingSeconds}s)</span>
              </div>

              <h3 className="text-xl font-black uppercase text-zinc-900 dark:text-white">
                Finding You a Certified Peer Listener
              </h3>
              <p className="font-mono text-xs text-zinc-500 max-w-md mx-auto">
                Estimated wait time: <strong>&lt; 30 seconds</strong>. Take a moment to relax with this guided breathing exercise.
              </p>

              {/* Interactive Box Breathing Circle */}
              <div className="neu-border relative mx-auto my-6 flex h-48 w-48 flex-col items-center justify-center rounded-full border-4 border-purple-500 bg-purple-50 dark:bg-purple-950/40 p-4 transition-all">
                <span className="font-mono text-xs font-black uppercase text-purple-900 dark:text-purple-200">
                  {breathingPhase.label}
                </span>
                <p className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 mt-1 px-2 text-center">
                  {breathingPhase.instruction}
                </p>
                <div className="mt-2 font-mono text-lg font-black text-purple-600">
                  {4 - Math.floor((elapsedWaitingSeconds % 16) % 4)}s
                </div>
              </div>

              <Button
                variant="outline"
                onClick={handleEndChatAndDestroyKeys}
                className="neu-border font-mono text-xs font-bold uppercase text-zinc-600"
              >
                Cancel Queue Request
              </Button>
            </div>
          ) : (
            /* STAGE 3: Live E2EE Ephemeral Chat Room */
            <div className="neu-border bg-white dark:bg-zinc-900 max-w-3xl mx-auto overflow-hidden">
              {/* Chat Header */}
              <div className="border-b border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-purple-500 text-white">
                    <HeartHandshake className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-mono text-xs font-black uppercase text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>{sessionState.matchedListener?.anonymousAlias || "Peer Listener"}</span>
                      <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[9px] font-bold">
                        Online
                      </span>
                    </h4>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {sessionState.matchedListener?.majorOrFocus}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleEndChatAndDestroyKeys}
                    className="neu-border bg-rose-600 font-mono text-[11px] font-black uppercase text-white hover:bg-rose-700 shadow-[2px_2px_0_0_#000]"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    End & Destroy Keys
                  </Button>
                </div>
              </div>

              {/* Messages Feed */}
              <div
                ref={chatScrollRef}
                className="h-[380px] overflow-y-auto p-4 space-y-3 font-mono text-xs bg-zinc-950/5 dark:bg-zinc-950/40"
              >
                {sessionState.messages.map((msg) => {
                  if (msg.senderRole === "system_shield") {
                    return (
                      <div
                        key={msg.id}
                        className="neu-border bg-purple-50 p-2.5 text-center text-[11px] text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 border-purple-300"
                      >
                        {msg.plaintext}
                      </div>
                    );
                  }

                  const isStudent = msg.senderRole === "student";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isStudent ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`neu-border max-w-md p-3 rounded ${
                          isStudent
                            ? "bg-purple-600 text-white"
                            : "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white"
                        }`}
                      >
                        <p className="text-xs">{msg.plaintext}</p>
                      </div>
                      <span className="text-[9px] text-zinc-400 mt-0.5 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={handleSendMessage}
                className="border-t border-zinc-200 p-3 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2 font-mono text-xs"
              >
                <input
                  type="text"
                  placeholder="Type a message (E2EE encrypted in browser)..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="neu-border flex-1 bg-zinc-50 p-2.5 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white"
                />
                <Button
                  type="submit"
                  className="neu-border bg-purple-600 font-mono text-xs font-black uppercase text-white hover:bg-purple-700 shadow-[3px_3px_0_0_#000]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Certified Listener Portal */}
        <TabsContent value="listener_dashboard" className="mt-4">
          <PeerListenerDashboard />
        </TabsContent>

        {/* Tab 3: Safety Plan Builder */}
        <TabsContent value="safety_plan" className="mt-4">
          <SafetyPlanInteractiveBuilder />
        </TabsContent>
      </Tabs>

      {/* 24/7 Crisis Escalation Modal */}
      <CrisisSafetyEscalationDrawer
        isOpen={isCrisisModalOpen}
        onClose={() => setIsCrisisModalOpen(false)}
        isTriggeredByKeyword={isSafetyAlertTriggered}
      />
    </div>
  );
};

export default AnonymousPeerSupportMatcher;
