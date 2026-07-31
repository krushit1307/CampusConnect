import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import React from "react";
import { Building2 } from "lucide-react";

interface ClubMentionAttributes {
  id: string | null;
  name: string | null;
  slug: string | null;
  logoUrl?: string | null;
}

export const ClubMentionView: React.FC<NodeViewProps> = (props) => {
  const { name, slug, logoUrl } = props.node.attrs as ClubMentionAttributes;
  const clubName = name || slug || "Club";
  const clubSlug = slug || "";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (clubSlug) {
      window.location.href = `/clubs/${clubSlug}`;
    }
  };

  return (
    <NodeViewWrapper as="span" className="inline-block mx-0.5 align-baseline">
      <a
        href={clubSlug ? `/clubs/${clubSlug}` : "#"}
        onClick={handleClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer no-underline select-none"
        title={`View ${clubName} club page`}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={clubName}
            className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <Building2 className="w-3 h-3 shrink-0 text-primary" />
        )}
        <span>@{clubName}</span>
      </a>
    </NodeViewWrapper>
  );
};

export const ClubMentionNode = Node.create({
  name: "clubMention",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
      name: { default: null },
      slug: { default: null },
      logoUrl: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="club-mention"]',
        getAttrs: (element) => {
          if (typeof element === "string") return false;
          return {
            id: element.getAttribute("data-id"),
            name: element.getAttribute("data-name"),
            slug: element.getAttribute("data-slug"),
            logoUrl: element.getAttribute("data-logo-url"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        {
          "data-type": "club-mention",
          "data-id": HTMLAttributes.id,
          "data-name": HTMLAttributes.name,
          "data-slug": HTMLAttributes.slug,
          "data-logo-url": HTMLAttributes.logoUrl,
          class:
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20",
        },
        HTMLAttributes,
      ),
      `@${HTMLAttributes.name || HTMLAttributes.slug || "Club"}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ClubMentionView);
  },
});
