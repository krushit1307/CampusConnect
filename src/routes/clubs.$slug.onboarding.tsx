import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SiteShell } from '@/components/site/SiteShell';
import { ClubOnboardingWizard } from '@/components/clubs/ClubOnboardingWizard';
import { ClubOnboardingState } from '@/types/clubOnboarding';
import { Sparkles, ShieldCheck } from 'lucide-react';

export default function ClubOnboardingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const handleFinish = (state: ClubOnboardingState) => {
    alert(`Congratulations! "${state.clubName}" is now fully configured and live.`);
    navigate(`/clubs/${slug || ''}`);
  };

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-black pb-6 text-center md:text-left">
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="p-1.5 bg-lime border-2 border-black rounded">
                  <Sparkles size={20} />
                </span>
                <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight text-black">
                  New Club Setup & Onboarding Wizard
                </h1>
              </div>
              <p className="font-mono text-xs text-gray-600 mt-1">
                Configure essential club metadata, officer permissions, constitution bylaws, and first event.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white px-3.5 py-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono text-xs font-bold text-gray-700 mx-auto md:mx-0">
              <ShieldCheck size={18} className="text-emerald-600" />
              <span>Student Union Compliant Setup</span>
            </div>
          </div>

          {/* Stepper Wizard */}
          <ClubOnboardingWizard
            clubSlug={slug || 'new-club'}
            onFinish={handleFinish}
          />
        </div>
      </div>
    </SiteShell>
  );
}
