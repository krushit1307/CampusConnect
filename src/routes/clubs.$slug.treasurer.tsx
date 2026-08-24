import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft, DollarSign, TrendingDown, BookOpen, ShieldCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaxExemptComplianceExportModal } from "@/components/finance/TaxExemptComplianceExportModal";

export default function TreasurerDashboardRoute() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: clubData, error: clubError } = await supabase
          .from("clubs")
          .select("id, name, slug")
          .eq("slug", slug)
          .single();

        if (clubError || !clubData) {
          navigate("/clubs");
          return;
        }
        setClub(clubData);

        const { data, error } = await supabase.rpc("get_club_balance_sheet", {
          p_club_id: clubData.id,
        });

        if (error) {
          console.error("Failed to load balance sheet:", error);
        } else if (data && data.length > 0) {
          setBalanceSheet(data[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, navigate, supabase]);

  if (loading) {
    return (
      <SiteShell>
        <div className="flex justify-center items-center h-96">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SiteShell>
    );
  }

  if (!club) return null;

  return (
    <SiteShell>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate(`/clubs/${club.slug}`)}
              className="mb-2 -ml-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to {club.name}
            </Button>
            <h1 className="text-3xl font-bold">Treasurer's Dashboard</h1>
            <p className="text-muted-foreground">
              Financial overview, GAAP-compliant balance sheet & Tax-Exempt compliance audit engine
            </p>
          </div>

          <Button
            onClick={() => setExportModalOpen(true)}
            className="neu-border bg-purple-600 hover:bg-purple-700 text-white font-mono text-xs font-bold uppercase gap-2 self-start sm:self-auto shadow-[3px_3px_0_0_#000]"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            1-Click Compliance Export
          </Button>

          <TaxExemptComplianceExportModal
            open={exportModalOpen}
            onClose={() => setExportModalOpen(false)}
            clubId={club.id}
            clubName={club.name}
            treasurerName="Club Treasurer"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border rounded-xl p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="w-5 h-5 text-green-500" />
              <h2 className="font-semibold text-sm uppercase tracking-wider">Cash Balance</h2>
            </div>
            <p className="text-4xl font-bold">
              ${(balanceSheet?.cash_balance ?? 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-card border rounded-xl p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingDown className="w-5 h-5 text-blue-500" />
              <h2 className="font-semibold text-sm uppercase tracking-wider">Current Asset Value (Inventory)</h2>
            </div>
            <p className="text-4xl font-bold">
              ${(balanceSheet?.inventory_value ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Calculated via Straight-Line Depreciation</p>
          </div>

          <div className="bg-card border rounded-xl p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen className="w-5 h-5 text-purple-500" />
              <h2 className="font-semibold text-sm uppercase tracking-wider">Total Assets</h2>
            </div>
            <p className="text-4xl font-bold">
              ${(balanceSheet?.total_assets ?? 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-8 bg-card border rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-6 border-b pb-4">Balance Sheet (GAAP Compliant)</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Assets</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Cash & Equivalents</span>
                  <span>${(balanceSheet?.cash_balance ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Property & Equipment (Net)</span>
                  <span>${(balanceSheet?.inventory_value ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 font-bold text-lg mt-4">
                  <span>Total Assets</span>
                  <span>${(balanceSheet?.total_assets ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Liabilities & Equity</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Current Liabilities</span>
                  <span>$0</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Club Equity (Retained Earnings)</span>
                  <span>${(balanceSheet?.total_assets ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 font-bold text-lg mt-4">
                  <span>Total Liabilities & Equity</span>
                  <span>${(balanceSheet?.total_assets ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </SiteShell>
  );
}
