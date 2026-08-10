import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type SessionTimeoutModalProps = {
  open: boolean;
  secondsLeft: number;
  onStayLoggedIn: () => void;
};

export default function SessionTimeoutModal({
  open,
  secondsLeft,
  onStayLoggedIn,
}: SessionTimeoutModalProps) {
  // Dialog showing "Your session will expire in 5 minutes. Click to stay logged in."
  // with a button that calls onStayLoggedIn
}
