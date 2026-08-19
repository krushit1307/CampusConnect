import React from 'react';
import { Bell, Calendar, GraduationCap, AtSign, Check, Circle } from 'lucide-react';
import { CampusNotificationItem } from '../../services/notificationFeedEngine';

interface NotificationCardProps {
    item: CampusNotificationItem;
    onMarkAsRead: (id: string) => void;
}

export const NotificationCardItem: React.FC<NotificationCardProps> = ({ item, onMarkAsRead }) => {
    const getCategoryIcon = () => {
        switch (item.category) {
            case 'event': return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
            case 'academic': return <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />;
            case 'mention': return <AtSign className="w-3.5 h-3.5 text-teal-400" />;
            default: return <Bell className="w-3.5 h-3.5 text-indigo-400" />;
        }
    };

    return (
        <div
            onClick={() => onMarkAsRead(item.id)}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                item.isRead
                    ? 'bg-slate-950/60 border-slate-800/60 text-slate-400'
                    : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-indigo-500/50'
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-slate-950 border border-slate-800">
                        {getCategoryIcon()}
                    </div>
                    <h5 className="text-xs font-bold text-slate-100 truncate">{item.title}</h5>
                </div>
                <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">{item.timestamp}</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
        </div>
    );
};
