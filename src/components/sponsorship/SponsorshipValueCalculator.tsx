import { useMemo, useState } from "react";
import { BarChart3, Check, DollarSign, Info, Target } from "lucide-react";
import {
  calculateSponsorshipValue,
  formatSponsorshipCurrency,
  parseSponsorshipOverride,
} from "@/lib/sponsorshipValuation";

interface SponsorshipValueCalculatorProps {
  averageAttendance: number;
  appImpressions: number;
  targetedAudiencePercent?: number;
  initialOverride?: number | null;
  onOverrideChange?: (value: number) => void;
}

export function SponsorshipValueCalculator({
  averageAttendance,
  appImpressions,
  targetedAudiencePercent = 80,
  initialOverride = null,
  onOverrideChange,
}: SponsorshipValueCalculatorProps) {
  const valuation = useMemo(
    () =>
      calculateSponsorshipValue({
        averageAttendance,
        appImpressions,
        targetedAudiencePercent,
      }),
    [averageAttendance, appImpressions, targetedAudiencePercent],
  );
  const [override, setOverride] = useState<number | null>(initialOverride);
  const publishedPrice = override ?? valuation.suggestedPrice;
  const gaugeRange = Math.max(valuation.rangeHigh, valuation.suggestedPrice * 1.5, 1);
  const gaugePercent = Math.min(100, Math.max(0, (publishedPrice / gaugeRange) * 100));

  const handleOverride = (value: string) => {
    const parsed = parseSponsorshipOverride(value, valuation.suggestedPrice);
    setOverride(parsed);
    onOverrideChange?.(parsed);
  };

  const clearOverride = () => {
    setOverride(null);
    onOverrideChange?.(valuation.suggestedPrice);
  };

  return (
    <section
      className="neu-border bg-indigo-50 p-5 shadow-[4px_4px_0_0_#000]"
      aria-labelledby="sponsorship-value-title"
    >
      <div className="flex flex-col gap-3 border-b-2 border-black pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-indigo-800">
            <Target className="h-4 w-4" /> Evidence-based pricing
          </p>
          <h3
            id="sponsorship-value-title"
            className="mt-1 font-display text-2xl font-black uppercase"
          >
            Sponsorship value calculator
          </h3>
          <p className="mt-2 max-w-2xl font-mono text-xs leading-5 text-indigo-950/75">
            A transparent CPM estimate turns your historical reach into a defensible sponsorship
            ask. You can override the recommendation before publishing an RFP.
          </p>
        </div>
        <BarChart3 className="h-8 w-8 shrink-0 text-indigo-800" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
        <div className="flex flex-col items-center">
          <div
            className="relative flex h-40 w-40 items-center justify-center rounded-full border-4 border-black"
            style={{
              background: `conic-gradient(#4f46e5 ${gaugePercent * 3.6}deg, #c7d2fe ${gaugePercent * 3.6}deg 360deg)`,
            }}
            role="img"
            aria-label={`Sponsorship price gauge at ${formatSponsorshipCurrency(publishedPrice)}`}
          >
            <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border-2 border-black bg-white text-center">
              <DollarSign className="h-5 w-5 text-indigo-700" />
              <strong className="font-display text-2xl font-black">
                {formatSponsorshipCurrency(publishedPrice)}
              </strong>
              <span className="font-mono text-[9px] font-bold uppercase text-gray-500">
                publishable ask
              </span>
            </div>
          </div>
          <p className="mt-3 text-center font-mono text-[11px] text-indigo-950">
            Suggested range: <strong>{formatSponsorshipCurrency(valuation.rangeLow)}</strong>–
            <strong>{formatSponsorshipCurrency(valuation.rangeHigh)}</strong>
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Avg attendance" value={averageAttendance.toLocaleString()} />
            <Metric label="App impressions" value={appImpressions.toLocaleString()} />
            <Metric label="Targeted audience" value={`${Math.round(targetedAudiencePercent)}%`} />
          </div>

          <div className="border-2 border-indigo-900 bg-white p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
              <p className="font-mono text-xs leading-5 text-gray-700">
                {valuation.qualifiedImpressions.toLocaleString()} qualified impressions at a ${50}{" "}
                CPM, adjusted by a {valuation.demographicMultiplier}× targeted-audience multiplier.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label
                htmlFor="sponsorship-price-override"
                className="mb-1 block font-mono text-xs font-black uppercase"
              >
                Manual RFP price override
              </label>
              <div className="flex items-center gap-2">
                <span className="border-2 border-black bg-gray-100 px-3 py-2 font-mono text-sm">
                  $
                </span>
                <input
                  id="sponsorship-price-override"
                  type="number"
                  min="0"
                  step="5"
                  value={override ?? valuation.suggestedPrice}
                  onChange={(event) => handleOverride(event.target.value)}
                  className="neu-border w-full p-2 font-mono text-sm font-bold"
                  aria-describedby="sponsorship-override-help"
                />
              </div>
              <p
                id="sponsorship-override-help"
                className="mt-1 font-mono text-[10px] text-gray-600"
              >
                Prices are rounded to the nearest $5 for a clean sponsor-facing ask.
              </p>
            </div>
            {override !== null ? (
              <button
                type="button"
                onClick={clearOverride}
                className="neu-border flex items-center justify-center gap-2 bg-white px-3 py-2 font-mono text-xs font-black uppercase"
              >
                Reset suggestion
              </button>
            ) : (
              <span className="flex items-center justify-center gap-1 px-2 py-2 font-mono text-[10px] font-black uppercase text-indigo-800">
                <Check className="h-4 w-4" /> Algorithm applied
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-black bg-white p-3">
      <span className="block font-mono text-[10px] font-bold uppercase text-gray-500">{label}</span>
      <strong className="mt-1 block font-display text-xl font-black text-indigo-950">
        {value}
      </strong>
    </div>
  );
}
