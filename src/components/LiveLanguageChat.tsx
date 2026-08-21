import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface MessagePayload {
  id: string;
  sender_name: string;
  original_text: string;
  detected_source_lang: string;
  translated_text_en: string;
}

interface LiveLanguageChatProps {
  currentUserId: string;
  userLanguagePref: string;
  currentUserName: string;
}

export default function LiveLanguageChat({ currentUserId, userLanguagePref, currentUserName }: LiveLanguageChatProps) {
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Seed recent workspace entries on mount
    const fetchChatHistory = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) setMessages(data);
    };
    fetchChatHistory();

    // 2. Open up real-time WebSocket channel streams
    const chatChannel = supabase
      .channel('live-webinar-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages((prev) => [...prev, payload.new as MessagePayload]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || sending) return;

    setSending(true);
    try {
      // Direct message routing to Edge interception loops via Supabase native invoke
      const { error } = await supabase.functions.invoke('chat-translator', {
        body: {
          message: textInput,
          senderId: currentUserId,
          senderName: currentUserName,
        }
      });

      if (error) throw error;
      
      setTextInput('');
    } catch (err) {
      console.error('Error firing chat transaction:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] w-full max-w-md border border-gray-200 rounded-2xl shadow-xl bg-white overflow-hidden">
      <div className="bg-gray-900 px-6 py-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wide">Live Orientation Chat</h3>
        <span className="text-[10px] bg-indigo-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
          Feed: {userLanguagePref}
        </span>
      </div>

      {/* Messages Canvas Frame */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50">
        {messages.map((msg) => {
          // Rule evaluation: If user preference matches the source language, show the original. Otherwise, default to English translation.
          // Advanced localizations can be implemented here by calling device APIs or mapping target localized columns,
          // but MVP utilizes the English translation base.
          const renderOriginal = userLanguagePref === msg.detected_source_lang;
          const displayOutput = renderOriginal ? msg.original_text : msg.translated_text_en;
          const showBadge = !renderOriginal && msg.detected_source_lang !== 'en';

          return (
            <div key={msg.id} className="flex flex-col items-start bg-white p-3 rounded-xl shadow-sm border border-gray-100 max-w-[85%]">
              <span className="text-xs font-bold text-gray-500 mb-0.5">{msg.sender_name}</span>
              <p className="text-sm text-gray-800 leading-relaxed break-words">{displayOutput}</p>
              {showBadge && (
                <span className="text-[9px] text-indigo-500 font-semibold mt-1 inline-flex items-center gap-0.5 bg-indigo-50 px-1.5 py-0.2 rounded">
                  ✨ Translated by AI
                </span>
              )}
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input Action Panel */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 flex gap-2 bg-white">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type your question here..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-4 py-2 rounded-xl text-sm transition disabled:opacity-40"
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
