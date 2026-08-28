import React, { useState, useContext } from 'react';
import { AssistantContext } from '../context/AssistantContext';

export default function ChatSessionSidebar() {
  const { 
    sessions, 
    activeSessionId, 
    switchSession, 
    renameSession, 
    deleteSession, 
    exportSession 
  } = useContext(AssistantContext);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.snippet && s.snippet.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleRenameSubmit = (id) => {
    if (editTitle.trim()) {
      renameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 text-white h-full flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h2 className="font-semibold text-lg mb-2">Chat Sessions</h2>
        <input 
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-800 text-sm p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.map(session => (
          <div 
            key={session.id}
            className={`group p-3 border-b border-slate-800/50 hover:bg-slate-800 cursor-pointer transition-colors ${activeSessionId === session.id ? 'bg-slate-800 border-l-2 border-blue-500' : ''}`}
          >
            {editingId === session.id ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-slate-700 text-xs p-1 rounded w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                  autoFocus
                  onBlur={() => handleRenameSubmit(session.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(session.id)}
                />
              </div>
            ) : (
              <div onClick={() => switchSession(session.id)}>
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-sm font-medium truncate pr-2">{session.title}</h3>
                  <div className="hidden group-hover:flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditTitle(session.title); setEditingId(session.id); }}
                      className="text-slate-400 hover:text-blue-400 text-xs"
                      aria-label="Rename Session"
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); exportSession(session.id); }}
                      className="text-slate-400 hover:text-emerald-400 text-xs"
                      aria-label="Export Session"
                      title="Export Transcript"
                    >
                      ⤓
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(session.id); }}
                      className="text-slate-400 hover:text-red-400 text-xs"
                      aria-label="Delete Session"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                </div>
                {session.snippet && (
                  <p className="text-xs text-slate-500 truncate">{session.snippet}</p>
                )}
              </div>
            )}
            
            {confirmDeleteId === session.id && (
              <div className="mt-2 p-2 bg-red-900/20 border border-red-800/50 rounded text-xs" onClick={(e) => e.stopPropagation()}>
                <p className="mb-2 text-red-300">Delete this session forever?</p>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                    className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors"
                  >
                    Delete
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
