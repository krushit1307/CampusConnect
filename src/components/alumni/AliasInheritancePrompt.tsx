// =============================================================================
// Component: AliasInheritancePrompt
// Issue: #4425 - Automated "Graduating Senior" Email Forwarding
// Description: The successor-facing half of the mail-forwarding handover.
// When the audit_graduates pass detects that a graduating officer held an
// external alias (president@..., treasurer@...), the incoming officer is
// prompted here: "Do you want to inherit the 'president@' alias?" Accepting
// re-maps the routing rule so sponsor mail lands in their inbox instead of
// bouncing off a graduate's dead address.
// =============================================================================

import React from "react";
import { CheckCircle2, Forward, Inbox, XCircle } from "lucide-react";

export interface AliasOfferView {
  offerId: string;
  /** Public address sponsors already write to, e.g. president@techclub... */
  aliasAddress: string;
  roleTitle: string;
  /** Display name of the graduating officer currently holding it. */
  outgoingHolderName: string;
  /** ISO timestamp after which the prompt lapses to the club fallback inbox. */
  expiresAt: string;
}

export type AliasDecision = "ACCEPTED" | "DECLINED";

interface AliasInheritancePromptProps {
  offers: AliasOfferView[];
  onDecide: (offerId: string, decision: AliasDecision) => void;
}

function localPartOf(address: string): string {
  return address.split("@")[0] ?? address;
}

export const AliasInheritancePrompt: React.FC<AliasInheritancePromptProps> = ({
  offers,
  onDecide,
}) => {
  if (offers.length === 0) return null;

  return (
    <section
      className="bg-slate-900/80 border border-sky-500/30 rounded-3xl p-6 space-y-4"
      data-testid="alias-inheritance-prompt"
      aria-label="Email alias inheritance requests"
    >
      <header className="flex items-center gap-2">
        <Forward className="w-5 h-5 text-sky-400" />
        <h2 className="text-lg font-bold text-slate-100">Your Incoming Email Aliases</h2>
      </header>
      <p className="text-xs text-slate-400 leading-relaxed">
        Sponsors outside the club keep writing to these addresses after every graduation. Inheriting
        an alias re-routes its mail straight to your personal inbox &mdash; same address, new
        destination, no lost threads.
      </p>

      <ul className="space-y-3">
        {offers.map((offer) => (
          <li
            key={offer.offerId}
            className="bg-slate-800/70 border border-slate-700 rounded-2xl p-4"
            data-testid={`alias-offer-${offer.offerId}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className="font-mono text-sm font-semibold text-sky-300 break-all"
                  data-testid={`alias-address-${offer.offerId}`}
                >
                  {offer.aliasAddress}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Held by {offer.outgoingHolderName} ({offer.roleTitle}), who just graduated.
                  Respond by {new Date(offer.expiresAt).toLocaleDateString()} &mdash; after that
                  mail goes to the club archive.
                </p>
                <p className="mt-2 text-sm text-slate-200 font-medium">
                  Do you want to inherit the &lsquo;{localPartOf(offer.aliasAddress)}&rsquo; alias?
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onDecide(offer.offerId, "ACCEPTED")}
                  data-testid={`alias-accept-${offer.offerId}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-950 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" /> Inherit
                </button>
                <button
                  type="button"
                  onClick={() => onDecide(offer.offerId, "DECLINED")}
                  data-testid={`alias-decline-${offer.offerId}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-300 hover:bg-slate-700/60 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Decline
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <Inbox className="w-3.5 h-3.5" />
        Declined aliases are forwarded to the club&rsquo;s advisor archive instead of expiring into
        a bounce.
      </p>
    </section>
  );
};

export default AliasInheritancePrompt;
