import React, { useMemo, useState } from "react";
import { VirtualList } from "../components/ui/VirtualList";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  major: string;
  interests: string[];
}

export default function Directory() {
  const users = useMemo<UserProfile[]>(() => {
    const roles = ["Student", "Professor", "Researcher", "Alumni", "Staff"];
    const depts = ["Computer Science", "Engineering", "Business", "Biology", "Arts"];
    const majors = [
      "Computer Science",
      "Mechanical Engineering",
      "Finance",
      "Genetics",
      "Graphic Design",
    ];
    const allInterests = [
      "Coding",
      "Robotics",
      "Reading",
      "Sports",
      "Music",
      "Art",
      "Gaming",
      "Writing",
    ];

    return Array.from({ length: 100000 }, (_, i) => {
      const userInterests = [
        allInterests[i % allInterests.length],
        allInterests[(i + 3) % allInterests.length],
      ];
      return {
        id: i + 1,
        name: `User #${i + 1}`,
        email: `user${i + 1}@university.edu`,
        role: roles[i % roles.length],
        department: depts[i % depts.length],
        major: majors[i % majors.length],
        interests: userInterests,
      };
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.major.toLowerCase().includes(query) ||
        user.interests.some((interest) => interest.toLowerCase().includes(query)),
    );
  }, [searchQuery, users]);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">University User Directory</h1>
      <p className="text-muted-foreground mb-4">
        Rendering {filteredUsers.length.toLocaleString()} users efficiently using custom windowed
        virtualization.
      </p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name, major, or interests..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 py-6 text-lg w-full bg-background neu-border"
        />
      </div>

      <div className="border rounded-lg shadow-sm bg-card overflow-hidden">
        <VirtualList
          items={filteredUsers}
          height={600}
          itemHeight={88}
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
                  <div className="text-xs text-muted-foreground mt-1 font-medium">{user.major}</div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="inline-block px-2 py-1 text-[10px] uppercase tracking-wider rounded bg-secondary text-secondary-foreground font-medium mb-1">
                  {user.role}
                </span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {user.interests.map((interest, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-1.5 py-0.5 rounded-full border border-primary/20 text-primary/70"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
