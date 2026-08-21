// src/components/equipment/EquipmentRentalCalendar.tsx
//
// Calendar UI for clubs to view equipment availability and reserve items.

import { useEffect, useState } from "react";
import { Calendar, Plus, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    fetchInventory,
    fetchReservations,
    checkAvailability,
    createReservation,
    type InventoryItem,
    type EquipmentReservation,
} from "@/lib/equipment";

interface EquipmentRentalCalendarProps {
    clubId: string;
    userId: string;
}

export function EquipmentRentalCalendar({ clubId, userId }: EquipmentRentalCalendarProps) {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [reservations, setReservations] = useState<EquipmentReservation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isChecking, setIsChecking] = useState(false);
    const [isReserving, setIsReserving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        (async () => {
            const data = await fetchInventory();
            setItems(data);
            setIsLoading(false);
        })();
    }, []);

    useEffect(() => {
        if (!selectedItem) return;
        (async () => {
            const res = await fetchReservations(selectedItem.id);
            setReservations(res);
        })();
    }, [selectedItem]);

    const handleCheckAvailability = async () => {
        if (!selectedItem || !startDate || !endDate) return;
        setIsChecking(true);
        setMessage(null);
        const available = await checkAvailability(selectedItem.id, startDate, endDate);
        setMessage(
            available
                ? { type: "success", text: "✓ Item is available for these dates." }
                : { type: "error", text: "✗ Item is already reserved for part of this range." }
        );
        setIsChecking(false);
    };

    const handleReserve = async () => {
        if (!selectedItem || !startDate || !endDate) return;
        setIsReserving(true);
        setMessage(null);

        // Double-check availability before reserving.
        const available = await checkAvailability(selectedItem.id, startDate, endDate);
        if (!available) {
            setMessage({ type: "error", text: "Item is no longer available." });
            setIsReserving(false);
            return;
        }

        const result = await createReservation(
            selectedItem.id, clubId, userId, startDate, endDate
        );
        if (result.success) {
            setMessage({ type: "success", text: "Reservation request submitted!" });
            // Refresh reservations.
            const res = await fetchReservations(selectedItem.id);
            setReservations(res);
        } else {
            setMessage({ type: "error", text: result.error ?? "Failed to reserve." });
        }
        setIsReserving(false);
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            <header className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Equipment Rental</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Browse available equipment and reserve it for your event dates.
                </p>
            </header>

            {/* Item selector */}
            <div className="mb-6">
                <Label htmlFor="item-select">Select Equipment</Label>
                <select
                    id="item-select"
                    value={selectedItem?.id ?? ""}
                    onChange={(e) => {
                        const item = items.find((i) => i.id === e.target.value);
                        setSelectedItem(item ?? null);
                        setMessage(null);
                    }}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                    <option value="">Choose an item…</option>
                    {items.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name} ({item.category}) — {item.condition}
                        </option>
                    ))}
                </select>
            </div>

            {/* Existing reservations */}
            {selectedItem && (
                <div className="mb-6 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Upcoming Reservations
                    </h2>
                    {reservations.filter((r) => r.status !== "cancelled" && r.status !== "returned").length === 0 ? (
                        <p className="text-sm text-slate-400">No upcoming reservations.</p>
                    ) : (
                        <ul className="space-y-2">
                            {reservations
                                .filter((r) => r.status !== "cancelled" && r.status !== "returned")
                                .map((res) => (
                                    <li key={res.id} className="flex items-center gap-2 text-sm">
                                        <Calendar className="h-4 w-4 text-indigo-500" />
                                        <span>
                                            {new Date(res.start_date).toLocaleString()} →{" "}
                                            {new Date(res.end_date).toLocaleString()}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                            {res.status}
                                        </span>
                                    </li>
                                ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Reservation form */}
            {selectedItem && (
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Reserve This Item
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="start-date">Pick Up</Label>
                            <Input
                                id="start-date"
                                type="datetime-local"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="end-date">Return</Label>
                            <Input
                                id="end-date"
                                type="datetime-local"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleCheckAvailability}
                            disabled={!startDate || !endDate || isChecking}
                        >
                            {isChecking ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Calendar className="mr-2 h-4 w-4" />
                            )}
                            Check Availability
                        </Button>
                        <Button
                            onClick={handleReserve}
                            disabled={!startDate || !endDate || isReserving}
                        >
                            {isReserving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="mr-2 h-4 w-4" />
                            )}
                            Reserve
                        </Button>
                    </div>

                    {message && (
                        <div
                            className={`mt-4 flex items-center gap-2 rounded-md p-3 text-sm ${
                                message.type === "success"
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                            }`}
                        >
                            {message.type === "error" && <AlertCircle className="h-4 w-4" />}
                            {message.text}
                        </div>
                    )}
                    <p className="mt-2 text-xs text-slate-400">
                        Note: A 2-hour buffer is automatically added to all reservations to allow for logistics.
                    </p>
                </div>
            )}
        </div>
    );
}
