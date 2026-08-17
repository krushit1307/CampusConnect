import { useMemo, useState } from "react";
import { useQuery, useMutation, queryClient } from "@/hooks/useReactQueryReplacement";
import { toast } from "sonner";
import { Gavel, UserCheck, UserMinus, UserX, Users, AlertTriangle } from "lucide-react";
import {
  meetingQuorumService,
  type MeetingRosterEntry,
  type MeetingSnapshot,
} from "@/services/meetingQuorumService";
import {
  describeQuorum,
  summariseRejections,
  type AttendanceStatus,
  type ProxyRejectionReason,
} from "@/lib/meetingQuorum";

interface QuorumPanelProps {
  clubId: string;
}

const REJECTION_LABELS: Record<ProxyRejectionReason, string> = {
  self_delegation: "Delegated to themselves",
  unknown_delegator: "Delegator not on the roll",
  unknown_delegate: "Delegate not on the roll",
  delegator_ineligible: "Delegator has no vote",
  delegate_ineligible: "Delegate has no vote",
  duplicate_delegation: "Delegated more than once",
  delegator_attended: "Delegator attended in person",
  revoked: "Withdrawn before the meeting",
  cycle_detected: "Delegation loops back on itself",
  chain_too_deep: "Delegation chain too long",
  delegate_absent: "Delegate did not attend",
  delegate_cap_exceeded: "Delegate already at the proxy cap",
};

const ATTENDANCE_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  icon: typeof UserCheck;
}> = [
  { value: "present", label: "Present", icon: UserCheck },
  { value: "excused", label: "Excused", icon: UserMinus },
  { value: "absent", label: "Absent", icon: UserX },
];

/**
 * Live quorum panel for a club meeting.
 *
 * The numbers on screen come straight from the quorum engine, so the figure the
 * chair reads out is the same one the minutes will record.
 */
