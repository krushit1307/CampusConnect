import { createHmac } from "node:crypto";
import type { Request, Response } from "express";
import { createClient } from "../src/lib/supabase/client";

function createJwt(payload: Record<string, unknown>): string {
  const secret = process.env.SUPABASE_JWT_SECRET;

  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is not configured");
  }

  const encode = (value: string) =>
    Buffer.from(value)
      .toString("base64url");

  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encode(JSON.stringify(payload));
  const unsignedToken = `${header}.${body}`;

  const signature = createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

export async function handleImpersonation(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminToken = authHeader.substring(7);
    const supabase = createClient();

    const {
      data: { user: adminUser },
      error: authError,
    } = await supabase.auth.getUser(adminToken);

    if (authError || !adminUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", adminUser.id)
      .single();

    if (adminProfileError || adminProfile?.role !== "system_admin") {
      return res.status(403).json({ error: "Forbidden: Super Admin access required" });
    }

    const { target_user_id } = req.body;

    if (!target_user_id || typeof target_user_id !== "string") {
      return res.status(400).json({ error: "target_user_id is required" });
    }

    const { data: targetUser, error: targetError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", target_user_id)
      .single();

    if (targetError || !targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    if (targetUser.role !== "student") {
      return res.status(400).json({
        error: "Only student accounts can be impersonated",
      });
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      user_id: targetUser.id,
      admin_id: adminUser.id,
      action: "IMPERSONATE",
      target_table: "profiles",
      record_id: targetUser.id,
      details: {
        admin_id: adminUser.id,
        target_user_id: targetUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    if (auditError) {
      console.error("[Impersonation] Audit log failed:", auditError);
      return res.status(500).json({
        error: "Unable to start impersonation because the audit log could not be recorded",
      });
    }

    const token = createJwt({
      id: targetUser.id,
      role: "STUDENT",
      is_impersonated: true,
      admin_id: adminUser.id,
    });

    return res.status(200).json({
      token,
      user: {
        id: targetUser.id,
        name: targetUser.full_name,
        role: targetUser.role,
      },
    });
  } catch (error) {
    console.error("[Impersonation] Failed:", error);

    return res.status(500).json({
      error: "Failed to start impersonation",
    });
  }
}