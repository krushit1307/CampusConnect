import { Lock } from "lucide-react";
import type { Message } from "@/store/useChatStore";
import { useChatStore } from "@/store/useChatStore";
import LinkPreviewCard from "./LinkPreviewCard";

export default function MessageBubble({ msg }: { msg: Message }) {
  const currentUser = useChatStore((s) => s.currentUser);
  if (!currentUser) return null;

  const isMe = msg.sender_id === currentUser.id;
  const time = new Date(msg.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const urlMatch = msg.content.match(/(https?:\/\/[^\s]+)/i);
  const firstUrl = urlMatch ? urlMatch[0] : null;

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:border-cream ${
          isMe
            ? "bg-lime text-black"
            : "bg-white text-black dark:bg-zinc-800 dark:text-cream dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.15)]"
        }`}
      >
        <p className="whitespace-pre-wrap font-sans text-sm font-medium">{msg.content}</p>
        {firstUrl && <LinkPreviewCard url={firstUrl} />}
        <div className="mt-1.5 flex items-center justify-between gap-4 font-mono text-[9px] uppercase opacity-60">
          <span>{time}</span>
          <span className="flex items-center gap-0.5">
            {isMe ? (
              msg.read_at ? (
                <span className="flex items-center gap-0.5 text-blue-600" title="Read">
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
}
