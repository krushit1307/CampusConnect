import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";

export function SessionExpiryModal() {
  const { showModal, isRefreshing, refreshSession, handleLogout } = useSessionExpiry();

  // Using open={showModal} makes this a controlled component
  return (
    <AlertDialog open={showModal}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session Expiring Soon</AlertDialogTitle>
          <AlertDialogDescription>Your session will expire in 2 minutes.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLogout} disabled={isRefreshing}>
            Logout
          </AlertDialogCancel>
          <AlertDialogAction onClick={refreshSession} disabled={isRefreshing}>
            {isRefreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
