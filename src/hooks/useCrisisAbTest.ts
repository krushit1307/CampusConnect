import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCrisisAbTest(sessionId: string) {
  const supabase = createClient();
  const [variant, setVariant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVariant() {
      const { data: expData, error } = await supabase
        .from("ab_test_experiments")
        .select(`
          id, is_active, winner_variant_id,
          variants:ab_test_variants (id, payload)
        `)
        .eq("name", "Crisis Banner Copy Test")
        .single();

      if (error || !expData || !expData.is_active) {
        setLoading(false);
        return;
      }

      const { id: expId, winner_variant_id, variants } = expData;
      let selectedVariant = null;

      if (winner_variant_id) {
        selectedVariant = variants.find((v: any) => v.id === winner_variant_id);
      } else if (variants && variants.length > 0) {
        let hash = 0;
        for (let i = 0; i < sessionId.length; i++) {
          hash = sessionId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const bucketIndex = Math.abs(hash) % variants.length;
        selectedVariant = variants[bucketIndex];
      }

      if (selectedVariant) {
        setVariant({ expId, variantId: selectedVariant.id, ...selectedVariant.payload });
        await supabase.rpc("record_ab_test_event", {
          p_experiment_id: expId,
          p_variant_id: selectedVariant.id,
          p_session_id: sessionId,
          p_event_type: "impression"
        });
      }
      setLoading(false);
    }
    if (sessionId) {
      void loadVariant();
    }
  }, [sessionId, supabase]);

  const trackConversion = async () => {
    if (!variant) return;
    await supabase.rpc("record_ab_test_event", {
      p_experiment_id: variant.expId,
      p_variant_id: variant.variantId,
      p_session_id: sessionId,
      p_event_type: "conversion"
    });
  };

  return { variant, trackConversion, loading };
}
