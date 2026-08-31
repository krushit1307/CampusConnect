import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, MessageCircle, AlertTriangle, Send } from "lucide-react";
import { acknowledgeCatererDietaryAlert } from "@/services/catererDietaryAlert";
import { analyzeQaProfanity } from "@/lib/qaProfanityFilter";

export default function CatererAlertView() {
  const { token } = useParams<{ token: string }>();
  const [alert, setAlert] = useState<any>(null);
  const [chat, setChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (token) loadAlertAndChat();
  }, [token]);

  const loadAlertAndChat = async () => {
    setLoading(true);
    try {
      // Use the security definer function to get chat info via token
      const { data: chatData, error: chatErr } = await supabase.rpc("get_caterer_chat_by_token", {
        p_token: token,
      });

      if (chatErr) throw new Error(chatErr.message);

      if (chatData && chatData.length > 0) {
        setChat(chatData[0]);
        // Also subscribe to messages for this chat_id
        loadMessages(chatData[0].id);
        setupRealtime(chatData[0].id);
      } else {
        // Chat doesn't exist yet, we just have an alert.
        // Let's create the chat when caterer first visits, or wait for them to click "Message Attendee"
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load alert details.");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    const { data, error } = await supabase
      .from("caterer_attendee_chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (!error && data) {
      setMessages(data);
    }
  };

  const setupRealtime = (chatId: string) => {
    supabase
      .channel(`caterer-chat-${chatId}`)
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
  };

  const handleAcknowledge = async () => {
    if (!token) return;
    const res = await acknowledgeCatererDietaryAlert(token);
    if (res.success) {
      toast.success("Alert acknowledged successfully.");
      // We might need to refresh local state or something.
    } else {
      toast.error("Failed to acknowledge alert.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !token) return;

    // Check for profanity
    const profanityResult = analyzeQaProfanity(messageInput.trim());
    if (profanityResult.isProfane) {
      toast.error("Message flagged for inappropriate content. Please rephrase.");
      return;
    }

    setSending(true);

    try {
      // If chat doesn't exist, we must create it via an edge function or RPC.
      // Wait, let's create a "create_caterer_chat" RPC or handle it inside "send_caterer_message".
      // Let's update send_caterer_message to auto-create the chat if it doesn't exist!
      const { error } = await supabase.rpc("send_caterer_message", {
        p_token: token,
        p_content: messageInput.trim(),
      });

      if (error) throw new Error(error.message);
      setMessageInput("");

      // If we didn't have chat object loaded, reload it.
      if (!chat) {
        await loadAlertAndChat();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to send message: " + err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center font-mono">Loading secure connection...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white dark:bg-zinc-900 border-2 border-black dark:border-cream rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] overflow-hidden flex flex-col h-[80vh]">
        {/* Header */}
        <div className="bg-yellow-400 p-6 border-b-2 border-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-black" />
              <h1 className="font-display font-black text-2xl uppercase tracking-wider text-black">
                Caterer Alert Portal
              </h1>
            </div>
            <button
              onClick={handleAcknowledge}
              className="px-4 py-2 bg-black text-white font-mono font-bold text-xs uppercase hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Acknowledge Alert
            </button>
          </div>
          {chat && (
            <p className="mt-4 font-mono text-sm text-black font-semibold">
              Dietary Restriction:{" "}
              <span className="underline decoration-2">{chat.dietary_tag}</span>
            </p>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-center font-mono text-xs text-slate-500 my-4">
            Secure, anonymized connection established with the attendee.
            <br />
            Their real name is hidden to protect their privacy.
          </div>

          {messages.map((msg) => {
            const isMe = msg.sender_type === "caterer";
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isMe ? "bg-indigo-100" : "bg-white"}`}
                >
                  <p className="text-xs font-bold font-mono mb-1 text-slate-500">
                    {isMe ? "You (Caterer)" : "Attendee"}
                  </p>
                  <p className="text-sm font-medium">{msg.content}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="p-4 border-t-2 border-black bg-slate-100 dark:bg-zinc-800">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Ask the attendee about their restriction..."
              className="flex-1 bg-white border-2 border-black p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={chat?.status === "archived"}
            />
            <button
              type="submit"
              disabled={sending || chat?.status === "archived"}
              className="bg-indigo-500 text-white border-2 border-black p-3 font-bold hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          {chat?.status === "archived" && (
            <p className="text-center text-xs text-red-500 font-mono font-bold mt-2">
              This chat has been archived because the event concluded.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
