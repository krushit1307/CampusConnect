import type { User } from "@supabase/supabase-js";
interface UserDropdownProps {
  user: User;
  onSignOut: () => void;
}
export declare function UserDropdown({
  user,
  onSignOut,
}: UserDropdownProps): import("react").JSX.Element;
export {};
