import React, { useState } from "react";
import {
  Send,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  Info,
} from "lucide-react";
import { useSubmitPathway, useSubmitAccessibilityReport } from "@/hooks/useAccessibleRoutes";

// ─── Pathway Submission Form ────────────────────────────────────────────

interface PathwaySubmitFormProps {
  onClose: () => void;
  defaultStartLat?: number;
  defaultStartLng?: number;
  defaultEndLat?: number;
  defaultEndLng?: number;
}

const SURFACE_OPTIONS = [
  { value: "paved", label: "Paved", emoji: "🛣️" },
  { value: "concrete", label: "Concrete", emoji: "🏗️" },
  { value: "tile", label: "Tile", emoji: "🔲" },
  { value: "gravel", label: "Gravel", emoji: "🪨" },
  { value: "grass", label: "Grass", emoji: "🌿" },
  { value: "carpet", label: "Carpet", emoji: "🟫" },
];

export function PathwaySubmitForm({
  onClose,
  defaultStartLat,
  defaultStartLng,
  defaultEndLat,
  defaultEndLng,
}: PathwaySubmitFormProps) {
  const [name, setName] = useState("");
  const [startLat, setStartLat] = useState(defaultStartLat?.toString() || "");
  const [startLng, setStartLng] = useState(defaultStartLng?.toString() || "");
  const [endLat, setEndLat] = useState(defaultEndLat?.toString() || "");
  const [endLng, setEndLng] = useState(defaultEndLng?.toString() || "");
  const [surface, setSurface] = useState("paved");
  const [widthMeters, setWidthMeters] = useState("1.5");
  const [hasRamp, setHasRamp] = useState(false);
  const [hasTactilePaving, setHasTactilePaving] = useState(false);
  const [hasHandrails, setHasHandrails] = useState(false);
  const [gradePercentage, setGradePercentage] = useState("0");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitMutation = useSubmitPathway();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const sLat = parseFloat(startLat);
    const sLng = parseFloat(startLng);
    const eLat = parseFloat(endLat);
    const eLng = parseFloat(endLng);

    if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
      setError("Please enter valid coordinates for start and end points.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter a name for this pathway.");
      return;
    }

    try {
      await submitMutation.mutateAsync({
        name: name.trim(),
        geometry: {
          type: "LineString",
          coordinates: [
            [sLng, sLat],
            [eLng, eLat],
          ],
        },
        surface,
        widthMeters: parseFloat(widthMeters) || 1.5,
        hasRamp,
        hasTactilePaving,
        hasHandrails,
        gradePercentage: parseFloat(gradePercentage) || 0,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit pathway. Please try again.");
    }
  };

  if (success) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
        <div className="w-12 h-12 bg-emerald-900/50 border border-emerald-800 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-white">Pathway Submitted!</h3>
        <p className="text-sm text-slate-400 mt-2">
          Thank you for contributing to campus accessibility. Your pathway will
          be reviewed by the disability resource center.
        </p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold text-white">Submit New Pathway</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-500 hover:text-white transition-colors"
          aria-label="Close form"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Info Banner */}
        <div className="bg-violet-950/30 border border-violet-900/50 rounded-lg px-3 py-2 flex items-start gap-2">
          <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-violet-300">
            Help students with disabilities navigate campus safely by submitting
            verified accessible pathways. All submissions are reviewed by the
            disability resource center.
          </p>
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300">{error}</p>
          </div>
        )}

        {/* Pathway Name */}
        <div>
          <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
            Pathway Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Main Gate to Science Hall"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            required
          />
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
              Start Latitude *
            </label>
            <input
              type="number"
              step="any"
              value={startLat}
              onChange={(e) => setStartLat(e.target.value)}
              placeholder="40.8005"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
              Start Longitude *
            </label>
            <input
              type="number"
              step="any"
              value={startLng}
              onChange={(e) => setStartLng(e.target.value)}
              placeholder="-73.9420"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
              End Latitude *
            </label>
            <input
              type="number"
              step="any"
              value={endLat}
              onChange={(e) => setEndLat(e.target.value)}
              placeholder="40.8050"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
              End Longitude *
            </label>
            <input
              type="number"
              step="any"
              value={endLng}
              onChange={(e) => setEndLng(e.target.value)}
              placeholder="-73.9370"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              required
            />
          </div>
        </div>

        {/* Surface Type */}
        <div>
          <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
            Surface Type
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {SURFACE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSurface(opt.value)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                  surface === opt.value
                    ? "bg-violet-600 text-white border-violet-500"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600"
                }`}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Width */}
        <div>
          <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
            Width (meters)
          </label>
          <input
            type="number"
            step="0.1"
            min="0.5"
            max="10"
            value={widthMeters}
            onChange={(e) => setWidthMeters(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
        </div>

        {/* Grade */}
        <div>
          <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
            Grade / Slope (%)
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="100"
            value={gradePercentage}
            onChange={(e) => setGradePercentage(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
        </div>

        {/* Accessibility Features */}
        <div>
          <label className="block text-[11px] text-slate-400 uppercase font-bold mb-2">
            Accessibility Features
          </label>
          <div className="space-y-2">
            {[
              { state: hasRamp, setter: setHasRamp, label: "♿ Wheelchair Ramp", desc: "Ramp available for wheelchair access" },
              { state: hasTactilePaving, setter: setHasTactilePaving, label: "🟫 Tactile Paving", desc: "Tactile ground indicators for visually impaired" },
              { state: hasHandrails, setter: setHasHandrails, label: "🦯 Handrails", desc: "Handrails along the pathway" },
            ].map((feature) => (
              <label
                key={feature.label}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  feature.state
                    ? "bg-violet-950/30 border-violet-800"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={feature.state}
                  onChange={(e) => feature.setter(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    feature.state
                      ? "bg-violet-600 border-violet-500"
                      : "border-slate-600"
                  }`}
                >
                  {feature.state && (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  )}
                </div>
                <div>
                  <span className="text-[12px] text-white font-bold">
                    {feature.label}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {feature.desc}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-bold transition-colors"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Pathway for Review
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Report Issue Form ──────────────────────────────────────────────────

