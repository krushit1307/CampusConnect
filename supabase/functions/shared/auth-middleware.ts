import { User } from "https://esm.sh/@supabase/supabase-js@2";
import { getSessionIdFromToken } from "./session-token.ts";
import {
  getFingerprintFromRequest,
  getIpSubnet,
  getRequestIp,
  hmacHex,
} from "./replay-detection.ts";

export async function verifyAuth(
  req: Request,
  supabase: {
    auth: {
      getUser: (token: string) => Promise<{
        data: { user: User | null };
        error: unknown;
      }>;
    };
  },
): Promise<User> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return user;
}

/**
 * Raised when the JWT is being presented from a context that differs
 * from the one that minted it — i.e. a confirmed token replay. The
 * underlying auth session has already been revoked by the time this
 * error is thrown.
 */
export class SessionReplayError extends Error {
  constructor() {
    super("Session replay detected");
    this.name = "SessionReplayError";
  }
}

/**
 * Auth check + token-replay detection.
 *
 * After the JWT is verified, the request's fingerprint and /24 IP
 * subnet are compared against the binding recorded when the session
 * was minted (see `register-device-session`). A confirmed mismatch on
 * BOTH dimensions is treated as token replay: the session is revoked
 * and a `SessionReplayError` is thrown so callers can force a global
 * logout. The check is fail-open when there is nothing to compare
 * against (pre-existing sessions, missing fingerprint/subnet data).
 */
export async function verifyAuthWithReplayDetection(
  req: Request,
  supabase: {
    auth: {
      getUser: (token: string) => Promise<{
        data: { user: User | null };
        error: unknown;
      }>;
    };
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  },
): Promise<User> {
  const user = await verifyAuth(req, supabase);
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const sessionId = getSessionIdFromToken(token);
  const bindingSecret = Deno.env.get("REPLAY_BINDING_SECRET") ?? "";

  // No way to correlate the token to a session binding -> fail open.
  if (!sessionId || bindingSecret.length < 16) {
    return user;
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fingerprint = getFingerprintFromRequest(req, body);
  const ipAddress = getRequestIp(req);

  if (!fingerprint || !ipAddress) {
    return user;
  }

  const [fingerprintHash, ipSubnetHash] = await Promise.all([
    hmacHex(fingerprint, bindingSecret),
    hmacHex(getIpSubnet(ipAddress) ?? ipAddress, bindingSecret),
  ]);

  if (!fingerprintHash || !ipSubnetHash) {
    return user;
  }

  const { data: verdict, error } = await supabase.rpc("detect_session_replay", {
    p_auth_session_id: sessionId,
    p_fingerprint_hash: fingerprintHash,
    p_ip_subnet_hash: ipSubnetHash,
  });

  if (error) {
    // Fail open: a broken detector must never lock users out.
    return user;
  }

  if (verdict === "replay") {
    throw new SessionReplayError();
  }

  return user;
}
