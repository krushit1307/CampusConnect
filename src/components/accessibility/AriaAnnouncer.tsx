import { useAriaAnnouncer } from "@/store/ariaAnnouncer";

export default function AriaAnnouncer() {
  const message = useAriaAnnouncer((state) => state.message);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      role="status"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        margin: -1,
        padding: 0,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {message}
    </div>
  );
}
