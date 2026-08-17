import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Boxes, CalendarClock, PiggyBank } from "lucide-react";
import { clubAssetService, type AssetPlanningView } from "@/services/clubAssetService";
import type { AssetCondition } from "@/lib/assetDepreciation";

interface AssetRegisterPanelProps {
  clubId: string;
  /** Overrides today's date, used by the year-end preview. */
  asOf?: string;
}

const CONDITION_STYLES: Record<AssetCondition, string> = {
  excellent: "bg-lime",
  good: "bg-white",
  fair: "bg-yellow-100",
  poor: "bg-peach",
};

const METHOD_LABELS: Record<string, string> = {
  straight_line: "Straight line",
  declining_balance: "Declining balance",
  units_of_production: "Units of production",
};

function formatCents(cents: number): string {
  const dollars = Math.floor(Math.abs(cents) / 100).toLocaleString("en-US");
  const remainder = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}$${dollars}.${remainder}`;
}

/**
 * Officer view of the club's capital kit: what it is worth today, what has to
 * be replaced and when, and how much has to be set aside each period to afford
 * it. The point is that the lighting desk stops being a surprise.
 */
export function AssetRegisterPanel({ clubId, asOf }: AssetRegisterPanelProps) {
  const [view, setView] = useState<AssetPlanningView | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setView(await clubAssetService.getPlanningView(clubId, asOf));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the asset register");
    } finally {
      setLoading(false);
    }
  }, [clubId, asOf]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSnapshot = async () => {
    try {
      const count = await clubAssetService.snapshotRegister(clubId, asOf);
      toast.success(
        count === 0
          ? "There is nothing on the register to snapshot."
          : `Froze book values for ${count} asset${count === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the snapshot");
    }
  };

  if (loading) {
    return <div className="neu-border h-40 animate-pulse bg-white" />;
  }

  if (!view || view.rows.length === 0) {
    return (
      <div className="neu-border bg-white p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Boxes className="h-5 w-5" /> Asset register
        </h2>
        <p className="mt-3 font-mono text-sm text-gray-500">
          Nothing has been added to the asset register yet. Add the club's capital kit to see what
          it is worth and when it will need replacing.
        </p>
      </div>
    );
  }

  const { rows, forecast, fund } = view;

  return (
    <div className="space-y-6">
      <div className="neu-border bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Boxes className="h-5 w-5" /> Asset register
          </h2>
          <button
            type="button"
            onClick={handleSnapshot}
            className="neu-border bg-lime px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-peach"
          >
            Freeze book values
          </button>
        </div>

        <dl className="mb-5 grid grid-cols-2 gap-3 font-mono text-xs lg:grid-cols-4">
          <Stat label="Book value" value={formatCents(view.registerValueCents)} />
          <Stat
            label="Assets tracked"
            value={`${rows.filter((r) => !r.asset.disposalDate).length}`}
          />
          <Stat
            label={`Replacements to ${forecast.fromYear + forecast.horizonYears - 1}`}
            value={formatCents(forecast.totalInflatedCents)}
            icon={<CalendarClock className="h-3.5 w-3.5" />}
          />
          <Stat
            label="Set aside per period"
            value={formatCents(fund.contributionPerPeriodCents)}
            tone={fund.fullyFunded ? "plain" : "warn"}
            icon={<PiggyBank className="h-3.5 w-3.5" />}
          />
        </dl>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left font-mono text-xs">
            <thead>
              <tr className="border-b-2 border-black uppercase text-gray-600">
                <th className="py-2">Asset</th>
                <th className="py-2">Method</th>
                <th className="py-2">Condition</th>
                <th className="py-2 text-right">Cost</th>
                <th className="py-2 text-right">Book value</th>
                <th className="py-2 text-right">Replace by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(
                ({ asset, bookValueCents: value, remainingLifeMonths: left, endOfLife }) => (
                  <tr
                    key={asset.id}
                    className={`border-b border-gray-200 ${asset.disposalDate ? "opacity-50" : ""}`}
                  >
                    <td className="py-2">
                      <span className="block text-sm font-bold">{asset.name}</span>
                      <span className="text-[11px] uppercase text-gray-500">{asset.category}</span>
                    </td>
                    <td className="py-2">{METHOD_LABELS[asset.method] ?? asset.method}</td>
                    <td className="py-2">
                      <span
                        className={`neu-border inline-block px-2 py-1 text-[11px] font-bold uppercase ${
                          CONDITION_STYLES[asset.condition]
                        }`}
                      >
                        {asset.condition}
                      </span>
                    </td>
                    <td className="py-2 text-right">{formatCents(asset.acquisitionCostCents)}</td>
                    <td className="py-2 text-right font-bold">{formatCents(value)}</td>
                    <td className="py-2 text-right">
                      {asset.disposalDate ? (
                        <span className="text-gray-500">Disposed {asset.disposalDate}</span>
                      ) : (
                        <>
                          <span className="block">{endOfLife}</span>
                          <span className="text-[11px] text-gray-500">
                            {left === 0 ? "overdue" : `${left} months left`}
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="neu-border bg-white p-4 sm:p-6">
        <h3 className="mb-3 flex items-center gap-2 border-b-2 border-black pb-2 font-bold">
          <CalendarClock className="h-4 w-4" /> Replacement timeline
        </h3>

        {forecast.years.length === 0 ? (
          <p className="font-mono text-sm text-gray-500">
            Nothing on the register falls due within the next {forecast.horizonYears} years.
          </p>
        ) : (
          <ul className="space-y-2 font-mono text-xs">
            {forecast.years.map((year) => (
              <li key={year.year} className="flex items-center justify-between gap-3">
                <span className="font-bold">{year.year}</span>
                <span className="flex-1 border-b border-dashed border-gray-300" />
                <span>
                  {year.assetIds.length} item{year.assetIds.length === 1 ? "" : "s"} ·{" "}
                  {formatCents(year.inflatedCostCents)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {!fund.fullyFunded && (
          <p className="neu-border mt-4 flex items-start gap-2 bg-peach/40 p-3 font-mono text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              The reserve holds {formatCents(fund.currentReserveCents)} against{" "}
              {formatCents(fund.totalNeededCents)} of planned replacements. That is a gap of{" "}
              {formatCents(fund.shortfallCents)}, or {formatCents(fund.contributionPerPeriodCents)}{" "}
              across each of the next {fund.contributionsRemaining} contributions.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "plain",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "plain" | "warn";
}) {
  return (
    <div className={`neu-border p-3 ${tone === "warn" ? "bg-peach/40" : "bg-white"}`}>
      <dt className="flex items-center gap-1 uppercase text-gray-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-base font-bold">{value}</dd>
    </div>
  );
}

export default AssetRegisterPanel;
