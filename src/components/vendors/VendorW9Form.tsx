import { useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { isValidTin, type TinType } from "@/lib/vendor1099Misc";

export function VendorW9Form() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [legalName, setLegalName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [tinType, setTinType] = useState<TinType>("ssn");
  const [tin, setTin] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  const { data: existing } = useQuery({
    queryKey: ["vendor_w9_form"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("vendor_w9_forms")
        .select("legal_name, business_name, tin_type, tin")
        .eq("vendor_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!isValidTin(tinType, tin)) {
        throw new Error(tinType === "ein" ? "EIN must be XX-XXXXXXX." : "SSN must be XXX-XX-XXXX.");
      }
      const { error } = await supabase.rpc("submit_vendor_w9", {
        p_legal_name: legalName.trim(),
        p_tin_type: tinType,
        p_tin: tin.trim(),
        p_address_line1: address.trim(),
        p_city: city.trim(),
        p_state: state.trim(),
        p_zip: zip.trim(),
        p_business_name: businessName.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("W-9 submitted.");
      queryClient.invalidateQueries({ queryKey: ["vendor_w9_form"] });
      queryClient.invalidateQueries({ queryKey: ["vendor_requires_w9_to_bid"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to submit W-9"),
  });

  const onFile = existing != null && !Array.isArray(existing);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate();
      }}
      className="border-2 border-black bg-white p-4 space-y-3 shadow-[4px_4px_0_0_#000]"
      data-testid="vendor-w9-form"
    >
      <h3 className="font-display font-black text-base uppercase tracking-wide flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Digital W-9
      </h3>
      <p className="font-mono text-xs text-gray-600">
        {onFile
          ? "A W-9 is on file. Update SSN/EIN below if your tax identity changed."
          : "SSN or EIN is required before bidding once fiscal-year escrow payouts reach $600."}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="font-mono text-[10px] font-bold uppercase">
          Legal name *
          <input
            required
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className="mt-1 w-full border-2 border-black px-2 py-1 text-xs font-sans"
          />
        </label>
        <label className="font-mono text-[10px] font-bold uppercase">
          Business name
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="mt-1 w-full border-2 border-black px-2 py-1 text-xs font-sans"
          />
        </label>
        <label className="font-mono text-[10px] font-bold uppercase">
          TIN type *
          <select
            value={tinType}
            onChange={(e) => setTinType(e.target.value as TinType)}
            className="mt-1 w-full border-2 border-black px-2 py-1 text-xs font-sans bg-white"
          >
            <option value="ssn">SSN</option>
            <option value="ein">EIN</option>
          </select>
        </label>
        <label className="font-mono text-[10px] font-bold uppercase">
          SSN / EIN *
          <input
            required
            value={tin}
            onChange={(e) => setTin(e.target.value)}
            placeholder={tinType === "ein" ? "12-3456789" : "123-45-6789"}
            className="mt-1 w-full border-2 border-black px-2 py-1 text-xs font-sans"
          />
        </label>
        <label className="font-mono text-[10px] font-bold uppercase sm:col-span-2">
          Address *
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full border-2 border-black px-2 py-1 text-xs font-sans"
          />
        </label>
        <label className="font-mono text-[10px] font-bold uppercase">
          City *
          <input
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 w-full border-2 border-black px-2 py-1 text-xs font-sans"
          />
        </label>
        <label className="font-mono text-[10px] font-bold uppercase">
          State *
          <input
            required
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="mt-1 w-full border-2 border-black px-2 py-1 text-xs font-sans"
          />
        </label>
        <label className="font-mono text-[10px] font-bold uppercase">
          ZIP *
          <input
            required
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="mt-1 w-full border-2 border-black px-2 py-1 text-xs font-sans"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={saveMutation.isPending}
        className="px-3 py-2 border-2 border-black bg-black text-white font-bold text-xs uppercase disabled:opacity-50"
      >
        {saveMutation.isPending ? "Saving..." : "Submit W-9"}
      </button>
    </form>
  );
}
