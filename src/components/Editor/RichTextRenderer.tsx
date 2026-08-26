import type { ReactNode } from "react";
import type { RichTextDocument, RichTextNode, RichTextText } from "@/lib/richText/types";

function leaf(value: RichTextText, key: string): ReactNode {
  let out: ReactNode = value.text;
  if (value.code) out = <code key={key}>{out}</code>;
  if (value.bold) out = <strong key={key}>{out}</strong>;
  if (value.italic) out = <em key={key}>{out}</em>;
  if (value.underline) out = <u key={key}>{out}</u>;
  if (value.strike) out = <s key={key}>{out}</s>;
  if (value.link)
    out = (
      <a key={key} href={value.link} target="_blank" rel="noreferrer noopener">
        {out}
      </a>
    );
  return out;
}

function node(value: RichTextNode, key: string): ReactNode {
  switch (value.type) {
    case "paragraph":
      return <p key={key}>{value.children.map((x, i) => leaf(x, `${key}-${i}`))}</p>;
    case "heading": {
      const Tag = `h${value.level}` as keyof JSX.IntrinsicElements;
      return <Tag key={key}>{value.children.map((x, i) => leaf(x, `${key}-${i}`))}</Tag>;
    }
    case "blockquote":
      return (
        <blockquote key={key}>{value.children.map((x, i) => node(x, `${key}-${i}`))}</blockquote>
      );
    case "bullet_list":
      return <ul key={key}>{value.children.map((x, i) => node(x, `${key}-${i}`))}</ul>;
    case "ordered_list":
      return <ol key={key}>{value.children.map((x, i) => node(x, `${key}-${i}`))}</ol>;
    case "list_item":
      return <li key={key}>{value.children.map((x, i) => node(x, `${key}-${i}`))}</li>;
    case "code_block":
      return (
        <pre key={key}>
          <code>{value.children.map((x) => x.text).join("")}</code>
        </pre>
      );
    case "image":
      return (
        <img key={key} src={value.url} alt={value.alt ?? ""} title={value.title} loading="lazy" />
      );
    case "hard_break":
      return <br key={key} />;
    case "club_mention":
      return (
        <span key={key} className="font-medium">
          @{value.name}
        </span>
      );
    case "event_card":
      return (
        <a
          key={key}
          href={value.url ?? `/events/${value.eventId}`}
          className="block rounded-lg border p-3"
        >
          {value.title}
        </a>
      );
    case "user_mention":
      return (
        <span key={key} className="font-medium">
          @{value.label}
        </span>
      );
  }
}

export function RichTextRenderer({ value }: { value: RichTextDocument }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {value.map((x, i) => node(x, String(i)))}
    </div>
  );
}
