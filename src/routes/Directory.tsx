import React, { useMemo } from "react";
import { VirtualList } from "../components/ui/VirtualList";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
}

export default function Directory() {
  const users = useMemo<UserProfile[]>(() => {
    const roles = ["Student", "Professor", "Researcher", "Alumni", "Staff"];
    const depts = ["Computer Science", "Engineering", "Business", "Biology", "Arts"];

    return Array.from({ length: 100000 }, (_, i) => ({
      id: i + 1,
      name: `User #${i + 1}`,
      email: `user${i + 1}@university.edu`,
      role: roles[i % roles.length],
      department: depts[i % depts.length],
    }));
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">University User Directory</h1>
      <p className="text-muted-foreground mb-4">
        Rendering {users.length.toLocaleString()} users efficiently using custom windowed
        virtualization.
      </p>

      <div className="border rounded-lg shadow-sm bg-card overflow-hidden">
        <VirtualList
          items={users}
          height={600}
          itemHeight={64}
          overscan={5}
          renderItem={(user) => (
            <div className="flex items-center justify-between p-4 border-b h-full hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-sm">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-1 text-xs rounded bg-secondary text-secondary-foreground font-medium">
                  {user.role}
                </span>
                <div className="text-xs text-muted-foreground mt-0.5">{user.department}</div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
