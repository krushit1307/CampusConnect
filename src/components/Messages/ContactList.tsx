import Search from "lucide-react/dist/esm/icons/search";
import { useChatStore } from "@/store/useChatStore";

export default function ContactList() {
  const searchQuery = useChatStore((s) => s.searchQuery);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);
  const filteredProfiles = useChatStore((s) => s.filteredProfiles);
  const loadingProfiles = useChatStore((s) => s.loadingProfiles);
  const activeRecipient = useChatStore((s) => s.activeRecipient);
  const setActiveRecipient = useChatStore((s) => s.setActiveRecipient);

  return (
    <div className="flex flex-col border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-black dark:border-cream md:col-span-4">
      <div className="border-b-2 border-black p-3 dark:border-cream bg-[#f3f4f6] dark:bg-zinc-900">
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border-2 border-black bg-white py-1.5 pl-9 pr-3 font-mono text-xs focus:outline-none dark:bg-zinc-800 dark:border-cream dark:text-cream"
          />
        </div>
      </div>

      <div className="h-[550px] overflow-y-auto p-2">
        {loadingProfiles ? (
          <div className="py-8 text-center font-mono text-xs">Loading students...</div>
        ) : filteredProfiles.length === 0 ? (
          <div className="py-8 text-center font-mono text-xs text-gray-500">No students found.</div>
        ) : (
          <div className="space-y-1.5">
            {filteredProfiles.map((profile) => {
              const isActive = activeRecipient?.id === profile.id;
              const initials =
                profile.full_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "U";

              return (
                <button
                  key={profile.id}
                  onClick={() => setActiveRecipient(profile)}
                  className={`w-full border-2 border-black p-3 text-left transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none flex items-center gap-3 ${
                    isActive
                      ? "bg-lime text-black shadow-none translate-x-0.5 translate-y-0.5"
                      : "bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-800 dark:text-cream dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.15)] dark:border-cream"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-yellow-300 font-display text-sm font-bold text-black uppercase">
                    {initials}
                  </div>
                  <div className="overflow-hidden">
                    <div className="truncate font-display text-sm font-bold uppercase leading-none">
                      {profile.full_name || "Anonymous Student"}
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px] uppercase opacity-75">
                      {profile.college || "No College Listed"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
