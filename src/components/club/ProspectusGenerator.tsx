// src/components/club/ProspectusGenerator.tsx
//
// UI for clubs to configure and generate their sponsorship prospectus.

import { useEffect, useState } from "react";
import { FileText, Loader2, Download, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    fetchProspectusMetrics,
    downloadProspectus,
    type ProspectusMetrics,
} from "@/lib/prospectus";

interface ProspectusGeneratorProps {
    clubId: string;
}

export function ProspectusGenerator({ clubId }: ProspectusGeneratorProps) {
    const [metrics, setMetrics] = useState<ProspectusMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [pitchText, setPitchText] = useState("");
    const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
    const [primaryColor, setPrimaryColor] = useState("#6366f1");

    useEffect(() => {
        (async () => {
            const data = await fetchProspectusMetrics(clubId);
            if (data) {
                setMetrics(data);
                // Pre-select all tiers by default
                setSelectedTiers(data.tiers.map((t) => t.name));
            }
            setIsLoading(false);
        })();
    }, [clubId]);

    const handleToggleTier = (tierName: string) => {
        setSelectedTiers((prev) =>
            prev.includes(tierName)
                ? prev.filter((t) => t !== tierName)
                : [...prev, tierName]
        );
    };

    const handleGenerate = () => {
        if (!metrics) return;
        setIsGenerating(true);
        downloadProspectus(metrics, { pitchText, selectedTiers, primaryColor });
        setIsGenerating(false);
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center">
                <p className="text-slate-500">Failed to load club metrics.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-8">
            <header className="mb-8">
                <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-indigo-500" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Sponsorship Prospectus</h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Generate a branded PDF with your live club metrics.
                        </p>
                    </div>
                </div>
            </header>

            {/* Metrics Preview */}
            <div className="mb-6 grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-slate-200 p-4 text-center dark:border-slate-700">
                    <p className="text-2xl font-bold text-indigo-500">{metrics.member_count}</p>
                    <p className="text-xs text-slate-400">Members</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 text-center dark:border-slate-700">
                    <p className="text-2xl font-bold text-indigo-500">{metrics.event_count}</p>
                    <p className="text-xs text-slate-400">Events</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 text-center dark:border-slate-700">
                    <p className="text-2xl font-bold text-indigo-500">{metrics.avg_attendance}</p>
                    <p className="text-xs text-slate-400">Avg Attendance</p>
                </div>
            </div>

            {/* Configuration Form */}
            <div className="space-y-6 rounded-lg border border-slate-200 p-6 dark:border-slate-700">
                <div>
                    <Label htmlFor="pitch">Custom Pitch Text</Label>
                    <Textarea
                        id="pitch"
                        value={pitchText}
                        onChange={(e) => setPitchText(e.target.value)}
                        placeholder="Why should a sponsor support your club? What value do you offer?"
                        rows={4}
                    />
                </div>

                <div>
                    <Label htmlFor="color">Brand Color</Label>
                    <div className="flex items-center gap-3">
                        <Palette className="h-5 w-5 text-slate-400" />
                        <Input
                            id="color"
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="w-16 cursor-pointer p-1"
                        />
                        <span className="text-sm text-slate-500">{primaryColor}</span>
                    </div>
                </div>

                <div>
                    <Label>Sponsorship Tiers to Include</Label>
                    <div className="mt-2 space-y-2">
                        {metrics.tiers.length === 0 ? (
                            <p className="text-sm text-slate-400">No tiers configured for this club.</p>
                        ) : (
                            metrics.tiers.map((tier) => (
                                <div key={tier.name} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id={`tier-${tier.name}`}
                                        checked={selectedTiers.includes(tier.name)}
                                        onChange={() => handleToggleTier(tier.name)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor={`tier-${tier.name}`} className="text-sm">
                                        {tier.name} — ${(tier.price / 100).toFixed(2)}
                                    </label>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Generate Button */}
            <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="mt-6 w-full gap-2"
                size="lg"
            >
                {isGenerating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <Download className="h-5 w-5" />
                )}
                Generate & Download PDF
            </Button>
        </div>
    );
}
