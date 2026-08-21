import React from 'react';
import { EventChatMessage } from '../../services/eventCollaborationEngine';

interface ChatBubbleProps {
    message: EventChatMessage;
}

export const EventChatMessageBubble: React.FC<ChatBubbleProps> = ({ message }) => {
    return (
        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1 text-xs">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-100">{message.senderName}</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[9px] font-mono font-bold">
                        {message.senderRole}
                    </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">{message.timestamp}</span>
            </div>
            <p className="text-slate-300 leading-relaxed">{message.messageText}</p>
        </div>
    );
};
