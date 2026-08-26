// src/components/speakers/SpeakerDirectory.tsx
//
// UI for searching and viewing the centralized speaker directory.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, User, Building2, Loader2, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    searchSpeakers,
    fetchSpeakerHistory,
    type GuestSpeaker,
    type SpeakerHistory,
} from "@/lib/speakerDirectory";

export function SpeakerDirectory() {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<GuestSpeaker[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedSpeaker, setSelectedSpeaker] = useState<SpeakerHistory | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.trim().length < 2) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            const results = await searchSpeakers(searchQuery);
            setSearchResults(results);
            setIsSearching(false);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSelectSpeaker = async (speakerId: string) => {
        setIsLoadingHistory(true);
        setSelectedSpeaker(null);
        const history = await fetchSpeakerHistory(speakerId);
        setSelectedSpeaker(history);
        setIsLoadingHistory(false);
    };

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <header className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Speaker Directory</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Search for past guest speakers across all campus clubs.
                </p>
            </header>

            <div className="mb-8">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Search by name or organization (e.g., Microsoft)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-500" />
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Search Results Column */}
                <div className="space-y-3">
                    {searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
                        <p className="text-sm text-slate-400">No speakers found.</p>
                    )}
                    {searchResults.map((speaker) => (
                        <div
                            key={speaker.id}
                            className="cursor-pointer rounded-lg border border-slate-200 p-4 transition-colors hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-slate-700 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/30"
                            onClick={() => handleSelectSpeaker(speaker.id)}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                        {speaker.name}
                                    </h3>
                                    {speaker.title && speaker.organization && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {speaker.title} at {speaker.organization}
                                        </p>
                                    )}
                                </div>
                                {speaker.rating && (
                                    <div className="flex items-center gap-1 text-xs text-amber-500">
                                        <Star className="h-3 w-3 fill-amber-500" />
                                        {speaker.rating}/5
                                    </div>
                                )}
                            </div>
                            {speaker.bio && (
                                <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                                    {speaker.bio}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Speaker Profile / History Column */}
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    {isLoadingHistory && (
                        <div className="flex h-48 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        </div>
                    )}
                    {!isLoadingHistory && !selectedSpeaker && (
                        <div className="flex h-48 flex-col items-center justify-center text-center">
                            <User className="mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
                            <p className="text-sm text-slate-400">
                                Select a speaker to view their history and profile.
                            </p>
                        </div>
                    )}
                    {selectedSpeaker && (
                        <div className="space-y-4">
                            {/* Profile Header */}
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {selectedSpeaker.speaker.name}
                                </h2>
                                {selectedSpeaker.speaker.organization && (
                                    <p className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                                        <Building2 className="h-3 w-3" />
                                        {selectedSpeaker.speaker.organization}
                                    </p>
                                )}
                                {selectedSpeaker.speaker.bio && (
                                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                                        {selectedSpeaker.speaker.bio}
                                    </p>
                                )}
                                {selectedSpeaker.speaker.contact_email && (
                                    <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                        ✉️ {selectedSpeaker.speaker.contact_email} (Visible to admins only)
                                    </p>
                                )}
                            </div>

                            {/* Event History */}
                            <div>
                                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Event History
                                </h3>
                                {selectedSpeaker.events.length === 0 ? (
                                    <p className="text-xs text-slate-400">No past events.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {selectedSpeaker.events.map((event) => (
                                            <li key={event.event_id} className="text-xs">
                                                <Link
                                                    to={`/events/${event.event_id}`}
                                                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                                >
                                                    {event.event_title}
                                                </Link>
                                                <p className="text-slate-500 dark:text-slate-400">
                                                    {new Date(event.event_date).toLocaleDateString()} • {event.club_name}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Private Notes */}
                            <div>
                                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Internal Notes
                                </h3>
                                {selectedSpeaker.notes.length === 0 ? (
                                    <p className="text-xs text-slate-400">No notes.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {selectedSpeaker.notes.map((note) => (
                                            <li key={note.note_id} className="rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-800">
                                                <p className="italic text-slate-600 dark:text-slate-300">
                                                    "{note.note_text}"
                                                </p>
                                                <p className="mt-1 text-slate-400">
                                                    — {note.author_name} ({note.club_name})
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
