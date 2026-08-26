import { useMemo } from "react";
import { AlertTriangle, ArrowDownRight, BarChart3, Loader2 } from "lucide-react";
import { EventRoadmap } from "@/components/events/EventRoadmap";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import {
  buildBudgetActualSankeyData,
  formatCurrency,
  type ActualExpense,
  type BudgetLineItem,
  type SankeyLink,
} from "@/lib/budgetActualSankey";
import { ResponsiveContainer, Sankey, Tooltip, type TooltipProps } from "recharts";

type SankeyLinkProps = {
  sourceX?: number;
  sourceY?: number;
  sourceControlX?: number;
  targetX?: number;
  targetY?: number;
  targetControlX?: number;
  linkWidth?: number;
  payload?: SankeyLink;
};

function BudgetSankeyLink({
  sourceX = 0,
  sourceY = 0,
  sourceControlX = sourceX,
  targetX = 0,
  targetY = 0,
  targetControlX = targetX,
  linkWidth = 1,
  payload,
}: SankeyLinkProps) {
  const path = `M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
  const stroke = payload?.overrun ? "#dc2626" : "#2563eb";

  return (
    <path
      d={path}
      fill="none"
      stroke={stroke}
      strokeOpacity={payload?.overrun ? 0.92 : 0.62}
      strokeWidth={Math.max(1, linkWidth)}
      aria-label={payload?.label}
    />
  );
}

function SankeyTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const link = payload[0]?.payload as SankeyLink | undefined;
  if (!link?.label) return null;

  return (
    <div className="neu-border max-w-xs bg-white p-3 font-mono text-xs shadow-[3px_3px_0_0_#000]">
      <p className={`font-black uppercase ${link.overrun ? "text-red-700" : "text-blue-800"}`}>
        {link.overrun ? "Budget overrun" : "Budget flow"}
      </p>
      <p className="mt-1 text-black">{link.label}</p>
      <p className="mt-1 font-bold text-gray-700">Exact flow: {formatCurrency(link.value)}</p>
    </div>
  );
}

interface EventBudgetActualSankeyProps {
  eventId: string;
}

export function EventBudgetActualSankey({ eventId }: EventBudgetActualSankeyProps) {
  const supabase = createClient();

  const { data: eventData } = useQuery({
    queryKey: ["event-budget-actual-host-club", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("host_club_id")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data as { host_club_id: string | null };
    },
    enabled: Boolean(eventId),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["event-budget-actual-sankey", eventId, eventData?.host_club_id],
    queryFn: async () => {
      if (!eventData?.host_club_id) {
        return { budgets: [], actuals: [] };
      }

      const { data: requestData, error: requestError } = await supabase
        .from("funding_requests" as never)
        .select("id, title, status, event_id, funding_line_items(id, description, amount)")
        .eq("club_id", eventData.host_club_id)
        .eq("status", "approved");
      if (requestError) throw requestError;

      const requestRows = (requestData || []) as unknown as Array<Record<string, unknown>>;
      const eventLinkedRequests = requestRows.filter((request) => request.event_id === eventId);
      const fallbackRequests = requestRows.filter(
        (request) => request.event_id === null || request.event_id === undefined,
      );
      const selectedRequests =
        eventLinkedRequests.length > 0 ? eventLinkedRequests : fallbackRequests;

      const reconciledExpenseQuery = await supabase
        .from("expenses" as never)
        .select(
          "id, description, event_id, amount_cents, ocr_amount_cents, ocr_vendor, reconciliation_status, created_at",
        )
        .eq("event_id", eventId)
        .in("reconciliation_status", ["reconciled", "needs_audit"])
        .order("created_at", { ascending: true });

      let actualRows = reconciledExpenseQuery.data as unknown as Array<
        Record<string, unknown>
      > | null;
      if (reconciledExpenseQuery.error || !actualRows?.length) {
        const { data: eventExpenseData, error: eventExpenseError } = await supabase
          .from("event_expenses" as never)
          .select("id, description, total_amount, receipt_url, created_at")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });
        if (eventExpenseError) throw eventExpenseError;
        actualRows = eventExpenseData as unknown as Array<Record<string, unknown>>;
      }

      const budgets: BudgetLineItem[] = selectedRequests.flatMap((request) => {
        const lineItems = Array.isArray(request.funding_line_items)
          ? request.funding_line_items
          : [];
        return lineItems.map((item) => {
          const lineItem = item as Record<string, unknown>;
          return {
            id: String(lineItem.id),
            description: String(lineItem.description || "Unnamed budget item"),
            amount: Number(lineItem.amount) || 0,
            requestTitle: String(request.title || "Approved funding request"),
          };
        });
      });
      const actuals: ActualExpense[] = (actualRows || []).map((expense) => ({
        id: String(expense.id),
        description: String(expense.description || "Unlabeled event expense"),
        amount:
          expense.ocr_amount_cents !== null && expense.ocr_amount_cents !== undefined
            ? (Number(expense.ocr_amount_cents) || 0) / 100
            : expense.amount_cents !== null && expense.amount_cents !== undefined
              ? (Number(expense.amount_cents) || 0) / 100
              : Number(expense.total_amount) || 0,
        vendor: expense.ocr_vendor ? String(expense.ocr_vendor) : null,
        reconciliationStatus: expense.reconciliation_status
          ? String(expense.reconciliation_status)
          : "event_expense",
      }));

      return { budgets, actuals };
    },
    enabled: Boolean(eventId && eventData?.host_club_id),
  });

  const sankeyData = useMemo(
    () => buildBudgetActualSankeyData(data?.budgets || [], data?.actuals || []),
    [data],
  );
  const hasData = sankeyData.nodes.length > 0 && sankeyData.links.length > 0;

  if (isLoading) {
    return (
      <section className="neu-border mt-8 bg-white p-6" aria-busy="true">
        <div className="flex items-center gap-2 font-mono text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading budget flow...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="neu-border mt-8 bg-amber-50 p-6" role="status">
        <p className="flex items-center gap-2 font-mono text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" /> Budget flow is unavailable until funding and expense
          data can be loaded.
        </p>
      </section>
    );
  }

  if (!hasData) {
    return (
      <section className="neu-border mt-8 bg-white p-6" aria-label="Budget versus actual spending">
        <div className="flex items-start gap-3">
          <BarChart3 className="mt-1 h-5 w-5" />
          <div>
            <h3 className="font-display text-xl font-black uppercase">Budget vs actual flow</h3>
            <p className="mt-1 font-mono text-xs leading-5 text-gray-600">
              Approve at least one itemized funding request and log an event expense to generate the
              Sankey flow.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <EventRoadmap eventId={eventId} />
      <section
        className="neu-border mt-8 bg-white p-6"
        aria-labelledby="budget-actual-sankey-title"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-4">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-blue-800">
              Treasurer insight
            </p>
            <h3
              id="budget-actual-sankey-title"
              className="mt-1 font-display text-2xl font-black uppercase"
            >
              Budget vs actual flow
            </h3>
            <p className="mt-2 max-w-2xl font-mono text-xs leading-5 text-gray-600">
              Trace each approved budget bucket into recorded event spending. Red links mark money
              spent above the approved bucket.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right font-mono text-xs sm:grid-cols-4">
            <SummaryMetric label="Approved" value={sankeyData.totals.approved} />
            <SummaryMetric label="Actual" value={sankeyData.totals.actual} />
            <SummaryMetric
              label="Variance"
              value={sankeyData.totals.variance}
              tone={sankeyData.totals.variance > 0 ? "danger" : "good"}
            />
            <SummaryMetric label="Overrun" value={sankeyData.totals.overrun} tone="danger" />
          </div>
        </div>

        <div
          className="mt-4 h-[360px] w-full"
          role="img"
          aria-label="Interactive budget versus actual Sankey diagram"
        >
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={sankeyData}
              nodePadding={24}
              nodeWidth={18}
              linkCurvature={0.5}
              iterations={32}
              margin={{ top: 16, right: 120, bottom: 16, left: 120 }}
              link={<BudgetSankeyLink />}
            >
              <Tooltip content={<SankeyTooltip />} />
            </Sankey>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 border-t-2 border-black pt-3 font-mono text-[11px]">
          <LegendSwatch color="bg-blue-600" label="Approved-to-actual flow" />
          <LegendSwatch color="bg-red-600" label="Overrun flow" />
          <LegendSwatch color="bg-gray-300" label="Unspent or unallocated" />
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2" aria-label="Budget flow details">
          {sankeyData.links
            .filter((link) => link.overrun)
            .map((link) => (
              <div
                key={`${link.source}-${link.target}`}
                className="border-2 border-red-700 bg-red-50 p-3 font-mono text-xs"
              >
                <p className="flex items-center gap-2 font-black uppercase text-red-800">
                  <ArrowDownRight className="h-4 w-4" /> {link.label}
                </p>
                <p className="mt-1 text-red-900">Variance: +{formatCurrency(link.variance)}</p>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}

function SummaryMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "danger" | "good";
}) {
  return (
    <div className="border-2 border-black bg-cream px-2 py-1">
      <span className="block text-[10px] uppercase text-gray-600">{label}</span>
      <strong
        className={
          tone === "danger" ? "text-red-700" : tone === "good" ? "text-green-700" : "text-black"
        }
      >
        {formatCurrency(value)}
      </strong>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-3 w-3 border border-black ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}
