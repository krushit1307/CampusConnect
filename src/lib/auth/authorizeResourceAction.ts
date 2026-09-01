import { createServer } from "@/lib/supabase/server";

export type ProtectedResource =
  | "club"
  | "event";

export type ProtectedOperation =
  | "update_club"
  | "delete_club"
  | "manage_members"
  | "manage_roles"
  | "create_event"
  | "update_event"
  | "delete_event"
  | "cancel_event"
  | "check_in"
  | "refund_event"
  | "manage_event_resources";

export async function authorizeResourceAction(
  resourceType: ProtectedResource,
  resourceId: string,
  operation: ProtectedOperation,
) {
  const supabase = createServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      authorized: false,
      status: 401,
      error: "Authentication required.",
    };
  }

  const { data: authorized, error } = await supabase.rpc(
    "authorize_resource_action",
    {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_operation: operation,
      p_user_id: user.id,
    },
  );

  if (error) {
    console.error("Authorization policy error:", error);

    return {
      authorized: false,
      status: 500,
      error: "Unable to verify authorization.",
    };
  }

  if (!authorized) {
    return {
      authorized: false,
      status: 403,
      error: "You are not authorized to perform this operation.",
    };
  }

  return {
    authorized: true,
    status: 200,
    userId: user.id,
  };
}