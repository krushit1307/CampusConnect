import { useRef, useEffect } from "react";
import Lock from "lucide-react/dist/esm/icons/lock";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { useChatStore } from "@/store/useChatStore";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

interface ChatWindowProps {
  onSend: (e: React.FormEvent) => void;
  onTyping: () => void;
  onFocus: () => void;
  typingUsers: string[];
}

export default function ChatWindow({ onSend, onTyping, onFocus, typingUsers }: ChatWindowProps) {
  const activeRecipient = useChatStore((s) => s.activeRecipient);
  const messages = useChatStore((s) => s.messages);
  const loadingMessages = useChatStore((s) => s.loadingMessages);
  const recipientKeyError = useChatStore((s) => s.recipientKeyError);
  const currentUser = useChatStore((s) => s.currentUser);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!activeRecipient) {
    return (
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center p-6 text-center md:col-span-8 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-black dark:border-cream">
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
    );
  }

  return (
    <div className="flex flex-col border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-black dark:border-cream md:col-span-8">
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

      <div
        id="messages-container"
        className="flex-1 h-[420px] overflow-y-auto bg-slate-50 dark:bg-zinc-950 p-4 space-y-3"
      >
        {recipientKeyError ? (
          <div className="flex h-full items-center justify-center p-4">
            <div className="max-w-md border-2 border-black bg-yellow-50 p-6 text-center text-black shadow-md">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-yellow-600" />
              <h4 className="font-display text-sm font-bold uppercase">Encryption Blocked</h4>
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
              Send a message to start a conversation. Only you and this recipient can decrypt the
              contents.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {!recipientKeyError && (
        <MessageInput
          onSend={onSend}
          onTyping={onTyping}
          onFocus={onFocus}
          typingUsers={typingUsers}
        />
      )}
    </div>
  );
}
