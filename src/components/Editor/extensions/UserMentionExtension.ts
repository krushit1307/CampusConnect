import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { MentionDropdown } from "../MentionDropdown";
import { createClient } from "@/lib/supabase/client";

export const UserMentionExtension = Mention.extend({
  name: "mention",
}).configure({
  HTMLAttributes: {
    class: "text-primary bg-primary/10 rounded px-1 py-0.5 font-medium",
  },
  suggestion: {
    items: async ({ query }: { query: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, handle, avatar_url")
        .ilike("handle", `%${query}%`)
        .limit(5);

      if (error) {
        console.error("Error fetching mentions:", error);
        return [];
      }

      return data || [];
    },
    render: () => {
      let reactRenderer: ReactRenderer;
      let popup: TippyInstance[];

      return {
        onStart: (props: any) => {
          if (!props.clientRect) {
            return;
          }

          reactRenderer = new ReactRenderer(MentionDropdown, {
            props,
            editor: props.editor,
          });

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: reactRenderer.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },
        onUpdate(props: any) {
          reactRenderer.updateProps(props);

          if (!props.clientRect) {
            return;
          }

          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        },
        onKeyDown(props: any) {
          if (props.event.key === "Escape") {
            popup[0].hide();
            return true;
          }

          return (reactRenderer.ref as any)?.onKeyDown(props);
        },
        onExit() {
          popup[0].destroy();
          reactRenderer.destroy();
        },
      };
    },
  },
});
