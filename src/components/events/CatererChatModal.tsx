import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ChefHat, Send, X, AlertTriangle } from "lucide-react";
import { analyzeQaProfanity } from "@/lib/qaProfanityFilter";

export function CatererChatModal({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const [chat, setChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadChat();
    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`attendee-caterer-chat-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "caterer_attendee_chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const loadChat = async () => {
    const { data, error } = await supabase
      .from("caterer_attendee_chats")
      .select("*, event:events(title), alert:caterer_dietary_alerts(dietary_tag)")
      .eq("id", chatId)
      .single();

    if (error) {
      toast.error("Failed to load chat details.");
      return;
    }
    setChat(data);
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("caterer_attendee_chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    // Check for profanity
    const profanityResult = analyzeQaProfanity(messageInput.trim());
    if (profanityResult.isProfane) {
      toast.error("Message flagged for inappropriate content. Please rephrase.");
      return;
    }

    setSending(true);

    const { error } = await supabase.from("caterer_attendee_chat_messages").insert({
      chat_id: chatId,
      sender_type: "attendee",
      content: messageInput.trim(),
    });

    if (error) {
      toast.error("Failed to send message: " + error.message);
    } else {
      setMessageInput("");
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border-2 border-black dark:border-cream rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] flex flex-col h-[70vh] overflow-hidden relative">
        {/* Header */}
        <div className="bg-amber-400 border-b-2 border-black p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChefHat className="w-6 h-6 text-black" />
            <div>
              <h3 className="font-display font-black uppercase text-black text-lg leading-none">
                Caterer Chat
              </h3>
              {chat && (
                <p className="font-mono text-[10px] text-black font-bold mt-1">
                  {chat.event?.title} • {chat.alert?.dietary_tag}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-100 p-3 border-b-2 border-black flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="font-mono text-xs text-amber-800">
            This chat is anonymized. The caterer does not see your real name.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center font-mono text-xs text-slate-500 mt-10">
              No messages yet.
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_type === "attendee";
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-xl p-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isMe ? "bg-amber-200 text-black" : "bg-white text-black dark:bg-zinc-800 dark:text-cream"}`}
                >
                  <p className="text-[10px] font-bold font-mono mb-1 opacity-70">
                    {isMe ? "You" : "Caterer"}
                  </p>
                  <p className="text-sm font-medium">{msg.content}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="p-4 border-t-2 border-black bg-slate-50 dark:bg-zinc-800">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Reply to caterer..."
              className="flex-1 bg-white border-2 border-black p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-black"
              disabled={chat?.status === "archived"}
            />
            <button
              type="submit"
              disabled={sending || chat?.status === "archived"}
              className="bg-amber-500 text-black border-2 border-black p-3 font-bold hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          {chat?.status === "archived" && (
            <p className="text-center text-[10px] text-red-500 font-mono font-bold mt-2">
              Chat archived (Event concluded).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
