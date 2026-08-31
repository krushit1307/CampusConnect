import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  FLASH_SALE_TRIGGER_DISCOUNT_PERCENT,
  FLASH_SALE_TRIGGER_DURATION_HOURS,
  type FlashSaleTriggerType,
} from "@/lib/flashSaleTrigger";

type TriggerRule = {
  id: string;
  trigger_type: FlashSaleTriggerType;
  hours_before: number | null;
  enabled: boolean;
  last_fired_at: string | null;
};

export function FlashSaleTriggerRules({ eventId }: { eventId: string }) {
  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [triggerType, setTriggerType] = useState<FlashSaleTriggerType>("hours_before_event");
  const [saving, setSaving] = useState(false);

  const loadRules = async () => {
    const supabase = createClient() as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => Promise<{ data: TriggerRule[] | null }>;
        };
      };
    };
    const { data } = await supabase
      .from("flash_sale_trigger_rules")
      .select("id, trigger_type, hours_before, enabled, last_fired_at")
      .eq("event_id", eventId);
    setRules(data ?? []);
  };

  useEffect(() => {
    void loadRules();
  }, [eventId]);

  const saveRule = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to save a flash-sale trigger.");
      const { error } = await (supabase as unknown as {
        from: (table: string) => {
          upsert: (
            row: Record<string, unknown>,
            opts: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        };
      })
        .from("flash_sale_trigger_rules")
        .upsert(
          {
            event_id: eventId,
            created_by: user.id,
            trigger_type: triggerType,
            hours_before: triggerType === "hours_before_event" ? 48 : null,
            discount_percent: FLASH_SALE_TRIGGER_DISCOUNT_PERCENT,
            duration_hours: FLASH_SALE_TRIGGER_DURATION_HOURS,
            enabled: true,
          },
          { onConflict: "event_id,trigger_type" },
        );
      if (error) throw new Error(error.message);
      toast.success("Flash-sale trigger saved. The hourly worker will evaluate it.");
      await loadRules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save trigger.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]"
      data-testid="flash-sale-trigger-rules"
    >
      <h2 className="font-display text-xl font-black uppercase">Flash Sale Triggers</h2>
      <p className="mt-1 font-mono text-xs text-black/60">
        If the trigger is true, apply a {FLASH_SALE_TRIGGER_DISCOUNT_PERCENT}% discount to all
        remaining tickets for {FLASH_SALE_TRIGGER_DURATION_HOURS} hours.
      </p>

      <label className="mt-4 block font-mono text-[11px] font-bold uppercase">Trigger</label>
      <select
        value={triggerType}
        onChange={(event) => setTriggerType(event.target.value as FlashSaleTriggerType)}
        className="neu-border mt-1 w-full bg-white px-3 py-2 font-mono text-sm"
      >
        <option value="hours_before_event">Time is 48 hours before event</option>
        <option value="weather_rain">Weather forecast predicts Rain (OpenWeather)</option>
      </select>

      <Button
        type="button"
        onClick={() => void saveRule()}
        disabled={saving}
        className="neu-border neu-press mt-4 bg-red-500 font-mono text-xs font-black uppercase text-black"
      >
        {saving ? "Saving…" : "Save trigger"}
      </Button>

      {rules.length > 0 && (
        <ul className="mt-4 space-y-1 font-mono text-xs">
          {rules.map((rule) => (
            <li key={rule.id}>
              {rule.trigger_type === "hours_before_event"
                ? `${rule.hours_before ?? 48}h before event`
                : "OpenWeather rain"}
              {rule.last_fired_at ? " — fired" : " — armed"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
