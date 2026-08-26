import React, { useState } from 'react';
import { Users, MessageSquare, CheckSquare, Send, Video } from 'lucide-react';
import { MOCK_ROOM_CHAT_MESSAGES, MOCK_COLLAB_TASKS, EventChatMessage, EventTaskItem } from '../../services/eventCollaborationEngine';
import { EventChatMessageBubble } from './EventChatMessageBubble';

export const EventCollaborationWorkspace: React.FC = () => {
    const [messages, setMessages] = useState<EventChatMessage[]>(MOCK_ROOM_CHAT_MESSAGES);
    const [tasks, setTasks] = useState<EventTaskItem[]>(MOCK_COLLAB_TASKS);
    const [newMessage, setNewMessage] = useState<string>('');

    const handleSendMessage = () => {
        if (!newMessage.trim()) return;
        const msg: EventChatMessage = {
            id: `msg_${Date.now()}`,
            senderName: "Dipanshu Batra",
            senderRole: "Lead Organizer",
            messageText: newMessage,
            timestamp: "Just Now"
        };
        setMessages(prev => [...prev, msg]);
        setNewMessage('');
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6 text-slate-100 font-sans p-4">
            {/* Header Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                        <Users className="w-4 h-4" /> Live Team Collaboration Hub
                    </div>
                    <button
                        type="button"
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
                    >
                        <Video className="w-3.5 h-3.5" /> Join Huddle Video
                    </button>
                </div>
                <h1 className="text-2xl font-black text-slate-100">Annual Tech Hackathon 2026 Organizing Workspace</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Team Room Chat Column */}
                <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                            <MessageSquare className="w-4 h-4 text-indigo-400" />
                            <h3 className="text-sm font-bold text-slate-100">Organizer Room Chat</h3>
                        </div>

                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {messages.map(msg => (
                                <EventChatMessageBubble key={msg.id} message={msg} />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-800">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Send message to event team..."
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                            type="button"
                            onClick={handleSendMessage}
                            className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Event Task Assignments Board Column */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-bold text-slate-100">Task Checklist</h3>
                    </div>

                    <div className="space-y-2 text-xs">
                        {tasks.map(task => (
                            <div key={task.id} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                                <h5 className="font-bold text-slate-200">{task.taskTitle}</h5>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                    <span>Assigned: {task.assigneeName}</span>
                                    <span className={`font-bold ${task.status === 'Done' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {task.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventCollaborationWorkspace;
