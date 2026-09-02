/**
 * Interactive Smart Vending Machine Blockchain Recall Alert Component
 * Issue #5357: Automated FDA Recall Ingestion, Polygon Supply Chain Ledger, & MQTT Hardware Lockout
 *
 * Features:
 * - 4x4 Grid of Vending Coils (A1 - D4) with item names, lot numbers, dietary tags, and live state
 * - Live Simulation of incoming FDA Recalls via MQTT / WebSocket
 * - Dynamic UI State change upon recall:
 *   * Target coils physically display "LOCKED - RECALLED"
 *   * Glass display overlay turns RED with prominent warning banner:
 *     "⚠️ FDA SAFETY RECALL: E. COLI CONTAMINATION DETECTED - LOT #LOT-2026-TURKEY-99 HARDWARE LOCKED"
 *   * Prevents any selection or payment interaction for locked coils
 * - Tactile Keypad POS Dispense Simulator
 * - Dietary Restriction cross-referencing filter (Halal, Kosher, Vegan, Gluten-Free, Nut-Free)
 * - Live MQTT Telemetry packet inspector and Polygon Ledger Blockchain Audit Card
 */

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";

export interface VendingCoilItem {
  coil: string;
  name: string;
  category: "sandwich" | "salad" | "snack" | "beverage" | "sweet";
  lotNumber: string;
  upcCode: string;
  price: number;
  dietaryTags: Array<"Halal" | "Kosher" | "Vegan" | "Vegetarian" | "Gluten-Free" | "Nut-Free">;
  stock: number;
  icon: string;
  calories: number;
}

export interface MqttLockoutPayload {
  event: string;
  recallId: string;
  upcCode: string;
  lotNumber: string;
  affectedVendingMachines: string[];
  affectedCoils: string[];
  warningMessage: string;
  timestamp: string;
}

export interface BlockchainRecallRecord {
  recallId: number;
  upcCode: string;
  lotNumber: string;
  reason: string;
  timestamp: number;
  active: boolean;
  transactionHash: string;
  contractAddress: string;
  network: string;
}

