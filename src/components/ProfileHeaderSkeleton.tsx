/**
 * Skeleton loader displayed during auth hydration to prevent
 * the flash of "Login/Signup" buttons before the user session is validated.
 */
export function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3">
      {/* Pulsating circle for Avatar */}
      <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
      {/* Pulsating rectangle for Username/Chevron */}
      <div className="hidden h-4 w-20 animate-pulse rounded bg-muted md:block" />
    </div>
  );
}