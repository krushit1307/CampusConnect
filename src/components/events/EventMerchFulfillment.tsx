import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Database } from "@/types/database.types";
import { Loader2, CheckCircle, Package, Search, Download } from "lucide-react";
import { toast } from "sonner";

type EventMerchOrderRow = Database["public"]["Tables"]["event_merch_orders"]["Row"];
type EventMerchOrderItemRow = Database["public"]["Tables"]["event_merch_order_items"]["Row"];

interface FulfillmentRow {
  order: EventMerchOrderRow;
  items: (EventMerchOrderItemRow & {
    variant?: { size: string; item?: { name: string } };
  })[];
  buyer_name: string | null;
  buyer_email: string | null;
}

interface EventMerchFulfillmentProps {
  eventId: string;
}

export function EventMerchFulfillment({ eventId }: EventMerchFulfillmentProps) {
  const [rows, setRows] = useState<FulfillmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "fulfilled">("all");

  const fetchOrders = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("event_merch_orders")
      .select(
        `
        *,
        items:event_merch_order_items(
          *,
          variant:event_merch_variants(
            size,
            item:event_merch_items(name)
          )
        ),
        buyer:profiles(full_name, email)
      `,
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load fulfillment data.");
    } else if (data) {
      const formatted: FulfillmentRow[] = data.map((row: any) => ({
        order: row,
        items: row.items || [],
        buyer_name: row.buyer?.full_name ?? null,
        buyer_email: row.buyer?.email ?? null,
      }));
      setRows(formatted);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleMarkFulfilled = async (orderId: string) => {
    const { error } = await supabase
      .from("event_merch_orders")
      .update({ fulfillment_status: "fulfilled" })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update fulfillment status.");
    } else {
      toast.success("Order marked as fulfilled.");
      fetchOrders();
    }
  };

  const handleExportCSV = () => {
    const headers = ["Order ID", "Buyer Name", "Buyer Email", "Items", "Total", "Payment Status", "Fulfillment Status", "Pickup Code", "Created At"];
    const lines = [headers.join(",")];

    for (const row of filteredRows) {
      const itemsStr = row.items
        .map((i) => `${i.variant?.item?.name ?? "Unknown"} (${i.variant?.size ?? "?"}) x${i.quantity}`)
        .join("; ");
      const total = `$${((row.order.total_amount || 0) / 100).toFixed(2)}`;
      const values = [
        row.order.id,
        row.buyer_name ?? "",
        row.buyer_email ?? "",
        `"${itemsStr}"`,
        total,
        row.order.payment_status,
        row.order.fulfillment_status,
        row.order.pickup_code ?? "",
        row.order.created_at,
      ];
      lines.push(values.join(","));
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `event-${eventId}-merch-fulfillment.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredRows = rows.filter((row) => {
    if (statusFilter === "pending" && row.order.fulfillment_status !== "pending") return false;
    if (statusFilter === "fulfilled" && row.order.fulfillment_status !== "fulfilled") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = row.buyer_name?.toLowerCase().includes(q);
      const matchesEmail = row.buyer_email?.toLowerCase().includes(q);
      const matchesItems = row.items.some((i) =>
        i.variant?.item?.name?.toLowerCase().includes(q),
      );
      return matchesName || matchesEmail || matchesItems;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Merch Fulfillment</h3>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-400">
            {rows.length} order{rows.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={rows.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/10 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 bg-transparent text-xs text-white outline-none placeholder:text-gray-500"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "fulfilled"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s
                  ? "bg-indigo-600 text-white"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <Package className="mx-auto mb-2 h-8 w-8 text-gray-500" />
          <p className="text-sm text-gray-400">
            {rows.length === 0
              ? "No merch orders yet."
              : "No orders match your filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Buyer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Fulfillment</th>
                <th className="px-4 py-3 font-medium">Pickup Code</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRows.map((row) => (
                <tr key={row.order.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{row.buyer_name ?? "Unknown"}</div>
                    <div className="text-gray-500">{row.buyer_email ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {row.items.map((item, i) => (
                        <div key={i} className="text-gray-300">
                          {item.variant?.item?.name ?? "Unknown"} —{" "}
                          <span className="text-indigo-300">{item.variant?.size ?? "?"}</span>
                          {" × "}
                          {item.quantity}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    ${((row.order.total_amount || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.order.payment_status === "captured"
                          ? "bg-green-500/10 text-green-400"
                          : row.order.payment_status === "pending"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {row.order.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.order.fulfillment_status === "fulfilled"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {row.order.fulfillment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {row.order.pickup_code ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.order.fulfillment_status === "pending" &&
                      row.order.payment_status === "captured" && (
                        <button
                          type="button"
                          onClick={() => handleMarkFulfilled(row.order.id)}
                          className="flex items-center gap-1 rounded-lg bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400 transition hover:bg-green-500/20"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Fulfill
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default EventMerchFulfillment;
