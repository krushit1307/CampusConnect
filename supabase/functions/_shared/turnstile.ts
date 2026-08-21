export async function verifyTurnstile(token: string): Promise<boolean> {
  // Try to get a specific configured secret, otherwise use Deno env, or fallback to dummy
  // 1x0000000000000000000000000000000AA is Cloudflare's standard testing secret that always passes
  const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY") || "1x0000000000000000000000000000000AA";

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("Error verifying Turnstile token:", err);
    return false;
  }
}
