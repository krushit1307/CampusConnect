import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";

export function ContractWarningAlert({ clubId }: { clubId: string }) {
  const supabase = createClient();

  const { data: expiringContracts, isLoading } = useQuery({
    queryKey: ["expiring_contracts", clubId],
    queryFn: async () => {
      // Find contracts expiring within 60 days
      const { data, error } = await supabase
        .from("vendor_contracts")
        .select("id, vendor_name, expiration_date, discount_terms")
        .eq("club_id", clubId)
        .gte("expiration_date", new Date().toISOString())
        .lte(
          "expiration_date",
          new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
        );

      if (error) {
        console.error("Error fetching expiring contracts:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!clubId,
  });

  if (isLoading || !expiringContracts || expiringContracts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 mb-6">
      {expiringContracts.map((contract: any) => {
        const daysLeft = Math.ceil(
          (new Date(contract.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        return (
          <div
            key={contract.id}
            className="w-full bg-rose-50 border-2 border-rose-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl shadow-sm animate-in slide-in-from-top"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl p-2 bg-rose-100 rounded-full text-rose-800 shrink-0">
                <AlertTriangle size={24} />
              </span>
              <div>
                <h4 className="text-sm font-black text-rose-900 tracking-tight">
                  Contract Expiration Warning
                </h4>
                <p className="text-xs text-rose-800 mt-1 max-w-2xl leading-relaxed">
                  Your <strong className="font-bold">{contract.discount_terms || "discount"}</strong> contract with <strong className="font-bold">{contract.vendor_name}</strong> expires in <strong className="font-bold underline">{daysLeft} days</strong>. Please contact them to renegotiate for next year to avoid losing these benefits.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                // Future integration: Mark as renegotiated
              }}
              className="px-4 py-2 bg-rose-800 hover:bg-rose-900 active:bg-rose-950 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm whitespace-nowrap transition"
            >
              Contact Vendor
            </button>
          </div>
        );
      })}
    </div>
  );
}
