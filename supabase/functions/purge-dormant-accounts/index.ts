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

      // Soft delete profile instead of deleting Auth user
      await supabase
        .from("profiles")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", user.id);

      // Ban the Auth user to prevent future logins
      await supabase.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
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
