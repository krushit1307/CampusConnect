import { useTagSubscription } from "@/hooks/useTagSubscription";

interface TagSubscribeButtonProps {
  tagName: string;
}

export function TagSubscribeButton({ tagName }: TagSubscribeButtonProps) {
  const { isSubscribed, isLoading, error, toggleSubscription } = useTagSubscription(tagName);
  const label = tagName.replace(/^#/, "").trim();

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggleSubscription}
        disabled={isLoading || !label}
        data-testid="tag-subscribe-button"
        className="neu-border bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubscribed ? `Subscribed to #${label}` : `🔔 Subscribe to #${label}`}
      </button>
      {error && <p className="font-mono text-[10px] font-bold text-red-700">{error}</p>}
    </div>
  );
}
