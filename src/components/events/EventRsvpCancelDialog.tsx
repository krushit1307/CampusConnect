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
import CalendarX2 from "lucide-react/dist/esm/icons/calendar-x-2";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";

interface EventRsvpCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  eventTitle?: string;
  isPending?: boolean;
}

export function EventRsvpCancelDialog({
  open,
  onOpenChange,
  onConfirm,
  eventTitle,
  isPending = false,
}: EventRsvpCancelDialogProps) {
  const title = eventTitle?.trim();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="neu-border max-w-md rounded-none border-4 border-black bg-cream p-0 shadow-[8px_8px_0_#111827]">
        <div className="border-b-4 border-black bg-peach px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="neu-border grid h-11 w-11 shrink-0 place-items-center bg-white">
              <ShieldAlert className="h-6 w-6 text-red-700" aria-hidden="true" />
            </span>
            <AlertDialogHeader className="space-y-1 text-left">
              <p className="eyebrow font-black text-black">Confirm cancellation</p>
              <AlertDialogTitle className="font-display text-2xl font-black text-black">
                Are you sure you want to cancel your RSVP?
              </AlertDialogTitle>
            </AlertDialogHeader>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          <AlertDialogDescription className="font-mono text-sm leading-6 text-black">
            {title ? (
              <>
                You are about to leave <span className="font-black">{title}</span>. Your spot may
                become available to someone else.
              </>
            ) : (
              "You are about to leave this event. Your spot may become available to someone else."
            )}
          </AlertDialogDescription>

          <div className="neu-border flex items-start gap-3 bg-white p-3">
            <CalendarX2 className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
            <p className="font-mono text-xs leading-5 text-black">
              This action only cancels your RSVP after you confirm. Closing this dialog keeps your
              registration unchanged.
            </p>
          </div>

          <AlertDialogFooter className="gap-3 sm:space-x-0">
            <AlertDialogCancel
              disabled={isPending}
              className="neu-border neu-press mt-0 rounded-none border-2 border-black bg-white px-4 py-2 font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-lime"
            >
              Keep RSVP
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={onConfirm}
              className="neu-border neu-press rounded-none border-2 border-black bg-red-600 px-4 py-2 font-mono text-xs font-black uppercase tracking-wider text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Cancelling..." : "Yes, cancel RSVP"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
