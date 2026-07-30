<div
  ref={index === directoryClubs.length - 1 ? lastClubRef : null}
  key={`${viewMode}-${c.slug}`}
  className="animate-fade-in-up break-inside-avoid mb-6"
  style={{ animationDelay: `${index * 75}ms` }}
>
  <HoverLink
    to={`/clubs/${c.slug}`}
    prefetch={() => prefetchClubProfile(c.slug)}
    className="neu-border group flex flex-col bg-white p-6 shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-300 ease-in-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0_0_var(--color-ink)]"
  >
    <div
      className={`club-logo-badge neu-border ${colors[index % colors.length]} mb-4 inline-block w-fit px-3 py-1 font-mono text-xs font-bold uppercase`}
    >
      Club
    </div>

    <h2 className="text-2xl font-bold">{c.name}</h2>

    <p className="my-3 font-mono text-xs text-gray-600">
      {c.description || "No description provided."}
    </p>

    <div className="mt-auto pt-3">
      <div className="my-3 border-t-2 border-black" />
      <div className="flex items-center justify-between font-mono text-xs">
        <span>
          {Array.isArray(c.club_stats)
            ? `${c.club_stats[0]?.total_members ?? 0} Members`
            : `${(c.club_stats as { total_members?: number } | null)?.total_members ?? 0} Members`}
        </span>

        <span className="font-bold uppercase flex items-center gap-1">
          View Profile{" "}
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </div>
    </div>
  </HoverLink>
</div>;
