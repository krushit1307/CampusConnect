import { SiteShell } from "@/components/site/SiteShell";
import { VendorRfpManager } from "@/components/vendors/VendorRfpManager";

export default function VendorRfpsPage() {
  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-12 md:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <h1 className="font-display text-4xl font-black tracking-tight uppercase mb-2 text-emerald-950">
              Vendor Marketplace
            </h1>
            <p className="font-mono text-sm text-gray-700">
              Browse open RFPs from campus organizations and submit competitive bids.
            </p>
          </div>

          <VendorRfpManager isVendorView={true} clubName="All Campus Organizations" />
        </div>
      </div>
    </SiteShell>
  );
}
