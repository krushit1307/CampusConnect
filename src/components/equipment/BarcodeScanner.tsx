// src/components/equipment/BarcodeScanner.tsx
//
// Admin barcode scanner for checking equipment in and out.
// Uses the device camera via the browser's BarcodeDetector API.

import { useState } from "react";
import { ScanLine, CheckCircle2, XCircle, AlertTriangle, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    checkOutEquipment,
    checkInEquipment,
} from "@/lib/equipment";

interface BarcodeScannerProps {
    onScanComplete?: () => void;
}

export function BarcodeScanner({ onScanComplete }: BarcodeScannerProps) {
    const [barcode, setBarcode] = useState("");
    const [mode, setMode] = useState<"check_in" | "check_out">("check_out");
    const [reservationId, setReservationId] = useState("");
    const [condition, setCondition] = useState<"good" | "damaged">("good");
    const [damageNotes, setDamageNotes] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleSubmit = async () => {
        if (!barcode) return;
        setIsLoading(true);
        setResult(null);

        if (mode === "check_out") {
            if (!reservationId) {
                setResult({ success: false, message: "Reservation ID is required for checkout." });
                setIsLoading(false);
                return;
            }
            const res = await checkOutEquipment(barcode, reservationId);
            setResult(res);
        } else {
            const res = await checkInEquipment(barcode, condition, damageNotes || undefined);
            setResult(res);
        }

        setIsLoading(false);
        if (result?.success) {
            setBarcode("");
            setReservationId("");
            setDamageNotes("");
            onScanComplete?.();
        }
    };

    return (
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900">
                    <ScanLine className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-lg font-bold">Equipment Scanner</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Scan or enter a barcode to check equipment in or out.
                    </p>
                </div>
            </div>

            {/* Mode toggle */}
            <div className="mb-4 flex gap-2">
                <Button
                    variant={mode === "check_out" ? "default" : "outline"}
                    onClick={() => setMode("check_out")}
                    className="flex-1"
                >
                    Check Out
                </Button>
                <Button
                    variant={mode === "check_in" ? "default" : "outline"}
                    onClick={() => setMode("check_in")}
                    className="flex-1"
                >
                    Check In
                </Button>
            </div>

            {/* Barcode input */}
            <div className="mb-4">
                <Label htmlFor="barcode">Barcode</Label>
                <div className="flex gap-2">
                    <Input
                        id="barcode"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder="Scan or type barcode..."
                        className="font-mono"
                    />
                    <Button variant="outline" onClick={() => setBarcode("DEMO-001")}>
                        <Camera className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Conditional fields */}
            {mode === "check_out" && (
                <div className="mb-4">
                    <Label htmlFor="reservation-id">Reservation ID</Label>
                    <Input
                        id="reservation-id"
                        value={reservationId}
                        onChange={(e) => setReservationId(e.target.value)}
                        placeholder="UUID of the approved reservation"
                        className="font-mono"
                    />
                </div>
            )}

            {mode === "check_in" && (
                <div className="mb-4 space-y-3">
                    <div>
                        <Label htmlFor="condition">Condition</Label>
                        <select
                            id="condition"
                            value={condition}
                            onChange={(e) => setCondition(e.target.value as "good" | "damaged")}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                        >
                            <option value="good">Good</option>
                            <option value="damaged">Damaged</option>
                        </select>
                    </div>
                    {condition === "damaged" && (
                        <div>
                            <Label htmlFor="damage-notes">Damage Notes</Label>
                            <textarea
                                id="damage-notes"
                                value={damageNotes}
                                onChange={(e) => setDamageNotes(e.target.value)}
                                placeholder="Describe the damage..."
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                                rows={3}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Submit */}
            <Button onClick={handleSubmit} disabled={!barcode || isLoading} className="w-full">
                {isLoading ? "Processing…" : `Confirm ${mode === "check_out" ? "Check Out" : "Check In"}`}
            </Button>

            {/* Result */}
            {result && (
                <div
                    className={`mt-4 flex items-start gap-2 rounded-md p-3 text-sm ${
                        result.success
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                    }`}
                >
                    {result.success ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : (
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    )}
                    <div>
                        <p className="font-medium">
                            {result.success ? "Success" : "Error"}
                        </p>
                        <p>{result.message}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
