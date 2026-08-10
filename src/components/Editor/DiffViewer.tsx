import { diffWordsWithSpace } from "diff";
import { cn } from "../../lib/utils";

interface DiffViewerProps {
  oldText: string;
  newText: string;
  className?: string;
}

export default function DiffViewer({ oldText, newText, className }: DiffViewerProps) {
  const diffs = diffWordsWithSpace(oldText || "", newText || "");

  return (
    <div
      className={cn(
        "rounded-md border-2 border-black bg-white p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap dark:bg-zinc-900 dark:border-cream dark:text-cream",
        className,
      )}
    >
      {diffs.map((part, index) => {
        if (part.added) {
          return (
            <span
              key={index}
              className="bg-green-200 text-green-900 dark:bg-green-900/50 dark:text-green-100 font-medium px-1 mx-0.5 rounded-sm"
            >
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span
              key={index}
              className="bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-100 line-through font-medium px-1 mx-0.5 rounded-sm opacity-80"
            >
              {part.value}
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );
}
