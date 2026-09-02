import React, { useState } from "react";
import {
  Lock,
  Unlock,
  QrCode,
  Bluetooth,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Key,
  Refrigerator,
  Sparkles,
  Zap,
  Clock,
} from "lucide-react";
import {
  SmartFridgeState,
  SmartFridgeUnlockResult,
  generateOneTimeUnlockHash,
  executeCatererQrDeposit,
  executeOrganizerBleUnlock,
} from "@/lib/smartRefrigeratorLock";
import { cn } from "@/lib/utils";

export interface SmartRefrigeratorLockWidgetProps {
  fridgeId?: string;
  fridgeLocation?: string;
  esp32DeviceId?: string;
  dietaryType?: string;
  eventTitle?: string;
  initialState?: SmartFridgeState;
  onFridgeUnlocked?: (result: SmartFridgeUnlockResult) => void;
  className?: string;
}

export const SmartRefrigeratorLockWidget: React.FC<SmartRefrigeratorLockWidgetProps> = ({
  fridgeId = "fridge-union-101",
  fridgeLocation = "Student Union Staging Rm 102",
  esp32DeviceId = "ESP32_FRIDGE_STAGING_01",
  dietaryType = "Halal / Kosher / Vegan Special Staging ($500 Value)",
  eventTitle = "Annual Multicultural Diversity Gala",
  initialState,
  onFridgeUnlocked,
  className,
}) => {
  const [fridgeState, setFridgeState] = useState<SmartFridgeState>(() => {
    if (initialState) return initialState;
    const { hash, expiresAt } = generateOneTimeUnlockHash("evt-gala-101", fridgeId);
    return {
      fridgeId,
      fridgeLocation,
      esp32DeviceId,
      dietaryType,
      eventId: "evt-gala-101",
      eventTitle,
      lockState: "locked",
      oneTimeUnlockHash: hash,
      unlockExpiresAt: expiresAt,
    };
  });

  const [recentResult, setRecentResult] = useState<SmartFridgeUnlockResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleCatererQrScan = () => {
    const result = executeCatererQrDeposit(fridgeId, "u-caterer-101");
    setRecentResult(result);
    setFridgeState((prev) => ({ ...prev, lockState: "caterer_unlocked" }));

    if (onFridgeUnlocked) onFridgeUnlocked(result);

    setNotice("Caterer QR Scan Verified! Lock dropped for food deposit. Auto-locking in 60s.");
    setTimeout(() => setNotice(null), 6000);
  };

  const handleOrganizerBleUnlock = () => {
    const result = executeOrganizerBleUnlock(fridgeId, fridgeState.oneTimeUnlockHash);
    setRecentResult(result);
    setFridgeState((prev) => ({ ...prev, lockState: "organizer_unlocked" }));

    if (onFridgeUnlocked) onFridgeUnlocked(result);

    setNotice("Organizer Bluetooth BLE Unlock Verified! ESP32 relay unlatched for event distribution.");
    setTimeout(() => setNotice(null), 6000);
  };

  const isLocked = fridgeState.lockState === "locked";

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-teal-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-teal-950">
            <Refrigerator className="w-5 h-5 text-teal-700 animate-bounce" />
            <span>"Dietary Restriction" Smart Refrigerator Lock — {fridgeLocation}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            IoT ESP32 Smart Lock protection for high-value food staging. Prevents unauthorized snacking until the event organizer arrives.
          </p>
        </div>

        <span
          className={cn(
            "px-3 py-1 font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
            isLocked ? "bg-rose-600 text-white" : "bg-emerald-600 text-white animate-pulse"
          )}
        >
          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <span>{isLocked ? "🔒 STAGING FRIDGE LOCKED" : "🔓 FRIDGE UNLOCKED"}</span>
        </span>
      </div>

      {/* Confirmation Notification Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Caterer QR Deposit & Organizer BLE Unlock Portals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left Column: Caterer Deposit QR Scanner */}
        <div className="p-5 border-b-2 md:border-b-0 md:border-r-2 border-black space-y-4 bg-white">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <QrCode className="w-4 h-4 text-teal-600" />
            Caterer Food Deposit QR Portal
          </h4>

          <div className="p-3.5 border-2 border-black rounded-lg bg-teal-50 space-y-2 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Protected Staging Contents:</span>
            <span className="font-bold text-teal-950 block">{dietaryType}</span>
            <p className="text-[11px] font-sans text-gray-600">
              Assigned Event: <span className="font-bold text-black">{eventTitle}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleCatererQrScan}
            className="w-full py-3 px-4 border-2 border-black bg-teal-600 text-white font-bold text-xs uppercase rounded-md hover:bg-teal-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4 text-amber-300" />
            <span>Scan Fridge QR Code to Deposit Food</span>
          </button>
        </div>

        {/* Right Column: Organizer Bluetooth BLE One-Time Unlock Portal */}
        <div className="p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Bluetooth className="w-4 h-4 text-teal-600" />
            Organizer Cryptographic BLE Unlock
          </h4>

          {/* Unlock Hash Card */}
          <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-2 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center text-[10px] text-gray-500 border-b border-gray-200 pb-1">
              <span className="flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-teal-600" /> ONE-TIME UNLOCK HASH
              </span>
              <span className="text-emerald-600 font-bold">VALID (4H)</span>
            </div>
            <p className="text-[10px] text-teal-900 font-mono break-all bg-slate-100 p-2 rounded border border-gray-300 font-bold">
              {fridgeState.oneTimeUnlockHash}
            </p>
          </div>

          <button
            type="button"
            onClick={handleOrganizerBleUnlock}
            className="w-full py-3 px-4 border-2 border-black bg-emerald-500 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
          >
            <Bluetooth className="w-4 h-4 text-amber-300" />
            <span>Bluetooth BLE Unlock Staging Fridge</span>
          </button>

          {/* Audit Log Banner */}
          {recentResult && (
            <div className="p-3.5 border-2 border-black rounded-lg bg-slate-900 text-white space-y-1.5 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center text-[10px] text-teal-400 font-bold border-b border-slate-700 pb-1">
                <span>ESP32 RELAY AUDIT LOG</span>
                <span className="uppercase text-emerald-400 font-bold">{recentResult.newLockState}</span>
              </div>
              <p className="text-[10px] text-gray-300 font-mono break-all">
                Payload: <span className="text-teal-300 font-bold">{recentResult.blePayload}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
