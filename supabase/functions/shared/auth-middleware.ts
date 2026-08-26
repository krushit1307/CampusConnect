import { User } from "https://esm.sh/@supabase/supabase-js@2";

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
