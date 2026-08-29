import React, { useState } from "react";
import { SponsorAbTest, VariantType, AbTestEvaluationResult } from "../../types/sponsorAbTesting";
import { sponsorAbTestingService } from "../../services/sponsorAbTestingService";

interface SponsorAbTestingDashboardProps {
  test: SponsorAbTest;
  onTestUpdated?: (updatedTest: SponsorAbTest) => void;
}

export const SponsorAbTestingDashboard: React.FC<SponsorAbTestingDashboardProps> = ({
  test: initialTest,
  onTestUpdated,
}) => {
  const [test, setTest] = useState<SponsorAbTest>(initialTest);
  const [evaluation, setEvaluation] = useState<AbTestEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const progressPercent = Math.min(
    100,
    Math.round((test.totalImpressions / test.config.sampleThreshold) * 100),
  );

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      const result = await sponsorAbTestingService.evaluateAndPromoteWinner(test.id);
      setEvaluation(result);
      const updated = await sponsorAbTestingService.getTestById(test.id);
      if (updated) {
        setTest(updated);
        onTestUpdated?.(updated);
      }
    } catch (err) {
      console.error("Error evaluating test:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSetManualWinner = async (winner: VariantType) => {
    const updated = await sponsorAbTestingService.setManualWinner(test.id, winner);
    setTest(updated);
    onTestUpdated?.(updated);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">{test.title}</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                test.status === "CONCLUDED"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {test.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Sponsor: <span className="font-medium text-foreground">{test.sponsorName}</span> | Event
            ID: <span className="font-mono text-xs">{test.eventId}</span>
          </p>
        </div>

        <button
          onClick={handleEvaluate}
          disabled={isEvaluating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isEvaluating ? "Evaluating CTR..." : "Run Statistical Evaluation"}
        </button>
      </div>

      {/* Sample Threshold Progress */}
      <div className="rounded-xl bg-muted/40 p-4 border border-border">
        <div className="flex justify-between text-sm font-medium mb-2">
          <span>Testing Sample Progress</span>
          <span>
            {test.totalImpressions} / {test.config.sampleThreshold} Impressions ({progressPercent}%)
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full transition-all duration-500 ${
              progressPercent >= 100 ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {progressPercent >= 100
            ? "✅ Minimum statistical threshold reached. Winning variant receives 100% traffic allocation."
            : `⏳ Traffic is split 50/50 between Logo A and Logo B until ${test.config.sampleThreshold} impressions.`}
        </p>
      </div>

      {/* Side-by-Side Variant Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Variant A */}
        <div
          className={`relative rounded-xl border p-5 transition-all ${
            test.winningVariant === "LOGO_A"
              ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20"
              : "border-border bg-card"
          }`}
        >
          {test.winningVariant === "LOGO_A" && (
            <div className="absolute top-3 right-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-white shadow">
              🏆 WINNER (100% Traffic)
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              A
            </span>
            <h3 className="font-semibold text-foreground">Variant A (Control)</h3>
          </div>

          <div className="mt-4 flex h-24 items-center justify-center rounded-lg border border-border/60 bg-white p-3">
            <img
              src={test.variantA.logoUrl}
              alt={test.variantA.altText}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Impressions</div>
              <div className="text-base font-bold">{test.metricsA.impressions}</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Clicks</div>
              <div className="text-base font-bold">{test.metricsA.clicks}</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">CTR</div>
              <div className="text-base font-bold text-primary">
                {test.metricsA.ctr.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => handleSetManualWinner("LOGO_A")}
              className="text-xs text-muted-foreground hover:text-foreground font-medium underline"
            >
              Promote Variant A Manually
            </button>
          </div>
        </div>

        {/* Variant B */}
        <div
          className={`relative rounded-xl border p-5 transition-all ${
            test.winningVariant === "LOGO_B"
              ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20"
              : "border-border bg-card"
          }`}
        >
          {test.winningVariant === "LOGO_B" && (
            <div className="absolute top-3 right-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-white shadow">
              🏆 WINNER (100% Traffic)
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              B
            </span>
            <h3 className="font-semibold text-foreground">Variant B (Challenger)</h3>
          </div>

          <div className="mt-4 flex h-24 items-center justify-center rounded-lg border border-border/60 bg-white p-3">
            <img
              src={test.variantB.logoUrl}
              alt={test.variantB.altText}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Impressions</div>
              <div className="text-base font-bold">{test.metricsB.impressions}</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Clicks</div>
              <div className="text-base font-bold">{test.metricsB.clicks}</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">CTR</div>
              <div className="text-base font-bold text-primary">
                {test.metricsB.ctr.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => handleSetManualWinner("LOGO_B")}
              className="text-xs text-muted-foreground hover:text-foreground font-medium underline"
            >
              Promote Variant B Manually
            </button>
          </div>
        </div>
      </div>

      {/* Evaluation Results Banner */}
      {evaluation && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Statistical Significance Report</span>
            <span className="text-xs font-mono">
              Confidence: {evaluation.confidencePercent}% (Z-Score: {evaluation.zScore})
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            CTR Delta: <strong className="text-foreground">{evaluation.ctrDifference}%</strong> |
            Recommended Winner:{" "}
            <strong className="text-foreground">{evaluation.recommendedWinner}</strong> | Action:{" "}
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
              {evaluation.actionTaken}
            </span>
          </p>
        </div>
      )}
    </div>
  );
};
