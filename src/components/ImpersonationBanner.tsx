import { useCallback, useEffect, useState } from "react";

interface ImpersonatedUser {
  id: string;
  name: string | null;
  role: string;
}

export default function ImpersonationBanner() {
  const [user, setUser] = useState<ImpersonatedUser | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("impersonation_token");
    const storedUser = sessionStorage.getItem("impersonated_user");

    if (!token || !storedUser) return;

    try {
      setUser(JSON.parse(storedUser) as ImpersonatedUser);
    } catch {
      sessionStorage.removeItem("impersonation_token");
      sessionStorage.removeItem("impersonated_user");
    }
  }, []);

  const endImpersonation = useCallback(() => {
    sessionStorage.removeItem("impersonation_token");
    sessionStorage.removeItem("impersonated_user");
    window.location.reload();
  }, []);

  if (!user) return null;

  return (
    <div className="sticky top-0 z-[9999] w-full bg-red-600 px-4 py-4 text-center text-xl font-extrabold uppercase text-white shadow-lg">
      Impersonating Student {user.name || user.id}.
      <button
        type="button"
        onClick={endImpersonation}
        className="ml-4 border-2 border-white px-4 py-2 font-bold underline hover:bg-white hover:text-red-600"
      >
        End Impersonation
      </button>
    </div>
  );
}