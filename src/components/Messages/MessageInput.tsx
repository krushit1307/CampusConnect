import { Send } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { Button } from "@/components/ui/button";

interface MessageInputProps {
  onSend: (e: React.FormEvent) => void;
  onTyping: () => void;
  onFocus: () => void;
  typingUsers: string[];
}

export default function MessageInput({
  onSend,
  onTyping,
  onFocus,
  typingUsers,
}: MessageInputProps) {
  const inputMessage = useChatStore((s) => s.inputMessage);
  const setInputMessage = useChatStore((s) => s.setInputMessage);

  return (
    <form
      onSubmit={onSend}
      className="border-t-2 border-black p-3 bg-white dark:bg-zinc-900 dark:border-cream flex flex-col gap-2"
    >
      <div
        className="min-h-[1.25rem] flex items-center gap-1.5"
        aria-live="polite"
        aria-atomic="true"
      >
        {typingUsers.length > 0 && (
          <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 italic animate-pulse">
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
            onTyping();
          }}
          onFocus={onFocus}
          placeholder="Type a secure message..."
          className="flex-1 border-2 border-black px-3 py-2 font-mono text-sm focus:outline-none dark:bg-zinc-800 dark:border-cream dark:text-cream"
        />
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 border-2 border-black bg-lime text-black neu-border neu-press"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
