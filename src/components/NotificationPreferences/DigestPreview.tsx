import { useState, useMemo } from "react";
import type { DigestConfig } from "@/hooks/useNotificationPreferences";

interface DigestPreviewProps {
  digest: DigestConfig;
}

const MOCK_EVENTS = [
  {
    title: "AI Workshop: Building Your First Agent",
    club: "Tech Club",
    date: "Sep 5, 2026",
    attendees: 42,
  },
  { title: "Fall Career Fair", club: "Career Services", date: "Sep 8, 2026", attendees: 200 },
  { title: "Photography Walk", club: "Creative Arts Society", date: "Sep 10, 2026", attendees: 18 },
];

const MOCK_CLUB_ACTIVITY = [
  { club: "IEEE Student Branch", action: "3 new posts", lastActive: "2 hours ago" },
  { club: "Debate Society", action: "Event created", lastActive: "5 hours ago" },
  { club: "Volunteer Corps", action: "12 new members", lastActive: "1 day ago" },
];

const MOCK_POPULAR_POSTS = [
  { title: "Best study spots on campus?", author: "Alex K.", likes: 24, comments: 12 },
  { title: "Free pizza at the CS lab today!", author: "Priya S.", likes: 18, comments: 8 },
];

const MOCK_DEADLINES = [
  { title: "Club Registration Renewal", due: "Sep 15, 2026", urgent: true },
  { title: "Hackathon Team Formation", due: "Sep 20, 2026", urgent: false },
];

function SectionBlock({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
        <h4 className="font-mono text-xs font-bold uppercase text-gray-700">{title}</h4>
        <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

export function DigestPreview({ digest }: DigestPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  const previewSections = useMemo(() => {
    const sections: { key: string; title: string; show: boolean; count: number }[] = [
      {
        key: "events",
        title: "Upcoming Events",
        show: digest.include_events,
        count: MOCK_EVENTS.length,
      },
      {
        key: "clubs",
        title: "Club Activity",
        show: digest.include_club_activity,
        count: MOCK_CLUB_ACTIVITY.length,
      },
      {
        key: "posts",
        title: "Popular Posts",
        show: digest.include_popular_posts,
        count: MOCK_POPULAR_POSTS.length,
      },
      {
        key: "deadlines",
        title: "Upcoming Deadlines",
        show: digest.include_upcoming_deadlines,
        count: MOCK_DEADLINES.length,
      },
    ];
    return sections.filter((s) => s.show);
  }, [digest]);

  const totalItems = previewSections.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="neu-border bg-white shadow-[2px_2px_0_0_#000] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky to-blue-100 px-5 py-4 border-b-2 border-black">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">
              Preview
            </h4>
            <h3 className="font-display text-lg font-black text-black">
              CampusConnect Weekly Digest
            </h3>
            <p className="font-mono text-xs text-gray-600 mt-0.5">
              {totalItems} items · {digest.frequency} · {digest.time}
            </p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="neu-border bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase hover:bg-cream transition-colors"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className={`divide-y divide-gray-100 ${!expanded ? "max-h-[280px] overflow-hidden relative" : ""}`}
      >
        {previewSections.map((section) => (
          <div key={section.key} className="p-4">
            <h4 className="font-mono text-[10px] font-bold uppercase text-gray-500 mb-2">
              {section.title}
            </h4>

            {section.key === "events" && (
              <SectionBlock title="Events" count={MOCK_EVENTS.length}>
                {MOCK_EVENTS.map((e, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-sm">{e.title}</p>
                      <p className="font-mono text-[10px] text-gray-500">
                        {e.club} · {e.date}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-gray-400">
                      {e.attendees} attending
                    </span>
                  </div>
                ))}
              </SectionBlock>
            )}

            {section.key === "clubs" && (
              <SectionBlock title="Clubs" count={MOCK_CLUB_ACTIVITY.length}>
                {MOCK_CLUB_ACTIVITY.map((c, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-sm">{c.club}</p>
                      <p className="font-mono text-[10px] text-gray-500">{c.action}</p>
                    </div>
                    <span className="font-mono text-[10px] text-gray-400">{c.lastActive}</span>
                  </div>
                ))}
              </SectionBlock>
            )}

            {section.key === "posts" && (
              <SectionBlock title="Posts" count={MOCK_POPULAR_POSTS.length}>
                {MOCK_POPULAR_POSTS.map((p, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-sm">{p.title}</p>
                      <p className="font-mono text-[10px] text-gray-500">by {p.author}</p>
                    </div>
                    <div className="flex gap-2 font-mono text-[10px] text-gray-400">
                      <span>♥ {p.likes}</span>
                      <span>💬 {p.comments}</span>
                    </div>
                  </div>
                ))}
              </SectionBlock>
            )}

            {section.key === "deadlines" && (
              <SectionBlock title="Deadlines" count={MOCK_DEADLINES.length}>
                {MOCK_DEADLINES.map((d, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-sm">{d.title}</p>
                      <p className="font-mono text-[10px] text-gray-500">Due {d.due}</p>
                    </div>
                    {d.urgent && (
                      <span className="bg-red-100 text-red-700 font-mono text-[10px] font-bold px-2 py-0.5 uppercase">
                        Urgent
                      </span>
                    )}
                  </div>
                ))}
              </SectionBlock>
            )}
          </div>
        ))}
      </div>

      {!expanded && previewSections.length > 2 && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
      )}
    </div>
  );
}
