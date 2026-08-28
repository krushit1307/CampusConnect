import React, { useState, useEffect } from "react";
import { Server, Zap, Trash2, ShieldCheck, Activity, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { toast } from "sonner";

interface HardwareProvisioningPanelProps {
  eventId: string;
  clubId: string;
}

export const HardwareProvisioningPanel: React.FC<HardwareProvisioningPanelProps> = ({
  eventId,
  clubId,
}) => {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [quantity, setQuantity] = useState(50);
  const [provider, setProvider] = useState("aws_ec2");
  const [resourceType, setResourceType] = useState("t3.micro");
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);

  const { data: request, isLoading } = useQuery({
    queryKey: ["hardware_request", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hardware_provisioning_requests")
        .select("*, hardware_provisioned_resources(id, status, public_ip, attendee_id)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 is not found
      return data;
    },
  });

  // Real-time subscription to track provisioning progress
  useEffect(() => {
    if (!request) return;

    const channel = supabase
      .channel("hardware_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hardware_provisioning_requests",
          filter: `id=eq.${request.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["hardware_request", eventId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hardware_provisioned_resources",
          filter: `request_id=eq.${request.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["hardware_request", eventId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [request?.id, eventId, queryClient, supabase]);

  const provisionMutation = useMutation({
    mutationFn: async () => {
      setIsProvisioning(true);
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hardware-provisioning`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({
            action: "provision",
            eventId,
            clubId,
            provider,
            resourceType,
            quantity,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Provisioning failed");
      return result;
    },
    onSuccess: () => {
      toast.success("Provisioning started successfully!");
      queryClient.invalidateQueries({ queryKey: ["hardware_request", eventId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to start provisioning");
    },
    onSettled: () => setIsProvisioning(false),
  });

  const terminateMutation = useMutation({
    mutationFn: async () => {
      if (!request) return;
      setIsTerminating(true);
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hardware-provisioning`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({
            action: "terminate_manual",
            requestId: request.id,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Termination failed");
      return result;
    },
    onSuccess: () => {
      toast.success("Termination started successfully!");
      queryClient.invalidateQueries({ queryKey: ["hardware_request", eventId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to terminate resources");
    },
    onSettled: () => setIsTerminating(false),
  });

  const assignAttendeesMutation = useMutation({
    mutationFn: async () => {
      if (!request) return;
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hardware-provisioning`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({
            action: "assign_attendees",
            requestId: request.id,
            eventId,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Assignment failed");
      return result;
    },
    onSuccess: (data) => {
      toast.success(`Assigned ${data.assignedCount} VMs to attendees.`);
      queryClient.invalidateQueries({ queryKey: ["hardware_request", eventId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign attendees");
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 border rounded-xl animate-pulse bg-gray-50 h-40">
        Loading hardware panel...
      </div>
    );
  }

  const isRequestActive = request && !["terminated", "failed"].includes(request.status);

  return (
    <div className="border-2 border-black rounded-xl bg-white overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="p-4 bg-indigo-100 border-b-2 border-black flex items-center gap-3">
        <Server className="w-6 h-6 text-indigo-700" />
        <div>
          <h3 className="font-bold text-sm uppercase text-indigo-950">
            Cloud Hardware Provisioning
          </h3>
          <p className="text-xs font-sans text-indigo-800">
            Provision temporary compute environments for hackathons or workshops.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5 font-mono">
        {isRequestActive ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border-2 border-black rounded-lg bg-gray-50">
              <div className="flex items-center gap-3">
                <Activity
                  className={cn(
                    "w-5 h-5",
                    request.status === "active"
                      ? "text-emerald-500"
                      : "text-amber-500 animate-pulse",
                  )}
                />
                <div>
                  <div className="font-bold text-sm uppercase">Status: {request.status}</div>
                  <div className="text-xs text-gray-600">
                    {request.hardware_provisioned_resources?.length || 0} VMs Provisioned
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to terminate these resources manually? This cannot be undone.",
                    )
                  ) {
                    terminateMutation.mutate();
                  }
                }}
                disabled={isTerminating || request.status === "terminating"}
                className="px-3 py-1.5 border-2 border-black bg-rose-500 text-white font-bold text-xs uppercase rounded hover:bg-rose-600 disabled:opacity-50 flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isTerminating ? "Terminating..." : "Terminate Resources"}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 border-2 border-black rounded-lg bg-emerald-50">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="font-bold text-sm uppercase">Attendee Assignment</div>
                  <div className="text-xs text-gray-600">
                    Automatically map VMs to checked-in attendees securely.
                  </div>
                </div>
              </div>
              <button
                onClick={() => assignAttendeesMutation.mutate()}
                disabled={assignAttendeesMutation.isPending || request.status !== "active"}
                className="px-3 py-1.5 border-2 border-black bg-emerald-600 text-white font-bold text-xs uppercase rounded hover:bg-emerald-700 disabled:opacity-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {assignAttendeesMutation.isPending ? "Assigning..." : "Assign to Checked-In"}
              </button>
            </div>

            {request.error_information && (
              <div className="p-3 bg-rose-50 border-2 border-rose-200 text-rose-800 text-xs rounded-lg">
                <strong>Error:</strong> {request.error_information}
              </div>
            )}

            <div className="text-[10px] text-gray-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Resources will be automatically terminated after the event ends to prevent runaway
              billing.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs bg-white font-sans"
                >
                  <option value="aws_ec2">AWS EC2 (Linux)</option>
                  <option value="aws_workspaces">AWS WorkSpaces</option>
                  <option value="gcp_compute" disabled>
                    GCP Compute (Coming Soon)
                  </option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Resource Type</label>
                <select
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs bg-white font-sans"
                >
                  <option value="t3.micro">t3.micro (2 vCPU, 1GB RAM)</option>
                  <option value="t3.medium">t3.medium (2 vCPU, 4GB RAM)</option>
                </select>
              </div>
              <div>
                <label htmlFor="hw-quantity" className="text-xs font-bold uppercase block mb-1">
                  Quantity
                </label>
                <input
                  id="hw-quantity"
                  type="number"
                  min={1}
                  max={100}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs bg-white font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => provisionMutation.mutate()}
                disabled={isProvisioning || quantity < 1 || quantity > 100}
                className="px-4 py-2 border-2 border-black bg-indigo-600 text-white font-bold text-xs uppercase rounded-md hover:bg-indigo-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 flex items-center gap-1.5"
              >
                <Zap className="w-4 h-4" />
                {isProvisioning ? "Provisioning..." : `Provision ${quantity} VMs`}
              </button>
            </div>

            {request?.status === "terminated" && (
              <div className="text-[10px] text-gray-500 mt-2 border-t pt-2">
                Previous provisioning session ended ({new Date(request.updated_at).toLocaleString()}
                ).
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
