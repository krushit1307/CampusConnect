let csrfToken: string | null = null;

export async function initializeCsrf() {
  if (csrfToken) return csrfToken;

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/csrf-token`, {
    credentials: "include",
  });

  const json = await res.json();

  csrfToken = json.token;

  return csrfToken;
}

export function getCsrfToken() {
  return csrfToken;
}
