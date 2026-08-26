import React, { useState } from "react";
import {
  MenuItem,
  InformalDiningMeetup,
  CampusMenuCrowdService,
} from "@/services/campusMenuCrowdService";
import { Users, Calendar, Clock, MapPin, X, Utensils } from "lucide-react";

interface CreateInformalMeetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
  diningHallId: string;
  currentUserId: string;
  currentUserName: string;
  onMeetupCreated: (meetup: InformalDiningMeetup) => void;
}

export const CreateInformalMeetupModal: React.FC<CreateInformalMeetupModalProps> = ({
  isOpen,
  onClose,
  menuItem,
  diningHallId,
  currentUserId,
  currentUserName,
  onMeetupCreated,
}) => {
  const [title, setTitle] = useState(
    menuItem ? `Meetup: ${menuItem.name} Squad` : "Informal Dining Meetup",
  );
  const [description, setDescription] = useState(
    menuItem
      ? `Hey everyone! Let's grab ${menuItem.name} together and chat about classes/projects.`
      : "Join us for lunch at the dining hall!",
  );
  const [tableLocation, setTableLocation] = useState("Booth near East Windows #3");
  const [meetupTime, setMeetupTime] = useState(
    new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  );
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !menuItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const meetup = await CampusMenuCrowdService.createInformalMeetup({
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
        diningHallId,
        hostUserId: currentUserId,
        hostName: currentUserName,
        title,
        description,
        meetupTime: new Date(meetupTime).toISOString(),
        maxParticipants,
        tableLocation,
      });

      onMeetupCreated(meetup);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create meetup");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Host Informal Meetup
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tied directly to:{" "}
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {menuItem.name}
              </span>
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Meetup Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder="e.g. Chicken Nugget Day Squad"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Description / Vibe
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder="What's the plan? Chat about CS exam, casual hangout, etc."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-500" /> Time
              </label>
              <input
                type="datetime-local"
                value={meetupTime}
                onChange={(e) => setMeetupTime(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-orange-500" /> Max Group Size
              </label>
              <input
                type="number"
                min="2"
                max="20"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-orange-500" /> Table / Spot Location
            </label>
            <input
              type="text"
              value={tableLocation}
              onChange={(e) => setTableLocation(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500"
              placeholder="e.g. Table 12 near salad bar, big round table"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-50"
            >
              {isSubmitting ? "Creating Meetup..." : "Publish Meetup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
