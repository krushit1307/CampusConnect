import React, { useState } from "react";
import {
  ShieldCheck,
  Award,
  Wallet,
  ExternalLink,
  Hexagon,
  Lock,
  Linkedin,
  Search,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const SbtCredentialDashboard: React.FC = () => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Mock State
  const credentials = [
    {
      id: "uuid-1",
      series_title: "Machine Learning Architecture 101",
      speaker: "Dr. Sarah Chen '15 (DeepMind)",
      polygon_tx_hash: "0x8f2a...391c",
      issued_at: "Oct 20, 2026",
      polygon_token_id: 12,
    },
  ];

  const handleConnectWallet = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setWalletConnected(true);
    }, 1200);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 font-sans space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Hexagon className="h-8 w-8 text-indigo-500 fill-indigo-500/20" />
            Soulbound Credentials (SBT)
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm max-w-2xl">
            Cryptographically verifiable attendance credentials minted on the Polygon blockchain.
            These tokens are strictly non-transferable and permanently bound to your identity.
          </p>
        </div>
        {!walletConnected ? (
          <Button
            onClick={handleConnectWallet}
            disabled={isConnecting}
            className="bg-indigo-600 hover:bg-indigo-700 font-bold border border-indigo-500"
          >
            <Wallet className="mr-2 h-4 w-4" />
            {isConnecting ? "Connecting..." : "Link Web3 Wallet"}
          </Button>
        ) : (
          <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-indigo-400 font-mono text-xs font-bold">
              0x7F...3B9A Connected
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Wallet Display */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-16 -right-16 h-48 w-48 bg-emerald-500/10 rounded-full blur-3xl"></div>
            <CardHeader className="border-b border-slate-800/50 pb-4">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Award className="h-5 w-5 text-emerald-400" />
                Your Earned Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {credentials.length === 0 ? (
                <div className="text-center py-12">
                  <Lock className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-400 font-mono text-sm">
                    No Soulbound Tokens earned yet.
                  </p>
                  <p className="text-slate-500 font-mono text-xs mt-2">
                    Attend 100% of a High-Value Seminar Series to unlock.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {credentials.map((cred) => (
                    <div key={cred.id} className="relative group">
                      {/* Token Card */}
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-indigo-500/50 transition-colors z-10 relative flex flex-col md:flex-row gap-6">
                        {/* Token Visual */}
                        <div className="shrink-0 h-32 w-32 bg-indigo-950 border-2 border-indigo-500/30 rounded-lg flex flex-col items-center justify-center relative overflow-hidden shadow-inner shadow-indigo-500/20">
                          <Hexagon className="h-16 w-16 text-indigo-400" />
                          <div className="absolute bottom-2 text-center w-full">
                            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded-full">
                              SBT #{cred.polygon_token_id}
                            </span>
                          </div>
                        </div>

                        {/* Token Data */}
                        <div className="flex-1 flex flex-col justify-center">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-black text-white tracking-tight">
                              {cred.series_title}
                            </h3>
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                              <ShieldCheck className="h-3 w-3" /> Verifiable
                            </span>
                          </div>

                          <p className="text-sm text-slate-400 mb-4">
                            Instructed by:{" "}
                            <strong className="text-slate-300">{cred.speaker}</strong>
                          </p>

                          <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-3 font-mono text-xs">
                            <div>
                              <p className="text-slate-500 mb-1">Issue Date</p>
                              <p className="text-slate-300">{cred.issued_at}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 mb-1">Polygon TX</p>
                              <a
                                href={`https://polygonscan.com/tx/${cred.polygon_tx_hash}`}
                                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 truncate max-w-[120px]"
                              >
                                {cred.polygon_tx_hash} <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* LinkedIn / Public Verification Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-slate-900 border-slate-800 shadow-xl">
            <CardHeader className="bg-slate-950/50 border-b border-slate-800 pb-4">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Linkedin className="h-5 w-5 text-sky-500" />
                Resume Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                Connect your LinkedIn profile to instantly display your Soulbound Tokens as
                verifiable Certifications.
              </p>

              <Button className="w-full bg-[#0a66c2] hover:bg-[#004182] text-white font-bold h-10">
                Add to LinkedIn Profile
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-indigo-950/20 border-indigo-500/20 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-indigo-400 text-sm flex items-center gap-2">
                <Search className="h-4 w-4" />
                How Recruiter Verification Works
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <ul className="text-xs text-indigo-200/80 font-mono space-y-3 list-disc list-outside ml-4">
                <li>When you link an SBT to your resume, it exposes a cryptographic proof URL.</li>
                <li>
                  Recruiters click the link and view the original transaction on the Polygon
                  blockchain.
                </li>
                <li>
                  The Smart Contract strictly enforces that these tokens are Non-Transferable (they
                  cannot be bought or sold).
                </li>
                <li>
                  This provides absolute cryptographic certainty that you physically attended 100%
                  of the course.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SbtCredentialDashboard;
