import { ImagePlus, Send, X, Check } from "lucide-react";
import { useState, useRef } from "react";

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BugReportModal({ open, onOpenChange }: BugReportModalProps) {
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");

  // NEW: State and Ref for file uploads
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  // Dynamic text based on the selected category
  const contentMap: Record<
    string,
    { title: string; subtitle: string; label: string; placeholder: string }
  > = {
    bug: {
      title: "Report a Bug",
      subtitle: "Found something broken? Let us know and we'll fix it.",
      label: "What went wrong?",
      placeholder:
        "Describe the bug — what happened, what you expected, and the steps to reproduce it.",
    },
    feature: {
      title: "Request a Feature",
      subtitle: "Have a great idea? We'd love to hear it.",
      label: "Describe your feature",
      placeholder:
        "Describe how this feature would work and why it would be useful to the community.",
    },
    suggestion: {
      title: "General Suggestion",
      subtitle: "How can we improve your experience?",
      label: "Your feedback",
      placeholder: "Share your thoughts, ideas, or general feedback with us.",
    },
  };

  const currentContent = contentMap[category];

  // NEW: Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setScreenshot(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitted:", { category, message, screenshot });

    // Reset form after submission
    setMessage("");
    setScreenshot(null);
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-[#8b5cf6] p-6 shadow-[8px_8px_0_0_rgba(0,0,0,1)] border-2 border-black">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            setScreenshot(null); // Clear file if they close without submitting
          }}
          className="absolute cursor-pointer right-4 top-4 text-black transition-transform hover:scale-110"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Dynamic Header */}
        <h2 className="mb-1 font-display text-2xl font-bold text-indigo-950">
          {currentContent.title}
        </h2>
        <p className="mb-6 font-mono text-sm text-indigo-950">{currentContent.subtitle}</p>

        <form onSubmit={handleSubmit}>
          {/* Category Dropdown */}
          <div className="mb-4 text-left">
            <label className="mb-2 block font-mono text-sm font-bold text-purple-900">
              Feedback Type
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full cursor-pointer border-2 border-black bg-white p-2 font-mono text-sm text-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="bug">🐛 Report a Bug</option>
              <option value="feature">💡 Request a Feature</option>
              <option value="suggestion">💭 General Suggestion</option>
            </select>
          </div>

          {/* Dynamic Textarea */}
          <div className="mb-1 text-left">
            <label className="mb-2 block font-mono text-sm font-bold text-purple-900">
              {currentContent.label}
            </label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              placeholder={currentContent.placeholder}
              className="h-32 w-full resize-none border-2 border-black bg-white p-3 font-mono text-sm text-black focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Character Count */}
          <div className="mb-4 text-right font-mono text-xs font-bold text-indigo-950">
            {message.length}/2000
          </div>

          {/* NEW: Working File Upload */}
          <div className="mb-6 text-left">
            <label className="mb-2 block font-mono text-sm font-bold text-purple-900">
              Screenshot (optional)
            </label>

            {/* Hidden Input */}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />

            {/* Conditional Rendering: Show upload button OR file name */}
            {!screenshot ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer items-center gap-2 bg-white px-4 py-2 font-mono text-sm font-bold text-black transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px] shadow-[4px_4px_0_0_rgba(0,0,0,1)] border-2 border-black"
              >
                <ImagePlus className="h-4 w-4" />
                UPLOAD SCREENSHOT
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/40 px-3 py-2 border-2 border-black font-mono text-xs font-bold text-indigo-950">
                  <Check className="h-4 w-4 text-green-900" />
                  <span className="max-w-[200px] truncate">{screenshot.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScreenshot(null)}
                  className="font-mono cursor-pointer text-xs font-bold text-indigo-950 underline hover:text-black"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={message.trim().length === 0}
              className="flex cursor-pointer items-center gap-2 bg-white/30 px-6 py-2 font-mono text-sm font-bold text-black transition-all hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/30 border-2 border-transparent disabled:border-transparent"
            >
              <Send className="h-4 w-4" />
              SUBMIT REPORT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
