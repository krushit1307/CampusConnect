import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  generateSymmetricKey, 
  exportKey, 
  importKey, 
  encryptMessage, 
  decryptMessage 
} from '../../utils/crypto';

interface Message {
  id: string;
  senderId: string;
  ciphertext: string; // The backend only ever sends this
  iv: string;         // and this.
  createdAt: string;
}

interface DecryptedMessage extends Message {
  plainText: string;
}

export const SecureClubChat: React.FC<{ clubId: string; currentUserId: string }> = ({ clubId, currentUserId }) => {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isReady, setIsReady] = useState(false);

  // MOCK KEY EXCHANGE:
  // In a real E2EE system, keys are securely exchanged via public-key cryptography
  // or out-of-band methods (like QR code scanning). For this demonstration, we mock
  // a shared club key stored in sessionStorage so it doesn't leave the client.
  useEffect(() => {
    const initializeKeys = async () => {
      const storageKey = `e2ee_key_${clubId}`;
      let storedBase64Key = sessionStorage.getItem(storageKey);
      let activeKey: CryptoKey;

      if (!storedBase64Key) {
        activeKey = await generateSymmetricKey();
        storedBase64Key = await exportKey(activeKey);
        sessionStorage.setItem(storageKey, storedBase64Key);
      } else {
        activeKey = await importKey(storedBase64Key);
      }
      
      setKey(activeKey);
    };
    
    initializeKeys();
  }, [clubId]);

  // FETCH & DECRYPT HISTORY
  useEffect(() => {
    if (!key) return;

    const loadHistory = async () => {
      try {
        const response = await axios.get(`/api/messages/history/${clubId}`);
        const rawMessages: Message[] = response.data.messages;

        // Decrypt everything entirely on the client
        const decryptedHistory: DecryptedMessage[] = [];
        for (const msg of rawMessages) {
          try {
            const plainText = await decryptMessage(msg.ciphertext, msg.iv, key);
            decryptedHistory.push({ ...msg, plainText });
          } catch (err) {
            console.error("Failed to decrypt message ID", msg.id);
            decryptedHistory.push({ ...msg, plainText: '[ENCRYPTED - KEY MISMATCH]' });
          }
        }
        
        setMessages(decryptedHistory);
        setIsReady(true);
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    };

    loadHistory();
  }, [clubId, key]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !key) return;

    const textToSend = inputValue;
    setInputValue(''); // Optimistic UI clear

    try {
      // 1. Encrypt on the client
      const { ciphertext, iv } = await encryptMessage(textToSend, key);

      // 2. Send ONLY the unreadable ciphertext and IV to the backend
      const response = await axios.post('/api/messages/send', {
        clubId,
        senderId: currentUserId,
        ciphertext,
        iv
      });

      if (response.data.success) {
        // Optimistic UI update
        const newMsg: DecryptedMessage = {
          ...response.data.message,
          plainText: textToSend
        };
        setMessages(prev => [...prev, newMsg]);
      }
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  if (!isReady) return <div className="p-4">Establishing Secure Connection...</div>;

  return (
    <div className="flex flex-col h-[500px] border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-gray-800 text-white p-3 flex justify-between items-center shadow-md z-10">
        <h3 className="font-bold">Executive Board Chat</h3>
        <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full font-semibold">
          🔒 End-to-End Encrypted
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="text-xs text-gray-500 mb-1 px-1">
                {isMe ? 'You' : `User: ${msg.senderId}`}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
                isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
              }`}>
                {msg.plainText}
              </div>
              {/* Dev visualization to prove backend storage is secure */}
              <div className="text-[10px] text-gray-400 mt-1 max-w-[200px] truncate" title={msg.ciphertext}>
                Raw: {msg.ciphertext.substring(0, 15)}...
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="bg-white p-3 border-t border-gray-200">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Type a secure message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button 
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 font-medium transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
