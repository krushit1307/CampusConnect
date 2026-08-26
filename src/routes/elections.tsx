import React, { useState } from 'react';
import { SiteShell } from '@/components/site/SiteShell';
import { RankedChoiceBallot } from '@/components/voting/RankedChoiceBallot';
import { ElectionAuditLedger } from '@/components/voting/ElectionAuditLedger';
import { Election, Candidate, RankedBallot } from '@/types/election';
import { generateCryptographicReceipt } from '@/lib/voting/rankedChoice';
import {
  Vote,
  ShieldCheck,
  Award,
  Users,
  Clock,
  Sparkles,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

export default function ElectionsPage() {
  const [currentUser] = useState({ id: 'student-voter-42', name: 'Jordan Rivera' });
  const [hasVoted, setHasVoted] = useState(false);

  const [candidates] = useState<Candidate[]>([
    {
      id: 'cand-1',
      name: 'Maya Lin',
      major: 'B.S. Computer Science & Public Policy',
      platformSummary: 'Expanding 24/7 Library Hours, Subsidized Cloud Computing Credits, Student Club Grants',
      statement: 'I will advocate for expanded STEM lab access and equitable distribution of campus activity fees.',
      endorsements: ['CS Student Association', 'Women in Computing'],
    },
    {
      id: 'cand-2',
      name: 'Marcus Thorne',
      major: 'B.A. Economics & Political Science',
      platformSummary: 'Campus Dining Affordability, Extended Shuttle Routes, Mental Health Days',
      statement: 'Focusing on transparent student government budgeting and lowering campus dining prices.',
      endorsements: ['Economics Club', 'Debate Society'],
    },
    {
      id: 'cand-3',
      name: 'Elena Rostova',
      major: 'B.S. Biomedical Engineering',
      platformSummary: 'Undergraduate Research Stipends, Sustainable Campus Initiatives, Zero-Waste Cafeterias',
      statement: 'Dedicated to increasing lab research funding and establishing campus solar energy goals.',
      endorsements: ['Pre-Med Society', 'Environmental Action Coalition'],
    },
    {
      id: 'cand-4',
      name: 'David Kim',
      major: 'B.B.A. Finance & Information Systems',
      platformSummary: 'Career Fair Expansion, Alumni Mentorship Network, Free Adobe & MATLAB Licenses',
      statement: 'Bringing top-tier tech and finance recruiters directly to campus with dedicated prep workshops.',
      endorsements: ['Investment Society', 'Hackathon Organizing Committee'],
    },
  ]);

  const [election, setElection] = useState<Election>({
    id: 'elec-2026-spring',
    title: 'Student Government Association Presidential Election 2026',
    description:
      'Official campus-wide election for Student Body President utilizing Ranked-Choice Voting (Instant-Runoff).',
    organization: 'Campus Election Commission',
    startDate: '2026-08-20T08:00:00Z',
    endDate: '2026-08-30T20:00:00Z',
    status: 'active',
    candidates,
    totalEligibleVoters: 14500,
    ballots: [
      { ballotId: 'b-1', voterHash: 'anon-83f19a', timestamp: '2026-08-24T10:15:00Z', rankings: ['cand-1', 'cand-3', 'cand-2', 'cand-4'], signature: '0x99a812bc3' },
      { ballotId: 'b-2', voterHash: 'anon-41cb90', timestamp: '2026-08-24T11:02:00Z', rankings: ['cand-2', 'cand-1', 'cand-4', 'cand-3'], signature: '0x12bb49fc8' },
      { ballotId: 'b-3', voterHash: 'anon-09ee44', timestamp: '2026-08-24T12:45:00Z', rankings: ['cand-3', 'cand-1', 'cand-2', 'cand-4'], signature: '0x88ee410aa' },
      { ballotId: 'b-4', voterHash: 'anon-7128df', timestamp: '2026-08-24T13:20:00Z', rankings: ['cand-1', 'cand-2', 'cand-3', 'cand-4'], signature: '0x3344199dd' },
      { ballotId: 'b-5', voterHash: 'anon-55aa21', timestamp: '2026-08-24T14:10:00Z', rankings: ['cand-4', 'cand-2', 'cand-1', 'cand-3'], signature: '0x7701fae29' },
      { ballotId: 'b-6', voterHash: 'anon-1038dc', timestamp: '2026-08-24T15:05:00Z', rankings: ['cand-1', 'cand-4', 'cand-3', 'cand-2'], signature: '0x99008811e' },
      { ballotId: 'b-7', voterHash: 'anon-64ee91', timestamp: '2026-08-24T15:40:00Z', rankings: ['cand-3', 'cand-4', 'cand-1', 'cand-2'], signature: '0x44883391b' },
      { ballotId: 'b-8', voterHash: 'anon-29aa48', timestamp: '2026-08-24T16:20:00Z', rankings: ['cand-2', 'cand-3', 'cand-1', 'cand-4'], signature: '0x00115599c' },
    ],
  });

  const handleCastBallot = (rankedCandidateIds: string[]) => {
    const { voterHash, signature } = generateCryptographicReceipt(currentUser.id, rankedCandidateIds);
    const newBallot: RankedBallot = {
      ballotId: `ballot-${Date.now()}`,
      voterHash,
      signature,
      rankings: rankedCandidateIds,
      timestamp: new Date().toISOString(),
    };

    setElection((prev) => ({
      ...prev,
      ballots: [newBallot, ...prev.ballots],
    }));
    setHasVoted(true);
  };

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-black pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-lime border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Vote size={24} />
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black">
                  Decentralized Campus Elections
                </h1>
              </div>
              <p className="font-mono text-sm text-gray-600 mt-1">
                {election.title} • Verifiably anonymous Ranked-Choice Voting (IRV).
              </p>
            </div>

            {/* Verification Badge */}
            <div className="flex items-center gap-2 bg-white px-3.5 py-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono text-xs font-bold text-gray-700">
              <ShieldCheck size={18} className="text-emerald-600" />
              <span>Zero-Knowledge Blind Signatures Active</span>
            </div>
          </div>

          {/* Election Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="font-mono text-xs text-gray-500 uppercase">Ballots Cast</div>
              <div className="font-display font-black text-2xl text-black">
                {election.ballots.length}
              </div>
            </div>

            <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="font-mono text-xs text-gray-500 uppercase">Voting System</div>
              <div className="font-display font-black text-2xl text-purple-700">
                Instant-Runoff (RCV)
              </div>
            </div>

            <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="font-mono text-xs text-gray-500 uppercase">Voting Closes In</div>
              <div className="font-display font-black text-2xl text-amber-600">
                5 Days, 8 Hours
              </div>
            </div>
          </div>

          {/* Main 2-Column Voting Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Ranked Choice Ballot */}
            <div>
              <RankedChoiceBallot
                candidates={election.candidates}
                onSubmitBallot={handleCastBallot}
                hasVoted={hasVoted}
              />
            </div>

            {/* Right: Live RCV Tabulation & Audit Ledger */}
            <div>
              <ElectionAuditLedger election={election} />
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
