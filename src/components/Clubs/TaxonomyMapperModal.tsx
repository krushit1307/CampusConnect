import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface TaxonomyMapperModalProps {
  customTag: string;
  onMap: () => void;
  onCancel: () => void;
}

export const TaxonomyMapperModal: React.FC<TaxonomyMapperModalProps> = ({
  customTag,
  onMap,
  onCancel,
}) => {
  const supabase = createClient();
  const [taxonomy, setTaxonomy] = useState<{ id: string; name: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("standard_taxonomy").select("id, name").order("name");
      if (data) setTaxonomy(data);
    }
    load();
  }, [supabase]);

  const handleSave = async () => {
    if (!selectedId) return;
    setLoading(true);
    await supabase.from("custom_tag_mappings").insert({
      custom_tag: customTag,
      standard_taxonomy_id: selectedId,
    });
    setLoading(false);
    onMap();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg p-6 shadow-xl border-2 border-black space-y-4">
        <h3 className="text-lg font-bold text-black font-mono">Map Custom Tag</h3>
        <p className="text-sm text-gray-700">
          The tag <span className="font-bold">"{customTag}"</span> is not recognized in our standard
          taxonomy. Please select its closest parent category to help students find it.
        </p>

        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
        >
          <option value="" disabled>
            Select a category...
          </option>
          {taxonomy.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded text-sm font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedId || loading}
            className="px-4 py-2 bg-black text-white rounded text-sm font-bold disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Mapping"}
          </button>
        </div>
      </div>
    </div>
  );
};
