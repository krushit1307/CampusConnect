import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { Calendar, Users, Rss, LayoutDashboard, MessageSquare, Award } from "lucide-react";

const links = [
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/clubs", label: "Clubs", icon: Users },
  { to: "/feed", label: "Feed", icon: Rss },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/certificates", label: "Certificates", icon: Award },
] as const;

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden"
      aria-label="Mobile navigation"
    >
      <ul className="flex items-center justify-around h-16">
        {links.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
