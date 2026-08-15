// src/components/events/UmbrellaLandingPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, Users, Ticket, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    fetchUmbrellaSchedule,
    purchaseGlobalPass,
    type UmbrellaSchedule,
    type ChildEvent,
} from "@/lib/umbrellaEvents";

interface UmbrellaLandingPageProps {
    umbrellaId: string;
    userId: string | undefined;
}

/**
 * The Umbrella Landing Page component (Issue #2909).
 *
 * Renders a beautiful timeline/schedule view for a parent umbrella
 * event (e.g., "Orientation Week", "Homecoming"), aggregating all
 * child events into a cohesive schedule. Provides a "Buy Global Pass"
 * button that auto-RSVPs the user to all ungated child events and
 * claims seats at gated events.
 */
export function UmbrellaLandingPage({ umbrellaId, userId }: UmbrellaLandingPageProps) {
    const [schedule, setSchedule] = useState<UmbrellaSchedule | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [passResult, setPassResult] = useState<{
        autoRsvped: number;
        waitlisted: number;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const data = await fetchUmbrellaSchedule(umbrellaId);
            if (!cancelled) {
                setSchedule(data);
                setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [umbrellaId]);

    const handleBuyPass = async () => {
        if (!userId) {
            setError("Please log in to purchase a pass.");
            return;
        }
        setIsPurchasing(true);
        setError(null);
        const result = await purchaseGlobalPass(umbrellaId, userId);
        setIsPurchasing(false);
        if (result.success) {
            setPassResult({
                autoRsvped: result.autoRsvpedCount,
                waitlisted: result.waitlistedCount,
            });
            // Refresh the schedule to show updated counts.
            const fresh = await fetchUmbrellaSchedule(umbrellaId);
            setSchedule(fresh);
        } else {
            setError(result.message);
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" aria-hidden="true" />
            </div>
        );
    }

    if (!schedule || !schedule.umbrella) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center">
                <AlertTriangle className="mb-2 h-8 w-8 text-amber-500" aria-hidden="true" />
                <p className="text-slate-600 dark:text-slate-400">Umbrella event not found.</p>
            </div>
        );
    }

    const { umbrella, children } = schedule;

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            {/* ── Hero / Banner ────────────────────────────────── */}
            {umbrella.banner_url && (
                <div className="mb-6 overflow-hidden rounded-xl">
                    <img
                        src={umbrella.banner_url}
                        alt={umbrella.title}
                        className="h-48 w-full object-cover sm:h-64"
                    />
                </div>
            )}

            <header className="mb-8">
                <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                    Umbrella Event
                </span>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                    {umbrella.title}
                </h1>
                {umbrella.description && (
                    <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
                        {umbrella.description}
                    </p>
                )}

                {/* Meta row */}
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                    {umbrella.event_date && (
                        <span className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" aria-hidden="true" />
                            {new Date(umbrella.event_date).toLocaleDateString(undefined, {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </span>
                    )}
                    {umbrella.location && (
                        <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" aria-hidden="true" />
                            {umbrella.location}
                        </span>
                    )}
                    {children.length > 0 && (
                        <span className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" aria-hidden="true" />
                            {children.length} sub-events
                        </span>
                    )}
                </div>
            </header>

            {/* ── Global Pass CTA ────────────────────────────────── */}
            <div className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-800 dark:bg-indigo-950/40">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Ticket className="h-8 w-8 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                        <div>
                            <h2 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                                Global Pass
                            </h2>
                            <p className="text-sm text-indigo-700 dark:text-indigo-300">
                                Get access to all{" "}
                                <strong>{children.length}</strong> sub-events with a single pass.
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleBuyPass}
                        disabled={isPurchasing || !userId || !!passResult}
                        className="gap-2"
                        size="lg"
                    >
                        {isPurchasing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Processing…
                            </>
                        ) : passResult ? (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                Pass Activated
                            </>
                        ) : (
                            <>
                                <Ticket className="h-4 w-4" />
                                Buy Global Pass
                            </>
                        )}
                    </Button>
                </div>

                {/* Pass result feedback */}
                {passResult && (
                    <div className="mt-4 rounded-lg bg-white/70 p-3 text-sm dark:bg-slate-900/50">
                        <p className="font-medium text-emerald-700 dark:text-emerald-400">
                            ✓ Pass activated! You're automatically RSVPed to{" "}
                            {passResult.autoRsvped} sub-event(s).
                        </p>
                        {passResult.waitlisted > 0 && (
                            <p className="mt-1 text-amber-700 dark:text-amber-400">
                                ⚠ {passResult.waitlisted} sub-event(s) are at capacity. You've been
                                waitlisted — claim your seat from the schedule below if a spot opens up.
                            </p>
                        )}
                    </div>
                )}

                {error && (
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                        {error}
                    </p>
                )}
            </div>

            {/* ── Schedule / Timeline ─────────────────────────── */}
            <section>
                <h2 className="mb-4 text-xl font-bold">Schedule</h2>
                {children.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700">
                        No sub-events have been added to this umbrella yet.
                    </p>
                ) : (
                    <ol className="space-y-4">
                        {children.map((child, index) => (
                            <ChildEventCard key={child.id} child={child} index={index} />
                        ))}
                    </ol>
                )}
            </section>
        </div>
    );
}

/**
 * A single child event card in the umbrella schedule.
 */
function ChildEventCard({ child, index }: { child: ChildEvent; index: number }) {
    const isFull =
        child.max_attendees !== null &&
        child.max_attendees > 0 &&
        child.attending_count >= child.max_attendees;

    const startDate = child.start_date || child.event_date;

    return (
        <li className="flex gap-4">
            {/* Timeline dot + line */}
            <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {index + 1}
                </span>
                <span className="mt-1 w-0.5 flex-1 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
            </div>

            {/* Card body */}
            <Link
                to={`/events/${child.id}`}
                className="mb-4 flex-1 rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            {child.title}
                        </h3>
                        {child.club_name && (
                            <p className="text-xs text-indigo-600 dark:text-indigo-400">
                                by {child.club_name}
                            </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                            {startDate && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(startDate).toLocaleString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>
                            )}
                            {child.location && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {child.location}
                                </span>
                            )}
                            {child.max_attendees !== null && (
                                <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {child.attending_count} / {child.max_attendees}
                                    {isFull && (
                                        <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900 dark:text-red-300">
                                            FULL
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </Link>
        </li>
    );
}
