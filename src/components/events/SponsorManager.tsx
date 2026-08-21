// =============================================================================
// Component: SponsorManager
// Issue: #2808 - Implement 'Sponsorship' Tiers and Dynamic Banners for Events
// Description: Admin interface for adding new sponsors.Includes a form for
// uploading logos, setting tier levels, and providing website URLs.
// =============================================================================

import React, { useState } from "react";
import { SponsorTier, useEventSponsors } from "../../hooks/useEventSponsors";
import { sanitizeSvgString } from "../../lib/sponsors/sanitizeSvg";

interface SponsorManagerProps {
  eventId: string;
}

export const SponsorManager: React.FC<SponsorManagerProps> = ({ eventId }) => {
  const { addSponsor, isUploading } = useEventSponsors(eventId);

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tier, setTier] = useState<SponsorTier>("silver");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(selectedFile.type)) {
      setError("Please upload a PNG, JPEG, SVG, or WebP image.");
      return;
    }

    // Validate file size (Max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB.");
      return;
    }

    // If SVG, sanitize it to prevent XSS
    if (selectedFile.type === "image/svg+xml") {
      try {
        const text = await selectedFile.text();
        const sanitized = sanitizeSvgString(text);
        const blob = new Blob([sanitized], { type: "image/svg+xml" });
        const sanitizedFile = new File([blob], selectedFile.name, { type: "image/svg+xml" });
        setFile(sanitizedFile);
      } catch (err) {
        setError("Failed to process SVG. It may contain invalid markup.");
        return;
      }
    } else {
      setFile(selectedFile);
    }

    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Sponsor name is required.");
      return;
    }
    if (!file) {
      setError("Please upload a logo.");
      return;
    }

    const success = await addSponsor(name, websiteUrl, tier, file);
    if (success) {
      // Reset form
      setName("");
      setWebsiteUrl("");
      setTier("silver");
      setFile(null);
      setIsOpen(false);
    }
  };

  return (
    <div className="mb-8">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Add New Sponsor
        </button>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add New Sponsor</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sponsor Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Acme Corp"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sponsorship Tier *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["platinum", "gold", "silver", "bronze"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    className={`py-2 px-3 border rounded-lg text-sm font-medium capitalize transition-all ${
                      tier === t
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500"
                        : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Logo File * <span className="text-xs text-gray-500">(PNG, SVG, JPG, WebP)</span>
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900/30 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/50"
              />
              {file && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  Selected: {file.name}
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isUploading}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || !file}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isUploading ? "Uploading..." : "Add Sponsor"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
