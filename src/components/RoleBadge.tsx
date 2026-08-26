import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { roleTitleForLevel } from "@/lib/clubPermissions";

const variantMap: Record<string, string> = {
  admin: "bg-peach border-black text-black",
  organizer: "bg-lavender border-black text-black",
  member: "bg-sky border-black text-black",
  alumni: "bg-lime border-black text-black",
  Treasurer: "bg-yellow-200 border-black text-black",
  Secretary: "bg-brand-violet-base text-black border-black",
};

const labelMap: Record<string, string> = {
  admin: "Admin",
  organizer: "Organizer",
  member: "Member",
  alumni: "Alumni",
};

// Short, plain-language explanation of what each role can actually do.
// Shown in the hover tooltip so people don't have to guess what a badge means.
const descriptionMap: Record<string, string> = {
  admin: "Full edits — can manage members, events, and club settings.",
  organizer: "Event manager — can create and edit events for this club.",
  member: "Read-only — can view club info, members, and events.",
  alumni: "Read-only — former active member of this club.",
};

export function RoleBadge({
  role,
  permissionsLevel,
}: {
  role?: string;
  permissionsLevel?: number;
}) {
  const label = role ? (labelMap[role] ?? role) : roleTitleForLevel(permissionsLevel ?? 10);
  const styles = variantMap[role ?? ""] ?? "bg-sky border-black text-black";
  const description =
    descriptionMap[role ?? ""] ??
    `Holds ${permissionsLevel ?? 10} authority level — see role permissions for capabilities.`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={`inline-block cursor-default border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-none ${styles}`}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="neu-border max-w-[200px] rounded-none border-2 border-black bg-cream px-2 py-1.5 font-mono text-xs font-normal normal-case text-black shadow-none"
        >
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