interface ReportIssueFormProps {
  routeId: string;
  pathwayId?: string;
  onClose: () => void;
}

const REPORT_TYPES = [
  { value: "obstacle", label: "New Obstacle", icon: "🚧" },
  { value: "facility-issue", label: "Facility Issue", icon: "⚠️" },
  { value: "route-blocked", label: "Route Blocked", icon: "🚫" },
  { value: "update", label: "Route Update", icon: "🔄" },
];

const SEVERITY_OPTIONS = [
  { value: "minor", label: "Minor", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "moderate", label: "Moderate", color: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: "severe", label: "Severe", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "blocking", label: "Blocking", color: "bg-red-100 text-red-800 border-red-300" },
];

export function ReportIssueForm({
  routeId,
  pathwayId,
  onClose,
}: ReportIssueFormProps) {
  const [reporterName, setReporterName] = useState("");
  const [reporterRole, setReporterRole] = useState("student");
  const [type, setType] = useState("obstacle");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [severity, setSeverity] = useState("moderate");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitMutation = useSubmitAccessibilityReport();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reporterName.trim() || !title.trim() || !description.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    try {
      await submitMutation.mutateAsync({
        reporterName: reporterName.trim(),
        reporterRole,
        pathwayId,
        routeId,
        type: type as "obstacle" | "facility-issue" | "route-blocked" | "update",
        title: title.trim(),
        description: description.trim(),
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        severity: severity as "minor" | "moderate" | "severe" | "blocking",
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit report.");
    }
  };

  if (success) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
        <div className="w-12 h-12 bg-emerald-900/50 border border-emerald-800 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-white">Report Submitted!</h3>
        <p className="text-sm text-slate-400 mt-2">
          Your accessibility report has been submitted and will be reviewed by
          the disability resource center.
        </p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Report Accessibility Issue</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-500 hover:text-white transition-colors"
          aria-label="Close form"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
              Your Name *
            </label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
              Your Role
            </label>
            <select
              value={reporterRole}
              onChange={(e) => setReporterRole(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            >
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="staff">Staff</option>
              <option value="disability-resource-center">Disability Resource Center</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Report Type */}
        <div>
          <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
            Issue Type *
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {REPORT_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                  type === opt.value
                    ? "bg-violet-600 text-white border-violet-500"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600"
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Broken elevator at Science Hall"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the accessibility issue in detail..."
            rows={3}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
            required
          />
        </div>

        {/* Severity */}
        <div>
          <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
            Severity
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {SEVERITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSeverity(opt.value)}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                  severity === opt.value
                    ? `${opt.color} border-current`
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Optional Location */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
              Latitude (optional)
            </label>
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="40.8050"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 uppercase font-bold mb-1">
              Longitude (optional)
            </label>
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="-73.9370"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-bold transition-colors"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Report
            </>
          )}
        </button>
      </form>
    </div>
  );
}
