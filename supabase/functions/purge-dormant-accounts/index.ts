import { createClient } from "npm:@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async () => {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 5);

  const { data: users, error } = await supabase.auth.admin.listUsers();

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  for (const user of users.users) {
    if (!user.last_sign_in_at) continue;

    const lastSignIn = new Date(user.last_sign_in_at);

    if (lastSignIn >= cutoff) continue;

    try {
      // Remove avatar (example path)
      const avatarPath = `avatars/${user.id}.png`;

      await supabase.storage.from("avatars").remove([avatarPath]);

      // Delete Auth user (cascades where configured)
      await supabase.auth.admin.deleteUser(user.id);
    } catch (e) {
      console.error(`Failed to purge ${user.id}`, e);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
});
