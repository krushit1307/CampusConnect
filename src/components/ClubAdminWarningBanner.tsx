import { useNavigate } from 'react-router-dom';

interface BannerProps {
  clubId: string;
  clubSlug: string;
  currentStatus: 'active' | 'warning_issued' | 'hibernated' | 'decertified';
  warningIssuedAt?: string;
}

export default function ClubAdminWarningBanner({ clubId, clubSlug, currentStatus, warningIssuedAt }: BannerProps) {
  const navigate = useNavigate();

  if (currentStatus !== 'warning_issued') return null;

  // Calculate approximate clearance deadlines remaining
  const daysRemaining = warningIssuedAt 
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(warningIssuedAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 30;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in slide-in-from-top">
      <div className="flex items-start gap-3">
        <span className="text-xl p-1 bg-amber-100 rounded-lg text-amber-800">⚠️</span>
        <div>
          <h4 className="text-sm font-black text-amber-900 tracking-tight">
            Your club is at risk of decertification due to inactivity.
          </h4>
          <p className="text-xs text-amber-700 mt-0.5 max-w-2xl leading-relaxed">
            The platform registered no operational tracking entries for this organization over the past semester. You have exactly <strong className="font-bold underline">{daysRemaining} days</strong> left to publish an upcoming event layout before this profile is auto-hibernated and hidden from public directories.
          </p>
        </div>
      </div>

      <button
        onClick={() => navigate(`/clubs/${clubSlug}/manage?tab=events`)}
        className="px-4 py-2 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm whitespace-nowrap transition"
      >
        ➕ Create Event Now
      </button>
    </div>
  );
}
