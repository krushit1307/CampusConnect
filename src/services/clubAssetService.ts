import { supabase } from "@/lib/supabase";
import {
  accumulatedDepreciationCents,
  bookValueCents,
  buildReplacementForecast,
  buildSinkingFundPlan,
  endOfLifeDate,
  registerValueCents,
  remainingLifeMonths,
  type ClubAsset,
  type ReplacementForecast,
  type SinkingFundPlan,
} from "@/lib/assetDepreciation";

export interface AssetRegisterRow {
  asset: ClubAsset;
  bookValueCents: number;
  accumulatedDepreciationCents: number;
  remainingLifeMonths: number;
  endOfLife: string;
}

export interface ReservePlanSettings {
  balanceCents: number;
  contributionsPerYear: number;
  planningHorizonYears: number;
  inflationRatePercent: number;
}

export interface AssetPlanningView {
  rows: AssetRegisterRow[];
  registerValueCents: number;
  forecast: ReplacementForecast;
  fund: SinkingFundPlan;
  settings: ReservePlanSettings;
}

/** Settings used when a club has not configured a replacement reserve. */
export const DEFAULT_RESERVE_SETTINGS: ReservePlanSettings = {
  balanceCents: 0,
  contributionsPerYear: 2,
  planningHorizonYears: 5,
  inflationRatePercent: 3,
};

function toAsset(row: any): ClubAsset {
  return {
    id: row.id,
    clubId: row.club_id,
    name: row.name,
    category: row.category,
    acquisitionCostCents: Number(row.acquisition_cost_cents),
    acquisitionDate: row.acquisition_date,
    usefulLifeMonths: Number(row.useful_life_months),
    salvageValueCents: Number(row.salvage_value_cents),
    method: row.method,
    decliningRatePercent:
      row.declining_rate_percent === null ? undefined : Number(row.declining_rate_percent),
    totalExpectedUnits:
      row.total_expected_units === null ? undefined : Number(row.total_expected_units),
    unitsUsed: row.units_used === null ? undefined : Number(row.units_used),
    condition: row.condition,
    disposalDate: row.disposal_date,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const clubAssetService = {
  /** Every asset on a club's register, disposed ones included. */
  async listAssets(clubId: string): Promise<ClubAsset[]> {
    const { data, error } = await supabase
      .from("club_assets")
      .select("*")
      .eq("club_id", clubId)
      .order("acquisition_date", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(toAsset);
  },

  /** The club's replacement reserve settings, or the platform defaults. */
  async getReserveSettings(clubId: string): Promise<ReservePlanSettings> {
    const { data, error } = await supabase
      .from("club_asset_reserves")
      .select("*")
      .eq("club_id", clubId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ...DEFAULT_RESERVE_SETTINGS };

    return {
      balanceCents: Number((data as any).balance_cents),
      contributionsPerYear: Number((data as any).contributions_per_year),
      planningHorizonYears: Number((data as any).planning_horizon_years),
      inflationRatePercent: Number((data as any).inflation_rate_percent),
    };
  },

  /**
   * Everything the officer dashboard shows: current book values, the
   * replacement timeline and the contribution needed to fund it.
   */
  async getPlanningView(clubId: string, asOf: string = todayIso()): Promise<AssetPlanningView> {
    const [assets, settings] = await Promise.all([
      this.listAssets(clubId),
      this.getReserveSettings(clubId),
    ]);

    const rows: AssetRegisterRow[] = assets.map((asset) => ({
      asset,
      bookValueCents: bookValueCents(asset, asOf),
      accumulatedDepreciationCents: accumulatedDepreciationCents(asset, asOf),
      remainingLifeMonths: remainingLifeMonths(asset, asOf),
      endOfLife: endOfLifeDate(asset),
    }));

    const forecast = buildReplacementForecast(assets, {
      asOf,
      horizonYears: settings.planningHorizonYears,
      inflationRatePercent: settings.inflationRatePercent,
    });

    return {
      rows,
      registerValueCents: registerValueCents(assets, asOf),
      forecast,
      fund: buildSinkingFundPlan(forecast, settings.balanceCents, settings.contributionsPerYear),
      settings,
    };
  },

  /** Adds an asset to the register. */
  async createAsset(
    clubId: string,
    input: Omit<ClubAsset, "id" | "clubId" | "disposalDate">,
  ): Promise<void> {
    const { error } = await supabase.from("club_assets").insert({
      club_id: clubId,
      name: input.name,
      category: input.category,
      acquisition_cost_cents: Math.max(0, Math.round(input.acquisitionCostCents)),
      acquisition_date: input.acquisitionDate,
      useful_life_months: input.usefulLifeMonths,
      salvage_value_cents: Math.max(0, Math.round(input.salvageValueCents)),
      method: input.method,
      declining_rate_percent: input.decliningRatePercent ?? null,
      total_expected_units: input.totalExpectedUnits ?? null,
      units_used: input.unitsUsed ?? 0,
      condition: input.condition,
    });

    if (error) throw error;
  },

  /** Records a condition inspection, which moves the replacement date. */
  async updateCondition(assetId: string, condition: ClubAsset["condition"]): Promise<void> {
    const { error } = await supabase.from("club_assets").update({ condition }).eq("id", assetId);
    if (error) throw error;
  },

  /** Records metered usage for an asset depreciated by units of production. */
  async recordUsage(assetId: string, unitsUsed: number): Promise<void> {
    const { error } = await supabase
      .from("club_assets")
      .update({ units_used: Math.max(0, Math.round(unitsUsed)) })
      .eq("id", assetId);

    if (error) throw error;
  },

  /** Takes an asset off the register once it has been sold or scrapped. */
  async disposeAsset(assetId: string, disposalDate: string, proceedsCents = 0): Promise<void> {
    const { error } = await supabase
      .from("club_assets")
      .update({
        disposal_date: disposalDate,
        disposal_proceeds_cents: Math.max(0, Math.round(proceedsCents)),
      })
      .eq("id", assetId);

    if (error) throw error;
  },

  /**
   * Freezes book values for a period end. Snapshots are what the club hands to
   * the Student Union; the live figures keep moving after that.
   */
  async snapshotRegister(clubId: string, asOf: string = todayIso()): Promise<number> {
    const assets = await this.listAssets(clubId);
    const rows = assets
      .filter((asset) => !asset.disposalDate)
      .map((asset) => ({
        asset_id: asset.id,
        club_id: clubId,
        as_of: asOf,
        book_value_cents: bookValueCents(asset, asOf),
        accumulated_depreciation_cents: accumulatedDepreciationCents(asset, asOf),
      }));

    if (rows.length === 0) return 0;

    const { error } = await supabase
      .from("club_asset_depreciation_snapshots")
      .upsert(rows, { onConflict: "asset_id, as_of" });

    if (error) throw error;
    return rows.length;
  },

  /** Updates the reserve balance and the assumptions behind the plan. */
  async saveReserveSettings(clubId: string, settings: ReservePlanSettings): Promise<void> {
    const { error } = await supabase.from("club_asset_reserves").upsert(
      {
        club_id: clubId,
        balance_cents: Math.max(0, Math.round(settings.balanceCents)),
        contributions_per_year: settings.contributionsPerYear,
        planning_horizon_years: settings.planningHorizonYears,
        inflation_rate_percent: settings.inflationRatePercent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "club_id" },
    );

    if (error) throw error;
  },
};
