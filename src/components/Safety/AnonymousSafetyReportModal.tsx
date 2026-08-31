/**
 * Anonymous Safety Report Modal
 * Enables students to quickly and anonymously report poor lighting, suspicious activity,
 * broken emergency callboxes, or physical hazards with geolocation tags.
 * Issue #4139
 */

import React, { useState } from 'react';
import {
  SafetyReportType,
  SafetySeverity,
  SafetyReportInput,
  GeoLocationPoint,
} from '../../types/campusSafety';
import {
  AlertCircle,
  EyeOff,
  MapPin,
  Send,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface AnonymousSafetyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitReport: (report: SafetyReportInput) => Promise<boolean>;
  selectedCoordinates?: GeoLocationPoint | null;
}

export const AnonymousSafetyReportModal: React.FC<
  AnonymousSafetyReportModalProps
> = ({ isOpen, onClose, onSubmitReport, selectedCoordinates }) => {
  const [reportType, setReportType] = useState<SafetyReportType>('poor_lighting');
  const [severity, setSeverity] = useState<SafetySeverity>('high');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const lat = selectedCoordinates?.latitude || 40.717;
    const lng = selectedCoordinates?.longitude || -74.007;

    const success = await onSubmitReport({
      latitude: lat,
      longitude: lng,
      report_type: reportType,
      severity,
      description,
      is_anonymous: isAnonymous,
    });

    setIsSubmitting(false);
    if (success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        setDescription('');
      }, 1400);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Report Campus Safety Hazard</h3>
              <p className="text-xs text-slate-400">
                Instantly updates the live walking heatmap for fellow students
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="font-semibold text-lg text-emerald-300">
              Safety Report Broadcasted
            </h4>
            <p className="text-xs text-slate-400">
              Walking routes are now automatically routing students away from this zone.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Coordinate Status */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
              <div className="flex items-center space-x-2 text-slate-300">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>
                  Location: {selectedCoordinates?.latitude.toFixed(4) || '40.7170'},{' '}
                  {selectedCoordinates?.longitude.toFixed(4) || '-74.0070'}
                </span>
              </div>
              <span className="text-slate-400">(Selected Pin)</span>
            </div>

            {/* Report Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Hazard Category
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as SafetyReportType)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="poor_lighting">Poor / Broken Lighting</option>
                <option value="suspicious_activity">Suspicious Activity / Loitering</option>
                <option value="harassment">Harassment / Unsafe Encounter</option>
                <option value="emergency_callbox_broken">Broken Blue-Light Emergency Callbox</option>
                <option value="isolated_pathway">Isolated / Obstructed Blindspot Pathway</option>
                <option value="physical_hazard">Physical Obstruction / Construction Hazard</option>
                <option value="theft_incident">Theft / Break-in Incident</option>
              </select>
            </div>

            {/* Severity */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Hazard Severity Level
              </label>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {(['low', 'medium', 'high', 'critical'] as SafetySeverity[]).map(
                  (lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSeverity(lvl)}
                      className={`py-2 rounded-xl capitalize font-medium border transition ${
                        severity === lvl
                          ? lvl === 'critical'
                            ? 'bg-rose-600 text-white border-rose-500'
                            : lvl === 'high'
                            ? 'bg-orange-600 text-white border-orange-500'
                            : lvl === 'medium'
                            ? 'bg-amber-600 text-white border-amber-500'
                            : 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {lvl}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Incident Details (Optional)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Streetlight #4 completely out near the chemistry building walkway, dark trees blocking visibility."
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Anonymous Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs">
              <div className="flex items-center space-x-2">
                <EyeOff className="w-4 h-4 text-emerald-400" />
                <span className="font-medium">Submit Anonymously</span>
              </div>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center space-x-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Transmitting...' : 'Post Hazard Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