export function QuorumPanel({ clubId }: QuorumPanelProps) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ["club-meetings", clubId],
    queryFn: () => meetingQuorumService.listMeetings(clubId),
    enabled: !!clubId,
  });

  const activeMeetingId = selectedMeetingId ?? meetings[0]?.id ?? null;

  const { data: snapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: ["meeting-quorum", activeMeetingId],
    queryFn: () => meetingQuorumService.getSnapshot(activeMeetingId as string),
    enabled: !!activeMeetingId,
  });

  const attendanceMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: AttendanceStatus }) =>
      meetingQuorumService.setAttendance(activeMeetingId as string, userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-quorum", activeMeetingId] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not record attendance");
    },
  });

  const rejections = useMemo(
    () => (snapshot ? summariseRejections(snapshot.report.proxies) : []),
    [snapshot],
  );

  if (meetingsLoading) {
    return <div className="neu-border h-40 animate-pulse bg-white" />;
  }

  if (meetings.length === 0) {
    return (
      <div className="neu-border bg-white p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Gavel className="h-5 w-5" /> Meeting Quorum
        </h2>
        <p className="mt-3 font-mono text-sm text-gray-500">
          No meetings have been scheduled for this club yet. Once a meeting is opened, attendance
          and proxy votes are tracked here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="neu-border bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Gavel className="h-5 w-5" /> Meeting Quorum
          </h2>
          <select
            value={activeMeetingId ?? ""}
            onChange={(event) => setSelectedMeetingId(event.target.value)}
            className="neu-border bg-white px-3 py-2 font-mono text-xs uppercase"
            aria-label="Select meeting"
          >
            {meetings.map((meeting) => (
              <option key={meeting.id} value={meeting.id}>
                {meeting.title} — {new Date(meeting.scheduled_for).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        {snapshotLoading || !snapshot ? (
          <div className="h-24 animate-pulse bg-gray-100" />
        ) : (
          <QuorumSummary snapshot={snapshot} />
        )}
      </div>

      {snapshot && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="neu-border bg-white p-4 sm:p-6">
            <h3 className="mb-3 flex items-center gap-2 border-b-2 border-black pb-2 font-bold">
              <Users className="h-4 w-4" /> Roll call
            </h3>
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {snapshot.roster.map((entry) => (
                <RosterRow
                  key={entry.userId}
                  entry={entry}
                  disabled={attendanceMutation.isPending}
                  onChange={(status) => attendanceMutation.mutate({ userId: entry.userId, status })}
                />
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <div className="neu-border bg-white p-4 sm:p-6">
              <h3 className="mb-3 border-b-2 border-black pb-2 font-bold">
                Voting power in the room
              </h3>
              {snapshot.report.breakdown.length === 0 ? (
                <p className="font-mono text-sm text-gray-500">Nobody has checked in yet.</p>
              ) : (
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 uppercase text-gray-500">
                      <th className="py-2">Member</th>
                      <th className="py-2 text-right">Own</th>
                      <th className="py-2 text-right">Proxies</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.report.breakdown.map((row) => (
                      <tr key={row.delegateId} className="border-b border-gray-100">
                        <td className="py-2">{nameFor(snapshot, row.delegateId)}</td>
                        <td className="py-2 text-right">{row.ownWeight}</td>
                        <td className="py-2 text-right">
                          {row.proxyCount > 0 ? `+${row.proxyWeight} (${row.proxyCount})` : "—"}
                        </td>
                        <td className="py-2 text-right font-bold">{row.totalWeight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {rejections.length > 0 && (
              <div className="neu-border bg-peach/20 p-4 sm:p-6">
                <h3 className="mb-3 flex items-center gap-2 border-b-2 border-black pb-2 font-bold">
                  <AlertTriangle className="h-4 w-4" /> Proxies not counted
                </h3>
                <ul className="space-y-2 font-mono text-xs">
                  {rejections.map((rejection) => (
                    <li key={rejection.reason} className="flex items-start justify-between gap-3">
                      <span>
                        <strong>{REJECTION_LABELS[rejection.reason]}</strong>
                        <span className="block text-gray-600">{rejection.detail}</span>
                      </span>
                      <span className="neu-border bg-white px-2 py-1">{rejection.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuorumSummary({ snapshot }: { snapshot: MeetingSnapshot }) {
  const { report } = snapshot;
  const progress =
    report.requiredPower > 0
      ? Math.min(100, Math.round((report.effectivePower / report.requiredPower) * 100))
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-bold">{describeQuorum(report)}</p>
        <span
          className={`neu-border px-3 py-1 font-mono text-xs font-bold uppercase ${
            report.met ? "bg-lime" : "bg-peach"
          }`}
        >
          {report.met ? "Quorate" : "Not quorate"}
        </span>
      </div>

      <div className="h-4 w-full border-2 border-black bg-white">
        <div
          className={`h-full ${report.met ? "bg-lime" : "bg-peach"}`}
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
        <Stat label="In person" value={`${report.presentPower} (${report.presentCount})`} />
        <Stat label="By proxy" value={`${report.proxyPower}`} />
        <Stat label="Required" value={`${report.requiredPower}`} />
        <Stat label="Total roll" value={`${report.basePower} (${report.eligibleCount})`} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="neu-border bg-white p-3">
      <dt className="uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-base font-bold">{value}</dd>
    </div>
  );
}

function RosterRow({
  entry,
  disabled,
  onChange,
}: {
  entry: MeetingRosterEntry;
  disabled: boolean;
  onChange: (status: AttendanceStatus) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{entry.displayName}</span>
        <span className="font-mono text-[11px] uppercase text-gray-500">
          {entry.tier}
          {entry.eligibleToVote ? "" : " · no vote"}
        </span>
      </span>
      <span className="flex shrink-0 gap-1">
        {ATTENDANCE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = entry.status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              title={option.label}
              aria-label={`${option.label}: ${entry.displayName}`}
              aria-pressed={active}
              className={`neu-border p-1.5 transition-colors disabled:opacity-50 ${
                active ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </span>
    </li>
  );
}

function nameFor(snapshot: MeetingSnapshot, userId: string): string {
  return snapshot.roster.find((entry) => entry.userId === userId)?.displayName ?? "Unknown member";
}

export default QuorumPanel;
