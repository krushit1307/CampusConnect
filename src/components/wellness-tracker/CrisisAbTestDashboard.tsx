import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, BarChart2, CheckCircle2, PieChart } from "lucide-react";

interface Variant {
  id: string;
  name: string;
  payload: { title: string; copy: string; cta: string; url: string; color: string };
  impressions: number;
  conversions: number;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  target_impressions: number;
  is_active: boolean;
  winner_variant_id: string | null;
  variants: Variant[];
}

export function CrisisAbTestDashboard() {
  const supabase = createClient();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTest() {
      const { data: expData, error: expError } = await supabase
        .from("ab_test_experiments")
        .select(`
          id, name, description, target_impressions, is_active, winner_variant_id,
          variants:ab_test_variants (id, name, payload, impressions, conversions)
        `)
        .eq("name", "Crisis Banner Copy Test")
        .single();

      if (!expError && expData) {
        setExperiment(expData as unknown as Experiment);
      }
      setLoading(false);
    }
    
    void loadTest();
  }, [supabase]);

  if (loading) return <div className="p-4 font-mono">Loading A/B Test Metrics...</div>;
  if (!experiment) return <div className="p-4 font-mono">No active crisis A/B tests found.</div>;

  const totalImpressions = experiment.variants.reduce((acc, v) => acc + v.impressions, 0);
  const targetReached = totalImpressions >= experiment.target_impressions;

  return (
    <div className="bg-white border-2 border-black p-6 neu-shadow-sm mb-8">
      <div className="flex items-center gap-3 mb-6 border-b-2 border-black pb-4">
        <BarChart2 className="w-8 h-8" />
        <div>
          <h2 className="text-2xl font-black uppercase font-display">{experiment.name}</h2>
          <p className="font-mono text-sm text-gray-600">{experiment.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {experiment.variants.map((variant) => {
          const ctr = variant.impressions > 0 
            ? ((variant.conversions / variant.impressions) * 100).toFixed(1) 
            : "0.0";
            
          const isWinner = experiment.winner_variant_id === variant.id || (targetReached && totalImpressions > 0 && 
              variant.conversions / (variant.impressions || 1) === Math.max(...experiment.variants.map(v => v.conversions / (v.impressions || 1))));

          return (
            <div 
              key={variant.id} 
              className={`border-2 border-black p-4 relative ${isWinner ? "bg-green-50" : "bg-gray-50"}`}
            >
              {isWinner && (
                <div className="absolute -top-3 -right-3 bg-green-400 text-black border-2 border-black px-2 py-1 text-xs font-bold flex items-center gap-1 uppercase">
                  <CheckCircle2 className="w-3 h-3" /> Winner
                </div>
              )}
              
              <h3 className="font-bold font-mono uppercase mb-2 border-b-2 border-black/10 pb-2">
                {variant.name}
              </h3>
              
              <div className="space-y-3 font-mono text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Impressions:</span>
                  <span className="font-bold">{variant.impressions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Clicks (Conversion):</span>
                  <span className="font-bold">{variant.conversions}</span>
                </div>
                <div className="flex justify-between bg-black text-white p-1">
                  <span>CTR:</span>
                  <span className="font-bold">{ctr}%</span>
                </div>
              </div>

              <div className="mt-4 border-2 border-dashed border-black/30 p-3 bg-white">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Preview Payload</p>
                <div className={`border-l-4 p-2 ${variant.payload.color === 'red' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'}`}>
                  <p className="font-bold text-sm">{variant.payload.title}</p>
                  <p className="text-xs mt-1">{variant.payload.copy}</p>
                  <button className="mt-2 text-xs font-bold underline bg-black text-white px-2 py-1">
                    {variant.payload.cta}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t-2 border-black pt-4 flex items-center justify-between font-mono text-sm">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4" />
          <span>Progress to Statistical Significance:</span>
        </div>
        <div className="flex-1 mx-4 h-4 border-2 border-black bg-gray-200 overflow-hidden relative">
          <div 
            className="h-full bg-blue-400 border-r-2 border-black"
            style={{ width: `${Math.min(100, (totalImpressions / experiment.target_impressions) * 100)}%` }}
          />
        </div>
        <span className="font-bold">
          {totalImpressions} / {experiment.target_impressions}
        </span>
      </div>
      
      {targetReached && !experiment.winner_variant_id && (
        <div className="mt-4 p-3 bg-yellow-100 border-2 border-black font-mono text-sm font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Target impressions reached! Awaiting health administrator final review to lock winner.
        </div>
      )}
    </div>
  );
}
