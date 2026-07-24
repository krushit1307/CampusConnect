import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ShortcutsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const shortcuts = [
  {
    action: "Search",
    shortcut: "/",
  },
  {
    action: "Close modals",
    shortcut: "Esc",
  },
  {
    action: "Open keyboard shortcuts",
    shortcut: "?",
  },
];

export default function ShortcutsModal({ open, onOpenChange }: ShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-4 border-black">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Available shortcuts in CampusConnect</DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-3">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.action}
              className="flex items-center justify-between rounded-md border-2 border-black p-3"
            >
              <span className="font-medium">{shortcut.action}</span>

              <div className="min-w-[60px] rounded border-2 border-black bg-white px-3 py-1 text-center font-mono font-bold text-black shadow-[2px_2px_0px_black]">
                {shortcut.shortcut}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
