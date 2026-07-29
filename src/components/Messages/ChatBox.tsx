import { Lock } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { useChat } from "./useChat";
import ChatHeader from "./ChatHeader";
import ContactList from "./ContactList";
import ChatWindow from "./ChatWindow";

export default function ChatBox() {
  const currentUser = useChatStore((s) => s.currentUser);

  const { typingUsers, broadcastTyping, clearTyping, handleSendMessage, handleResetKeys } =
    useChat();

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
      <ChatHeader onResetKeys={handleResetKeys} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <ContactList />
        <ChatWindow
          onSend={handleSendMessage}
          onTyping={broadcastTyping}
          onFocus={broadcastTyping}
          typingUsers={typingUsers}
        />
      </div>
    </div>
  );
}
