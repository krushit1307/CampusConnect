import { Download } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { format1099MiscDollars } from "@/lib/vendor1099Misc";

type Filing = {
  id: string;
  tax_year: number;
  total_paid: number;
  pdf_url: string | null;
  schema: { recipient_name?: string; payer_name?: string } | null;
};

export function Vendor1099MiscPanel({
  clubId,
  isVendorView = false,
}: {
  clubId?: string;
  isVendorView?: boolean;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const taxYear = new Date().getUTCFullYear() - 1;

  const { data: filings = [] } = useQuery({
    queryKey: ["vendor_1099_misc_filings", clubId, isVendorView],
    queryFn: async () => {
      let q = supabase
        .from("vendor_1099_misc_filings")
        .select("id, tax_year, total_paid, pdf_url, schema")
        .order("tax_year", { ascending: false });
      if (clubId) q = q.eq("club_id", clubId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Filing[];
    },
    enabled: isVendorView || !!clubId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!clubId) throw new Error("Club is required to generate 1099-MISC forms.");
      const { data, error } = await supabase.functions.invoke("generate-1099-misc", {
        body: { clubId, taxYear },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("1099-MISC forms generated for the club treasurer and vendors.");
      queryClient.invalidateQueries({ queryKey: ["vendor_1099_misc_filings"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to generate 1099-MISC"),
  });

  if (!isVendorView && !clubId) return null;

  return (
    <div
      className="border-2 border-black bg-white p-4 space-y-3 shadow-[4px_4px_0_0_#000]"
      data-testid="vendor-1099-misc-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-black text-base uppercase tracking-wide">
          1099-MISC filings
        </h3>
        {clubId && !isVendorView && (
          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-3 py-1 border-2 border-black bg-black text-white font-mono text-xs font-bold uppercase disabled:opacity-50"
          >
            {generateMutation.isPending ? "Generating..." : `Generate ${taxYear} 1099-MISC`}
          </button>
        )}
      </div>
      <p className="font-mono text-xs text-gray-600">
        Copy C is for the club treasurer. Copy B is for the vendor.
      </p>
      {filings.length === 0 ? (
        <p className="font-mono text-xs text-gray-500">No 1099-MISC forms for this tax year yet.</p>
      ) : (
        <ul className="space-y-2">
          {filings.map((filing) => (
            <li
              key={filing.id}
              className="flex items-center justify-between gap-2 border-2 border-black p-2"
            >
              <div className="font-mono text-xs">
                <p className="font-bold">
                  {filing.tax_year} · {format1099MiscDollars(Number(filing.total_paid))}
                </p>
                <p className="text-gray-600">
                  {filing.schema?.recipient_name || filing.schema?.payer_name || "1099-MISC"}
                </p>
              </div>
              {filing.pdf_url && (
                <a
                  href={filing.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase underline"
                >
                  <Download className="h-3 w-3" />
                  PDF
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
