import React, { useState } from 'react';
import { Bell, CheckCheck, Filter, X } from 'lucide-react';
import { MOCK_CAMPUS_NOTIFICATIONS, CampusNotificationItem } from '../../services/notificationFeedEngine';
import { NotificationCardItem } from './NotificationCardItem';

export const NotificationBellPopoverWidget: React.FC = () => {
    const [notifications, setNotifications] = useState<CampusNotificationItem[]>(MOCK_CAMPUS_NOTIFICATIONS);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [filterCategory, setFilterCategory] = useState<string>('all');

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleMarkAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    };

    const handleMarkAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    };

    const filtered = notifications.filter(n => {
        if (filterCategory === 'all') return true;
        return n.category === filterCategory;
    });

    return (
        <div className="relative inline-block text-left font-sans">
            {/* Bell Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all shadow-lg"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-slate-950">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Popover Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl z-50 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-indigo-400" />
                            <h4 className="text-sm font-bold text-slate-100">Campus Notifications</h4>
                        </div>

                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAllAsRead}
                                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                        {['all', 'event', 'academic', 'mention'].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setFilterCategory(cat)}
                                className={`px-2.5 py-1 rounded-xl font-bold uppercase text-[10px] transition-all whitespace-nowrap ${
                                    filterCategory === cat
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Notifications Scroll List */}
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {filtered.map(item => (
                            <NotificationCardItem
                                key={item.id}
                                item={item}
                                onMarkAsRead={handleMarkAsRead}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBellPopoverWidget;
