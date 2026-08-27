export type RichTextMark = {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  underline?: boolean;
  strike?: boolean;
  link?: string;
};

export type RichTextText = { text: string } & RichTextMark;

export type RichTextNode =
  | { type: "paragraph"; children: RichTextText[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: RichTextText[] }
  | { type: "blockquote"; children: RichTextNode[] }
  | { type: "bullet_list"; children: RichTextNode[] }
  | { type: "ordered_list"; children: RichTextNode[] }
  | { type: "list_item"; children: RichTextNode[] }
  | { type: "code_block"; language?: string; children: RichTextText[] }
  | { type: "image"; url: string; alt?: string; title?: string; children: [{ text: "" }] }
  | { type: "hard_break"; children: [{ text: "" }] }
  | {
      type: "club_mention";
      id: string;
      name: string;
      slug?: string;
      logoUrl?: string | null;
      children: [{ text: "" }];
    }
  | {
      type: "event_card";
      eventId: string;
      title: string;
      date?: string | null;
      location?: string | null;
      bannerUrl?: string | null;
      clubName?: string | null;
      url?: string | null;
      children: [{ text: "" }];
    }
  | { type: "user_mention"; id: string; label: string; children: [{ text: "" }] };

export type RichTextDocument = RichTextNode[];
