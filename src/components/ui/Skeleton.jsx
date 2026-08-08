export default function Skeleton({ className = "", ...props }) {
  return (
    <>
      <div className={`relative overflow-hidden bg-gray-200 rounded-md ${className}`} {...props}>
        {/* The shimmering gradient layer */}
        <div
          className="absolute inset-0 top-0 left-0 h-full w-full"
          style={{
            backgroundImage:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
            animation: "skeleton-shimmer 1.5s infinite",
          }}
        />
      </div>

      {/* Global keyframe injection for the sweep effect */}
      <style>{`
        @keyframes skeleton-shimmer {
          0% {
            transform: translateX(-150%);
          }
          100% {
            transform: translateX(150%);
          }
        }
      `}</style>
    </>
  );
}
