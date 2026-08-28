import re

with open("src/components/events/EventRsvpButton.tsx", "r") as f:
    content = f.read()

# 1. State
state_str = """
  const [hideDietary, setHideDietary] = useState(false);
"""
content = re.sub(
    r'(const \[isAnonymous, setIsAnonymous\] = useState\(false\);)',
    r'\1\n' + state_str,
    content
)

# 2. Logic in executeJoin
logic_str = """
    // If they want to hide dietary restrictions, update the RSVP record immediately after joining
    if (result.success && hideDietary) {
      await supabase
        .from("event_rsvps")
        .update({ dietary_restrictions: [] })
        .eq("event_id", eventId)
        .eq("user_id", userId);
    }
"""
content = re.sub(
    r'(const result = await joinEventOrWaitlist.*?;\n    setLoading\(false\);)',
    r'\1' + logic_str,
    content
)

# 3. Import supabase
import_str = """
import { createClient } from "@/lib/supabase/client";
"""
content = re.sub(
    r'(import React, \{ useState, useEffect \} from "react";)',
    r'\1\n' + import_str,
    content
)

# Create supabase instance
supabase_instance = """
  const supabase = createClient();
"""
content = re.sub(
    r'(const \[loading, setLoading\] = useState\(false\);)',
    supabase_instance + r'\1',
    content
)

# 4. UI for checkbox
ui_str = """
        <div className="flex items-start space-x-2 my-2 p-3 border rounded-md bg-slate-50 dark:bg-slate-900">
          <Checkbox
            id="hide-dietary"
            checked={hideDietary}
            onCheckedChange={(checked) => setHideDietary(checked as boolean)}
          />
          <div className="grid gap-1.5 leading-none mt-0.5">
            <Label htmlFor="hide-dietary" className="font-semibold cursor-pointer">
              Hide my dietary & accessibility needs for this event
            </Label>
            <p className="text-xs text-slate-500">
              Your global dietary preferences will not be shared with the organizer for this specific event.
            </p>
          </div>
        </div>
"""
content = re.sub(
    r'(<div className="grid gap-1.5 leading-none mt-0.5">[\s\S]*?</Label>[\s\S]*?</p>\s*</div>\s*</div>)',
    r'\1\n' + ui_str,
    content
)

with open("src/components/events/EventRsvpButton.tsx", "w") as f:
    f.write(content)
