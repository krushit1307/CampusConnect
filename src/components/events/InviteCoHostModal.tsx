import React, { useState } from 'react';
import { CoHostClub, CoHostInvitePayload } from '@/types/cohost';
import { X, Handshake, ShieldCheck, Check } from 'lucide-react';

interface InviteCoHostModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableClubs: CoHostClub[];
  onSendInvite: (payload: CoHostInvitePayload) => void;
}

export function InviteCoHostModal({
  isOpen,
  onClose,
  availableClubs,
  onSendInvite,
}: InviteCoHostModalProps) {
  const [selectedClubId, setSelectedClubId] = useState(availableClubs[0]?.id || '');
  const [grantPermissions, setGrantPermissions] = useState(true);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClubId) return;

    onSendInvite({
      eventId: 'evt-draft-1',
      targetClubId: selectedClubId,
      grantExecutivePermissions: grantPermissions,
      invitationMessage: message,
    });

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white border-4 border-black rounded-lg max-w-md w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 border-2 border-black rounded hover:bg-gray-100"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 bg-lime border-2 border-black rounded">
            <Handshake size={20} />
          </div>
          <h2 className="text-xl font-display font-black text-black">
            Invite Co-Hosting Partner Club
          </h2>
        </div>
        <p className="text-xs font-mono text-gray-600 mb-4">
          Co-hosting shares event visibility on both club profiles & grants executive management access.
        </p>

        {isSuccess ? (
          <div className="p-6 text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-100 border-2 border-emerald-600 rounded-full flex items-center justify-center mx-auto text-emerald-700">
              <Check size={24} />
            </div>
            <h3 className="font-display font-black text-lg text-black">Invitation Dispatched!</h3>
            <p className="font-mono text-xs text-gray-600">
              Partner club president has been notified for formal handshake approval.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
            <div>
              <label className="block font-bold uppercase text-gray-700 mb-1">
                Select Partner Club
              </label>
              <select
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                className="w-full p-2.5 border-2 border-black rounded bg-white font-bold"
              >
                {availableClubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name} ({club.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-gray-700 mb-1">
                Invitation Note / Role Distribution
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. We would love to collaborate on the spring hackathon keynote & split workshop slots!"
                className="w-full p-2.5 border-2 border-black rounded bg-white font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="grant-perms"
                checked={grantPermissions}
                onChange={(e) => setGrantPermissions(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-black accent-lime"
              />
              <label htmlFor="grant-perms" className="font-bold text-gray-800 cursor-pointer">
                Grant partner executives full Check-In Scanner & RSVP management rights
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border-2 border-black rounded font-bold uppercase hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-lime hover:bg-lime/90 border-2 border-black rounded font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Send Partnership Request
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
