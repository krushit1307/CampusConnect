import React, { createContext, useState, useEffect } from 'react';

export const AssistantContext = createContext();

export function AssistantProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState({});

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      // Mocking /api/assistant/sessions retrieval logic
      const mockSessions = [
        { id: 'session-1', title: 'Data Pipeline Help', snippet: 'How does the cron job execute?' },
        { id: 'session-2', title: 'RAG Architecture', snippet: 'Explain vector embeddings in PostgreSQL.' }
      ];
      setSessions(mockSessions);
      if (mockSessions.length > 0) setActiveSessionId(mockSessions[0].id);
      
      setMessages({
        'session-1': [{ role: 'user', content: 'How does the cron job execute?' }],
        'session-2': [{ role: 'user', content: 'Explain vector embeddings in PostgreSQL.' }]
      });
    } catch (err) {
      console.error('Failed fetching assistant sessions state:', err);
    }
  };

  const switchSession = (id) => {
    setActiveSessionId(id);
    // Synced FloatingAssistant update logic handles global state routing here
  };

  const renameSession = async (id, newTitle) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    // Implementation placeholder for PATCH /api/assistant/sessions/:id
  };

  const deleteSession = async (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(sessions.find(s => s.id !== id)?.id || null);
    }
    // Implementation placeholder for DELETE /api/assistant/sessions/:id
  };

  const exportSession = async (id) => {
    const sessionToExport = sessions.find(s => s.id === id);
    const sessionMessages = messages[id] || [];
    
    // Construct automated markdown transcript blob
    let transcript = `# Chat Transcript: ${sessionToExport.title}\n\n`;
    sessionMessages.forEach(msg => {
      transcript += `**${msg.role === 'user' ? 'User' : 'Assistant'}**: ${msg.content}\n\n`;
    });
    
    if (sessionMessages.length === 0) {
      transcript += "_No messages recorded in this session._\n";
    }

    // Trigger local filesystem blob download using dynamic object URLs
    const blob = new Blob([transcript], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assistant_transcript_${id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AssistantContext.Provider 
      value={{ 
        sessions, 
        activeSessionId, 
        messages, 
        switchSession, 
        renameSession, 
        deleteSession, 
        exportSession 
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}
