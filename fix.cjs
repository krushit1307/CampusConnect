const fs = require("fs");
const p = "src/pages/Events/EventDetail.tsx";
let txt = fs.readFileSync(p, "utf-8");

txt = txt.replace(
  'import NotFound from \"./NotFound\";',
  'import { NotFound } from \"@/components/NotFound\";',
);

const imports = [
  "import { SiteShell } from '@/components/site/SiteShell';",
  "import { PredictiveTurnout } from '@/components/events/PredictiveTurnout';",
  "import { LiveQA } from '@/components/events/LiveQA';",
  "import { useEventViewerCount } from '@/hooks/useEventViewerCount';",
];
for (let imp of imports) {
  if (!txt.includes(imp.split(" ")[2])) {
    txt = imp + "\n" + txt;
  }
}

txt = txt.replace(/\(event\.event_rsvps as unknown\[\]\)/g, "(event.event_rsvps as any[])");
txt = txt.replace(/typedEvent\.event_waitlist/g, "(typedEvent as any).event_waitlist");
txt = txt.replace(/typedEvent\.event_rsvps/g, "(typedEvent as any).event_rsvps");

// Fix event typing everywhere: replace 'event.' with '(event as any).' globally but only for the specific accesses we know are failing.
txt = txt.replace(/event\.location/g, "(event as any).location");
txt = txt.replace(/event\.end_date/g, "(event as any).end_date");
txt = txt.replace(/event\.title/g, "(event as any).title");
txt = txt.replace(/event\.id/g, "(event as any).id");
txt = txt.replace(/event\.banner_url/g, "(event as any).banner_url");
txt = txt.replace(/event\.description/g, "(event as any).description");
txt = txt.replace(/event\.event_rsvps/g, "(event as any).event_rsvps");

// The main EventDetail useQuery is huge and causes 'event' to be typed as DOM 'Event' because it's used before declaration in a useEffect.
// I will move the useQuery block using string manipulation carefully!
const queryStartStr =
  'const {\n    data: event,\n    isLoading,\n    refetch,\n  } = useQuery({\n    queryKey: [\"event\", eventId],';
const idxStart = txt.indexOf(queryStartStr);
if (idxStart !== -1) {
  let brackets = 0;
  let idxEnd = -1;
  for (let i = idxStart + queryStartStr.length; i < txt.length; i++) {
    if (txt[i] === "{") brackets++;
    else if (txt[i] === "}") {
      if (brackets === 0) {
        // Find closing parenthesis
        const endParen = txt.indexOf(");", i);
        if (endParen !== -1) {
          idxEnd = endParen + 2;
          break;
        }
      } else {
        brackets--;
      }
    }
  }

  if (idxEnd !== -1) {
    const queryBlock = txt.substring(idxStart, idxEnd);
    txt = txt.substring(0, idxStart) + txt.substring(idxEnd);

    // Find insert location
    const insertLocation = "  // Safe window URL handling for SSR / hydration safety";
    const insertIdx = txt.indexOf(insertLocation);
    if (insertIdx !== -1) {
      txt = txt.substring(0, insertIdx) + queryBlock + "\n\n" + txt.substring(insertIdx);
    }
  }
}

fs.writeFileSync(p, txt);
