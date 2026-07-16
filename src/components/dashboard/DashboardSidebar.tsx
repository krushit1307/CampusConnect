import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "@tanstack/react-router";

const navItems = [
  { title: "Dashboard", to: "/dashboard" },
  { title: "Events", to: "/events" },
  { title: "Clubs", to: "/clubs" },
  { title: "Feed", to: "/feed" },
  { title: "Certificates", to: "/certificates" },
  { title: "Settings", to: "/settings" },
];

export function DashboardSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <h2 className="px-2 py-2 text-lg font-bold">Dashboard</h2>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>

          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild isActive={location.pathname === item.to}>
                  <Link to={item.to}>{item.title}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}