import React, { useState } from "react";

// Define our strict payload structure for the blockchain
interface IngredientEntry {
  id: string;
  ingredientName: string;
  supplierName: string;
  lotNumber: string;
}

export const CatererIngredientLogger = () => {
  const [eventId, setEventId] = useState("EVT-2026-991"); // Mock Event ID
  const [ingredients, setIngredients] = useState<IngredientEntry[]>([
    { id: crypto.randomUUID(), ingredientName: "", supplierName: "", lotNumber: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState("");

  const handleAddRow = () => {
    setIngredients([
      ...ingredients,
      { id: crypto.randomUUID(), ingredientName: "", supplierName: "", lotNumber: "" },
    ]);
  };

  const handleChange = (id: string, field: keyof IngredientEntry, value: string) => {
    setIngredients(ingredients.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing)));
  };

  const handleRemoveRow = (id: string) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((ing) => ing.id !== id));
    }
  };

  const handleSubmitToLedger = async () => {
    const isValid = ingredients.every(
      (ing) => ing.ingredientName && ing.supplierName && ing.lotNumber,
    );
    if (!isValid) {
      alert("Please fill out all fields before submitting to the ledger.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      eventId,
      timestamp: new Date().toISOString(),
      ingredients: ingredients.map(({ ingredientName, supplierName, lotNumber }) => ({
        ingredientName,
        supplierName,
        lotNumber,
      })),
    };

    try {
      // Calling our new Supabase Edge Function
      const response = await fetch("http://localhost:54321/functions/v1/log-ingredient-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to log to ledger");

      const data = await response.json();
      setTxHash(data.txHash); // Set the real cryptographic hash returned from our backend
    } catch (error) {
      console.error("Blockchain write failed:", error);
      alert("Failed to record to ledger.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (txHash) {
    return (
      <div className="max-w-4xl mx-auto p-8 mt-10 bg-green-50 rounded-xl shadow-lg border border-green-200">
        <h2 className="text-2xl font-bold text-green-700 mb-4">Supply Chain Logged Successfully</h2>
        <p className="text-gray-700 mb-4">
          The ingredient data has been permanently written to the immutable ledger.
        </p>
        <div className="bg-white p-4 rounded border border-green-300 font-mono text-sm break-all">
          <strong>Transaction Hash:</strong> {txHash}
        </div>
        <button
          onClick={() => {
            setTxHash("");
            setIngredients([
              { id: crypto.randomUUID(), ingredientName: "", supplierName: "", lotNumber: "" },
            ]);
          }}
          className="mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded"
        >
          Log Another Contract
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 mt-10 bg-white rounded-xl shadow-lg border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">High-Risk Contract: Ingredient Ledger</h2>
        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-300">
          Immutable Blockchain Record
        </span>
      </div>

      <p className="text-gray-600 mb-6 pb-4 border-b">
        As per University safety guidelines, all core ingredients for Event{" "}
        <strong>{eventId}</strong> must be traced. Input your supplier details and lot numbers
        below. This data cannot be altered once submitted.
      </p>

      <div className="space-y-4 mb-6">
        {ingredients.map((ing) => (
          <div
            key={ing.id}
            className="flex gap-4 items-center bg-gray-50 p-4 rounded border border-gray-100"
          >
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Ingredient</label>
              <input
                type="text"
                placeholder="e.g. Wheat Flour"
                value={ing.ingredientName}
                onChange={(e) => handleChange(ing.id, "ingredientName", e.target.value)}
                className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Supplier Name
              </label>
              <input
                type="text"
                placeholder="e.g. Farm XYZ"
                value={ing.supplierName}
                onChange={(e) => handleChange(ing.id, "supplierName", e.target.value)}
                className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Lot Number</label>
              <input
                type="text"
                placeholder="e.g. LOT-88219"
                value={ing.lotNumber}
                onChange={(e) => handleChange(ing.id, "lotNumber", e.target.value)}
                className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            {ingredients.length > 1 && (
              <button
                onClick={() => handleRemoveRow(ing.id)}
                className="mt-5 text-red-500 hover:text-red-700 font-bold px-2"
                title="Remove Row"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={handleAddRow}
          className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center"
        >
          + Add Another Ingredient
        </button>

        <button
          onClick={handleSubmitToLedger}
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded shadow-md transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Writing to Blockchain..." : "Sign & Write to Ledger"}
        </button>
      </div>
    </div>
  );
};
