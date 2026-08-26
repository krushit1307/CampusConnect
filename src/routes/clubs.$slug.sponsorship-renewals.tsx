/**
 * Club Sponsorship Renewals Management Page
 * Route: /clubs/:slug/sponsorship-renewals
 * Issue #4141
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  SponsorshipTierRenewal,
  SponsorshipInvoice,
  RenewalCronSummary,
} from '../../types/sponsorshipRenewal';
import { sponsorshipRenewalService } from '../../services/sponsorshipRenewalService';
import { SponsorshipRenewalManager } from '../../components/sponsorship/SponsorshipRenewalManager';
import { SponsorRenewalPaymentPortal } from '../../components/sponsorship/SponsorRenewalPaymentPortal';
import {
  DollarSign,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Sparkles,
} from 'lucide-react';

export default function ClubSponsorshipRenewalsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [sponsorships, setSponsorships] = useState<SponsorshipTierRenewal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePaymentPortalSponsor, setActivePaymentPortalSponsor] =
    useState<SponsorshipTierRenewal | null>(null);

  const loadSponsorships = async () => {
    setIsLoading(true);
    try {
      const data = await sponsorshipRenewalService.fetchClubSponsorships(slug || 'club-tech');
      setSponsorships(data);
    } catch (err) {
      console.error('Failed to load renewals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSponsorships();
  }, [slug]);

  const handleRunCron = async () => {
    const res = await sponsorshipRenewalService.runRenewalCronCheck(sponsorships);
    setSponsorships(res.updatedList);
    return res;
  };

  const handlePaySponsorship = async (sponsorshipId: string) => {
    const updated = await sponsorshipRenewalService.processSponsorPayment(
      sponsorshipId,
      sponsorships
    );
    setSponsorships((prev) =>
      prev.map((s) => (s.id === sponsorshipId ? updated : s))
    );
  };

  const handleToggleRotator = async (sponsorshipId: string, active: boolean) => {
    await sponsorshipRenewalService.toggleRotatorStatus(sponsorshipId, active);
    setSponsorships((prev) =>
      prev.map((s) => (s.id === sponsorshipId ? { ...s, is_active_in_rotator: active } : s))
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Sponsorship Tier Renewal Invoicing
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              Automated 30-day Stripe subscription renewals, billing notifications,
              and sponsor rotator synchronization.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadSponsorships}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition"
            title="Reload Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Dashboard */}
      <SponsorshipRenewalManager
        sponsorships={sponsorships}
        onRunCron={handleRunCron}
        onPaySponsorship={handlePaySponsorship}
        onToggleRotator={handleToggleRotator}
      />

      {/* Sponsor Payment Portal Modal */}
      {activePaymentPortalSponsor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <SponsorRenewalPaymentPortal
            sponsorship={activePaymentPortalSponsor}
            onConfirmPayment={async () => {
              await handlePaySponsorship(activePaymentPortalSponsor.id);
            }}
            onClose={() => setActivePaymentPortalSponsor(null)}
          />
        </div>
      )}
    </div>
  );
}