const INITIAL_COILS: VendingCoilItem[] = [
  {
    coil: "A1",
    name: "Turkey & Cheddar Sandwich",
    category: "sandwich",
    lotNumber: "LOT-2026-TURKEY-99",
    upcCode: "012345678905",
    price: 4.5,
    dietaryTags: ["Halal", "Nut-Free"],
    stock: 8,
    icon: "🥪",
    calories: 420,
  },
  {
    coil: "A2",
    name: "Smoked Turkey Club Sub",
    category: "sandwich",
    lotNumber: "LOT-2026-TURKEY-99",
    upcCode: "012345678905",
    price: 5.25,
    dietaryTags: ["Nut-Free"],
    stock: 6,
    icon: "🥖",
    calories: 480,
  },
  {
    coil: "A3",
    name: "Halal Roasted Beef Ciabatta",
    category: "sandwich",
    lotNumber: "LOT-2026-BEEF-77",
    upcCode: "012345678912",
    price: 5.5,
    dietaryTags: ["Halal"],
    stock: 10,
    icon: "🥩",
    calories: 510,
  },
  {
    coil: "A4",
    name: "Organic Hummus & Pita Box",
    category: "snack",
    lotNumber: "LOT-2026-VEG-14",
    upcCode: "012345678918",
    price: 3.75,
    dietaryTags: ["Vegan", "Halal", "Kosher"],
    stock: 12,
    icon: "🧆",
    calories: 290,
  },
  {
    coil: "B1",
    name: "Gluten-Free Chia Protein Bowl",
    category: "salad",
    lotNumber: "LOT-2026-SNACK-22",
    upcCode: "012345678925",
    price: 4.25,
    dietaryTags: ["Gluten-Free", "Vegan"],
    stock: 7,
    icon: "🥗",
    calories: 340,
  },
  {
    coil: "B2",
    name: "Kosher Smoked Salmon Wrap",
    category: "sandwich",
    lotNumber: "LOT-2026-FISH-03",
    upcCode: "012345678930",
    price: 6.0,
    dietaryTags: ["Kosher", "Nut-Free"],
    stock: 5,
    icon: "🌯",
    calories: 390,
  },
  {
    coil: "B3",
    name: "Peanut Butter Energy Crunch",
    category: "snack",
    lotNumber: "LOT-2026-NUT-55",
    upcCode: "012345678944",
    price: 2.75,
    dietaryTags: ["Vegetarian"],
    stock: 14,
    icon: "🥜",
    calories: 260,
  },
  {
    coil: "B4",
    name: "Greek Yogurt & Berry Parfait",
    category: "snack",
    lotNumber: "LOT-2026-DAIRY-88",
    upcCode: "012345678950",
    price: 3.5,
    dietaryTags: ["Vegetarian", "Gluten-Free"],
    stock: 9,
    icon: "🍓",
    calories: 210,
  },
  {
    coil: "C1",
    name: "Grilled Chicken Caesar Salad",
    category: "salad",
    lotNumber: "LOT-2026-POULTRY-11",
    upcCode: "012345678962",
    price: 5.75,
    dietaryTags: ["Halal"],
    stock: 8,
    icon: "🥙",
    calories: 380,
  },
  {
    coil: "C2",
    name: "Vegan Falafel & Tahini Bowl",
    category: "salad",
    lotNumber: "LOT-2026-VEG-91",
    upcCode: "012345678977",
    price: 4.8,
    dietaryTags: ["Vegan", "Halal", "Kosher"],
    stock: 11,
    icon: "🥗",
    calories: 360,
  },
  {
    coil: "C3",
    name: "Classic Roast Beef & Mustard",
    category: "sandwich",
    lotNumber: "LOT-2026-BEEF-99",
    upcCode: "012345678981",
    price: 5.25,
    dietaryTags: ["Nut-Free"],
    stock: 4,
    icon: "🥪",
    calories: 460,
  },
  {
    coil: "C4",
    name: "Cold Brew Espresso Shot",
    category: "beverage",
    lotNumber: "LOT-2026-BEV-10",
    upcCode: "012345678990",
    price: 3.25,
    dietaryTags: ["Vegan", "Gluten-Free", "Kosher", "Halal"],
    stock: 18,
    icon: "☕",
    calories: 15,
  },
  {
    coil: "D1",
    name: "Fresh Apple Slices & Caramel",
    category: "snack",
    lotNumber: "LOT-2026-FRUIT-02",
    upcCode: "012345678001",
    price: 2.25,
    dietaryTags: ["Vegetarian", "Gluten-Free"],
    stock: 15,
    icon: "🍎",
    calories: 140,
  },
  {
    coil: "D2",
    name: "Almond & Oat Granola Bar",
    category: "snack",
    lotNumber: "LOT-2026-GRAIN-33",
    upcCode: "012345678002",
    price: 2.0,
    dietaryTags: ["Vegan"],
    stock: 20,
    icon: "🌾",
    calories: 220,
  },
  {
    coil: "D3",
    name: "Electrolyte Sparkling Water",
    category: "beverage",
    lotNumber: "LOT-2026-BEV-44",
    upcCode: "012345678003",
    price: 1.75,
    dietaryTags: ["Vegan", "Gluten-Free", "Kosher", "Halal"],
    stock: 24,
    icon: "💧",
    calories: 0,
  },
  {
    coil: "D4",
    name: "Dark Chocolate Coconut Crisp",
    category: "sweet",
    lotNumber: "LOT-2026-CHOC-15",
    upcCode: "012345678004",
    price: 2.5,
    dietaryTags: ["Vegan", "Gluten-Free"],
    stock: 16,
    icon: "🍫",
    calories: 190,
  },
];

export interface SmartVendingRecallAlertProps {
  machineId?: string;
  campusLocation?: string;
  initialRecalls?: BlockchainRecallRecord[];
}

