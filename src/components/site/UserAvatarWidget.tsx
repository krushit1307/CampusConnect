import { getPresenceBadgeClass, usePresence } from "@/hooks/usePresence";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Isolated UserAvatarWidget micro-component (#1753).
 * Encapsulates supabase auth state, user profile metadata, and real-time presence subscriptions.
 * Prevents local avatar/status updates from triggering parent Navbar re-renders.
 */
export const UserAvatarWidget = memo(function UserAvatarWidget() {
  const navigate = useNavigate();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { onlineUsers } = usePresence(user?.id);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user?.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser?.user_metadata?.avatar_url) {
        setAvatarUrl(currentUser.user_metadata.avatar_url);
      } else {
        setAvatarUrl(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out failed:", error.message);
      return;
    }
    navigate("/", { replace: true });
  };

  if (!user) {
    return (
      <Link
        to="/auth"
        id="nav-signin-button"
        className="neu-border neu-press bg-black px-3 py-1.5 font-mono text-xs font-bold uppercase text-cream hover:bg-cream hover:text-black dark:bg-cream dark:text-black dark:hover:bg-black dark:hover:text-cream"
        style={{ letterSpacing: "0.08em" }}
      >
        Sign in
      </Link>
    );
  }

  const initial = user.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <div className="hidden rounded-full border border-black bg-lime px-2 py-1 text-xs font-mono font-bold md:flex dark:border-cream dark:text-black">
        🟢 {onlineUsers} online
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="User menu"
            className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-black bg-lime font-mono text-xs font-bold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:focus-visible:ring-cream"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="User avatar"
                onLoad={() => setIsLoaded(true)}
                className={`h-full w-full object-cover transition-opacity duration-200 ${
                  isLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            ) : (
              <span>{initial}</span>
            )}
            {avatarUrl && !isLoaded && (
              <span className="absolute inset-0 flex items-center justify-center bg-lime text-black">
                {initial}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="break-all text-xs">{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link to="/dashboard">Dashboard</Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link to="/messages">Messages</Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link to="/settings">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
