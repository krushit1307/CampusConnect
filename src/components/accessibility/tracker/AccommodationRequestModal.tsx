import React, { useState } from "react";
import {
  AccommodationCategory,
  UrgencyLevel,
} from "@/types/accessibilityFulfillment";
import {
  CATEGORY_CONFIGS,
  accessibilityFulfillmentService,
} from "@/services/accessibilityFulfillmentService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accessibility,
  Ear,
  Eye,
  Brain,
  Armchair,
  Flame,
  Clock,
  Sparkles,
  CheckCircle,
} from "lucide-react";

interface AccommodationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated: (requestId: string) => void;
}

const CATEGORY_ICONS: Record<AccommodationCategory, React.ElementType> = {
  mobility: Accessibility,
  auditory: Ear,
  visual: Eye,
  cognitive: Brain,
  spatial: Armchair,
};

export const AccommodationRequestModal: React.FC<AccommodationRequestModalProps> = ({
  isOpen,
  onClose,
  onRequestCreated,
}) => {
  const [category, setCategory] = useState<AccommodationCategory>("mobility");
  const [accommodationType, setAccommodationType] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [eventOrLocation, setEventOrLocation] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("medium");
  const [notes, setNotes] = useState("");
  const [studentName, setStudentName] = useState("Rushabh Mahajan");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!accommodationType || !buildingName) return;

    const newReq = accessibilityFulfillmentService.createRequest({
      studentId: `user-${Date.now()}`,
      studentName,
      category,
      accommodationType,
      eventOrLocation: eventOrLocation || "Main Campus Event",
      buildingName,
      roomNumber,
      urgency,
      notes,
    });

    onRequestCreated(newReq.id);
    onClose();

    // Reset form
    setAccommodationType("");
    setBuildingName("");
    setRoomNumber("");
    setEventOrLocation("");
    setUrgency("medium");
    setNotes("");
  };

  const selectedCategoryConfig = CATEGORY_CONFIGS.find((c) => c.id === category);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl border-slate-800 bg-slate-950 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-blue-400" />
            Request Accessibility Accommodation
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Submit a real-time accessibility accommodation request for immediate campus dispatch & Domino's tracker tracking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 my-2">
          {/* Step 1: Category Tile Selector */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              1. Accommodation Category
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORY_CONFIGS.map((cat) => {
                const IconComp = CATEGORY_ICONS[cat.id];
                const isSelected = category === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id);
                      if (!accommodationType) {
                        setAccommodationType(cat.examples[0] || "");
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/15 text-blue-300 shadow-md ring-2 ring-blue-500/30"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <IconComp className={`h-5 w-5 mb-1.5 ${isSelected ? "text-blue-400" : "text-slate-500"}`} />
                    <span className="text-xs font-semibold leading-snug">{cat.name.split("&")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Example Pills */}
          {selectedCategoryConfig && (
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-semibold mr-1">Popular Quick Picks:</span>
              {selectedCategoryConfig.examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setAccommodationType(ex)}
                  className={`text-[11px] px-2 py-0.5 rounded-md border transition-all ${
                    accommodationType === ex
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Specific Need Title */}
          <div>
            <Label htmlFor="accommodationType" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Specific Accommodation Requested *
            </Label>
            <Input
              id="accommodationType"
              required
              placeholder="e.g. Portable Wheelchair Ramp, Live ASL Interpreter, Quiet Space"
              value={accommodationType}
              onChange={(e) => setAccommodationType(e.target.value)}
              className="mt-1.5 border-slate-800 bg-slate-900 text-white text-sm"
            />
          </div>

          {/* Step 3: Location Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="buildingName" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Building / Venue *
              </Label>
              <Input
                id="buildingName"
                required
                placeholder="e.g. Science Complex Hall B"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                className="mt-1.5 border-slate-800 bg-slate-900 text-white text-sm"
              />
            </div>

            <div>
              <Label htmlFor="roomNumber" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Room / Gate / Seat
              </Label>
              <Input
                id="roomNumber"
                placeholder="e.g. Auditorium 101 or Gate 4"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="mt-1.5 border-slate-800 bg-slate-900 text-white text-sm"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="eventOrLocation" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Event / Course Name
            </Label>
            <Input
              id="eventOrLocation"
              placeholder="e.g. Spring Tech Symposium or CS 101 Lecture"
              value={eventOrLocation}
              onChange={(e) => setEventOrLocation(e.target.value)}
              className="mt-1.5 border-slate-800 bg-slate-900 text-white text-sm"
            />
          </div>

          {/* Step 4: Urgency Selector */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
              Urgency Level
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {(["low", "medium", "high", "immediate"] as UrgencyLevel[]).map((u) => {
                const isSelected = urgency === u;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgency(u)}
                    className={`py-1.5 rounded-lg border text-xs font-bold capitalize transition-all ${
                      isSelected
                        ? u === "immediate"
                          ? "bg-red-500 text-white border-red-400 shadow-md animate-pulse"
                          : u === "high"
                          ? "bg-amber-500 text-slate-950 border-amber-400"
                          : "bg-blue-600 text-white border-blue-500"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {u === "immediate" && <Flame className="h-3 w-3 inline mr-1" />}
                    {u}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <Label htmlFor="notes" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Special Notes / Instructions
            </Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Any specific access requirements, sightline needs, or door entrance directions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 border-slate-800 bg-slate-900 text-white text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-800 text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5"
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Submit Request & Start Tracker
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
