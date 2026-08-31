import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SiteShell } from '@/components/site/SiteShell';
import { CoHostApprovalCard } from '@/components/events/CoHostApprovalCard';
import { InviteCoHostModal } from '@/components/events/InviteCoHostModal';
import { CoHostPartnership, CoHostClub, CoHostInvitePayload } from '@/types/cohost';
import {
  Handshake,
  ArrowLeft,
  Plus,
  Inbox,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export default function ClubPartnershipsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const availableClubs: CoHostClub[] = [
    { id: 'c-acm', name: 'ACM Student Chapter', slug: 'acm', category: 'Technology', presidentName: 'David Kim' },
    { id: 'c-wic', name: 'Women in Computing (WiC)', slug: 'wic', category: 'Technology', presidentName: 'Maya Lin' },
    { id: 'c-robotics', name: 'Campus Robotics Coalition', slug: 'robotics', category: 'Engineering', presidentName: 'Marcus Thorne' },
    { id: 'c-design', name: 'Design & UX Guild', slug: 'design-guild', category: 'Arts & Design', presidentName: 'Elena Rostova' },
  ];

  const [partnerships, setPartnerships] = useState<CoHostPartnership[]>([
    {
      id: 'part-1',
      eventId: 'evt-101',
      eventTitle: 'Annual 24-Hour AI Hackathon 2026',
      eventDate: 'Oct 22, 2026',
      eventLocation: 'Grand Ballroom & Makerspace',
      initiatingClub: availableClubs[0], // ACM
      invitedClub: { id: 'c-current', name: slug ? `${slug.toUpperCase()} Club` : 'Your Club', slug: slug || 'club', category: 'Engineering', presidentName: 'You (Alex)' },
      status: 'pending',
      requestedAt: '2026-08-28T10:00:00Z',
      grantExecutivePermissions: true,
    },
    {
      id: 'part-2',
      eventId: 'evt-102',
      eventTitle: 'Introduction to Generative 3D Modeling Workshop',
      eventDate: 'Nov 05, 2026',
      eventLocation: 'West Lab 104',
      initiatingClub: { id: 'c-current', name: slug ? `${slug.toUpperCase()} Club` : 'Your Club', slug: slug || 'club', category: 'Engineering', presidentName: 'You (Alex)' },
      invitedClub: availableClubs[3], // Design Guild
      status: 'approved',
      requestedAt: '2026-08-25T14:00:00Z',
      grantExecutivePermissions: true,
    },
  ]);

  const handleApprove = (id: string) => {
    setPartnerships((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'approved' } : p))
    );
  };

  const handleDecline = (id: string) => {
    setPartnerships((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'declined' } : p))
    );
  };

  const handleSendInvite = (payload: CoHostInvitePayload) => {
    const target = availableClubs.find((c) => c.id === payload.targetClubId) || availableClubs[0];
    const newPartnership: CoHostPartnership = {
      id: `part-${Date.now()}`,
      eventId: payload.eventId,
      eventTitle: 'Spring Inter-Club Tech Showcase 2027',
      eventDate: 'Dec 10, 2026',
      eventLocation: 'Student Union Hall',
      initiatingClub: { id: 'c-current', name: slug ? `${slug.toUpperCase()} Club` : 'Your Club', slug: slug || 'club', category: 'Engineering', presidentName: 'You (Alex)' },
      invitedClub: target,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      grantExecutivePermissions: payload.grantExecutivePermissions,
    };
    setPartnerships([newPartnership, ...partnerships]);
  };

  const incomingList = partnerships.filter((p) => p.invitedClub.id === 'c-current');
  const outgoingList = partnerships.filter((p) => p.initiatingClub.id === 'c-current');

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-black pb-6">
            <div className="flex items-center gap-3">
              <Link
                to={`/clubs/${slug}`}
                className="neu-border bg-white p-2.5 hover:bg-gray-50 flex items-center justify-center transition-transform hover:-translate-y-0.5"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-lime border-2 border-black rounded">
                    <Handshake size={20} />
                  </span>
                  <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight text-black">
                    Cross-Club Co-Hosting & Partnerships
                  </h1>
                </div>
                <p className="font-mono text-xs text-gray-600 mt-0.5">
                  Formal co-hosting handshake protocol for shared event administration & multi-profile surfacing.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="neu-border bg-lime hover:bg-lime/90 px-4 py-2.5 font-mono text-xs font-black uppercase text-black flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-transform"
            >
              <Plus size={16} /> Invite Co-Host
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="neu-border bg-white p-1.5 flex items-center gap-2 max-w-fit font-mono text-xs font-bold uppercase">
            <button
              onClick={() => setActiveTab('incoming')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
                activeTab === 'incoming'
                  ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <Inbox size={15} /> Incoming Requests ({incomingList.length})
            </button>
            <button
              onClick={() => setActiveTab('outgoing')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
                activeTab === 'outgoing'
                  ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <Send size={15} /> Outgoing Invitations ({outgoingList.length})
            </button>
          </div>

          {/* Partnerships Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(activeTab === 'incoming' ? incomingList : outgoingList).map((partnership) => (
              <CoHostApprovalCard
                key={partnership.id}
                partnership={partnership}
                isIncoming={activeTab === 'incoming'}
                onApprove={handleApprove}
                onDecline={handleDecline}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteCoHostModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        availableClubs={availableClubs}
        onSendInvite={handleSendInvite}
      />
    </SiteShell>
  );
}
