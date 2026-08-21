import { UserProfile } from "./types";

interface UserCardProps {
  user: UserProfile;
}

export function UserCard({ user }: UserCardProps) {
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center justify-between p-4 border-b h-full hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
          {initials}
        </div>
        <div>
          <div className="font-semibold text-sm">{user.name}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
          <div className="text-xs text-muted-foreground mt-1 font-medium">{user.major}</div>
        </div>
      </div>
      <div className="text-right flex flex-col items-end">
        <span className="inline-block px-2 py-1 text-[10px] uppercase tracking-wider rounded bg-secondary text-secondary-foreground font-medium mb-1">
          {user.role}
        </span>
        <div className="flex gap-1 flex-wrap justify-end">
          {user.interests.map((interest) => (
            <span
              key={`${user.id}-${interest}`}
              className="text-[10px] px-1.5 py-0.5 rounded-full border border-primary/20 text-primary/70"
            >
              {interest}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
