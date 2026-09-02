import React, { useState } from 'react';
import {
  DeepfakePhishingSimulationService,
  PhishingCampaignScenario,
  SimulationResult,
} from '../../services/deepfakePhishingSimulationService';
import { ShieldAlert, Video, Send, AlertOctagon, CheckCircle2, UserCheck, Smartphone } from 'lucide-react';

export const DeepfakePhishingDebriefPortal: React.FC = () => {
  const service = DeepfakePhishingSimulationService.getInstance();
  const avatars = service.getAvailableAvatars();

  const [clubName, setClubName] = useState('Robotics Society');
  const [presidentName, setPresidentName] = useState('Alex Rivera');
  const [phoneNumber, setPhoneNumber] = useState('+1 (555) 234-5678');
  const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]?.avatarId || 'avatar-dean-smith');
  const [amount, setAmount] = useState(5000);
  const [urgencyReason, setUrgencyReason] = useState('urgent venue deposit hold');

  const [campaign, setCampaign] = useState<PhishingCampaignScenario | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [showDebrief, setShowDebrief] = useState(false);

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const newCamp = await service.launchPhishingSimulation({
      targetClubId: 'club-robotics',
      targetClubName: clubName,
      targetPresidentName: presidentName,
      targetPhoneNumber: phoneNumber,
      authorityAvatarId: selectedAvatar,
      transferAmount: amount,
      urgencyReason,
    });
    setCampaign(newCamp);
    setResult(null);
    setShowDebrief(false);
  };

  const handleSimulateUserAction = async (action: 'CLICKED_LINK' | 'INITIATED_TRANSFER' | 'REPORTED_PHISHING') => {
    if (!campaign) return;
    const res = await service.recordPhishingInteraction(campaign.campaignId, action);
    setResult(res);
    if (action === 'INITIATED_TRANSFER' || action === 'CLICKED_LINK') {
      setShowDebrief(true);
    }
  };

  const handleCompleteDebrief = () => {
    if (campaign) {
      service.completeDebrief(campaign.campaignId);
      setShowDebrief(false);
      setCampaign(service.getCampaign(campaign.campaignId) || null);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white min-h-screen font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-rose-400">
              <ShieldAlert className="w-7 h-7 text-rose-500" />
              Automated Deepfake Video Phishing Simulation & Debriefing
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Issue #5146: Synthesia/HeyGen digital avatar phishing defense for Club Leaders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-rose-950 text-rose-300 border border-rose-800 rounded-full text-xs font-semibold flex items-center gap-1">
              <Video className="w-4 h-4" /> AI Avatar Synthesizer Active
            </span>
          </div>
        </div>

        {/* Campaign Creation & Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Form */}
          <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-xl space-y-4">
            <h3 className="text-md font-semibold text-slate-200 flex items-center gap-2">
              <Send className="w-4 h-4 text-rose-400" />
              Dispatch Deepfake SMS Payload
            </h3>

            <form onSubmit={handleLaunchCampaign} className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Club Name</label>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Club President Name</label>
                <input
                  type="text"
                  value={presidentName}
                  onChange={(e) => setPresidentName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Registered Phone (SMS)</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">High-Authority Avatar</label>
                <select
                  value={selectedAvatar}
                  onChange={(e) => setSelectedAvatar(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-rose-500"
                >
                  {avatars.map((av) => (
                    <option key={av.avatarId} value={av.avatarId}>
                      {av.name} ({av.authorityTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Urgent Transfer Demand ($)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg transition-colors text-sm shadow-lg shadow-rose-600/30"
              >
                Synthesize & Send Deepfake SMS
              </button>
            </form>
          </div>

          {/* Active Simulation Preview & Phone Mockup */}
          <div className="lg:col-span-2 space-y-4">
            {campaign ? (
              <div className="bg-slate-800/90 border border-slate-700 p-6 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-rose-400" />
                    <h3 className="font-semibold text-white">SMS Payload Received by {campaign.targetPresidentName}</h3>
                  </div>
                  <span className="px-2.5 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 rounded text-xs">
                    {campaign.status}
                  </span>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg space-y-3 border border-slate-800">
                  <div className="text-xs text-slate-400 flex justify-between">
                    <span>From: University Authority Video Bot</span>
                    <span>SID: {campaign.smsMessageSid}</span>
                  </div>

                  <div className="p-3 bg-slate-900 border border-rose-900/40 rounded-lg text-sm text-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
                      <Video className="w-4 h-4" /> Attached Deepfake Video: {campaign.generatedVideoUrl}
                    </div>
                    <p className="italic text-slate-300">"{campaign.syntheticScript}"</p>
                  </div>
                </div>

                {/* Simulated Target Actions */}
                <div className="pt-2">
                  <span className="text-xs text-slate-400 block mb-2 font-medium">Test Target President Behavior:</span>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleSimulateUserAction('INITIATED_TRANSFER')}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Fall for Scam (Execute Fake Wire Transfer)
                    </button>
                    <button
                      onClick={() => handleSimulateUserAction('REPORTED_PHISHING')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Identify Deepfake & Report to IT Security
                    </button>
                  </div>
                </div>

                {result && (
                  <div className={`p-4 rounded-lg border text-sm mt-4 ${result.attemptedFakeTransfer ? 'bg-rose-950/60 border-rose-800 text-rose-200' : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'}`}>
                    <div className="font-bold text-md mb-1">
                      {result.attemptedFakeTransfer ? 'VULNERABILITY DETECTED! (Deepfake Victim)' : 'PHISHING BLOCKED!'}
                    </div>
                    <div>Risk Score: {result.riskScore} / 100</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-800/40 border border-slate-800 p-12 rounded-xl text-center text-slate-500 space-y-3">
                <ShieldAlert className="w-12 h-12 mx-auto text-slate-600" />
                <div className="text-lg font-medium text-slate-400">No Phishing Campaign Dispatched Yet</div>
                <p className="text-sm max-w-md mx-auto">
                  Select a digital authority avatar and target club president to initiate an automated multimodal deepfake training simulation.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Mandatory Deepfake Social Engineering Debriefing */}
        {showDebrief && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-rose-800 p-6 rounded-2xl max-w-2xl w-full space-y-5 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-600/20 rounded-xl text-rose-500">
                  <AlertOctagon className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">CRITICAL DEBRIEFING: Deepfake Social Engineering</h2>
                  <p className="text-rose-400 text-sm font-medium mt-0.5">
                    You just attempted to wire funds based on an AI-generated video attack!
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-300 space-y-3 leading-relaxed">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-rose-400" /> Why text-based verification is no longer enough:
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-400">
                  <li>Generative AI models can clone any university figure's voice and facial features in under 30 seconds.</li>
                  <li>Always verify urgent payment requests via an out-of-band phone call to official department numbers.</li>
                  <li>Never trust SMS video attachments requesting immediate financial transfers.</li>
                </ul>
              </div>

              <button
                onClick={handleCompleteDebrief}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-rose-600/30 text-sm"
              >
                I Acknowledge Deepfake Risk & Complete Mandatory Training
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
