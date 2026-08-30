import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, CheckCircle2, Clock, XCircle, ExternalLink } from "lucide-react";

interface Props {
  eventId: string;
}

export function ResourceRequestWidget({ eventId }: Props) {
  const supabase = createClient();

  const {
    data: request,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["event_resource_requests", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_resource_requests")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }
      return data;
    },
    enabled: !!eventId,
  });

  if (isLoading) {
    return (
      <div
        className="animate-pulse border-2 border-black bg-gray-100 p-5 shadow-[4px_4px_0_0_#000] h-32"
        data-testid="resource-widget-loading"
      />
    );
  }

  if (error) {
    return (
      <div
        className="border-2 border-black bg-red-50 p-5 shadow-[4px_4px_0_0_#000] text-red-900"
        data-testid="resource-widget-error"
      >
        <div className="flex items-center gap-2">
          <XCircle size={20} />
          <p className="font-mono text-xs font-bold uppercase">Failed to load resource requests</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return null;
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return {
          label: "Pending IT Approval",
          bg: "bg-yellow-300",
          icon: <Clock size={16} />,
        };
      case "submitted":
        return {
          label: "Ticket Created",
          bg: "bg-blue-300",
          icon: <CheckCircle2 size={16} />,
        };
      case "approved":
        return {
          label: "Approved",
          bg: "bg-green-400",
          icon: <CheckCircle2 size={16} />,
        };
      case "failed":
      case "rejected":
        return {
          label: status.charAt(0).toUpperCase() + status.slice(1),
          bg: "bg-red-400",
          icon: <AlertCircle size={16} />,
        };
      default:
        return {
          label: status,
          bg: "bg-gray-300",
          icon: <Clock size={16} />,
        };
    }
  };

  const config = getStatusConfig(request.status);

  return (
    <div
      className="mb-8 border-2 border-black bg-blue-50 p-5 shadow-[4px_4px_0_0_#000]"
      data-testid="resource-widget"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-black uppercase text-blue-900">
            IT & Resource Requests 🖥️
          </h2>
          <p className="font-mono text-xs text-blue-700/80 mt-1">
            Requested resources: {request.resources.join(", ")}
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 border-2 border-black font-mono text-xs font-bold uppercase ${config.bg}`}
          >
            {config.icon}
            {config.label}
          </div>
          {request.external_ticket_id && (
            <a
              href={`#ticket-${request.external_ticket_id}`}
              className="flex items-center gap-1 text-xs font-mono font-bold hover:underline text-blue-900"
            >
              Ticket: {request.external_ticket_id}
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