export const SmartVendingRecallAlert: React.FC<SmartVendingRecallAlertProps> = ({
  machineId = "VM-HUB-12",
  campusLocation = "Student Union Hall - Level 1",
}) => {
  // State
  const [coils, setCoils] = useState<VendingCoilItem[]>(INITIAL_COILS);
  const [recalledLots, setRecalledLots] = useState<Set<string>>(new Set());
  const [activeRecallPayload, setActiveRecallPayload] = useState<MqttLockoutPayload | null>(null);
  const [blockchainRecalls, setBlockchainRecalls] = useState<BlockchainRecallRecord[]>([]);
  const [mqttFeed, setMqttFeed] = useState<Array<{ timestamp: string; topic: string; data: any }>>(
    [],
  );

  // Interactive Keypad & POS State
  const [keypadInput, setKeypadInput] = useState<string>("");
  const [selectedCoil, setSelectedCoil] = useState<VendingCoilItem | null>(null);
  const [dispenseStatus, setDispenseStatus] = useState<string>("READY");
  const [dispenseMessage, setDispenseMessage] = useState<string>(
    "Enter coil code (e.g., A1) or tap an item",
  );
  const [studentBalance, setStudentBalance] = useState<number>(25.0);
  const [isProcessingDispense, setIsProcessingDispense] = useState<boolean>(false);
  const [selectedDietFilter, setSelectedDietFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"vending" | "mqtt" | "blockchain">("vending");
  const [hardwareLockoutActive, setHardwareLockoutActive] = useState<boolean>(false);

  // Initialize and check if initial recall is active
  const triggerFdaRecallSimulation = useCallback(() => {
    const targetLot = "LOT-2026-TURKEY-99";
    const targetUpc = "012345678905";
    const affectedCoils = ["A1", "A2"];
    const recallId = "FDA-2026-EC-9901";
    const reason =
      "FDA Safety Alert: E. Coli O157:H7 contamination detected in sliced turkey batches.";
    const txHash = "0x8f2d9c44b7e192a54316ce83091df8820461b7e4113824510ad6e7c10b7842c1";
    const timestampIso = new Date().toISOString();

    // 1. Update recalled lots set
    setRecalledLots((prev) => {
      const next = new Set(prev);
      next.add(targetLot);
      return next;
    });

    // 2. Formulate MQTT Lockout Payload
    const mqttPayload: MqttLockoutPayload = {
      event: "FDA_RECALL_LOCKOUT",
      recallId: recallId,
      upcCode: targetUpc,
      lotNumber: targetLot,
      affectedVendingMachines: ["VM-NORTH-01", "VM-SOUTH-04", machineId],
      affectedCoils: affectedCoils,
      warningMessage: "DANGER: RECALLED PRODUCT - CONTAMINATED LOT",
      timestamp: timestampIso,
    };

    setActiveRecallPayload(mqttPayload);
    setHardwareLockoutActive(true);

    // 3. Add to MQTT Feed
    setMqttFeed((prev) => [
      {
        timestamp: new Date().toLocaleTimeString(),
        topic: "campusconnect/vending/hardware/lockout",
        data: mqttPayload,
      },
      ...prev.slice(0, 19),
    ]);

    // 4. Update Blockchain Record
    const blockchainRecord: BlockchainRecallRecord = {
      recallId: 1,
      upcCode: targetUpc,
      lotNumber: targetLot,
      reason: reason,
      timestamp: Math.floor(Date.now() / 1000),
      active: true,
      transactionHash: txHash,
      contractAddress: "0x71C0F4d188Ff36A96E26b38c2057790E3c18b76D",
      network: "Polygon Mainnet (POS)",
    };

    setBlockchainRecalls((prev) => {
      const filtered = prev.filter((r) => r.lotNumber !== targetLot);
      return [blockchainRecord, ...filtered];
    });

    // If the currently selected coil is locked, reset selection
    if (selectedCoil && (selectedCoil.coil === "A1" || selectedCoil.coil === "A2")) {
      setSelectedCoil(null);
      setKeypadInput("");
      setDispenseStatus("HARDWARE_LOCKED");
      setDispenseMessage(
        "⚠️ ALERT: Selection was aborted. Contaminated lot locked by FDA safety directive.",
      );
    }
  }, [machineId, selectedCoil]);

  const clearRecalls = () => {
    setRecalledLots(new Set());
    setActiveRecallPayload(null);
    setHardwareLockoutActive(false);
    setDispenseStatus("READY");
    setDispenseMessage("System normalized. Ready for standard transactions.");
    setMqttFeed((prev) => [
      {
        timestamp: new Date().toLocaleTimeString(),
        topic: "campusconnect/vending/hardware/lockout",
        data: {
          event: "RECALL_STATE_RESET",
          message: "All coils normalized and hardware locks cleared.",
        },
      },
      ...prev,
    ]);
  };

  // Check if coil is recalled
  const isCoilRecalled = useCallback(
    (item: VendingCoilItem) => {
      return recalledLots.has(item.lotNumber);
    },
    [recalledLots],
  );

  // Handle Coil Selection
  const handleSelectCoil = (item: VendingCoilItem) => {
    setKeypadInput(item.coil);
    if (isCoilRecalled(item)) {
      setSelectedCoil(item);
      setDispenseStatus("HARDWARE_LOCKED");
      setDispenseMessage(
        `⛔ HARDWARE LOCKED: Coil ${item.coil} (${item.name}) is subject to an active FDA recall for Lot #${item.lotNumber}. Dispense is permanently blocked.`,
      );
      return;
    }

    setSelectedCoil(item);
    setDispenseStatus("SELECTED");
    setDispenseMessage(
      `Coil ${item.coil}: ${item.name} ($${item.price.toFixed(2)}) ready for purchase.`,
    );
  };

  // Keypad press handler
  const handleKeypadPress = (val: string) => {
    if (val === "CLEAR") {
      setKeypadInput("");
      setSelectedCoil(null);
      setDispenseStatus("READY");
      setDispenseMessage("Enter coil code (e.g., A1) or tap an item");
      return;
    }

    if (val === "ENTER") {
      const match = coils.find((c) => c.coil.toUpperCase() === keypadInput.toUpperCase());
      if (match) {
        handleSelectCoil(match);
      } else {
        setDispenseStatus("INVALID_CODE");
        setDispenseMessage(`Invalid coil code '${keypadInput}'. Please enter A1 to D4.`);
      }
      return;
    }

    if (keypadInput.length < 2) {
      const nextInput = keypadInput + val;
      setKeypadInput(nextInput);
      if (nextInput.length === 2) {
        const match = coils.find((c) => c.coil.toUpperCase() === nextInput.toUpperCase());
        if (match) {
          handleSelectCoil(match);
        }
      }
    }
  };

  // Dispense simulation
  const handleDispensePurchase = () => {
    if (!selectedCoil) return;

    if (isCoilRecalled(selectedCoil)) {
      setDispenseStatus("HARDWARE_LOCKED");
      setDispenseMessage(
        `🚨 CRITICAL SAFETY INTERLOCK: Cannot dispense ${selectedCoil.name}. FDA recall on lot ${selectedCoil.lotNumber} has locked this motor coil.`,
      );
      return;
    }

    if (studentBalance < selectedCoil.price) {
      setDispenseStatus("INSUFFICIENT_FUNDS");
      setDispenseMessage(
        `Insufficient balance. Required: $${selectedCoil.price.toFixed(2)}, Available: $${studentBalance.toFixed(2)}.`,
      );
      return;
    }

    setIsProcessingDispense(true);
    setDispenseStatus("DISPENSING");
    setDispenseMessage(`Actuating coil ${selectedCoil.coil}... Dispensing ${selectedCoil.name}.`);

    setTimeout(() => {
      setStudentBalance((prev) => Math.max(0, prev - selectedCoil.price));
      setCoils((prev) =>
        prev.map((c) =>
          c.coil === selectedCoil.coil ? { ...c, stock: Math.max(0, c.stock - 1) } : c,
        ),
      );
      setIsProcessingDispense(false);
      setDispenseStatus("SUCCESS");
      setDispenseMessage(
        `✅ Dispensed! Please take your ${selectedCoil.name} from the collection tray.`,
      );
      setSelectedCoil(null);
      setKeypadInput("");
    }, 1500);
  };

  // Filtered coils by dietary tag
  const filteredCoils = useMemo(() => {
    if (selectedDietFilter === "ALL") return coils;
    return coils.filter((c) => c.dietaryTags.includes(selectedDietFilter as any));
  }, [coils, selectedDietFilter]);

  const dietaryOptions = ["ALL", "Halal", "Kosher", "Vegan", "Gluten-Free", "Nut-Free"];

  return (
    <div className="smart-vending-container bg-slate-950 text-slate-100 min-h-screen p-4 md:p-8 font-sans antialiased">
      {/* Top Header & Context */}
      <header className="max-w-7xl mx-auto mb-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
              Smart IoT Edge Node Connected
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/80">
              Polygon Provenance Ledger
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Dietary Smart Vending Hardware Lockout</span>
            <span className="text-sm font-mono font-normal text-slate-400 px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
              #{machineId}
            </span>
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            Automated FDA Recall Ingestion • On-Chain Halal & Food Safety Ledger • MQTT Hardware
            Interlock Pipeline
          </p>
        </div>

        {/* Global Action Simulation Bar */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={triggerFdaRecallSimulation}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-lg shadow-rose-950/50 border border-rose-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <span className="text-base">🚨</span>
            <span>Simulate FDA Recall Ingestion</span>
          </button>

          {hardwareLockoutActive && (
            <button
              onClick={clearRecalls}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🔄</span>
              <span>Reset Recalls</span>
            </button>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 flex items-center gap-3 text-xs">
            <span className="text-slate-400 font-mono">Location:</span>
            <span className="text-slate-200 font-medium">{campusLocation}</span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto mb-6 flex items-center gap-2 border-b border-slate-800/80 pb-3">
        <button
          onClick={() => setActiveTab("vending")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "vending"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <span>🖥️</span>
          <span>Vending Machine Interface</span>
        </button>

        <button
          onClick={() => setActiveTab("mqtt")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "mqtt"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <span>📡</span>
          <span>MQTT Hardware Telemetry ({mqttFeed.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("blockchain")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "blockchain"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <span>⛓️</span>
          <span>Polygon Supply Ledger ({blockchainRecalls.length})</span>
        </button>
      </div>

      {/* Main Layout Container */}
      <main className="max-w-7xl mx-auto">
        {activeTab === "vending" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT 8 COLS: Smart Vending Machine Physical Enclosure */}
            <div className="lg:col-span-8 flex flex-col">
              {/* Machine Outer Frame */}
              <div
                className={`relative rounded-3xl p-5 md:p-7 shadow-2xl transition-all duration-500 border-4 ${
                  hardwareLockoutActive
                    ? "bg-gradient-to-b from-slate-900 via-rose-950/20 to-slate-950 border-rose-600 shadow-rose-950/50"
                    : "bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border-slate-700 shadow-black"
                }`}
              >
                {/* Vending Machine Canopy Light Strip */}
                <div className="flex items-center justify-between mb-4 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🥗</span>
                    <div>
                      <h2 className="text-sm font-extrabold tracking-wide uppercase text-slate-100">
                        CampusConnect Fresh & Halal Smart Hub
                      </h2>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Hardware Node ID: {machineId} • Bio-Safety Protocol Active
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold font-mono ${
                        hardwareLockoutActive
                          ? "bg-rose-500 text-white animate-pulse"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {hardwareLockoutActive
                        ? "🔒 HARDWARE LOCKOUT ENGAGED"
                        : "🟢 NORMAL OPERATIONS"}
                    </span>
                  </div>
                </div>

                {/* Dietary Restriction Filter Toolbar */}
                <div className="mb-4 flex flex-wrap items-center gap-1.5 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-[11px] font-mono text-slate-400 px-2 uppercase">
                    Dietary Filter:
                  </span>
                  {dietaryOptions.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedDietFilter(tag)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        selectedDietFilter === tag
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                {/* PROMINENT FDA SAFETY RECALL EMERGENCY BANNER OVERLAY */}
                {hardwareLockoutActive && activeRecallPayload && (
                  <div className="mb-4 bg-gradient-to-r from-rose-900/90 via-red-900/95 to-rose-900/90 border-2 border-rose-500 rounded-2xl p-4 text-white shadow-xl shadow-red-950/80 animate-bounce-short">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl p-2 bg-rose-950/90 rounded-xl border border-rose-400/50 flex-shrink-0 animate-pulse">
                        ⚠️
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-black font-mono tracking-wider uppercase bg-rose-950 px-2 py-0.5 rounded border border-rose-400/40 text-rose-200">
                            CRITICAL FDA ENFORCEMENT ADVISORY
                          </span>
                          <span className="text-xs font-mono text-rose-200">
                            Recall Ref: {activeRecallPayload.recallId}
                          </span>
                        </div>
                        <h3 className="text-sm md:text-base font-extrabold tracking-tight text-white">
                          ⚠️ FDA SAFETY RECALL: E. COLI CONTAMINATION DETECTED - LOT #
                          {activeRecallPayload.lotNumber} HARDWARE LOCKED
                        </h3>
                        <p className="text-xs text-rose-100 mt-1">
                          Coils [{activeRecallPayload.affectedCoils.join(", ")}] are physically
                          isolated. Motor actuation coils are frozen via remote MQTT hardware
                          interrupt.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Physical Glass Display & 4x4 Coils Grid */}
                <div
                  className={`relative rounded-2xl p-4 transition-all duration-300 ${
                    hardwareLockoutActive
                      ? "bg-red-950/30 border-2 border-rose-500/60 shadow-[inset_0_0_40px_rgba(239,68,68,0.2)]"
                      : "bg-slate-950/80 border border-slate-800/90 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]"
                  }`}
                >
                  {/* Subtle Acrylic Glass Reflection Effect */}
                  <div className="absolute inset-0 pointer-events-none rounded-2xl bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.07]" />

                  {/* 4x4 Grid (A1 to D4) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
                    {filteredCoils.map((item) => {
                      const isRecalled = isCoilRecalled(item);
                      const isSelected = selectedCoil?.coil === item.coil;

                      return (
                        <div
                          key={item.coil}
                          onClick={() => handleSelectCoil(item)}
                          className={`relative rounded-xl p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none group border ${
                            isRecalled
                              ? "bg-rose-950/80 border-rose-500 text-rose-100 shadow-lg shadow-rose-950/60 ring-2 ring-rose-500/40"
                              : isSelected
                                ? "bg-indigo-950/90 border-indigo-400 text-white ring-2 ring-indigo-500/50 shadow-md"
                                : "bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 text-slate-200 hover:border-slate-700"
                          }`}
                        >
                          {/* Top Coil Label & Stock */}
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                                isRecalled
                                  ? "bg-rose-900 text-rose-200 border border-rose-400"
                                  : isSelected
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {item.coil}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Qty: {item.stock}
                            </span>
                          </div>

                          {/* Item Icon & Details */}
                          <div className="text-center my-1.5">
                            <div className="text-3xl mb-1 transform group-hover:scale-110 transition-transform">
                              {item.icon}
                            </div>
                            <h4 className="text-xs font-bold leading-tight line-clamp-2 h-8 flex items-center justify-center text-slate-100">
                              {item.name}
                            </h4>
                          </div>

                          {/* Dietary Tags */}
                          <div className="flex flex-wrap items-center justify-center gap-1 my-1">
                            {item.dietaryTags.map((tag) => (
                              <span
                                key={tag}
                                className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                  tag === "Halal"
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                    : tag === "Kosher"
                                      ? "bg-blue-950 text-blue-300 border border-blue-800"
                                      : tag === "Vegan"
                                        ? "bg-green-950 text-green-300 border border-green-800"
                                        : tag === "Gluten-Free"
                                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                                          : "bg-purple-950 text-purple-300 border border-purple-800"
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          {/* Lot Number & Price */}
                          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                            <span
                              className="font-mono text-slate-400 truncate max-w-[80px]"
                              title={item.lotNumber}
                            >
                              #{item.lotNumber.replace("LOT-2026-", "")}
                            </span>
                            <span className="font-bold text-xs text-white">
                              ${item.price.toFixed(2)}
                            </span>
                          </div>

                          {/* RECALLED HARDWARE LOCK OVERLAY */}
                          {isRecalled && (
                            <div className="absolute inset-0 bg-rose-950/95 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center p-2 text-center border-2 border-rose-500 animate-pulse">
                              <span className="text-2xl mb-1">🔒</span>
                              <span className="text-[11px] font-black tracking-wider uppercase text-white bg-rose-800 px-2 py-0.5 rounded border border-rose-400">
                                LOCKED - RECALLED
                              </span>
                              <span className="text-[9px] font-mono text-rose-200 mt-1 font-semibold">
                                #{item.lotNumber}
                              </span>
                              <span className="text-[8px] text-rose-300 leading-tight mt-0.5">
                                E. Coli Hazard
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Physical Dispensing Tray Bottom */}
                <div className="mt-5 bg-slate-950 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xl">
                      📥
                    </div>
                    <div>
                      <span className="text-xs font-mono uppercase text-slate-400 block">
                        Collection Delivery Tray
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        {isProcessingDispense
                          ? "⏳ Dispense in progress..."
                          : "Sensor Ready (No Obstruct)"}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                    ANTI-THEFT INTERLOCK ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT 4 COLS: Smart POS Keypad & Dispenser Terminal */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              {/* POS Terminal & Digital LCD */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  {/* Digital LCD Segment Display */}
                  <div className="bg-emerald-950/80 border-2 border-emerald-600/80 rounded-2xl p-4 shadow-inner mb-5 font-mono">
                    <div className="flex items-center justify-between text-[10px] text-emerald-400/80 uppercase pb-1 border-b border-emerald-800/40 mb-2">
                      <span>VEND-OS v4.18</span>
                      <span>LEDGER-SYNC: OK</span>
                    </div>

                    <div className="text-2xl font-black text-emerald-300 tracking-widest min-h-[32px] flex items-center justify-between">
                      <span>CODE: {keypadInput || "__"}</span>
                      {selectedCoil && <span>${selectedCoil.price.toFixed(2)}</span>}
                    </div>

                    <div className="mt-2 text-xs text-emerald-200/90 leading-relaxed font-sans min-h-[36px]">
                      {dispenseMessage}
                    </div>
                  </div>

                  {/* Student Card / Payment Balance */}
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-sm text-indigo-300">
                        💳
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-slate-400 block">
                          Student Campus Card
                        </span>
                        <span className="text-xs font-bold text-white">John Harvard (#9044)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono text-slate-400 block">
                        Balance
                      </span>
                      <span className="text-sm font-extrabold text-emerald-400 font-mono">
                        ${studentBalance.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Tactile Keypad (A-D, 1-4, Enter, Clear) */}
                  <div className="mb-5">
                    <label className="text-[11px] font-mono uppercase text-slate-400 block mb-2">
                      Tactile Keypad
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {["A", "B", "C", "D"].map((row) => (
                        <button
                          key={row}
                          onClick={() => handleKeypadPress(row)}
                          className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold font-mono text-sm border border-slate-700 transition-all cursor-pointer"
                        >
                          {row}
                        </button>
                      ))}
                      {["1", "2", "3", "4"].map((num) => (
                        <button
                          key={num}
                          onClick={() => handleKeypadPress(num)}
                          className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold font-mono text-sm border border-slate-700 transition-all cursor-pointer"
                        >
                          {num}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={() => handleKeypadPress("CLEAR")}
                        className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-rose-300 font-bold font-mono text-xs border border-slate-700 transition-all cursor-pointer"
                      >
                        CLEAR
                      </button>
                      <button
                        onClick={() => handleKeypadPress("ENTER")}
                        className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold font-mono text-xs shadow-md transition-all cursor-pointer"
                      >
                        ENTER
                      </button>
                    </div>
                  </div>
                </div>

                {/* Purchase Action Button */}
                <div>
                  <button
                    disabled={!selectedCoil || isCoilRecalled(selectedCoil) || isProcessingDispense}
                    onClick={handleDispensePurchase}
                    className={`w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                      !selectedCoil
                        ? "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed"
                        : isCoilRecalled(selectedCoil)
                          ? "bg-rose-900/60 text-rose-300 border-2 border-rose-500/80 cursor-not-allowed animate-pulse"
                          : isProcessingDispense
                            ? "bg-indigo-700 text-indigo-200 cursor-wait"
                            : "bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white shadow-emerald-950/50 cursor-pointer"
                    }`}
                  >
                    {isProcessingDispense ? (
                      <>
                        <span className="animate-spin text-base">⏳</span>
                        <span>Dispensing Food Asset...</span>
                      </>
                    ) : selectedCoil && isCoilRecalled(selectedCoil) ? (
                      <>
                        <span>🚫</span>
                        <span>PURCHASE BLOCKED: RECALLED LOT</span>
                      </>
                    ) : selectedCoil ? (
                      <>
                        <span>💳</span>
                        <span>
                          Dispense {selectedCoil.coil} (${selectedCoil.price.toFixed(2)})
                        </span>
                      </>
                    ) : (
                      <>
                        <span>👆</span>
                        <span>Select Coil to Purchase</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MQTT Hardware Telemetry Feed */}
        {activeTab === "mqtt" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📡</span>
                  <span>Live MQTT Broker Telemetry Stream</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Topic: campusconnect/vending/hardware/lockout • QoS 2 (Exactly Once)
                </p>
              </div>

              <button
                onClick={triggerFdaRecallSimulation}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>⚡</span>
                <span>Publish Test Lockout Event</span>
              </button>
            </div>

            {mqttFeed.length === 0 ? (
              <div className="text-center py-16 text-slate-500 font-mono text-xs">
                No telemetry packets recorded yet. Click "Simulate FDA Recall Ingestion" to
                broadcast a hardware lockout event.
              </div>
            ) : (
              <div className="space-y-4">
                {mqttFeed.map((packet, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-rose-400 font-bold">TOPIC: {packet.topic}</span>
                      </div>
                      <span className="text-slate-400">{packet.timestamp}</span>
                    </div>

                    <pre className="text-emerald-400 bg-slate-900/90 p-3 rounded-xl overflow-x-auto text-[11px] leading-relaxed">
                      {JSON.stringify(packet.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Polygon Supply Chain Provenance Ledger */}
        {activeTab === "blockchain" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="mb-6 pb-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>⛓️</span>
                  <span>HalalProvenanceLedger.sol On-Chain Recalls</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Smart Contract Address: 0x71C0F4d188Ff36A96E26b38c2057790E3c18b76D (Polygon PoS)
                </p>
              </div>
            </div>

            {blockchainRecalls.length === 0 ? (
              <div className="text-center py-16 text-slate-500 font-mono text-xs">
                No on-chain food safety recall records found. Trigger an FDA sync to write an
                immutable recall transaction.
              </div>
            ) : (
              <div className="space-y-4">
                {blockchainRecalls.map((rec, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-indigo-900/60 rounded-2xl p-5 shadow-lg space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-rose-950 text-rose-300 border border-rose-700 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
                          ON-CHAIN RECALL ID #{rec.recallId}
                        </span>
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-mono px-2 py-0.5 rounded-full">
                          {rec.network}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        Block Timestamp: {new Date(rec.timestamp * 1000).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-slate-400 font-mono block">Recalled Lot Number:</span>
                        <span className="text-white font-bold font-mono">{rec.lotNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono block">UPC Barcode:</span>
                        <span className="text-white font-bold font-mono">{rec.upcCode}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono block">Enforcement Status:</span>
                        <span className="text-rose-400 font-bold font-mono">
                          ACTIVE HARDWARE LOCK
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300">
                      <span className="text-slate-400 font-mono block mb-0.5">
                        Advisory Reason:
                      </span>
                      <p className="font-medium bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        {rec.reason}
                      </p>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 break-all bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between">
                      <span>
                        Tx Hash: <strong className="text-indigo-400">{rec.transactionHash}</strong>
                      </span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        VERIFIED IMMUTABLE
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
