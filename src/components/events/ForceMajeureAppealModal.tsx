import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CloudRain,
  Scale,
  ShieldAlert,
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ForceMajeureAppealModalProps {
  cancellationId: string;
  onSuccess?: () => void;
}

export const ForceMajeureAppealModal: React.FC<ForceMajeureAppealModalProps> = ({
  cancellationId,
  onSuccess,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ status: string; rationale: string; weather: any } | null>(
    null,
  );

  const { toast } = useToast();
  const supabase = createClient();

  const handleSubmit = async () => {
    if (!appealText.trim()) {
      toast({ title: "Explanation required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Insert the appeal record
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data: appealRecord, error: insertErr } = await supabase
        .from("force_majeure_appeals")
        .insert({
          cancellation_id: cancellationId,
          organizer_id: userId,
          appeal_text: appealText,
        })
        .select()
        .single();

      if (insertErr || !appealRecord) throw insertErr || new Error("Failed to create appeal");

      // 2. Autonomously invoke the Edge Function to run NOAA + LLM
      toast({
        title: "Analyzing Appeal",
        description: "Querying NOAA Severe Weather API and validating contract...",
      });

      const { data: evalData, error: evalErr } = await supabase.functions.invoke(
        "force-majeure-validator",
        {
          body: { appeal_id: appealRecord.id },
        },
      );

      if (evalErr) throw evalErr;

      setResult({
        status: evalData.status,
        rationale: evalData.llmResult.rationale,
        weather: evalData.weatherOracleData,
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Appeal Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(val) => {
        setIsOpen(val);
        if (!val) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white font-mono uppercase tracking-wider text-xs h-10"
        >
          <Scale className="mr-2 h-4 w-4 text-indigo-400" />
          Appeal: Force Majeure
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] bg-slate-950 border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black text-white">
            <ShieldAlert className="h-6 w-6 text-indigo-500" />
            Force Majeure Appeal
          </DialogTitle>
          <DialogDescription className="text-slate-400 font-mono text-xs leading-relaxed pt-2">
            Warning: Legal escape clauses are rigorously and neutrally evaluated against empirical
            reality. All claims are verified against the{" "}
            <strong className="text-indigo-400">NOAA Severe Weather API</strong> and standard
            contract definitions.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Explanation of Impossible Circumstances
              </label>
              <Textarea
                placeholder="Describe exactly why the event was impossible (e.g. 'Severe flooding made the venue inaccessible...')"
                className="min-h-[120px] bg-slate-900 border-slate-800 text-slate-200 focus:border-indigo-500"
                value={appealText}
                onChange={(e) => setAppealText(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-4">
              <h4 className="text-sm font-bold text-indigo-400 mb-2">
                Automated Arbitration Process
              </h4>
              <ul className="text-xs text-indigo-300/80 space-y-2 list-disc list-inside">
                <li>We fetch exact GPS weather data at the time of cancellation.</li>
                <li>An AI legal oracle cross-references the weather with your Vendor Contract.</li>
                <li>
                  If the claim is frivolous (e.g., a light rain puddle), the 20% penalty remains.
                </li>
              </ul>
            </div>

            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !appealText.trim()}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-wider"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching Oracles...
                  </>
                ) : (
                  "Submit Legal Appeal"
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div
              className={`p-6 rounded-xl border-2 flex flex-col items-center justify-center text-center ${
                result.status === "APPROVED"
                  ? "bg-emerald-950/30 border-emerald-500/50"
                  : "bg-red-950/30 border-red-500/50"
              }`}
            >
              {result.status === "APPROVED" ? (
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
              ) : (
                <XCircle className="h-16 w-16 text-red-500 mb-4" />
              )}

              <h3
                className={`text-2xl font-black uppercase tracking-tight mb-2 ${
                  result.status === "APPROVED" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                Appeal {result.status}
              </h3>

              <p className="text-slate-300 font-mono text-sm leading-relaxed max-w-md">
                {result.rationale}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-3">
                <CloudRain className="h-4 w-4" />
                NOAA Oracle Telemetry
              </h4>
              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div>
                  <div className="text-slate-500">Source</div>
                  <div className="text-indigo-400">{result.weather?.source}</div>
                </div>
                <div>
                  <div className="text-slate-500">Conditions</div>
                  <div className="text-white">{result.weather?.textDescription}</div>
                </div>
                <div>
                  <div className="text-slate-500">Rain (Last Hr)</div>
                  <div className="text-white">{result.weather?.precipitationLastHour_mm} mm</div>
                </div>
                <div>
                  <div className="text-slate-500">Wind</div>
                  <div className="text-white">{result.weather?.windSpeed_kmh} km/h</div>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setIsOpen(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
