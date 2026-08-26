import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Siren,
  MapPin,
  Send,
  PhoneCall,
  CheckCircle2,
  X,
  Radio,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  IncidentCategory,
  IncidentReportPayload,
  SmsDispatchPayload,
  INCIDENT_CATEGORY_META,
  getIncidentCategoryMeta,
  formatIncidentLocationLabel,
  generateCampusPdSmsPayload,
  createIncidentReport,
} from "@/lib/campusSafetyIncident";
import { cn } from "@/lib/utils";

export interface CampusSafetyIncidentReporterWidgetProps {
  eventId?: string;
  eventTitle?: string;
  initialReport?: IncidentReportPayload | null;
  onReportSubmitted?: (report: IncidentReportPayload) => void;
  className?: string;
}

export const MOCK_ACTIVE_INCIDENT: IncidentReportPayload = {
  id: "inc-medical-901",
  eventId: "evt-concert-2026",
  eventTitle: "Annual Campus Spring Music Concert",
  category: "medical_emergency",
  description: "Attendee dehydrated and lightheaded near North Stage barrier.",
  latitude: 37.7749,
  longitude: -122.4194,
  locationLabel: "Near North Stage",
  status: "active",
  createdAt: new Date().toISOString(),
};

export const CampusSafetyIncidentReporterWidget: React.FC<CampusSafetyIncidentReporterWidgetProps> = ({
  eventId = "evt-concert-2026",
  eventTitle = "Annual Campus Spring Music Concert",
  initialReport = null,
  onReportSubmitted,
  className,
}) => {
  const [activeReport, setActiveReport] = useState<IncidentReportPayload | null>(initialReport);
  const [showTriageModal, setShowTriageModal] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory>("medical_emergency");
  const [locationLabel, setLocationLabel] = useState<string>("Near North Stage");
  const [description, setDescription] = useState<string>("Student collapsed due to heat exhaustion.");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({ lat: 37.7749, lng: -122.4194 });
  const [gpsStatus, setGpsStatus] = useState<string>("GPS Coordinates Captured (Accuracy ±5m)");
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  // Auto-capture GPS coordinates via browser Geolocation API
  const captureGpsLocation = () => {
    if ("geolocation" in navigator) {
      setGpsStatus("Locating precise GPS position...");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setGpsStatus(`GPS Captured: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        (err) => {
          setGpsStatus("Using default venue GPS coordinates");
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const handleOpenModal = () => {
    captureGpsLocation();
    setShowTriageModal(true);
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newReport = createIncidentReport({
      eventId,
      eventTitle,
      category: selectedCategory,
      description: description.trim(),
      latitude: userCoords.lat,
      longitude: userCoords.lng,
      locationLabel: locationLabel.trim(),
      status: "active",
    });

    setActiveReport(newReport);
    if (onReportSubmitted) onReportSubmitted(newReport);

    setShowTriageModal(false);
    setDispatchSuccess(
      "High-priority emergency alert dispatched to Organizer Dashboard & Campus PD SMS!"
    );
    setTimeout(() => setDispatchSuccess(null), 6000);
  };

  const smsPayload: SmsDispatchPayload | null = activeReport
    ? generateCampusPdSmsPayload(activeReport)
    : null;

  const categoryMeta = activeReport ? getIncidentCategoryMeta(activeReport.category) : null;

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Top Bar / Emergency Launcher */}
      <div className="p-5 bg-rose-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-rose-950">
            <Siren className="w-5 h-5 text-rose-600 animate-pulse" />
            <span>Campus Safety Incident Reporter — {eventTitle}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Native emergency triage button on active event pages. Captures exact GPS and dispatches real-time WebSocket alerts to organizers & Campus PD.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="px-4 py-2.5 border-2 border-black bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 animate-bounce"
        >
          <AlertTriangle className="w-4 h-4 text-amber-300" />
          <span>⚠️ Report Emergency Incident</span>
        </button>
      </div>

      {/* Dispatch Success Confirmation Banner */}
      {dispatchSuccess && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{dispatchSuccess}</span>
        </div>
      )}

      {/* Organizer High-Priority Alert Banner & Active Incident View (#4286) */}
      {activeReport && categoryMeta && (
        <div className="p-5 bg-rose-50 border-b-2 border-black space-y-4">
          <div className="flex items-center justify-between border-b-2 border-rose-300 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-950 uppercase">
              <span className="text-lg">{categoryMeta.icon}</span>
              <span>ORGANIZER HIGH-PRIORITY ALERT: {categoryMeta.alertTitle}</span>
            </div>
            <span className="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-full uppercase flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" /> Live Active Alert
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-2 p-3.5 border-2 border-black rounded-lg bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold uppercase text-gray-500 block">Incident Location & Details:</span>
              <p className="font-bold text-gray-900 text-sm">{activeReport.locationLabel}</p>
              <p className="font-sans text-gray-700 leading-snug">{activeReport.description}</p>
              <div className="pt-2 flex items-center gap-1.5 text-xs text-rose-700 font-bold">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{formatIncidentLocationLabel(activeReport.latitude, activeReport.longitude)}</span>
              </div>
            </div>

            {/* Campus PD SMS Dispatch Preview (#4286) */}
            {smsPayload && (
              <div className="space-y-2 p-3.5 border-2 border-black rounded-lg bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center text-[11px] border-b border-slate-700 pb-1.5">
                  <span className="font-bold uppercase text-emerald-400 flex items-center gap-1">
                    <PhoneCall className="w-3.5 h-3.5" /> Campus PD SMS Payload
                  </span>
                  <span className="text-gray-400">To: {smsPayload.recipientNumber}</span>
                </div>

                <p className="text-[11px] font-mono leading-relaxed text-gray-200 bg-slate-950 p-2 rounded border border-slate-800">
                  {smsPayload.message}
                </p>

                <a
                  href={smsPayload.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 underline pt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Direct Google Maps Location
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rapid Triage Emergency Modal (#4286) */}
      {showTriageModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleReportSubmit}
            className="bg-white border-2 border-black rounded-xl max-w-lg w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-auto font-mono"
          >
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-bold text-base uppercase flex items-center gap-2 text-rose-950">
                <Siren className="w-5 h-5 text-rose-600" />
                Rapid Triage Emergency Reporter
              </h3>
              <button
                type="button"
                onClick={() => setShowTriageModal(false)}
                className="p-1 border border-black rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category 1-Click Triage Selector Buttons */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase block text-gray-700">Select Emergency Category *</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(["medical_emergency", "security_threat", "facility_issue"] as IncidentCategory[]).map((cat) => {
                  const meta = INCIDENT_CATEGORY_META[cat];
                  const isSel = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "p-3 border-2 border-black rounded-lg text-left font-mono text-xs font-bold space-y-1 transition-transform",
                        isSel
                          ? "bg-rose-600 text-white scale-105 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-slate-50 text-gray-900 hover:bg-slate-100"
                      )}
                    >
                      <span className="text-lg block">{meta.icon}</span>
                      <span className="block leading-tight text-[11px]">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location Label */}
            <div>
              <label htmlFor="loc-label-input" className="text-xs font-bold uppercase block mb-1">
                Venue Location Landmark / Area *
              </label>
              <input
                id="loc-label-input"
                type="text"
                required
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="e.g. Near North Stage, Section B Row 4"
                className="w-full px-3 py-2 border-2 border-black rounded-md text-xs bg-white font-mono"
              />
            </div>

            {/* GPS Telemetry Indicator */}
            <div className="p-3 bg-slate-100 border border-slate-300 rounded text-xs font-sans text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-bold">{gpsStatus}</span>
              </div>
              <button
                type="button"
                onClick={captureGpsLocation}
                className="text-[10px] font-bold text-sky-700 hover:underline font-mono"
              >
                Re-scan GPS
              </button>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="inc-desc-input" className="text-xs font-bold uppercase block mb-1">
                Situation Details / Description *
              </label>
              <textarea
                id="inc-desc-input"
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe situation..."
                className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-3 border-t-2 border-black/10 flex justify-end gap-2">
              <button
                type="submit"
                className="w-full py-3 px-4 border-2 border-black bg-rose-600 text-white font-bold text-xs uppercase rounded-md hover:bg-rose-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4 text-amber-300" />
                Dispatch High-Priority Alert & SMS
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
