import React, { useState } from 'react';
import {
  SponsorPricingAsset,
  LocalizedSponsorLogoRenderConfig,
} from '../../types/sponsorCurrencyConverter';
import { sponsorCurrencyConverterService } from '../../services/sponsorCurrencyConverterService';
import { sponsorPppAdjusterService } from '../../services/sponsorPppAdjusterService';
export const SponsorLogoGeotargetedDisplay: React.FC = () => {
  const sponsors = sponsorCurrencyConverterService.getSponsors();
  const [selectedCountry, setSelectedCountry] = useState<string>('DE');
  const [activeTab, setActiveTab] = useState<'grid' | 'svg_inspect'>('grid');

  const countryOptions = [
    { code: 'US', label: '🇺🇸 United States (USD $)' },
    { code: 'DE', label: '🇩🇪 Germany (EUR €)' },
    { code: 'FR', label: '🇫🇷 France (EUR €)' },
    { code: 'GB', label: '🇬🇧 United Kingdom (GBP £)' },
    { code: 'CA', label: '🇨🇦 Canada (CAD CA$)' },
    { code: 'AU', label: '🇦🇺 Australia (AUD A$)' },
    { code: 'IN', label: '🇮🇳 India (INR ₹)' },
    { code: 'JP', label: '🇯🇵 Japan (JPY ¥)' },
    { code: 'CH', label: '🇨🇭 Switzerland (CHF)' },
  ];

  const localizedList: LocalizedSponsorLogoRenderConfig[] = sponsors.map((s) =>
    sponsorCurrencyConverterService.localizeSponsorAsset(s, selectedCountry)
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header & Geolocation Country Picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
              🌍 GeoIP + Live Forex Engine
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Dynamic SVG Logo Overlays
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">Geotargeted Sponsor Logo & Currency Localizer</h2>
          <p className="text-sm text-slate-400">
            Real-time IP geolocation and live currency conversion injected directly as SVG badges on sponsor assets
          </p>
        </div>

        {/* Country Selector */}
        <div className="flex items-center gap-3 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
          <span className="text-xs text-slate-400 font-semibold pl-2">Simulate User Location:</span>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:outline-none cursor-pointer"
          >
            {countryOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sponsor Showcase Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {localizedList.map((item) => (
          <div
            key={item.asset.id}
            className="group relative bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/60 hover:border-pink-500/40 rounded-2xl p-5 transition-all duration-300 shadow-xl flex flex-col justify-between"
          >
            {/* Top Row: Sponsor Brand Info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-pink-500/20 text-pink-300">
                  {item.asset.tier} Partner
                </span>
                <span className="text-xs text-slate-400 font-mono">Base: ${item.asset.basePriceUsd} USD</span>
              </div>

              {/* Logo Presentation Area with Overlay */}
              <div className="relative h-44 rounded-xl bg-gradient-to-b from-slate-950/80 to-slate-900/90 border border-slate-800 flex items-center justify-center p-6 overflow-hidden">
                {/* Background Subtle Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/5 via-indigo-500/5 to-transparent pointer-events-none" />

                {/* Main Brand Logo */}
                <img
                  src={item.asset.logoUrl}
                  alt={item.asset.sponsorName}
                  className="max-h-20 max-w-full object-contain filter drop-shadow-md group-hover:scale-105 transition duration-300"
                />

                {/* Dynamic Injected SVG Price Badge Overlay */}
                <div
                  className="absolute bottom-2 left-2 right-2 max-w-[210px] mx-auto filter drop-shadow-lg transition-transform group-hover:-translate-y-1 duration-200"
                  dangerouslySetInnerHTML={{ __html: item.svgBadgeOverlay }}
                />
              </div>

              <div>
                <h3 className="font-bold text-white text-base group-hover:text-pink-300 transition">
                  {item.asset.sponsorName}
                </h3>
                <p className="text-xs text-slate-300 line-clamp-1">{item.asset.campaignTitle}</p>
              </div>
            </div>

            {/* Bottom: Conversion Details & CTA */}
            <div className="pt-4 mt-4 border-t border-slate-700/50 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Localized For:</span>
                <span className="font-semibold text-emerald-400">
                  {item.geoContext.countryName} ({item.geoContext.localCurrencyCode})
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Effective Local Price:</span>
                <span className="text-base font-extrabold text-white font-mono">
                  {item.formattedLocalPrice}
                </span>
              </div>

              <a
                href={item.asset.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-4 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl text-center shadow-lg transition duration-200 flex items-center justify-center gap-1.5"
              >
                Claim Sponsor Offer ({item.formattedLocalPrice}) →
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Real-Time Telemetry / Currency Multiplier Info */}
      <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-slate-300 font-mono">
            FX Live Feed: USD/EUR=0.92 • USD/GBP=0.79 • USD/INR=83.45 • USD/CAD=1.36 • USD/JPY=154.2
          </span>
        </div>
        <div className="text-slate-500 text-[11px]">
          Target IP: 194.12.44.102 • CDN Latency: 4ms • MaxMind GeoIP2 Precision City
        </div>
      </div>
    </div>
  );
};
