import { useMemo, useState } from "react";
import { Check, ChevronRight, Clock3, FileText, Loader2, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@/hooks/useReactQueryReplacement";
import {
  fetchFundingRequestsForReview,
  setFundingRequestStatus,
  type FundingRequest,
  type FundingRequestStatus,
} from "@/lib/fundingWorkflow";

const columns: Array<{
  status: FundingRequestStatus;
  label: string;
  tone: string;
}> = [
  { status: "pending", label: "Pending", tone: "bg-amber-100" },
  { status: "under_review", label: "Under Review", tone: "bg-blue-100" },
  { status: "approved", label: "Approved", tone: "bg-green-100" },
  { status: "denied", label: "Denied", tone: "bg-red-100" },
];

export function FundingRequestKanban() {
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const {
    data: requests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["funding-requests-review"],
    queryFn: fetchFundingRequestsForReview,
  });

  const statusMutation = useMutation({
    mutationFn: ({
      requestId,
      status,
    }: {
      requestId: string;
      status: Exclude<FundingRequestStatus, "pending">;
    }) => setFundingRequestStatus(requestId, status, notes[requestId]),
    onSuccess: () => {
      toast.success("Funding request updated.");
      setExpandedId(null);
      queryClient.invalidateQueries({ queryKey: ["funding-requests-review"] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<FundingRequestStatus, FundingRequest[]>();
    columns.forEach((column) => map.set(column.status, []));
    requests.forEach((request) => map.get(request.status)?.push(request));
    return map;
  }, [requests]);

  const moveRequest = (requestId: string, status: Exclude<FundingRequestStatus, "pending">) => {
    statusMutation.mutate({ requestId, status });
  };

  if (isLoading) {
    return (
      <div className="neu-border bg-white p-10 text-center font-mono text-sm">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" /> Loading funding requests...
      </div>
    );
  }

  if (error) {
    return (
      <div className="neu-border bg-red-50 p-6 font-mono text-sm text-red-800">
        Unable to load funding requests.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="neu-border bg-peach p-6 shadow-[4px_4px_0_0_#000]">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
          Student Union finance desk
        </p>
        <h1 className="mt-1 font-display text-3xl font-black uppercase">Funding request board</h1>
        <p className="mt-2 max-w-3xl font-mono text-xs leading-5 text-gray-700">
          Drag a card into Under Review, Approved, or Denied. Approval posts the grant as income to
          the club ledger exactly once.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const columnRequests = grouped.get(column.status) ?? [];
          return (
            <section
              key={column.status}
              className={`min-h-[360px] border-2 border-black p-3 ${column.tone}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedId && column.status !== "pending") moveRequest(draggedId, column.status);
                setDraggedId(null);
              }}
            >
              <div className="mb-3 flex items-center justify-between border-b-2 border-black pb-2">
                <h2 className="font-display text-lg font-black uppercase">{column.label}</h2>
                <span className="rounded-full bg-black px-2 py-1 font-mono text-[10px] font-bold text-white">
                  {columnRequests.length}
                </span>
              </div>

              <div className="space-y-3">
                {columnRequests.map((request) => (
                  <FundingRequestCard
                    key={request.id}
                    request={request}
                    isExpanded={expandedId === request.id}
                    note={notes[request.id] ?? ""}
                    isPending={statusMutation.isPending}
                    onDragStart={() => setDraggedId(request.id)}
                    onToggle={() => setExpandedId(expandedId === request.id ? null : request.id)}
                    onNoteChange={(note) =>
                      setNotes((current) => ({ ...current, [request.id]: note }))
                    }
                    onMove={(status) => moveRequest(request.id, status)}
                  />
                ))}
                {columnRequests.length === 0 && (
                  <p className="border-2 border-dashed border-black/40 p-4 text-center font-mono text-[11px] text-gray-600">
                    Drop requests here
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function FundingRequestCard({
  request,
  isExpanded,
  note,
  isPending,
  onDragStart,
  onToggle,
  onNoteChange,
  onMove,
}: {
  request: FundingRequest;
  isExpanded: boolean;
  note: string;
  isPending: boolean;
  onDragStart: () => void;
  onToggle: () => void;
  onNoteChange: (note: string) => void;
  onMove: (status: Exclude<FundingRequestStatus, "pending">) => void;
}) {
  return (
    <article
      draggable={request.status !== "approved" && request.status !== "denied"}
      onDragStart={onDragStart}
      className="cursor-grab border-2 border-black bg-white p-3 shadow-[3px_3px_0_0_#000] active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase text-gray-500">
            {request.club_name ?? "Club"}
          </p>
          <h3 className="mt-1 font-display text-base font-black uppercase leading-tight">
            {request.title}
          </h3>
        </div>
        <FileText className="h-4 w-4 shrink-0" />
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-xs">
        <span className="font-black">${Number(request.total_amount).toFixed(2)}</span>
        <span className="flex items-center gap-1 text-gray-500">
          <Clock3 className="h-3 w-3" /> {new Date(request.created_at).toLocaleDateString()}
        </span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="mt-3 flex w-full items-center justify-between border-t-2 border-black pt-2 font-mono text-[10px] font-bold uppercase"
      >
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> {isExpanded ? "Close review" : "Review details"}
        </span>
        <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 border-t border-black pt-3">
          <div className="space-y-2">
            {request.funding_line_items?.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 font-mono text-[11px]">
                <span>{item.description}</span>
                <span className="shrink-0 font-bold">${Number(item.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Review notes for the club..."
            rows={3}
            className="neu-border w-full p-2 font-mono text-[11px]"
          />
          <div className="grid grid-cols-3 gap-2">
            {request.status === "pending" && (
              <button
                type="button"
                onClick={() => onMove("under_review")}
                disabled={isPending}
                className="neu-border bg-blue-600 px-2 py-2 font-mono text-[10px] font-bold uppercase text-white disabled:opacity-50"
              >
                <Clock3 className="mx-auto h-3 w-3" /> Review
              </button>
            )}
            {request.status !== "approved" && (
              <button
                type="button"
                onClick={() => onMove("approved")}
                disabled={isPending}
                className="neu-border bg-green-600 px-2 py-2 font-mono text-[10px] font-bold uppercase text-white disabled:opacity-50"
              >
                <Check className="mx-auto h-3 w-3" /> Approve
              </button>
            )}
            {request.status !== "denied" && (
              <button
                type="button"
                onClick={() => onMove("denied")}
                disabled={isPending}
                className="neu-border bg-red-600 px-2 py-2 font-mono text-[10px] font-bold uppercase text-white disabled:opacity-50"
              >
                <X className="mx-auto h-3 w-3" /> Deny
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
