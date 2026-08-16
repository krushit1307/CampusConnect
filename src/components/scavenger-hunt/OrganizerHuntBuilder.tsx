import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Plus, Trash2, Printer, CheckCircle, Save, MapPin, Award } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { generateClueQrPayload } from "../../lib/scavengerHuntEngine";

export interface ClueDraft {
  id?: string;
  sequence_order: number;
  hint_text: string;
  secret_qr_payload: string;
  target_lat?: number;
  target_lng?: number;
  points: number;
}

export function OrganizerHuntBuilder() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clues, setClues] = useState<ClueDraft[]>([
    {
      sequence_order: 1,
      hint_text: "Find the oldest tree near the central library courtyard.",
      secret_qr_payload: generateClueQrPayload("draft-hunt", 1),
      points: 100,
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedHuntId, setSavedHuntId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const addClue = () => {
    const nextOrder = clues.length + 1;
    setClues([
      ...clues,
      {
        sequence_order: nextOrder,
        hint_text: "",
        secret_qr_payload: generateClueQrPayload(savedHuntId || "temp-id", nextOrder),
        points: 100,
      },
    ]);
  };

  const removeClue = (index: number) => {
    if (clues.length <= 1) return;
    const updated = clues
      .filter((_, i) => i !== index)
      .map((c, i) => ({
        ...c,
        sequence_order: i + 1,
        secret_qr_payload: generateClueQrPayload(savedHuntId || "temp-id", i + 1),
      }));
    setClues(updated);
  };

  const updateClue = (index: number, field: keyof ClueDraft, value: string | number) => {
    const updated = [...clues];
    updated[index] = { ...updated[index], [field]: value };
    setClues(updated);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveHunt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFeedback({ type: "error", text: "Please enter a hunt title." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 1. Insert Hunt
      const { data: huntData, error: huntError } = await supabase
        .from("hunts")
        .insert({
          title,
          description,
          created_by: user?.id ?? null,
        })
        .select()
        .single();

      if (huntError) throw huntError;

      const huntId = huntData.id;
      setSavedHuntId(huntId);

      // 2. Insert Clues with finalized payloads
      const cluesToInsert = clues.map((c) => ({
        hunt_id: huntId,
        sequence_order: c.sequence_order,
        hint_text: c.hint_text,
        secret_qr_payload: generateClueQrPayload(huntId, c.sequence_order),
        target_lat: c.target_lat ?? null,
        target_lng: c.target_lng ?? null,
        points: c.points || 100,
      }));

      const { error: cluesError } = await supabase.from("clues").insert(cluesToInsert);
      if (cluesError) throw cluesError;

      setFeedback({
        type: "success",
        text: `Scavenger Hunt "${title}" successfully created! You can now print the QR codes.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving hunt";
      setFeedback({ type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Scavenger Hunt Builder
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create interactive clue sequences and generate printable QR checkpoints.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Printer className="h-4 w-4" />
            Print Checkpoints
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="alert"
          className={`rounded-lg p-4 text-sm ${
            feedback.type === "success"
              ? "border border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/50 dark:text-green-300"
              : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <form onSubmit={handleSaveHunt} className="space-y-6">
        {/* Hunt Metadata */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Hunt Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Orientation Week Discovery Trail"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the rules and prizes for completing the hunt..."
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Clues Sequence */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Clue Sequence</h2>
            <button
              type="button"
              onClick={addClue}
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              <Plus className="h-4 w-4" />
              Add Next Clue
            </button>
          </div>

          <div className="space-y-4">
            {clues.map((clue, index) => (
              <div
                key={index}
                className="relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                      #{clue.sequence_order}
                    </span>
                    <h3 className="text-base font-medium text-slate-900 dark:text-white">
                      Checkpoint {clue.sequence_order}
                    </h3>
                  </div>
                  {clues.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeClue(index)}
                      className="text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                      aria-label={`Remove checkpoint ${clue.sequence_order}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-2 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Hint / Riddle Text
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={clue.hint_text}
                        onChange={(e) => updateClue(index, "hint_text", e.target.value)}
                        placeholder="Type the riddle or directions leading to this checkpoint..."
                        className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                          <Award className="h-3 w-3" /> Points
                        </label>
                        <input
                          type="number"
                          value={clue.points}
                          onChange={(e) =>
                            updateClue(index, "points", parseInt(e.target.value) || 100)
                          }
                          className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                          <MapPin className="h-3 w-3" /> Geo-Coordinates (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 18.5204, 73.8567"
                          onChange={(e) => {
                            const [lat, lng] = e.target.value
                              .split(",")
                              .map((v) => parseFloat(v.trim()));
                            if (!isNaN(lat) && !isNaN(lng)) {
                              updateClue(index, "target_lat", lat);
                              updateClue(index, "target_lng", lng);
                            }
                          }}
                          className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* QR Code Printable Preview */}
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="bg-white p-2 rounded shadow-sm">
                      <QRCodeSVG
                        value={clue.secret_qr_payload}
                        size={110}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <span className="mt-2 text-center text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                      Step #{clue.sequence_order} QR
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving Hunt..." : "Save & Publish Hunt"}
          </button>
        </div>
      </form>
    </div>
  );
}
