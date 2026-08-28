import React, { useState, useRef, useEffect } from "react";
import { useSecureChat, SecureMessage } from "../../hooks/useSecureChat";
import { CrisisSafetyEscalationDrawer } from "../wellness/CrisisSafetyEscalationDrawer";
import { ShieldAlert, Lock } from "lucide-react";

interface SecureChatRoomProps {
  channelId: string;
  channelName: string;
  userPrivateKey: CryptoKey | null;
  currentUserId: string; // Added to determine own messages
  isResponder?: boolean; // Added for Issue #4786
  isAnonymousSupport?: boolean; // Added for Issue #4786
}

export const SecureChatRoom: React.FC<SecureChatRoomProps> = ({
  channelId,
  channelName,
  userPrivateKey,
  currentUserId,
  isResponder = false,
  isAnonymousSupport = false,
}) => {
  const { messages, isLoading, isDecrypting, error, sendMessage, hasKeys } = useSecureChat(
    channelId,
    userPrivateKey,
  );
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEscalationOpen, setIsEscalationOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    setIsSending(true);
    const success = await sendMessage(input);
    if (success) {
      setInput("");
    }
    setIsSending(false);
  };

  if (!userPrivateKey) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-red-800 dark:text-red-300 mb-2">
          Missing Private Key
        </h3>
        <p className="text-red-600 dark:text-red-400 max-w-md">
          This is a secure, end-to-end encrypted channel. Your private key is not present on this
          device, so historical messages cannot be decrypted.
        </p>
        <button className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
          Import Key Backup
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white dark:bg-zinc-900 rounded-xl border-2 border-black dark:border-zinc-700 overflow-hidden neu-shadow">
      {/* Header with Security Badge & Escalation */}
      <div className="p-4 border-b-2 border-black dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded border-2 border-black bg-emerald-400 dark:bg-emerald-600 flex items-center justify-center text-black dark:text-white">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black uppercase text-zinc-900 dark:text-white flex items-center gap-2">
              {isAnonymousSupport ? "Confidential Support Session" : channelName}
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-900 rounded">
                E2EE
              </span>
            </h2>
            <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
              {isAnonymousSupport
                ? "Identities are strictly hidden. This session is encrypted."
                : "Messages are encrypted. Search is disabled."}
            </p>
          </div>
        </div>

        {/* Issue #4786: Escalation Button for Responders */}
        {isResponder && isAnonymousSupport && (
          <button
            onClick={() => setIsEscalationOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white font-bold uppercase text-xs border-2 border-black hover:bg-rose-700 shadow-[2px_2px_0_0_#000] transition-all"
          >
            <ShieldAlert className="w-4 h-4" />
            Escalate to 911
          </button>
        )}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-zinc-50/50 dark:bg-zinc-900/50">
        {isLoading || isDecrypting ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 font-mono text-zinc-500">
              <span className="text-sm font-bold uppercase animate-pulse">
                Decrypting secure channel...
              </span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 font-mono">
            <Lock className="w-12 h-12 mb-4 opacity-50" />
            <p className="font-bold uppercase">Secure channel established</p>
            <p className="text-xs mt-1">Begin typing to send an encrypted message.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              isAnonymousSupport={isAnonymousSupport}
              isResponder={isResponder}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSend}
        className="p-4 border-t-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-800"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasKeys ? "Type a secure message..." : "Cannot send: Missing keys"}
            disabled={!hasKeys || isSending}
            className="flex-1 px-4 py-3 border-2 border-black bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm disabled:opacity-50"
          />
          <button
            typesubmit="submit"
            disabled={!hasKeys || isSending || !input.trim()}
            className="px-6 py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase text-sm border-2 border-black hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>

      {/* Crisis Escalation Drawer */}
      <CrisisSafetyEscalationDrawer
        isOpen={isEscalationOpen}
        onClose={() => setIsEscalationOpen(false)}
      />
    </div>
  );
};

/**
 * Individual Message Bubble Component
 */
const MessageBubble: React.FC<{
  message: SecureMessage;
  currentUserId: string;
  isAnonymousSupport: boolean;
  isResponder: boolean;
}> = ({ message, currentUserId, isAnonymousSupport, isResponder }) => {
  // Evaluate true ownership
  const isOwnMessage = message.sender_id === currentUserId;

  // Issue #4786: Mask identities if this is an anonymous support session
  let displayName = message.sender_profile?.full_name || "Unknown";
  if (isAnonymousSupport) {
    if (isOwnMessage) {
      displayName = isResponder ? "You (Responder)" : "You";
    } else {
      displayName = isResponder ? "Student" : "Peer Responder";
    }
  }

  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] px-4 py-3 border-2 border-black shadow-[2px_2px_0_0_#000] ${
          isOwnMessage
            ? "bg-emerald-400 text-black rounded-tl-xl rounded-tr-xl rounded-bl-xl"
            : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tl-xl rounded-tr-xl rounded-br-xl"
        }`}
      >
        {!isOwnMessage && (
          <p
            className={`font-mono text-[10px] font-black uppercase mb-1 ${isAnonymousSupport ? "text-rose-600" : "text-indigo-600"}`}
          >
            {displayName}
          </p>
        )}

        {message.decryption_error ? (
          <p className="text-sm italic font-bold flex items-center gap-1 text-rose-700">
            Decryption failed (Key mismatch)
          </p>
        ) : message.is_decrypted ? (
          <p className="text-sm whitespace-pre-wrap break-words">{message.plaintext}</p>
        ) : (
          <p className="text-sm italic opacity-50">Decrypting...</p>
        )}

        <p
          className={`font-mono text-[9px] mt-2 text-right ${isOwnMessage ? "text-emerald-900" : "text-zinc-500"}`}
        >
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
};
