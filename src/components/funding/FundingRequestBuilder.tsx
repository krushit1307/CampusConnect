import { useState } from "react";
import { CheckCircle2, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@/hooks/useReactQueryReplacement";
import {
  calculateFundingTotal,
  fetchClubFundingRequests,
  submitFundingRequest,
  type FundingLineItemInput,
  type FundingRequest,
} from "@/lib/fundingWorkflow";

const EMPTY_ITEM: FundingLineItemInput = { description: "", amount: 0, quote_url: "" };

const statusStyles: Record<FundingRequest["status"], string> = {
  pending: "bg-amber-100 text-amber-900",
  under_review: "bg-blue-100 text-blue-900",
  approved: "bg-green-100 text-green-900",
  denied: "bg-red-100 text-red-900",
};

export function FundingRequestBuilder({ clubId }: { clubId: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<FundingLineItemInput[]>([{ ...EMPTY_ITEM }]);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["club-funding-requests", clubId],
    queryFn: () => fetchClubFundingRequests(clubId),
    enabled: Boolean(clubId),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitFundingRequest(clubId, title, items),
    onSuccess: () => {
      toast.success("Funding request submitted to the Student Union.");
      setTitle("");
      setItems([{ ...EMPTY_ITEM }]);
      queryClient.invalidateQueries({ queryKey: ["club-funding-requests", clubId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateItem = (index: number, patch: Partial<FundingLineItemInput>) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  };

  const total = calculateFundingTotal(items);

  return (
    <div className="space-y-6">
      <section className="neu-border bg-peach p-5 shadow-[4px_4px_0_0_#000]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
              Student Union funding
            </p>
            <h2 className="mt-1 font-display text-2xl font-black uppercase">Request a budget</h2>
            <p className="mt-2 max-w-2xl font-mono text-xs leading-5 text-gray-700">
              Build an itemized proposal, attach quote links, and track the decision from one place.
            </p>
          </div>
          <FileText className="h-8 w-8 shrink-0" />
        </div>
      </section>

      <form
        className="neu-border space-y-5 bg-white p-5 shadow-[4px_4px_0_0_#000]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) {
            toast.error("Add a title for the funding request.");
            return;
          }
          submitMutation.mutate();
        }}
      >
        <div>
          <label className="mb-1 block font-mono text-xs font-bold uppercase">Request title</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Portable speaker for welcome week"
            className="neu-border w-full p-3 font-mono text-sm"
            maxLength={160}
            required
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 border-b-2 border-black pb-2">
            <div>
              <h3 className="font-display text-lg font-black uppercase">Line items</h3>
              <p className="font-mono text-[11px] text-gray-500">
                Each item needs a positive amount.
              </p>
            </div>
            <span className="font-mono text-sm font-black">Total: ${total.toFixed(2)}</span>
          </div>

          {items.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 border-2 border-black bg-cream p-3 md:grid-cols-[1fr_150px_1fr_auto]"
            >
              <input
                value={item.description}
                onChange={(event) => updateItem(index, { description: event.target.value })}
                placeholder="Item description"
                className="neu-border p-2 font-mono text-xs"
                required
              />
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={item.amount || ""}
                onChange={(event) => updateItem(index, { amount: Number(event.target.value) })}
                placeholder="Amount"
                className="neu-border p-2 font-mono text-xs"
                required
              />
              <input
                type="url"
                value={item.quote_url}
                onChange={(event) => updateItem(index, { quote_url: event.target.value })}
                placeholder="Quote URL (optional)"
                className="neu-border p-2 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
                disabled={items.length === 1}
                aria-label="Remove line item"
                className="neu-border bg-white p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}
            className="neu-border flex items-center gap-2 bg-lime px-3 py-2 font-mono text-xs font-bold uppercase"
          >
            <Plus className="h-4 w-4" /> Add line item
          </button>
        </div>

        <button
          type="submit"
          disabled={submitMutation.isPending}
          className="neu-border neu-press flex w-full items-center justify-center gap-2 bg-black p-3 font-mono text-sm font-bold uppercase text-white disabled:opacity-50"
        >
          {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit request
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <h3 className="font-display text-xl font-black uppercase">Request history</h3>
          <span className="font-mono text-xs text-gray-500">{requests.length} total</span>
        </div>
        {isLoading ? (
          <div className="neu-border bg-white p-6 text-center font-mono text-xs">
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="neu-border bg-white p-6 text-center font-mono text-xs text-gray-500">
            No funding requests yet.
          </div>
        ) : (
          requests.map((request) => (
            <article key={request.id} className="neu-border bg-white p-4 shadow-[3px_3px_0_0_#000]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-display text-lg font-black uppercase">{request.title}</h4>
                  <p className="font-mono text-xs text-gray-500">
                    Submitted {new Date(request.created_at).toLocaleDateString()} · $
                    {Number(request.total_amount).toFixed(2)}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 font-mono text-[10px] font-black uppercase ${statusStyles[request.status]}`}
                >
                  {request.status.replace("_", " ")}
                </span>
              </div>
              {request.review_notes && (
                <p className="mt-3 border-l-4 border-black bg-cream p-3 font-mono text-xs">
                  Review note: {request.review_notes}
                </p>
              )}
              {request.status === "approved" && (
                <p className="mt-3 flex items-center gap-2 font-mono text-xs font-bold text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Funds reconciled to the club ledger.
                </p>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
